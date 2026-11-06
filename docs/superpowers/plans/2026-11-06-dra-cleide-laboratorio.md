# Laboratório da Dra. Cleide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o cabeçalho do Laboratório em uma experiência temática com a Dra. Cleide Combustão.

**Architecture:** Um componente visual client-side independente concentra a arte, a composição responsiva e os adornos decorativos. `LabClient` apenas troca o cabeçalho atual por esse componente e continua provendo o saldo atual de Pó de Criação.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-06-dra-cleide-laboratorio-design.md`

## Global Constraints

- Não alterar comportamento, ações de servidor, custos, limites nem o bloqueio narrativo do Laboratório.
- Usar a arte fornecida como asset local estático.
- Esconder a ilustração decorativa abaixo do breakpoint `md`.

## Review Focus

- Layout em celular não pode ter sobreposição ou perda de controles; a arte deve permanecer oculta.
- O saldo de Pó de Criação precisa continuar refletindo atualizações de estado.
- Elementos decorativos não podem capturar cliques ou obscurecer abas e botões.
- A imagem local deve ter `alt` descritivo e fallback discreto em caso de falha.
- TypeScript deve continuar validar a página sem novos erros.

---

### Task 1: Asset e cabeçalho temático

**Files:**
- Create: `public/images/dra-cleide-lab-hero.png`
- Create: `src/app/(app)/laboratorio/_components/dra-cleide-lab-header.tsx`
- Modify: `src/app/(app)/laboratorio/_components/lab-client.tsx`

**Interfaces:**
- Consumes: `dust: number`
- Produces: `DraCleideLabHeader({ dust }: { dust: number }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Add a source-level test that asserts the Lab client renders `DraCleideLabHeader` with its live `dust` state and that the header uses the local Dra. Cleide asset.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-dra-cleide-lab-header.ts`
Expected: FAIL because the component and local asset references do not exist.

- [ ] **Step 3: Implement `DraCleideLabHeader({ dust }: { dust: number }): JSX.Element`**

Create the responsive visual composition, add the transparent Dra. Cleide hero asset into public assets, and replace the existing LabClient header with the new component.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-dra-cleide-lab-header.ts`
Expected: PASS.

- [ ] **Step 5: Run project verification**

Run: `npm run typecheck` and `npm test`
Expected: both commands exit with status 0.
