# Torre sem spoilers e rotas legíveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir o pôster inteiro, ocultar chefes/prêmios futuros e oferecer bifurcações com pistas fiéis e alternativas táticas quando disponíveis sem alterar a composição de salas.

**Architecture:** A apresentação é separada em componentes puros testáveis; a geração de mapa recebe uma versão fixada na run, preserva todas as salas e religa saídas redundantes quando possível. Um módulo puro produz pistas a partir do tipo real e da ameaça da próxima sala. A projeção server-side entrega somente as pistas e o que o jogador já descobriu; um componente único apresenta os cartões de rota no desktop e no mobile.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-21-torre-apresentacao-e-rotas-design.md`

## Global Constraints

- A Torre permanece restrita a administradores e testadores; não ativar acesso público, tickets ou baús.
- Não revelar antes da vitória nome do chefe, prêmio exato, espécie, tipo de ovo, resposta de enigma, encontro ou resultado de sala.
- Pistas verdadeiras, mas incompletas; não prometer cura, resgate ou drop condicionais.
- Não alterar probabilidades de drop, atributos de combate, Pressão, classes ou valores de recompensa.
- Runs anteriores conservam a geração antiga em todos os andares futuros; dados persistidos não são regenerados.
- Trabalhar no checkout atual e preservar alterações alheias; commits devem incluir somente os arquivos desta tarefa.

## Review Focus

1. Uma run antiga sobe de andar após a publicação: conserva `graphVersion` 1 e o mesmo mapa que geraria antes (Task 3).
2. Duas saídas oferecem o mesmo perfil apesar de nomes distintos: religar uma saída quando houver outro perfil alcançável na próxima coluna; quando não houver, informar diferenças reais de risco ou posicionamento (Tasks 3 e 4).
3. Pista de resgate/descanso sugere garantia que não existe: o texto é condicional e não divulga ocupantes ou resultados (Task 4).
4. Cliente recebe dados ocultos por outro campo da projeção: nós futuros não transportam título, tipo, puzzle ou conexões futuras desnecessárias (Task 4).
5. Arte e cartões de rota em tela estreita: pôster usa `contain` e cada opção/estado permanece legível sem depender do mapa desktop (Tasks 1 e 5).

---

### Task 1: Pôster completo e cabeçalho responsivo

**Files:** Create `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-hero.tsx`; modify `src/app/(app)/combates/torre-dos-rebeldes/page.tsx`; test `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-presentation.test.tsx`.

**Interfaces:** Produces `export function TowerHero()` (retorno JSX inferido), sem props nem dados do banco. `page.tsx` conserva `requireTowerAccess` e apenas troca o cabeçalho.

- [ ] **Step 1: Write failing test.** Renderize `<TowerHero />` com `renderToStaticMarkup`; exija `cover.png`, `object-contain` e texto “Torre dos Rebeldes”, e rejeite `bg-cover` na apresentação da arte.

  ```tsx
  const html = renderToStaticMarkup(<TowerHero />);
  assert.match(html, /cover\.png/);
  assert.match(html, /object-contain/);
  assert.match(html, /Torre dos Rebeldes/);
  assert.doesNotMatch(html, /bg-cover/);
  ```
- [ ] **Step 2: Verify RED.** `npx tsx --test 'src/app/(app)/combates/torre-dos-rebeldes/_components/tower-presentation.test.tsx'` falha porque o componente ainda não existe.
- [ ] **Step 3: Implement.** Em `tower-hero.tsx`, use layout de duas colunas no desktop e empilhado no celular, `<img>` proporcional sem corte e texto em painel próprio; substitua somente o `<header>` de `page.tsx`.
- [ ] **Step 4: Verify GREEN.** Rode o teste da Step 2 e `npm run typecheck`; ambos exit 0.
- [ ] **Step 5: Commit.** `git add -- 'src/app/(app)/combates/torre-dos-rebeldes/_components/tower-hero.tsx' 'src/app/(app)/combates/torre-dos-rebeldes/_components/tower-presentation.test.tsx' 'src/app/(app)/combates/torre-dos-rebeldes/page.tsx'`; commit `fix(tower): mostra poster completo no cabecalho`.

### Task 2: Visão geral dos andares sem spoilers

**Files:** Create `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-floor-mysteries.tsx`; modify `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-lobby.tsx`; extend `tower-presentation.test.tsx`.

**Interfaces:** Produces `export function TowerFloorMysteries()` (retorno JSX inferido), sem importar `exclusive-catalog`. `TowerLobby` usa esse componente apenas na visão `OVERVIEW`.

- [ ] **Step 1: Write failing tests.** `renderToStaticMarkup(<TowerFloorMysteries />)` deve conter “1º andar”, “7º andar” e sete cartões lacrados, sem qualquer `boss` ou `label` de `TOWER_BOSS_PRIZES`; ler `tower-lobby.tsx` e rejeitar o import do catálogo secreto.

  ```tsx
  const html = renderToStaticMarkup(<TowerFloorMysteries />);
  assert.equal((html.match(/º andar/g) ?? []).length, 7);
  for (const prize of TOWER_BOSS_PRIZES) {
    assert.doesNotMatch(html, new RegExp(prize.boss));
    assert.doesNotMatch(html, new RegExp(prize.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(readFileSync(new URL("./tower-lobby.tsx", import.meta.url), "utf8"), /import.*TOWER_BOSS_PRIZES/);
  ```
- [ ] **Step 2: Verify RED.** Rode o arquivo de teste da Task 1; falha pelo componente ausente e pelo import atual.
- [ ] **Step 3: Implement.** Troque o bloco de prêmios por sete cartões estáticos com identidade e prêmio velados; mantenha a explicação de progressão sem valores específicos. Remova `TOWER_BOSS_PRIZES` do bundle desse componente; não toque em relatório ou admin.
- [ ] **Step 4: Verify GREEN.** Rode o arquivo de teste e `npm run typecheck`; ambos exit 0.
- [ ] **Step 5: Commit.** Stage somente os três arquivos da Task 2 e commit `fix(tower): oculta chefes e premios na visao geral`.

### Task 3: Geração versionada sem alterar a composição de salas

**Files:** Modify `src/lib/tower/rooms.ts`, `src/lib/tower/pressure-rules.ts`, `src/lib/tower/turn.ts`, `src/app/(app)/combates/torre-dos-rebeldes/actions.ts`, `src/lib/tower/simulation.ts`; create `src/lib/tower/rooms.test.ts`; extend `src/lib/tower/pressure-rules.test.ts`.

**Interfaces:** Produce `type TowerGraphVersion = 1 | 2`, `type TowerRouteProfile = "CONFRONT" | "MECHANISM" | "RECOVERY" | "RESCUE" | "FIND" | "BOSS" | "ENTRANCE"`, `towerRouteProfile(kind: TowerRoomKind): TowerRouteProfile`, `TowerExplorationState.graphVersion?: TowerGraphVersion`, `generateTowerRoomGraph(seed: string, floor?: number, graphVersion?: TowerGraphVersion): TowerExplorationState`. Default `graphVersion=1` preserva chamadas antigas; início de nova run e simulação de run nova passam `2` explicitamente. Transições V1/V2 passam `state.graphVersion ?? 1`.

- [ ] **Step 1: Write failing tests.** Para sementes representativas e andares 1–7, versão 2 preserva `id`, `kind`, título, descrição e puzzle de cada sala da versão 1, entrada/recuperação/chefe fixos, reprodutibilidade e continuação válida para cada saída oferecida. Se as saídas legadas têm o mesmo perfil e outra sala da coluna seguinte possui perfil diferente, versão 2 oferece perfis diferentes; se todas têm o mesmo perfil, preserva as saídas legadas. Em `pressure-rules.test.ts`, uma run sem `graphVersion` que sobe de andar continua na versão 1, e uma da versão 2 continua na versão 2.

  ```ts
  assert.deepEqual(generateTowerRoomGraph("route-legacy", 2).graph.filter(r => r.id.startsWith("f2-c1-")).map(r => r.kind), ["LUCK", "EVENT", "RESCUE"]);
  const graph = generateTowerRoomGraph("route-contrast", 1, 2);
  assert.equal(graph.graphVersion, 2);
  const legacy = generateTowerRoomGraph("route-contrast", 1, 1);
  assert.deepEqual(graph.graph.map(({ connections, ...room }) => room), legacy.graph.map(({ connections, ...room }) => room));
  // Testar o contraste apenas quando a próxima coluna oferece perfis diferentes.
  assert.equal(transitionFloor(newExpeditionState(generateTowerRoomGraph("old"), ["ana"]), 2, "old", []).state.graphVersion ?? 1, 1);
  ```
- [ ] **Step 2: Verify RED.** `npx tsx --test src/lib/tower/rooms.test.ts src/lib/tower/pressure-rules.test.ts` falha nos casos de versão 2.
- [ ] **Step 3: Implement.** Mantenha algoritmo legado para versão 1. Na versão 2, gere as mesmas salas; quando ambas as saídas de uma sala têm o mesmo perfil e há um terceiro destino de perfil diferente na coluna seguinte, troque somente uma conexão, mantendo a outra e a conectividade. Se não há alternativa de perfil, não altere saídas. Ligue versão 2 ao início de run e simulador; propague versão nas duas transições. Não modifique efeitos de sala.
- [ ] **Step 4: Verify GREEN.** Rode os dois arquivos de teste e `npm run typecheck`; ambos exit 0. Rode `npx tsx --test scripts/tower-balance-check.test.ts`; se uma coorte canônica ficar fora da faixa de 5–15 vitórias/100, investigue o efeito do religamento sem alterar tipos de sala nem atributos de combate. Não publique se o gate final continuar falhando.
- [ ] **Step 5: Commit.** Stage somente os arquivos da Task 3 e commit `feat(tower): versiona mapas com bifurcacoes distintas`.

### Task 4: Pistas seguras na projeção de cada jogador

**Files:** Create `src/lib/tower/route-intel.ts` e `src/lib/tower/route-intel.test.ts`; modify `src/lib/tower/expedition-projection.ts`, `src/lib/tower/expedition-projection.test.ts`, `src/app/(app)/combates/torre-dos-rebeldes/actions.ts`.

**Interfaces:** Produce `type TowerRouteIntel = { signal: string; opportunity: string; risk: string }` and `getTowerRouteIntel(room: Pick<TowerRoomNode, "kind" | "index">, context?: { allyDistance?: number }): TowerRouteIntel`. Each `exploration.routes[]` and V2 `expedition.routes[]` entry gains `intel: TowerRouteIntel`; known titles continue in `title`. A visible/visited destination uses its existing known title; unknown destinations retain generic `title`.

- [ ] **Step 1: Write failing tests.** Check each room kind has meaningful, distinct, honest clues; `REST` and `RESCUE` use conditional language; `COMBAT` identifies confrontation without enemy names; `PUZZLE` does not reveal answer. In projection, an unknown adjacent route has `intel` but no true title, puzzle, reward or enemy; known `MAP`/`SCOUT` behavior remains; blocked and visited routes retain state. Hidden nodes expose no future-only `connections`.

  ```ts
  assert.match(getTowerRouteIntel({ kind: "REST", index: 1 }).opportunity, /pode/i);
  assert.match(getTowerRouteIntel({ kind: "RESCUE", index: 1 }).opportunity, /se houver/i);
  const view = projectExpeditionForMember(newExpeditionState(generateTowerRoomGraph("intel"), ["ana"]), "ana");
  assert.ok(view.routes.every(route => route.intel.signal && route.intel.opportunity && route.intel.risk));
  assert.ok(view.routes.every(route => route.visited || route.title === "Rota desconhecida"));
  assert.ok(view.rooms.filter(room => room.role === "HIDDEN").every(room => room.connections.length === 0));
  ```
- [ ] **Step 2: Verify RED.** `npx tsx --test src/lib/tower/route-intel.test.ts src/lib/tower/expedition-projection.test.ts` fails for missing clues/sanitization.
- [ ] **Step 3: Implement.** Centralize copy in `route-intel.ts`; add it to `projectExpeditionForMember` and the legacy/V2 merge in `getTowerRunStateAction`. Quando dois destinos tiverem o mesmo perfil, diferencie-os por ameaça real derivada da posição/índice e, quando disponível, distância efetiva dos aliados; não alegue diferença caso os dados sejam iguais. Never serialize the full hidden destination. Preserve known names and `blockedReason`; sanitize hidden-node `connections` without removing current/visited edges needed by the map.
- [ ] **Step 4: Verify GREEN.** Run both test files and `npm run typecheck`; both exit 0.
- [ ] **Step 5: Commit.** Stage only the five Task 4 files and commit `feat(tower): mostra pistas de rotas sem revelar salas`.

### Task 5: Cartões de escolha no celular e desktop

**Files:** Create `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-route-choices.tsx` e `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-route-choices.test.tsx`; modify `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-room-view.tsx`.

**Interfaces:** `TowerRouteChoices({ routes, selectedId, disabled, onRoute }: { routes: TowerRoutes; selectedId?: string; disabled: boolean; onRoute: (id: string) => void })` com retorno JSX inferido e `type TowerRoutes = NonNullable<Extract<Awaited<ReturnType<typeof import('../actions').getTowerRunStateAction>>, { ok: true }>['exploration']>['routes']`. The map remains supplemental; the same cards serve mobile and desktop.

- [ ] **Step 1: Write failing tests.** Static render verifies each card shows `signal`, `opportunity`, `risk`, known-return label, selected state and blocked reason/disabled attribute; cards contain no generic “Escolha 1 ou 2”. Include narrow-layout classes and accessible button labels. Use a small route fixture, not mocked server calls.

  ```tsx
  const html = renderToStaticMarkup(<TowerRouteChoices routes={routesFixture} selectedId="route-a" disabled={false} onRoute={() => {}} />);
  assert.match(html, /Passos e metal/);
  assert.match(html, /Confronto/);
  assert.match(html, /Voltar/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /Escolha [12]/);
  ```
- [ ] **Step 2: Verify RED.** `npx tsx --test 'src/app/(app)/combates/torre-dos-rebeldes/_components/tower-route-choices.test.tsx'` fails for missing component.
- [ ] **Step 3: Implement.** Replace the duplicate mobile route list with one responsive card section above the map; keep map nodes selectable on desktop and existing `onRoute`/confirmation/vote behavior unchanged. Show “Voltar” for visited route and “Bloqueada” with reason when unavailable.
- [ ] **Step 4: Verify GREEN.** Run the Task 5 test, all `src/lib/tower/*.test.ts`, `npm test`, `npm run typecheck` and `npm run build`; all exit 0. Check the presentation at 375 px and desktop width, including image framing, overflow and selected/blocked route states. Run `git diff --check` and inspect the access guard.
- [ ] **Step 5: Commit.** Stage only the Task 5 files and commit `feat(tower): apresenta escolhas de rota legiveis`.

## Final release gate

Re-run the balance test after all changes, compare its two 100-seed coortes for solo, duo, trio and strategic split, and do not publish if the 5–15/100 criterion fails. Verify the existing admin/tester gate still blocks ordinary players, both `ONLINE` and `SLOW` preserve action confirmation, and no unpublished reward appears in the overview or route payload. This repository has no configured lint script or ESLint config; record that explicitly rather than claiming lint passed. Publish only after the chosen execution workflow's final review and successful build; the event remains closed.
