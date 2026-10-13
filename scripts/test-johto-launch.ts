import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { JOHTO_INVITATION_LAUNCH_AT } from "../src/lib/johto-invitation-copy";

type Row = Record<string, any>;
function loadModule(file: string, mocks: Row): Row {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} as Row };
  runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(
    (name: string) => {
      if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
      return mocks[name];
    }, loaded, loaded.exports,
  );
  return loaded.exports;
}

const before = new Date("2026-10-13T10:59:59.999Z");
const launch = new Date("2026-10-13T11:00:00.000Z");
assert.equal(JOHTO_INVITATION_LAUNCH_AT.toISOString(), launch.toISOString());

let event: Row | null = { id: "raid-1", active: false };
let visible = false;
let startedAt: Date | null = null;
let expiresAt: Date | null = null;
let marker = false;
let pushes = 0;
const calls: string[] = [];
const database: Row = {
  appSetting: {
    findUnique: async () => marker ? { value: true } : null,
    upsert: async () => { marker = true; calls.push("mark released"); },
  },
  johtoRaidEvent: {
    updateMany: async ({ where, data }: Row) => {
      assert.equal(where.id, "raid-1");
      if (event && !event.active) { event.active = data.active; calls.push("activate"); return { count: 1 }; }
      return { count: 0 };
    },
  },
  johtoRaidLeader: { count: async () => startedAt ? 1 : 0 },
};
const launchModule = loadModule("src/lib/johto-launch.ts", {
  "@/lib/prisma": { prisma: database },
  "@/lib/johto-invitation-copy": { JOHTO_INVITATION_LAUNCH_AT },
  "@/lib/johto-invitation": {
    prepareJohtoInvitationCampaign: async ({ publish, now }: Row) => { assert.equal(publish, true); assert.ok(now >= launch); calls.push("publish invitation"); },
    runJohtoInvitationLaunch: async () => { pushes++; calls.push("push"); return { sent: 3, recipients: 3 }; },
  },
  "@/lib/johto-raid": {
    getJohtoEvent: async () => event,
    createJohtoEvent: async () => { event = { id: "raid-1", active: false }; calls.push("create raid"); return event; },
    setJohtoRaidVisible: async (value: boolean) => { visible = value; calls.push("show raid"); },
    openNextLeaderWindow: async (_eventId: string, now: Date) => {
      assert.equal(now, launch);
      if (!startedAt) { startedAt = now; expiresAt = new Date(now.getTime() + 5 * 86_400_000); calls.push("open Falkner"); }
    },
  },
});

(async () => {
assert.deepEqual(await launchModule.runJohtoLaunch(before), { launched: false, sent: 0 });
assert.deepEqual(calls, [], "before 08:00 BRT nothing is published or released");
assert.deepEqual(await launchModule.runJohtoLaunch(launch), { launched: true, sent: 3 });
assert.deepEqual(calls, ["publish invitation", "show raid", "activate", "open Falkner", "mark released", "push"], "invitation, raid and push launch in order");
assert.equal(visible, true);
assert.equal(event?.active, true);
assert.equal((startedAt as Date | null)?.toISOString(), launch.toISOString());
assert.equal((expiresAt as Date | null)?.toISOString(), "2026-10-18T11:00:00.000Z");

// Admin manually pauses and hides after launch. Later cron runs must not undo it.
visible = false;
event!.active = false;
const later = new Date("2026-10-13T11:05:00.000Z");
assert.deepEqual(await launchModule.runJohtoLaunch(later), { launched: true, sent: 3 });
assert.equal(visible, false);
assert.equal(event?.active, false);
assert.equal((startedAt as Date | null)?.toISOString(), launch.toISOString());
assert.equal(pushes, 2, "push launcher can retry but its persistent recipient markers decide delivery");

// A manually started event is released without resetting its leader deadline.
marker = false;
visible = false;
const manualStart = startedAt;
const manualExpiry = expiresAt;
calls.length = 0;
assert.deepEqual(await launchModule.runJohtoLaunch(launch), { launched: true, sent: 3 });
assert.equal(visible, true);
assert.equal(event?.active, true, "the scheduled release opens attacks without resetting an existing leader");
assert.equal(startedAt, manualStart);
assert.equal(expiresAt, manualExpiry);
assert.deepEqual(calls, ["publish invitation", "show raid", "activate", "mark released", "push"]);

// The existing weekly cron drives launch even if the league job itself is skipped.
const routeCalls: string[] = [];
const route = loadModule("src/app/api/cron/weekly-league/route.ts", {
  "next/server": { NextResponse: { json: (value: Row, options?: Row) => ({ value, status: options?.status ?? 200 }) } },
  "@/app/(app)/combates/liga-semanal/actions": { runWeeklyLeagueAutomation: async () => { routeCalls.push("weekly"); return { success: true, skipped: "weekend" }; } },
  "@/lib/johto-launch": { runJohtoLaunch: async () => { routeCalls.push("johto"); return { launched: true, sent: 0 }; } },
});
process.env.CRON_SECRET = "test-secret";
const unauthorized = await route.GET({ headers: { get: () => "Bearer wrong" } });
assert.equal(unauthorized.status, 401);
assert.deepEqual(routeCalls, []);
const authorized = await route.GET({ headers: { get: () => "Bearer test-secret" } });
assert.equal(authorized.status, 200);
assert.deepEqual(routeCalls, ["johto", "weekly"]);

// Concurrent cron requests cannot move Falkner's five-day deadline forward.
const firstLeader: Row = { id: "falkner-1", startedAt: null, expiresAt: null, defeatedAt: null, escapedAt: null };
const raidLibrary = loadModule("src/lib/johto-raid.ts", {
  "next/cache": { unstable_cache: (callback: unknown) => callback, revalidateTag: () => {} },
  "@prisma/client": {},
  "@/lib/prisma": { prisma: {
    johtoRaidEvent: { findUnique: async () => ({ leaderDays: 5 }) },
    johtoRaidLeader: {
      findMany: async () => [{ ...firstLeader }],
      updateMany: async ({ where, data }: Row) => {
        if (where.id !== firstLeader.id || firstLeader.startedAt) return { count: 0 };
        Object.assign(firstLeader, data);
        return { count: 1 };
      },
      findUnique: async () => ({ ...firstLeader }),
    },
  } },
  "@/lib/zikacoins": {}, "@/lib/league-combat": {}, "@/lib/league-ticker": {},
  "@/lib/mascot-data": {},
  "@/lib/johto-raid-sim": { JOHTO_EVENT_SLUG: "johto-test" },
});
const windows = await Promise.all([
  raidLibrary.openNextLeaderWindow("raid-1", launch),
  raidLibrary.openNextLeaderWindow("raid-1", new Date("2026-10-13T11:05:00.000Z")),
]);
assert.equal(windows.filter(Boolean).length, 1);
assert.equal(firstLeader.startedAt.toISOString(), launch.toISOString());
assert.equal(firstLeader.expiresAt.toISOString(), "2026-10-18T11:00:00.000Z");
console.log("ok lançamento Johto: corte BRT, liberação idempotente, controles manuais e cron semanal");
})().catch((error) => { console.error(error); process.exitCode = 1; });
