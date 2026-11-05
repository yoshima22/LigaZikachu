import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadTypeScript(relativePath) {
  const file = new URL("../" + relativePath, import.meta.url);
  if (!existsSync(file)) return null;
  const source = readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require, process, Buffer }, { filename: file.pathname });
  return module.exports;
}

const roomCode = loadTypeScript("src/lib/quick-room-code.ts");
const publicPolicy = loadTypeScript("src/lib/quick-room-public.ts");
const roomClient = readFileSync(new URL("../src/components/quick-room/quick-room-client.tsx", import.meta.url), "utf8");

test("normalizes formatted room codes without weakening canonical validation", () => {
  assert.equal(typeof roomCode.normalizeRoomCodeInput, "function");
  assert.equal(roomCode.normalizeRoomCodeInput("ABCD-EFGH-JK"), "abcdefghjk");
  assert.equal(roomCode.normalizeRoomCodeInput("abcd efgh jk"), "abcdefghjk");
  assert.equal(roomCode.normalizeRoomCodeInput("abcd-efgh-io"), "");
});

test("formats the existing ten-character secret only for display", () => {
  assert.equal(typeof roomCode.formatRoomCode, "function");
  assert.equal(roomCode.formatRoomCode("abcdefghjk"), "abcd-efgh-jk");
});

test("lists fresh public rooms as soon as someone joins, even before media starts", () => {
  assert.ok(publicPolicy, "public room policy module should exist");
  const now = new Date("2026-11-05T12:00:00.000Z");
  const active = { visibility: "PUBLIC", activeParticipants: 2, activeMedia: 1, publicLastSeenAt: now };
  assert.equal(publicPolicy.isPublicLiveEligible(active, now), true);
  assert.equal(publicPolicy.isPublicLiveEligible({ ...active, visibility: "UNLISTED" }, now), false);
  assert.equal(publicPolicy.isPublicLiveEligible({ ...active, activeMedia: 0 }, now), true);
});

test("shows a formatted, copyable room code alongside the share link", () => {
  assert.match(roomClient, /formatRoomCode/);
  assert.match(roomClient, /Copiar código/);
  assert.match(roomClient, /Código da sala/);
});

test("summarizes camera and screen activity without treating a muted microphone as a live source", () => {
  assert.equal(typeof publicPolicy.countActiveMedia, "function");
  assert.equal(publicPolicy.countActiveMedia([{ micOn: true, cameraOn: false, screenOn: false }]), 0);
  assert.equal(publicPolicy.countActiveMedia([{ micOn: false, cameraOn: true, screenOn: false }]), 1);
  assert.equal(publicPolicy.countActiveMedia([{ micOn: false, cameraOn: true, screenOn: true }]), 2);
});

