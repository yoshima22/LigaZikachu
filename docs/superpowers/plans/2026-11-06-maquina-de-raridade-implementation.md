# Máquina de Raridade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a administradores fundir raridades e estrelas no Laboratório, com Mutação Genética comprada por Pó de Criação.

**Architecture:** Regras puras de receita e elegibilidade ficam em módulo próprio e são testadas isoladamente. A action faz autorização, locks e alteração atômica de inventário/mascotes; a interface só seleciona sobrevivente e consumidos.

**Tech Stack:** Next.js Server Actions, React 19, TypeScript, Prisma/PostgreSQL, `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-06-maquina-de-raridade-design.md`

## Global Constraints

- Apenas `ADMIN` e `SUPER_ADMIN` operam a máquina, inclusive por action direta.
- `PLAYER` e `GAMEMASTER` veem somente `Máquina Parada`.
- Cada fusão de origem usa três mascotes da mesma origem e a Mutação do resultado.
- Fusão de origem aplica o reset integral da Pena Arco-Íris na faixa da nova origem.
- Estrelas usam dois LAB Lv.100 com mesma estrela; dão +5 aos cinco atributos e param em 5★.
- Não incluir conteúdo de origem futura não liberado.

## Review Focus

- IDs duplicados em slots falham sem consumo (Task 2).
- Mascotes travados/listados/em atividade não participam (Task 2).
- Falta de Pó ou mutação não deixa atualização parcial (Task 3).
- Duas fusões concorrentes não consomem os mesmos recursos duas vezes (Task 3).
- Interface não-admin não oferece acionador de fusão (Task 4).

---

### Task 1: Persistência e catálogo de Mutação Genética

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/shop-config.ts`
- Modify: `src/app/(app)/laboratorio/actions.ts`
- Test: `src/app/(app)/laboratorio/mutation-catalog.test.ts`

**Interfaces:** Produz `Mascot.labStars`, quatro novos `ShopItemType`, `LAB_MUTATION_CATALOG`, e `buyLabMutationAction(tier)`.

- [ ] Escrever teste que exige catálogo com custos `RARE:50`, `EVENT:100`, `SPECIAL:150`, `LAB:200` e os respectivos tipos de item.
- [ ] Rodar `npx tsx src/app/(app)/laboratorio/mutation-catalog.test.ts` e confirmar falha.
- [ ] Adicionar `labStars Int @default(0)`, os quatro tipos, os registros de item de imagem placeholder e a compra atômica que debita Pó e credita inventário.
- [ ] Rodar `npm run db:generate; npx tsx src/app/(app)/laboratorio/mutation-catalog.test.ts` e confirmar sucesso.
- [ ] Commit: `feat: add laboratory genetic mutations`.

### Task 2: Regras puras e reset de fusão

**Files:**
- Create: `src/lib/lab-rarity-machine.ts`
- Modify: `src/lib/mascot.ts`
- Test: `src/lib/lab-rarity-machine.test.ts`

**Interfaces:** Produz `getOriginFusionRecipe(origin)`, `validateLabStarFusion(input)` e `resetMascotForOriginFusion(...)` para a action.

- [ ] Escrever testes para as receitas `COMMON→RARE`, `RARE→EVENT`, `EVENT→SPECIAL`, `SPECIAL→LAB`; para a mutação LAB; para `2★+2★→3★`; e para recusar 5★.
- [ ] Rodar `npx tsx src/lib/lab-rarity-machine.test.ts` e confirmar falha.
- [ ] Implementar receitas e validação; extrair da Pena Arco-Íris a rotina reutilizável de reset que recebe a nova origem e preserva o comportamento de forma-base, atributos, personalidade, análise, marcos e bônus de evento.
- [ ] Rodar `npx tsx src/lib/lab-rarity-machine.test.ts` e confirmar sucesso.
- [ ] Commit: `feat: add laboratory rarity fusion rules`.

### Task 3: Administração e transação de fusão

**Files:**
- Modify: `src/app/(app)/laboratorio/actions.ts`
- Test: `src/app/(app)/laboratorio/actions.test.ts`

**Interfaces:** Produz `fuseMascotsInLabAction({ mode, survivorId, consumedIds })` e amplia `getLabDataAction` com origem, estrelas, permissão e saldo de mutações.

- [ ] Escrever testes mockados: admin obrigatório; três IDs distintos e mesma origem; mutação decrementada uma vez; sobrevivente resetado; fusão de estrela mantém Lv.100 e soma cinco a cada atributo; entrada inválida não grava nada.
- [ ] Rodar `npx tsx src/app/(app)/laboratorio/actions.test.ts` e confirmar falha.
- [ ] Implementar action serializável com advisory locks dos mascotes e inventário, reload interno, validações de disponibilidade, consumo/deleção somente depois da validação, atividade do jogador e revalidação do Laboratório.
- [ ] Rodar `npx tsx src/app/(app)/laboratorio/actions.test.ts; npm run typecheck` e confirmar sucesso.
- [ ] Commit: `feat: add admin laboratory mascot fusion`.

### Task 4: Loja e aba da máquina

**Files:**
- Modify: `src/app/(app)/laboratorio/page.tsx`
- Modify: `src/app/(app)/laboratorio/_components/lab-client.tsx`
- Create: `src/app/(app)/laboratorio/_components/rarity-machine-panel.tsx`
- Test: `src/app/(app)/laboratorio/_components/rarity-machine-panel.test.tsx`

**Interfaces:** Consome o payload/action da Task 3 e produz controles administrativos e a aba inativa para demais perfis.

- [ ] Escrever testes que verificam `Máquina Parada` sem trigger para não-admin e, para admin, `Mascote mantido`, `Consumidos`, custo de mutação e confirmação desativada sem receita válida.
- [ ] Rodar `npx tsx src/app/(app)/laboratorio/_components/rarity-machine-panel.test.tsx` e confirmar falha.
- [ ] Implementar cards de compra de mutações na loja de Pó com placeholder e painel de fusão com seleção inequívoca do sobrevivente, consumidos e confirmação irreversível.
- [ ] Rodar `npx tsx src/app/(app)/laboratorio/_components/rarity-machine-panel.test.tsx; npm run typecheck; npm run db:validate` e confirmar sucesso.
- [ ] Commit: `feat: add laboratory rarity machine interface`.
