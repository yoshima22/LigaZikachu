# Johto SUS Shield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paginated Johto SUS recovery, an event-scoped cooperative revive shield, and automatic cooldown refresh to the Johto raid.

**Architecture:** A new `JohtoRaidShield` record isolates one non-stackable shield charge per player and raid event from the Arena Z daily shield. The server validates and atomically consumes/recharges shield state; the raid page receives paginated own/allied injured data and renders interactive client panels that refresh at cooldown expiry.

**Tech Stack:** Next.js 15 Server Actions and App Router, React 19, Prisma/PostgreSQL, Tailwind CSS, TypeScript, Node assert scripts.

**Spec:** `docs/superpowers/specs/2026-10-13-johto-sus-shield-design.md`

## Global Constraints

- Use `JohtoRaidShield` scoped by `(eventId, playerId)`; never reuse `Player.susShieldDate`.
- Missing shield state means one charge is immediately available for existing players.
- The Johto shield only revives another player’s `INJURED` mascot and never stores more than one charge.
- A successful non-admin Johto attack sets the attacker’s shield charge to available.
- Keep bulk SUS atomic: all selected own mascots recover and are charged, or none are changed.
- Show the copy that Johto’s shield recharges after an attack, unlike Arena Z’s daily shield.

## Review Focus

- A player attempts to revive their own mascot; server rejects it even if a crafted request bypasses the UI.
- Two players target the same injured ally concurrently; exactly one consumes a shield and revives the mascot.
- A player with a spent shield attacks again; it becomes available but never reaches two charges.
- A no-balance bulk SUS request leaves every mascot in `INJURED` state.
- Cooldown expiry refreshes the raid controls once without navigating the player away from the current page.

---

### Task 1: Persist event-scoped shield state

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations-manual/048_johto_raid_shields.sql`
- Test: `scripts/test-johto-sus-shield.ts`

**Interfaces:**
- Produces Prisma model `JohtoRaidShield { eventId, playerId, available, usedAt, rechargedAt }` with unique `(eventId, playerId)`.
- Produces `getJohtoShieldState(eventId: string, playerId: string): Promise<{ available: boolean }>` in `src/lib/johto-raid.ts`.

- [ ] **Step 1: Write the failing persistence test**

Create the test script with an isolated event/player fixture. Assert a missing row returns `{ available: true }`; after creating a spent row it returns `{ available: false }`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/test-johto-sus-shield.ts --db`

Expected: FAIL because the model/state reader does not exist.

- [ ] **Step 3: Add `JohtoRaidShield` and the manual SQL migration**

Define foreign keys to `JohtoRaidEvent` and `Player`, cascade on event deletion, index `(eventId, available)`, and add the unique index. Implement the reader with the missing-row-as-available contract.

- [ ] **Step 4: Run the persistence test to verify it passes**

Run: `npx tsx scripts/test-johto-sus-shield.ts --db`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations-manual/048_johto_raid_shields.sql src/lib/johto-raid.ts scripts/test-johto-sus-shield.ts
git commit -m "feat: persist Johto raid shield state"
```

### Task 2: Consume and recharge the cooperative shield safely

**Files:**
- Modify: `src/lib/johto-raid.ts`
- Modify: `src/app/(app)/combates/raid-johto/actions.ts`
- Test: `scripts/test-johto-sus-shield.ts`

**Interfaces:**
- Consumes: `getJohtoShieldState(eventId, playerId)` from Task 1.
- Produces `useJohtoRaidShield(userId: string, targetMascotId: string): Promise<{ ok: boolean; message: string }>`.
- Extends `JohtoRaidState` with `shield: { available: boolean } | null` and `alliedInjured` page data.

- [ ] **Step 1: Write failing action tests**

Use two fixture players and injured mascots. Assert a ready shield revives only the other player’s mascot to `FREE` and becomes spent; assert own target, non-injured target, and repeat use fail; assert a successful `runJohtoRaidAttack` recharges the spent shield.

- [ ] **Step 2: Run the action test to verify it fails**

Run: `npx tsx scripts/test-johto-sus-shield.ts --db`

Expected: FAIL because the shield action/recharge behavior is absent.

- [ ] **Step 3: Implement shield consumption and attack recharge**

Use conditional `updateMany` checks inside transactions for both shield consumption and target transition. Reuse the Arena Z revive semantics (`FREE`, clear injury/rest fields) without calling the Arena Z daily-shield function. In the successful real-attack transaction, upsert the event/player shield row with `available=true` and `rechargedAt=now`.

- [ ] **Step 4: Add the server action**

Add a session-bound `useJohtoRaidShieldAction(formData)` that accepts one target mascot ID, calls the domain function, refreshes only on success, and returns a user-facing result.

- [ ] **Step 5: Run the action test to verify it passes**

Run: `npx tsx scripts/test-johto-sus-shield.ts --db`

Expected: PASS, including the concurrent/double-use guard.

- [ ] **Step 6: Commit**

```bash
git add src/lib/johto-raid.ts 'src/app/(app)/combates/raid-johto/actions.ts' scripts/test-johto-sus-shield.ts
git commit -m "feat: add Johto cooperative revive shield"
```

### Task 3: Provide paginated SUS data to the raid page

**Files:**
- Modify: `src/app/(app)/combates/raid-johto/page.tsx`
- Modify: `src/lib/johto-raid.ts`
- Test: `scripts/test-johto-sus-shield.ts`

**Interfaces:**
- Produces `JohtoSusPage { items, page, totalPages, total }` for own and allied injured mascots.
- Page query parameters: `susPage` and `allySusPage`, positive integers with a fixed server-side page size of 5.

- [ ] **Step 1: Write failing pagination tests**

Seed six own and six allied `INJURED` mascots. Assert page 1 and page 2 return the correct five/one split, allies exclude the viewer’s player ID, and invalid page values normalize to page 1.

- [ ] **Step 2: Run the pagination test to verify it fails**

Run: `npx tsx scripts/test-johto-sus-shield.ts --db`

Expected: FAIL because paged Johto SUS readers do not exist.

- [ ] **Step 3: Implement the paged readers and state selection**

Query only `INJURED` mascots. Return only player display name, mascot identity, level, and injury timestamp for allies. Do not expose allies’ unrelated profile or stat data. Thread shield state and both pages into the raid page props.

- [ ] **Step 4: Run the pagination test to verify it passes**

Run: `npx tsx scripts/test-johto-sus-shield.ts --db`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/johto-raid.ts 'src/app/(app)/combates/raid-johto/page.tsx' scripts/test-johto-sus-shield.ts
git commit -m "feat: paginate Johto SUS rosters"
```

### Task 4: Render SUS recovery, ally rescue, and cooldown auto-refresh

**Files:**
- Create: `src/app/(app)/combates/raid-johto/_components/johto-sus-panel.tsx`
- Create: `src/app/(app)/combates/raid-johto/_components/johto-cooldown-refresh.tsx`
- Modify: `src/app/(app)/combates/raid-johto/page.tsx`
- Modify: `src/app/(app)/combates/raid-johto/_components/johto-team-selector.tsx`
- Test: `scripts/test-johto-sus-shield.ts`

**Interfaces:**
- Consumes own/allied `JohtoSusPage`, `shield.available`, `healJohtoMascotSusAction`, `healAllJohtoMascotsSusAction`, and `useJohtoRaidShieldAction`.
- Produces `JohtoSusPanel` and `JohtoCooldownRefresh({ until: string | null })`.

- [ ] **Step 1: Write failing behavioral checks**

Add script-level assertions for server pagination contracts; add a focused client test or extracted timer helper test that verifies an expiry schedules exactly one refresh and no refresh when `until` is null or past.

- [ ] **Step 2: Run the check to verify it fails**

Run the focused test command chosen for the component/helper.

Expected: FAIL because the refresh helper/panel does not exist.

- [ ] **Step 3: Implement the client UI**

Render own mascots with individual and “Recuperar todos” controls, page links/buttons, an ally section with rescue controls, and a shield status card. Include exact explanatory copy: `Exclusivo de Johto: revive um aliado e volta após seu próximo ataque — diferente do escudo diário da Arena Z.` Disable rescue controls while the shield is spent or submission is pending.

- [ ] **Step 4: Implement automatic cooldown refresh**

Place `JohtoCooldownRefresh` beside the re-grouping alert. It calculates remaining milliseconds, schedules one timeout, calls `router.refresh()` at expiry, and clears the timeout on unmount/prop change. Keep the existing cooldown copy visible until refresh completes.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx tsx scripts/test-johto-sus-shield.ts --db && npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(app)/combates/raid-johto/_components/johto-sus-panel.tsx' 'src/app/(app)/combates/raid-johto/_components/johto-cooldown-refresh.tsx' 'src/app/(app)/combates/raid-johto/page.tsx' 'src/app/(app)/combates/raid-johto/_components/johto-team-selector.tsx' scripts/test-johto-sus-shield.ts
git commit -m "feat: add Johto SUS rescue interface"
```

### Task 5: Apply migration and verify production delivery

**Files:**
- Modify: `prisma/migrations-manual/048_johto_raid_shields.sql`
- Test: `scripts/test-johto-sus-shield.ts`

**Interfaces:**
- Consumes all prior tasks.
- Produces an applied production migration and a deployed raid UI.

- [ ] **Step 1: Validate generated Prisma client and migration SQL**

Run: `npm run db:generate && npx prisma validate`

Expected: PASS.

- [ ] **Step 2: Apply `048_johto_raid_shields.sql` to the production Supabase database**

Use the project’s established manual-migration mechanism. Confirm the table, unique key, and foreign keys exist before deploying code that queries it.

- [ ] **Step 3: Run complete verification**

Run: `npx tsx scripts/test-johto-raid.ts && npx tsx scripts/test-johto-sus-shield.ts --db && npm run typecheck && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 4: Push and wait for Vercel production status `Ready`**

Commit only intended tracked files, push `main`, and inspect the resulting production deployment until it reports `Ready`.
