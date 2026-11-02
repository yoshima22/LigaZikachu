# Posturas Desbloqueáveis de Produção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 13 locked postures, consumable and tradable Marcos, mascot-specific journeys, auditable progression, all combat effects, economy sources, and a launch simulation gate.

**Architecture:** A new training domain owns catalog, lifecycle, objective evaluation and immutable source records. Combat engines emit a shared structured artifact and delegate new stance effects to a shared resolver; the player selects only server-authorized unlocked stances. Economy seeding creates all Marcos disabled by the global launch flag until simulations pass.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, TypeScript, Node test runner via `tsx`, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-02-posturas-desbloqueaveis-producao-design.md`

## Global Constraints

- One active journey per mascot; activation atomically consumes exactly one tradable Marco, and cancellation/replacement erases progress without refund.
- Real player release stays behind `trainingStancesLive`; admin simulation is available before release.
- All 13 affinity pairs must be explicit; generic affinity text cannot ship.
- Only server allowlisted sources generate progression; Arena-Z credits use BRT day, pair cooldown, owner cap and source snapshots.
- All 13 combat effects use the authoritative formulas in the Spec, including caps and survival interactions.
- No player can select a locked stance in any persistent-mascot combat mode.

## Review Focus

- Concurrent Arena-Z completions for the same owner/pair: Task 3 transaction tests must prove caps and cooldown cannot race.
- Replacing/cancelling a journey while a combat/expedition is pending: Task 3 tests must prove old events never credit the replacement.
- Mascot sale with active vs completed journey: Task 2 tests must block active escrow and preserve completed unlock on the same mascot ID.
- A post-combat effect causing a completion: Task 3 tests must prove a single unlock/audit record and no duplicate consumption.
- Each engine’s type/guard/survival interaction: Task 4 parameterized tests must cover all 13 effects in every engine adapter.

---

### Task 1: Schema, catalog, explicit mission definitions, and item seeding

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_training_stances/migration.sql`
- Create: `src/lib/training-catalog.ts`
- Create: `src/lib/training-catalog.test.ts`
- Modify: `src/lib/combat-roles.ts`
- Modify: `src/lib/shop-config.ts`

**Interfaces:**
- Produces Prisma models/enums, `TRAINING_STANCE_CATALOG`, `TRAINING_AFFINITY_CATALOG`, `ensureTrainingMilestoneShopItems(tx)`, and `isTrainingMilestoneItem(type)`.
- Consumed by lifecycle, economy, UI and combat tasks.

- [ ] Write failing tests for all 13 stance definitions, all 169 concrete affinities, 7 persisted objective definitions per journey, and item seed metadata/price/negotiability.
- [ ] Run `node_modules/.bin/tsx --test src/lib/training-catalog.test.ts`; verify missing catalog failure.
- [ ] Add schema/migration and catalog; create all 13 5.000 ZC items with shared image, metadata, unbound inventory behavior, and disabled live flag.
- [ ] Run focused tests and `node_modules/.bin/tsc --noEmit`; commit `feat: add training stance catalog and schema`.

### Task 2: Journey lifecycle, inventory consumption, mascot card, and selection gate

**Files:**
- Create: `src/lib/mascot-training.ts`
- Create: `src/lib/mascot-training.test.ts`
- Modify: `src/app/(app)/mascotes/actions.ts`
- Modify: `src/app/(app)/mascotes/_components/*`
- Modify: `src/app/(app)/bazar/actions.ts`
- Modify: role-selection actions/pages that persist `preferredCombatRole`

**Interfaces:**
- Produces `activateTrainingJourney`, `cancelTrainingJourney`, `replaceTrainingJourney`, `getMascotTrainingView`, and `assertMascotStanceUnlocked`.
- Consumes catalog/schema from Task 1; consumed by Task 3 and selection adapters.

- [ ] Write failing lifecycle tests for atomic consumption, one active journey, confirmation-required replacement, no-refund cancellation, completed unlock, active-sale block and completed-unlock transfer with mascot ID.
- [ ] Implement transactional lifecycle and audit records; add mascot-card panel showing active mission/evidence/cancel/replace warning and blocked/unlocked stance state.
- [ ] Enforce server selection gate on every persistent role save/team assembly path; run tests/typecheck; commit `feat: add mascot training journeys`.

### Task 3: Structured event capture, progression worker, and launch simulations

**Files:**
- Create: `src/lib/mascot-training-events.ts`
- Create: `src/lib/mascot-training-events.test.ts`
- Modify: `src/lib/arena-z.ts`, `src/lib/league-combat.ts`, `src/lib/johto-raid*.ts`, `src/lib/bond-fight.ts`, sync/raid resolvers
- Modify: combat/expedition resolution actions that persist replays/rewards
- Modify: `src/app/(app)/admin/_components/training-milestones-lab.tsx`

**Interfaces:**
- Produces `captureTrainingSourceSnapshot`, `recordTrainingCombatArtifacts`, `recordTrainingExpedition`, `applyTrainingProgress`, and `runTrainingLaunchSimulation`.
- Consumes Task 1 catalog and Task 2 lifecycle.

- [ ] Write failing tests for every objective artifact, per-battle caps, duplicate source idempotency, BRT/day and pair locks, pending source after replacement, and exactly-once unlock after final milestone.
- [ ] Implement source snapshots and transactionally persisted artifacts/progress; add admin simulation report that runs all 169 affinity scenarios, every objective and completion/replacement cases.
- [ ] Run simulation fixtures plus focused tests; require a passing simulation report before Task 5 can turn on live configuration; commit `feat: track mascot training progress`.

### Task 4: Shared locked-stance combat resolver and engine adapters

**Files:**
- Create: `src/lib/training-stance-effects.ts`
- Create: `src/lib/training-stance-effects.test.ts`
- Modify: `src/lib/combat-roles.ts`, `src/lib/arena-z.ts`, `src/lib/league-combat.ts`, `src/lib/johto-raid-sim.ts`, `src/lib/bond-fight.ts`, `src/lib/tower/engine/combat.ts`, Arena Online/Mundo adapters

**Interfaces:**
- Produces a deterministic per-battle state machine and engine-neutral hooks for target choice, before/after attack, round transitions, damage, healing and death.
- Consumes Task 2 unlock gate and Task 3 artifact event API.

- [ ] Write failing parameterized tests for each of the 13 effects, caps, timing, type/guard/survival interactions and replay artifact output.
- [ ] Implement resolver and adapter contract; replace duplicated role-only branching where needed without changing legacy posture behavior.
- [ ] Run all combat-engine focused suites and simulated mirror battles; commit `feat: add locked stance combat effects`.

### Task 5: Miauvadão, Shop, 6h expedition drops, player UI, and launch switch

**Files:**
- Modify: `src/app/(app)/shop/page.tsx`, `src/app/(app)/shop/actions.ts`, shop admin seed paths
- Modify: `src/app/(app)/bazar/actions.ts`, `src/app/(app)/bazar/admin/page.tsx`
- Modify: `src/lib/mascot.ts`, `src/lib/mascot-data.ts`
- Modify: `src/app/(app)/manual/page.tsx`, `src/lib/manual-content.ts`
- Modify: feature-setting/config module and admin controls

**Interfaces:**
- Consumes seeded items, lifecycle, and simulation report from earlier tasks.

- [ ] Write failing tests proving 5.000 ZC full price, normal Shop/Miauvadão discounts, only one public Marco slot, exclusive-slot exception, 6h-Items-only drop band 0.75–1.50%, and live flag blocking all player availability until report passes.
- [ ] Implement distribution/UI/manual and admin launch control requiring latest successful simulation report.
- [ ] Run full focused suites, typecheck, production build and launch simulation; commit `feat: distribute locked training milestones`.

### Task 6: Verification, independent review, and deployment handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-11-02-posturas-desbloqueaveis-producao-design.md`

- [ ] Reconcile every requirement to a test and record simulation report version/summary in the admin audit log.
- [ ] Run focused tests, `node_modules/.bin/tsc --noEmit`, the project test command, and production build.
- [ ] Get an independent review of the branch; fix Critical/Important findings with RED→GREEN tests.
- [ ] Keep `trainingStancesLive` off unless the simulation report is green; commit and push to `main`.
