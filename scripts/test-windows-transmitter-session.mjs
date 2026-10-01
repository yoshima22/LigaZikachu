// Route contract tests: no production database, account, or live is used.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import crypto from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/api/spec/windows-transmitter/session/route.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(initial = "PREPARING", tickerFails = false) {
  const stream = { id: "live-1", title: "Teste do player", status: initial, broadcasterUserId: "user-1", matchId: null, tournamentId: null };
  const connection = { id: "signal-1", fromUserId: "user-1", payload: { tokenHash: createHash("sha256").update("secret").digest("hex") } };
  const notifications = [];
  const prisma = {
    specSignal: { findFirst: async () => connection, update: async ({ data }) => Object.assign(connection, data) },
    specStream: {
      findUnique: async () => ({ ...stream }),
      updateMany: async ({ where, data }) => {
        if (stream.status !== where.status) return { count: 0 };
        Object.assign(stream, data); return { count: 1 };
      },
      update: async ({ data }) => Object.assign(stream, data),
    },
    specSpectator: { deleteMany: async () => ({ count: 0 }) },
  };
  const imports = {
    crypto,
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@prisma/client": { Prisma: { JsonNull: null } },
    "@/lib/prisma": { prisma },
    "@/lib/spec/data": { enrichSpecStreams: async (rows) => rows.map(row => ({ matchLabel: row.title })) },
    "@/lib/spec/announce": { specLiveTickerMessage: ({ label, isCombat }) => `Enguiça: ${label} / combate=${isCombat}` },
    "@/lib/league-ticker": { publishLeagueTicker: async (input) => { if (tickerFails) throw Error("offline"); notifications.push(input); return true; } },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; }, Buffer, console: { error() {} } });
  const call = (action, extra = {}) => exports.POST(new Request("https://example.test/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ streamId: stream.id, token: "secret", action, ...extra }) }));
  return { call, stream, connection, notifications };
}

test("starts once, announces Professor Enguiça and saves quality without losing pairing", async () => {
  const f = fixture();
  assert.equal((await f.call("live", { resolution: "1080p", fps: "60 fps" })).status, 200);
  const startedAt = f.stream.startedAt;
  assert.equal(f.stream.status, "LIVE");
  assert.equal(f.connection.payload.fps, "60 fps");
  assert.equal(f.connection.payload.resolution, "1080p");
  assert.ok(f.connection.payload.tokenHash);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.notifications[0].eventKey, "spec-live-live-1");
  assert.equal(f.notifications[0].href, "/spec/live-1");
  assert.match(f.notifications[0].message, /Teste do player/);
  assert.equal((await f.call("live")).status, 200);
  assert.equal((await f.call("heartbeat")).status, 200);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.stream.startedAt, startedAt);
  assert.equal((await f.call("end")).status, 200);
  assert.equal(f.stream.status, "ENDED");
  assert.equal((await f.call("live")).status, 409);
});

test("parallel start requests produce one announcement", async () => {
  const f = fixture();
  const responses = await Promise.all([f.call("live"), f.call("live")]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(f.notifications.length, 1);
});

test("invalid credentials or quality do not start or announce", async () => {
  const f = fixture();
  assert.equal((await f.call("live", { token: "wrong" })).status, 401);
  for (const extra of [{ fps: "120 fps" }, { resolution: "4k" }, { fps: 60 }]) assert.equal((await f.call("live", extra)).status, 400);
  assert.equal(f.stream.status, "PREPARING");
  assert.equal(f.notifications.length, 0);
});

test("ended lives cannot be restarted", async () => {
  const f = fixture("ENDED");
  assert.equal((await f.call("live")).status, 409);
  assert.equal(f.notifications.length, 0);
});

test("ticker failure does not interrupt media startup", async () => {
  const f = fixture("PREPARING", true);
  assert.equal((await f.call("live")).status, 200);
  assert.equal(f.stream.status, "LIVE");
});
