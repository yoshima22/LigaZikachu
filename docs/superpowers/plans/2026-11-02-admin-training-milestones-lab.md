# Admin Training Milestones Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an admin-only, non-persistent laboratory to preview the locked-stance training journeys, test their counters and Arena-Z anti-delivery rules, and publish the approved limits in the manual.

**Architecture:** Keep all mission data and validation pure in a server-safe `training-milestones` module, with no Prisma models, ShopItem changes, gameplay role changes, or player-facing unlock checks. The existing admin “Testes e simulações” tab receives a client-side lab that invokes only those pure functions; the public manual renders the locked-stance rules and limits as informational copy.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Node test runner via `tsx`, Tailwind, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-10-28-posturas-desbloqueaveis-design.md`

## Global Constraints

- The lab is visible only from `/admin` after its existing `requireAdmin()` gate; it must never create a journey, consume an item, write to Prisma, or expose a route/API.
- No change may unlock, equip, alter, or persist a new combat posture.
- Player-facing copy must not use “mitigação de dano”; offensive bypass uses “Penetração de Armadura” and defensive cases use “Resistência de Dano”.
- Every journey selects 5–7 objectives from compatible pools and uses the long-duration limits in this plan.
- Arena-Z validity never requires a distinct opponent: one credit per player pair in a rolling 24h, one selected training mascot per battle, two credits per owner/day, and anti-delivery failures return explicit reasons.
- Draft, Terreno, admin/test battles, disabled modes, and inaccessible modes are never eligible.
- The supplied banner icon is reused under the dynamic item name `Marco de Postura - [Postura]`; it does not create a real shop item in this prototype.

## Review Focus

- Arena pair cooldown at exactly 24 hours: test that 23:59:59 fails and 24:00:00 is valid in Task 2.
- A valid-looking admin/test or Arena Draft event: test that the allowlist rejects it in Task 2.
- Mission selection for support and defender stances: test that no attacking-only or impossible self-heal objective is selected in Task 1.
- A repeated objective type or an out-of-range journey: test that each generated journey has unique objective types and 5–7 objectives in Task 1.
- A client simulation action must not persist: test pure progress evaluation only and review that Task 3 has no Server Action, fetch, Prisma import, or mutation path.

---

### Task 1: Pure training catalog, objective selection, and progress evaluator

**Files:**
- Create: `src/lib/training-milestones.ts`
- Create: `src/lib/training-milestones.test.ts`

**Interfaces:**
- Produces `TrainingStanceKey`, `TRAINING_STANCES`, `TRAINING_OBJECTIVES`, `buildTrainingJourney(input)`, and `evaluateTrainingEvent(journey, event)` for Task 3.
- Consumes the existing canonical personality keys and public combat-role labels from `@/lib/combat-roles` only for labels; it must not modify combat behavior.

- [ ] **Step 1: Write failing catalog tests**

Add tests proving that `buildTrainingJourney({ stance: "PURIFIER", personality: "LOYAL", seed: 7 })` returns 5–7 distinct compatible objectives, includes an explicit Loyal/Purifier protection affinity objective with target 30, and never contains the removed self-heal-after-low-HP objective.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test src/lib/training-milestones.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the catalog and evaluator**

Implement posture metadata for Executor, Comandante, Purificador, Sanguinário, Artilheiro, Revidador, Corrosivo, Estrategista, Inabalável, Fortaleza, Acumulador, Explosivo, and Armadilheiro. Define at least 28 objective templates with compatibility tags and the approved long-duration caps; select a deterministic, unique 5–7 objective journey from `seed`. `evaluateTrainingEvent` must return a delta of 0 or the per-combat cap plus a Portuguese explanation, without mutating input.

- [ ] **Step 4: Run the catalog tests to verify they pass**

Run: `pnpm exec tsx --test src/lib/training-milestones.test.ts`

Expected: PASS.

- [ ] **Step 5: Add failing evaluator boundary tests**

Add tests proving K.O. objectives stop at two credits per battle, last-survivor objectives stop at one, and the Sanguinário-compatible “pressão sob risco” action is recognized without requiring self-healing.

- [ ] **Step 6: Run, implement the smallest evaluator changes, and rerun**

Run: `pnpm exec tsx --test src/lib/training-milestones.test.ts`

Expected: first FAIL for missing behavior, then PASS after implementation.

- [ ] **Step 7: Commit**

```bash
git add src/lib/training-milestones.ts src/lib/training-milestones.test.ts
git commit -m "feat: add training milestone lab catalog"
```

### Task 2: Arena-Z training-credit validator

**Files:**
- Modify: `src/lib/training-milestones.ts`
- Modify: `src/lib/training-milestones.test.ts`

**Interfaces:**
- Produces `validateArenaTrainingCredit(input): ArenaTrainingCreditResult` for Task 3.
- Consumes no database data; the caller supplies timestamps, owner IDs, team/action counts, source mode, selected mascot state, and existing daily/pair credit counts.

- [ ] **Step 1: Write failing Arena validator tests**

Test a valid PvP battle; same-owner rejection; Draft/admin/test/terrain rejection; fewer than two mascots per side; fewer than six actions; pair cooldown at 23:59:59 and 24:00:00; owner daily cap; and no selected training mascot.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test src/lib/training-milestones.test.ts`

Expected: FAIL because `validateArenaTrainingCredit` is missing.

- [ ] **Step 3: Implement the pure validator**

Return `{ eligible, reasons, nextEligibleAt? }`. Keep the rolling cooldown and caps as constants surfaced to the lab. Do not query or mutate Arena-Z records.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec tsx --test src/lib/training-milestones.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/training-milestones.ts src/lib/training-milestones.test.ts
git commit -m "feat: validate arena training credits in lab"
```

### Task 3: Admin-only Training Milestones Lab

**Files:**
- Create: `src/app/(app)/admin/_components/training-milestones-lab.tsx`
- Modify: `src/app/(app)/admin/page.tsx`
- Create: `public/items/marco-de-postura.png`

**Interfaces:**
- Consumes `buildTrainingJourney`, `evaluateTrainingEvent`, `validateArenaTrainingCredit`, and catalog types from `@/lib/training-milestones`.
- Produces a local-only admin interface; it must not import Prisma, Server Actions, or call a network endpoint.

- [ ] **Step 1: Write a failing component-level harness or exportable view-model test**

Test the exported lab view-model builder with Executor/Competitive and Purificador/Leal selections: it must expose the dynamic item label, selected 5–7 objectives, the long limits, and an explicit no-persistence warning.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test src/app/(app)/admin/_components/training-milestones-lab.test.ts`

Expected: FAIL because the view model and component do not exist.

- [ ] **Step 3: Implement the admin lab and integrate it**

Add a card to the existing `testes` tab. Let admins select stance, personality, focus stats, deterministic seed, and a synthetic event. Show: the supplied icon; `Marco de Postura - [Postura]`; effects scaled by focus stats; objective counters; accepted/rejected event explanation; Arena-Z validity reasons; and a prominent “Simulação local — não cria item, não consome ZC e não libera postura” notice. Copy the attached PNG into the public item asset path without transforming the artwork.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `pnpm exec tsx --test src/app/(app)/admin/_components/training-milestones-lab.test.ts`

Expected: PASS.

- [ ] **Step 5: Run type checking**

Run: `pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/admin/page.tsx src/app/(app)/admin/_components/training-milestones-lab.tsx src/app/(app)/admin/_components/training-milestones-lab.test.ts public/items/marco-de-postura.png
git commit -m "feat: add admin training milestones lab"
```

### Task 4: Manual section for locked postures and mission limits

**Files:**
- Modify: `src/app/(app)/manual/page.tsx`
- Modify: `src/lib/manual-content.ts`

**Interfaces:**
- Consumes the published terminology and limits from Task 1, copied as player-facing explanatory text only.
- Produces a Manual section that does not imply that the locked postures are already obtainable.

- [ ] **Step 1: Write a failing manual content test**

Add a test for an exported manual-copy builder proving it labels the system “em preparação”, names `Marco de Postura - [Postura]`, publishes the per-combat caps, names Arena-Z’s 24-hour pair rule, and uses “Penetração de Armadura” rather than “mitigação de dano”.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test src/lib/training-milestones.test.ts`

Expected: FAIL because the manual copy builder is absent.

- [ ] **Step 3: Implement the manual copy and section**

Expose the mission-limit text through `MANUAL_DEFAULTS` and render a “Posturas desbloqueáveis — em preparação” subsection inside the existing Posturas section. Include allowed sources, exclusions, Arena-Z anti-delivery limits, long-duration caps, definitions for “aliado em perigo”, “cura efetiva”, “Penetração de Armadura”, and a note that the real item/system remains disabled.

- [ ] **Step 4: Run the test and typecheck**

Run: `pnpm exec tsx --test src/lib/training-milestones.test.ts && pnpm typecheck`

Expected: PASS and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/manual/page.tsx src/lib/manual-content.ts src/lib/training-milestones.ts src/lib/training-milestones.test.ts
git commit -m "docs: publish training milestone limits in manual"
```

### Task 5: End-to-end verification and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-10-28-posturas-desbloqueaveis-design.md`

- [ ] **Step 1: Update the design spec with the accepted terminology, long-duration limits, Arena pair-cooldown design, and prototype-only boundary.**

- [ ] **Step 2: Run focused tests and full project checks**

Run: `pnpm exec tsx --test src/lib/training-milestones.test.ts src/app/(app)/admin/_components/training-milestones-lab.test.ts && pnpm typecheck && pnpm test`

Expected: all commands exit 0. Report any pre-existing failure separately.

- [ ] **Step 3: Perform a manual admin smoke test**

Open `/admin#testes`, verify the lab appears only after admin authentication, simulate one accepted Arena event and one cooldown rejection, then verify no database records or player inventory changes are created.

- [ ] **Step 4: Commit and push**

```bash
git add docs/superpowers/specs/2026-10-28-posturas-desbloqueaveis-design.md
git commit -m "docs: finalize training milestones lab specification"
git push origin main
```
