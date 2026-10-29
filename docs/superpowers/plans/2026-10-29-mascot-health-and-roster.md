# Mascot Health and Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver grouped mascot-health alerts, XP Share discovery, vacation cancellation, and collection-wide stat ordering.

**Architecture:** Keep disease decisions in the existing scheduled processor, but use pure helpers for group copy and roster comparators. Extend the existing navigation notification snapshot so mascot alerts surface under the Collection menu, retain the server-side bank page action as the source of truth, and expose focused navigation to the permanent XP Share holder.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, Sonner, Lucide.

**Spec:** `docs/superpowers/specs/2026-10-29-mascot-health-and-roster-design.md`

## Global Constraints

- Alerts remain player notifications linked to `/mascotes` and must be idempotent for their relevant processing window.
- Existing bank pagination and server-side filters remain authoritative.
- All cancellation authorization and state checks happen on the server.
- Do not alter disease probability, treatment, XP Share rewards, or normal vacation completion rewards.

## Review Focus

- A three-or-more mascot group must never expose partial names, while one/two-member groups name every affected mascot.
- A player who disabled in-game mascot notifications must not receive a new unread badge.
- An XP Share holder that is in the bank must resolve even when another filter or page was active.
- A finished-but-unclaimed vacation may be explicitly abandoned without granting EXP, egg, happiness, or a ticket refund.
- Stat ordering must be deterministic for equal values and preserve pagination counts.

---

### Task 1: Grouped health alerts in the Collection notification menu

**Files:**
- Create: `src/lib/mascot-health-alerts.ts`
- Create: `src/lib/mascot-health-alerts.test.ts`
- Modify: `src/lib/mascot-bonds.ts:803-850`
- Modify: `src/lib/nav-notifications.ts`
- Modify: `src/app/(app)/_components/nav-notification-actions.ts`
- Modify: `src/app/(app)/_components/app-nav.tsx`

**Interfaces:**
- Produces: `formatMascotHealthAlert(kind: "DISEASED" | "AT_RISK", mascots: MascotHealthAlertMascot): { title: string; body: string }`.
- Produces: `NavNotificationSnapshot.mascotCount` and `mascotAlerts`, with navigation actions accepting the `MASCOT` category.
- Consumes: the existing disease eligibility condition and `filterInGameRecipients`/`createPlayerNotification` notification preference conventions.

- [ ] **Step 1: Write failing tests for grouped health-alert copy**

```ts
assert.deepEqual(formatMascotHealthAlert("DISEASED", [{ name: "Pikachu" }]), {
  title: "Um mascote está doente",
  body: "Pikachu está doente. Use um Antídoto para interromper a transmissão.",
});
assert.match(formatMascotHealthAlert("AT_RISK", [{ name: "A" }, { name: "B" }]).body, /A e B/);
assert.doesNotMatch(formatMascotHealthAlert("DISEASED", [{ name: "A" }, { name: "B" }, { name: "C" }]).body, /A|B|C/);
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run: `npx tsx --test src/lib/mascot-health-alerts.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement `formatMascotHealthAlert` in `src/lib/mascot-health-alerts.ts`**

Return the approved Portuguese aggregate copy for groups of three or more and named copy for one/two mascots; keep names data-only and never build HTML.

- [ ] **Step 4: Run the helper test to verify it passes**

Run: `npx tsx --test src/lib/mascot-health-alerts.test.ts`

Expected: PASS.

- [ ] **Step 5: Replace per-mascot notification writes in `processMascotDiseaseForPlayer`**

Track all direct disease cases and contagion cases in the same `newlyDiseased` group. Collect at-risk mascots before rolling infection. After all state updates, emit no more than one `MASCOT_DISEASE` and one `MASCOT_DISEASE_RISK` notification via the project notification helper, using a date/run-safe event key and respecting MASCOT in-game preferences.

- [ ] **Step 6: Extend navigation notification data and actions for MASCOT**

Add mascot count/alerts to the snapshot, MASCOT support to clear/view actions, and a `/mascotes` badge plus alerts in the desktop and mobile Collection menus. Update client-side optimistic alert removal for the new category.

- [ ] **Step 7: Run focused and type verification**

Run: `npx tsx --test src/lib/mascot-health-alerts.test.ts; npm run typecheck`

Expected: alert tests pass and TypeScript reports no errors.

### Task 2: Locate an equipped XP Share from the mascot bank

**Files:**
- Modify: `src/app/(app)/mascotes/page.tsx`
- Modify: `src/app/(app)/mascotes/_components/mascot-list.tsx`
- Modify: `src/app/(app)/mascotes/_components/mascot-bank-list-demand.tsx`
- Modify: `src/app/(app)/mascotes/actions.ts:2014-2269`

**Interfaces:**
- Produces: page data `xpShareHolder: { id; name; pokemonId; isFeatured; shareType } | null`.
- Consumes: optional `focusMascotId` in `getBankMascotsPageAction` to replace active bank filters with an exact player-owned bank-mascot lookup.

- [ ] **Step 1: Write a failing action-level test or focused type fixture for the exact holder lookup**

Add a minimal fixture asserting the request input accepts `focusMascotId` and that the bank query only returns the owned non-featured mascot whose ID matches it.

- [ ] **Step 2: Run the focused test to verify it fails**

Run the project’s selected focused TypeScript test command for the new fixture.

Expected: FAIL because `focusMascotId` and the holder projection are missing.

- [ ] **Step 3: Add the XP Share holder projection and exact bank lookup**

Query the active permanent `XP_SHARE`/`XP_SHARE_TEAM` buff with its mascot once in the mascot page loader. Preserve the existing bank query restrictions and add exact-ID focus only when the holder is banked.

- [ ] **Step 4: Add the visible locator control**

Show an informative XP Share summary above the bank. For a banked holder, “Localizar no banco” clears incompatible controls, requests the exact holder, and expands/highlights its row; for a featured holder, state that it is visible in Destaques.

- [ ] **Step 5: Run focused verification and typecheck**

Run: `npm run typecheck`

Expected: PASS with the narrowed request and component props type-safe.

### Task 3: Explicitly abandon an active vacation without refund

**Files:**
- Create: `src/lib/mascot-vacation.test.ts`
- Modify: `src/lib/mascot.ts:1736-1753`
- Modify: `src/app/(app)/mascotes/actions.ts:1276-1285`
- Modify: `src/app/(app)/mascotes/_components/mascot-card.tsx`
- Modify: `src/app/(app)/mascotes/_components/mascot-list.tsx`

**Interfaces:**
- Produces: `cancelVacation(playerId: string, expeditionId: string): Promise<void>` and `cancelVacationAction(expeditionId: string): Promise<{ error?: string }>`.
- Consumes: an active `MascotExpedition` whose `rewardJson.mode` is `VACATION`.

- [ ] **Step 1: Write a failing vacation-state test**

Test that the cancellation function rejects a non-vacation expedition and, for a player-owned active vacation, records a cancelled no-reward state without touching player inventory or mascot reward fields.

- [ ] **Step 2: Run the vacation test to verify it fails**

Run: `npx tsx --test src/lib/mascot-vacation.test.ts`

Expected: FAIL because the dedicated cancellation interface does not exist.

- [ ] **Step 3: Implement and expose dedicated vacation cancellation**

Guard ownership, active status, and `rewardJson.mode === "VACATION"`; persist the existing no-reward cancellation state plus a vacation-specific mascot event. Do not invoke inventory restoration or `claimVacation`.

- [ ] **Step 4: Add the explicit vacation action in both active-vacation presentations**

Use vacation-specific warning/confirmation text stating that the ticket is not returned. Render it while vacation status is active even after its finish time, before collection.

- [ ] **Step 5: Run vacation and type verification**

Run: `npx tsx --test src/lib/mascot-vacation.test.ts; npm run typecheck`

Expected: vacation test passes and TypeScript reports no errors.

### Task 4: Sort the full mascot bank by level, total stats, or individual stat

**Files:**
- Create: `src/lib/mascot-roster-sort.ts`
- Create: `src/lib/mascot-roster-sort.test.ts`
- Modify: `src/app/(app)/mascotes/actions.ts:2014-2269`
- Modify: `src/app/(app)/mascotes/_components/mascot-bank-list-demand.tsx`

**Interfaces:**
- Produces: `sortMascotRoster<T extends MascotRosterSortCandidate>(mascots: T[], mode: MascotRosterSortMode): T[]`.
- Consumes: modes `level`, `total`, `force`, `agility`, `charisma`, `instinct`, `vitality`, and existing `duplicates`.

- [ ] **Step 1: Write failing comparator tests**

```ts
assert.deepEqual(sortMascotRoster(rows, "level").map((row) => row.id), ["lv100-higher-total", "lv100-lower-total", "lv99"]);
assert.deepEqual(sortMascotRoster(rows, "force").map((row) => row.id), ["highest-force", "same-force-higher-total", "same-force-lower-total"]);
```

Include a deterministic final ID tie-breaker and one test for each remaining stat mode.

- [ ] **Step 2: Run comparator tests to verify they fail**

Run: `npx tsx --test src/lib/mascot-roster-sort.test.ts`

Expected: FAIL because the comparator module does not exist.

- [ ] **Step 3: Implement `sortMascotRoster`**

Compute total stats as the sum of the five persisted values. Use level then total stats for level ordering; use selected stat then total then level for an attribute ordering; use ID as the final deterministic tie-breaker.

- [ ] **Step 4: Integrate sort modes into the bank action and select control**

Keep default database ordering for `level`; for aggregate/attribute modes, load the filtered bank set within the existing 5,000-row collection ceiling, sort with the helper, then paginate in memory. Preserve duplicate grouping as its separate explicit mode and reset to page one when mode changes.

- [ ] **Step 5: Run comparator tests and full type verification**

Run: `npx tsx --test src/lib/mascot-roster-sort.test.ts; npm run typecheck`

Expected: comparator tests pass and TypeScript reports no errors.

### Task 5: Whole-feature verification

**Files:**
- Modify: only files from Tasks 1–4 as needed for verification fixes.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: verified build-quality implementation with no unrelated workspace modifications.

- [ ] **Step 1: Run all new focused tests together**

Run: `npx tsx --test src/lib/mascot-health-alerts.test.ts src/lib/mascot-vacation.test.ts src/lib/mascot-roster-sort.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Run the production type and build checks**

Run: `npm run typecheck; npm run build`

Expected: both commands exit 0.

- [ ] **Step 3: Inspect the final diff against the spec**

Run: `git diff --check; git diff -- <changed files>`

Expected: no whitespace errors; every design goal maps to a reviewed change; unrelated existing edits remain untouched.
