# Johto III Placement Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared Johto III placement animation template with five concise, distinct, accessible title effects.

**Architecture:** `Johto3PlacementEffect` will remain the public integration point, but will dispatch to five focused visual compositions. Small shared primitives will provide stable title copy and motion handling; each composition owns its unique visual layers and keyframes.

**Tech Stack:** Next.js 15, React 19, TypeScript, inline CSS/CSS keyframes, existing Johto texture assets.

**Spec:** `docs/superpowers/specs/2026-10-26-johto3-placement-effects-design.md`

## Global Constraints

- Use only existing assets and no new dependencies.
- Make the player name appear around 0.5 s after entry.
- Keep visual hierarchy focused on title/name; ambient layers must remain subtle.
- Use **Campeão da Copa Johto** for `CHAMPION`.
- Respect `prefers-reduced-motion`.

## Review Focus

- Each supported `Johto3Tier` selects a dedicated composition rather than a numeric-level template; covered in Task 1.
- `CHAMPION` has the corrected copy and the old league-champion copy is absent; covered in Task 1.
- Name and placement label remain visible with `flavorText` absent or supplied; covered in Task 2.
- Entry timing exposes the primary copy by 0.5 s; covered in Task 2.
- Reduced-motion users retain readable static composition without continuous animation; covered in Task 3.

---

### Task 1: Model five placement directions

**Files:**
- Create: `scripts/test-title-entrance-johto3.ts`
- Modify: `src/components/ui/title-entrance-johto3.tsx`

**Interfaces:**
- Consumes: `Johto3Tier`, `Props`.
- Produces: `Johto3PlacementEffect({ tier, name, flavorText })` with an explicit renderer for every tier.

- [ ] **Step 1: Write the failing static test**

Assert that the source contains the five renderer names, all five tier cases, `Campeão da Copa Johto`, and not `Campeão da Liga Johto`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/test-title-entrance-johto3.ts`
Expected: FAIL because the source still uses numeric `level` configuration and the old label.

- [ ] **Step 3: Implement explicit renderers in `src/components/ui/title-entrance-johto3.tsx`**

Create `FirstPlaceEffect`, `SecondPlaceEffect`, `ThirdPlaceEffect`, `FourthPlaceEffect`, and `CupChampionEffect`. Give each its selected color system, silhouette, entry sequence, and restrained ambient layer; retain a shared copy renderer only for title text treatment.

- [ ] **Step 4: Run the placement test**

Run: `npx tsx scripts/test-title-entrance-johto3.ts`
Expected: PASS.

### Task 2: Make title copy early and legible

**Files:**
- Modify: `scripts/test-title-entrance-johto3.ts`
- Modify: `src/components/ui/title-entrance-johto3.tsx`

**Interfaces:**
- Consumes: renderer props `{ name: string; flavorText?: string | null }`.
- Produces: name/label presentation with primary copy entrance at 0.5 s or earlier.

- [ ] **Step 1: Extend the failing test**

Assert a dedicated shared title treatment exists, it supports optional flavor text, and primary animation tokens use `0.5s` (or a smaller delay) rather than the former `1.5s` title delay.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/test-title-entrance-johto3.ts`
Expected: FAIL until the revised title choreography is present.

- [ ] **Step 3: Implement shared, contrast-safe copy treatment**

Keep the player name as the primary visual anchor in every composition; place flavor text below it when present. Restrict high-contrast particles to peripheral layers.

- [ ] **Step 4: Run the placement test**

Run: `npx tsx scripts/test-title-entrance-johto3.ts`
Expected: PASS.

### Task 3: Provide motion safety and integration verification

**Files:**
- Modify: `scripts/test-title-entrance-johto3.ts`
- Modify: `src/components/ui/title-entrance-johto3.tsx`

**Interfaces:**
- Consumes: browser `prefers-reduced-motion` preference.
- Produces: a static readable composition when reduced motion is requested.

- [ ] **Step 1: Extend the failing test**

Assert `@media (prefers-reduced-motion: reduce)` is defined for the effect classes/keyframes.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/test-title-entrance-johto3.ts`
Expected: FAIL until the media query is included.

- [ ] **Step 3: Implement the reduced-motion CSS and check responsive bounds**

Disable nonessential continuous animation while preserving the title, placement label, and key shape. Use viewport-safe `clamp()` sizing for mobile.

- [ ] **Step 4: Run validation**

Run: `npx tsx scripts/test-title-entrance-johto3.ts && npm run typecheck && npm run build`
Expected: PASS, then visually inspect each tier at desktop and mobile viewport sizes.
