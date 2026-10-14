# Desafio Sincronizado Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the cancelled 13/10 event, reverse only its rewards, preserve teams and nine-mascot lineups, and run the corrected 20/10 BRT schedule automatically.

**Architecture:** Add a guarded recovery service that creates a persistent audit manifest before applying a one-time reversal; it derives a fixed allowlist of reward records from the cancelled room and refuses to execute if an egg was hatched, a gift was claimed, or an account would become negative. Refactor event timing into schedule-derived selection windows so the cron opens, closes and executes each stage at the configured BRT milestones.

**Tech Stack:** Next.js 15 server actions/routes, TypeScript, Prisma/PostgreSQL, Vercel Cron, Node `tsx` maintenance scripts.

**Spec:** `docs/superpowers/specs/2026-10-13-desafio-sincronizado-recuperacao-design.md`

## Global Constraints

- Preserve every `SyncEventTeam` and `SyncEventLineup` belonging to the 13/10 cancelled event.
- Preserve the finalized `2026-08-05` event and every unrelated reward.
- Use explicit IDs stored in a recovery manifest; never reverse rewards by description text alone.
- Stop before mutating when a reward egg was hatched, a gift was claimed, or a wallet cannot cover its debit.
- All calendar values are BRT: 20/10/2026, registrations through 19:00, rounds at 20:00, 20:20 and 20:40, possible tiebreak at 21:00.
- Tiebreak selection is open from 20:41 through 20:59:59 BRT; eligible participants may reuse any of their nine locked lineup mascots, and the tiebreak executes automatically at 21:00 BRT.
- Cron work must be idempotent.

## Review Focus

- A reward record with the same description from an older event must never enter the 13/10 manifest.
- A wallet with insufficient balance must abort the recovery before any deletion or debit.
- A claimed gift or hatched egg must abort the recovery and retain all event data for review.
- The cron must not execute round 1 at 19:50 or 20:10; it must execute at/after its exact configured time.
- A late cron invocation must move through missed milestones once, without duplicate rooms, matches, rewards or reversals.

---

## File Structure

- `prisma/schema.prisma` — persistent `SyncEventRecovery` manifest/audit model.
- `prisma/migrations/<timestamp>_sync_event_recovery/` — database migration for the audit model.
- `src/lib/sync-event-recovery.ts` — discovery, validation, manifest persistence and transactional execution.
- `src/lib/sync-event-schedule.ts` — BRT schedule validation, phase/window calculation and event date guard.
- `src/lib/sync-event-automation.ts` — create room at lineup lock, open selection windows, execute rounds and automatic tiebreak/finalization at schedule milestones.
- `src/lib/sync-challenge.ts` — player-facing registration/lineup window labels derived from schedule.
- `src/app/(app)/desafio-sincronizado/actions.ts` — validate and save the schedule configuration.
- `src/app/(app)/desafio-sincronizado/lineup-actions.ts` — remove stale hard-coded 17:50 copy and enforce schedule-derived lineup closure.
- `src/app/(app)/desafio-sincronizado/_components/sync-room-panel.tsx` — phase-aware selection and automatic-tiebreak copy; retain admin controls only as recovery fallbacks.
- `src/app/(app)/desafio-sincronizado/page.tsx` — calendar/status copy sourced from the schedule helper.
- `src/app/api/cron/sync-event/route.ts` — invoke the idempotent schedule driver.
- `scripts/recover-sync-event-2026-10-13.ts` — admin-only two-phase dry-run/apply CLI for the already audited cancelled event.
- `scripts/test-sync-event-recovery.ts` — controlled Prisma-style test harness for recovery manifest guards.
- `scripts/test-sync-event-schedule.ts` — deterministic BRT schedule and automation boundary tests.

### Task 1: Schedule Domain and Calendar Validation

**Files:**
- Create: `src/lib/sync-event-schedule.ts`
- Modify: `src/app/(app)/desafio-sincronizado/actions.ts:576-665`
- Modify: `src/lib/sync-challenge.ts:getSyncWindowState`
- Test: `scripts/test-sync-event-schedule.ts`

**Interfaces:**
- Produces: `getSyncScheduleState(config, now): SyncScheduleState`, `validateSyncSchedule(input): SyncScheduleValidation`, and `SYNC_EVENT_DATE = "2026-10-20"`.
- Consumes: `SyncChallengeConfig` schedule fields.

- [ ] **Step 1: Write failing schedule tests**

Assert literal BRT moments: registration is open at `2026-10-20T18:59:59-03:00`, closed at 19:00; first selection is open from 19:00 through 19:59:59; rounds are executable only at 20:00, 20:20 and 20:40; tiebreak selection is open from 20:41 through 20:59:59 and executable at 21:00.

- [ ] **Step 2: Run the schedule test to verify it fails**

Run: `npx tsx scripts/test-sync-event-schedule.ts`

Expected: FAIL because no schedule domain module exists.

- [ ] **Step 3: Implement schedule state and validation**

Create `getSyncScheduleState(config, now)` with named phases `REGISTRATION`, `LINEUP_LOCK`, `ROUND_1_SELECTION`, `ROUND_1_EXECUTION`, `ROUND_2_SELECTION`, `ROUND_2_EXECUTION`, `ROUND_3_SELECTION`, `ROUND_3_EXECUTION`, `TIEBREAK_SELECTION`, `TIEBREAK_EXECUTION`, and `FINISHED`. Reject schedules with missing/chronologically invalid BRT milestones.

- [ ] **Step 4: Wire config save and player-facing registration/lineup checks to the helper**

Require exact 20/10/2026 ordering on the recovery event and replace the hard-coded 17:50 message with the helper label.

- [ ] **Step 5: Run tests to verify schedule behavior passes**

Run: `npx tsx scripts/test-sync-event-schedule.ts`

Expected: PASS including boundary moments and invalid ordering.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync-event-schedule.ts src/lib/sync-challenge.ts 'src/app/(app)/desafio-sincronizado/actions.ts' 'src/app/(app)/desafio-sincronizado/lineup-actions.ts' scripts/test-sync-event-schedule.ts
git commit -m "feat: define agenda do desafio sincronizado"
```

### Task 2: Persistent Recovery Manifest and Guarded Reversal

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_sync_event_recovery/migration.sql`
- Create: `src/lib/sync-event-recovery.ts`
- Create: `scripts/recover-sync-event-2026-10-13.ts`
- Test: `scripts/test-sync-event-recovery.ts`

**Interfaces:**
- Produces: `createSyncRecoveryManifest(input: { roomId: string }): Promise<RecoveryManifest>` and `applySyncRecovery(manifestId: string): Promise<RecoveryResult>`.
- Consumes: exact room, score, reward, wallet, egg, gift, round and team records.

- [ ] **Step 1: Write failing recovery tests**

Use controlled fixtures to assert that manifest creation captures only allowlisted IDs, `applySyncRecovery` rejects a hatched egg, rejects a claimed gift, rejects insufficient wallet balance, and preserves teams plus lineups while deleting the cancelled room’s matches/selections/scores/rounds.

- [ ] **Step 2: Run the recovery test to verify it fails**

Run: `npx tsx scripts/test-sync-event-recovery.ts`

Expected: FAIL because the manifest and recovery service do not exist.

- [ ] **Step 3: Add `SyncEventRecovery` storage and migrate it**

Store `id`, target room/date, `status`, immutable JSON snapshot, explicit JSON ID allowlists, `createdAt`, `appliedAt`, nullable operator identifier and result/error data. Add a unique constraint on the target room so the recovery cannot be applied twice.

- [ ] **Step 4: Implement discovery and two-phase recovery**

`createSyncRecoveryManifest` must take the 13/10 room, its score update/reward-grant times and exact recipients to create an auditable allowlist. `applySyncRecovery` must validate all guards before one transaction: reverse the allowlisted ZC with compensating ledger rows, delete only allowlisted unhatched eggs and unclaimed gifts, clear room-derived game data, detach teams, reset their event state while retaining lineups, and write the result to the manifest.

- [ ] **Step 5: Add the executable maintenance script**

The CLI must default to `--dry-run`, print counts and manifest ID, require `--apply --manifest <id>` to mutate, and refuse an already-applied manifest.

- [ ] **Step 6: Run recovery tests and database validation**

Run: `npx tsx scripts/test-sync-event-recovery.ts && npm run db:validate`

Expected: PASS; manifest guards and preservation assertions are green.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/sync-event-recovery.ts scripts/recover-sync-event-2026-10-13.ts scripts/test-sync-event-recovery.ts
git commit -m "feat: adiciona recuperação auditável do desafio sincronizado"
```

### Task 3: Idempotent Event Automation and Automatic Tiebreak

**Files:**
- Modify: `src/lib/sync-event-automation.ts`
- Modify: `src/app/api/cron/sync-event/route.ts`
- Modify: `vercel.json`
- Test: `scripts/test-sync-event-schedule.ts`

**Interfaces:**
- Consumes: `getSyncScheduleState`, valid locked teams and the recovery-cleared state.
- Produces: `runSyncEventAutomation(now): Promise<AutomationResult>` with formed/opened/executed/tiebreak/finalized counters.

- [ ] **Step 1: Add failing automation-boundary tests**

Assert no room/round opens before 19:00, room formation freezes only valid 9+9 teams at 19:00, each selection window opens at its defined start, each round executes at its exact time, and a tied leader opens round 0 selection from 20:41 through 20:59:59 with a selection pool of all nine locked mascots before executing at 21:00.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx scripts/test-sync-event-schedule.ts`

Expected: FAIL because `SELECTION_WINDOW_MS` currently gives the wrong execution behavior.

- [ ] **Step 3: Replace fixed selection duration with schedule phase transitions**

Create the room at 19:00 only after lineups are validated; schedule rounds at their execution marks; open each selection at the prior transition; auto-select only absent player selections at execution; keep round three from finishing the room until the 21:00 tiebreak decision is made. If a tiebreak is required, open round 0 selection at 20:41 rather than auto-selecting the tiebreak team.

- [ ] **Step 4: Automate tiebreak and finalization**

At 20:41 calculate top-place equality using existing ranking criteria and create round 0 only for tied teams. At 21:00 execute that round and otherwise finalize the room and rewards once. Let tiebreak selections draw from all nine locked mascots, bypassing the three-round no-reuse filter only for round 0; deterministically auto-select only missing tiebreak selections at execution.

- [ ] **Step 5: Make cron cadence compatible with exact milestones**

Change the sync event cron from every two minutes to every minute and preserve cron route authentication/idempotency.

- [ ] **Step 6: Run automation tests**

Run: `npx tsx scripts/test-sync-event-schedule.ts`

Expected: PASS with no duplicate mutation across repeated calls at each milestone.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync-event-automation.ts src/app/api/cron/sync-event/route.ts vercel.json scripts/test-sync-event-schedule.ts
git commit -m "feat: automatiza etapas do desafio sincronizado"
```

### Task 4: Event UI and Operational Recovery

**Files:**
- Modify: `src/app/(app)/desafio-sincronizado/page.tsx`
- Modify: `src/app/(app)/desafio-sincronizado/_components/sync-room-panel.tsx`
- Modify: `src/app/(app)/desafio-sincronizado/combat-actions.ts`
- Modify: `src/app/(app)/desafio-sincronizado/cleanup-actions.ts`
- Modify: `scripts/recover-sync-event-2026-10-13.ts`
- Test: `scripts/test-sync-event-schedule.ts`, `scripts/test-sync-event-recovery.ts`

**Interfaces:**
- Consumes: schedule helper, recovery result and automatic round state.
- Produces: BRT-specific phase/status copy and a complete recovery run report.

- [ ] **Step 1: Write failing UI-copy and recovery-report assertions**

Assert rendered/derived labels contain the exact 20/10 milestones and that admin UI no longer presents manual start/execute controls as the normal path. Assert the recovery report includes preserved team/lineup counts, reversed ZC, deleted eggs/gifts, cleared result counts and manifest ID.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx scripts/test-sync-event-schedule.ts && npx tsx scripts/test-sync-event-recovery.ts`

Expected: FAIL because stale labels/manual normal flow remain.

- [ ] **Step 3: Update player and admin UI**

Show the active phase, next BRT milestone, selection deadline and automatic-execution notice. Keep manual controls visibly marked as admin recovery actions only; remove stale 17:50 and ten-minute wording.

- [ ] **Step 4: Execute the two-phase recovery in production order**

Run the script in dry-run mode, inspect the manifest’s explicit counts/IDs against the audited 7.200 ZC, 18 eggs and 10 unclaimed gifts, then run `--apply --manifest <id>`. Re-run dry-run to prove no pending target remains.

- [ ] **Step 5: Set the production schedule**

Persist the exact BRT schedule: registrations close 20/10 19:00; rounds 20:00/20:20/20:40; tiebreak 21:00. Reopen registration and confirm the preserved teams/lineups are detached from the old room but intact.

- [ ] **Step 6: Verify end-to-end**

Run: `npx tsx scripts/test-sync-event-schedule.ts && npx tsx scripts/test-sync-event-recovery.ts && npm run typecheck && npm run build`

Expected: all pass; database audit after execution reports zero residual cancelled-room results/rewards, preserved lineups, and the 20/10 schedule.

- [ ] **Step 7: Commit and deploy**

```bash
git add 'src/app/(app)/desafio-sincronizado' scripts/recover-sync-event-2026-10-13.ts scripts/test-sync-event-*.ts
git commit -m "fix: recupera e reagenda desafio sincronizado"
git push origin main
```

Verify the Vercel deployment succeeds before announcing the recovery complete.
