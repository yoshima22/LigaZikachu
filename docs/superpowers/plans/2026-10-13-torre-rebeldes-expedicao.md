# Torre dos Rebeldes Expedition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a Torre suportar separação real, recuperação, AFK justo, dificuldade calibrada e comunicação visual/narrativa fiel às regras aprovadas.

**Architecture:** Novas runs recebem estado versionado V2 com posição por membro e encontro por sala; runs legadas mantêm o resolvedor anterior até terminar. Regras determinísticas ficam em módulos puros de `src/lib/tower`, enquanto `turn.ts` orquestra transações e `actions.ts` valida entrada/retorna projeções. A UI consome uma projeção específica do usuário e outra da party, sem decidir efeitos no cliente.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma/PostgreSQL, `tsx --test` para regras puras e `npm run typecheck` para integração.

**Spec:** `docs/superpowers/specs/2026-10-13-torre-rebeldes-expedicao-design.md`

## Global Constraints

- Não publicar para jogadores comuns antes de uma conclusão testada dos sete andares; manter o acesso fechado durante a implantação.
- Vitória somente após o chefe do 7º andar; não adicionar limite de passos nem de duração total.
- Recuperação por sala: ambos os mascotes a 50% HP; próxima utilização no andar do uso + 2, compartilhada pela run.
- Duas janelas consecutivas sem confirmar geram `AFK_ABANDONED`; a primeira avisa; AFK perde todas as recompensas da tentativa e não captura mascotes vivos.
- Drops de sala são pendentes até vencer o chefe do andar; prêmios garantidos são entregues uma vez somente no encerramento, exceto ao membro AFK.
- Sem novo ciclo comunitário; conservar Estudos e Legado. Conteúdo, preço e fontes exatas de tickets/baús são outra especificação.
- Sem introduzir dependência de testes além do `tsx` existente; usar `npx tsx --test <arquivo>` e não conectar testes puros ao banco de produção.

## Review Focus

- Duas resoluções simultâneas para o mesmo turno não duplicam movimento, drop, prêmio ou consumo de item — teste na Task 4.
- Aliado derrubado ou removido por AFK não impede iniciar o chefe; aliado vivo e distante impede — teste na Task 3.
- Um membro que confirma entre duas faltas consecutivas zera a contagem — teste na Task 4.
- Falha no andar 3 preserva drops garantidos no 2 e descarta os pendentes no 3; AFK não recebe nenhum — teste na Task 7.
- Reanimação no andar 2 bloqueia sala no 3 e libera no 4, inclusive após reconexão — teste na Task 6.

---

## File map

- `src/lib/tower/expedition-state.ts`: tipos V2, versionamento e migração apenas de projeção para UI.
- `src/lib/tower/route-rules.ts`: movimento, caminho de reencontro e portão de chefe.
- `src/lib/tower/room-resolver.ts`: resolução isolada por sala e resultado por frente.
- `src/lib/tower/pressure-rules.ts`: pressão híbrida, Sobrecarga e transição de andar.
- `src/lib/tower/recovery-rules.ts`: elegibilidade de item/sala e reanimação.
- `src/lib/tower/reward-ledger.ts`: `PENDING_FLOOR` → `SECURED` → entrega idempotente.
- `src/lib/tower/turn.ts`: transação, lock, orquestração V1/V2 e persistência.
- `src/app/(app)/combates/torre-dos-rebeldes/actions.ts`: validar ação relativa ao usuário e expor projeções.
- Componentes `tower-room-view.tsx`, `tower-run-panel.tsx`, `tower-lobby.tsx`, `tower-intro.tsx`, `tower-narrative.tsx`: mapa, feedback, tutorial, montagem e lore.
- `src/lib/tower/*.test.ts`: testes puros; `scripts/tower-simulate.ts`: simulações repetíveis sem escrita em DB.

### Task 1: Estado V2 e isolamento de runs legadas

**Files:** Create `src/lib/tower/expedition-state.ts`, `src/lib/tower/expedition-state.test.ts`; modify `src/app/(app)/combates/torre-dos-rebeldes/actions.ts` (início da run), `src/lib/tower/turn.ts` (dispatch por versão).

**Interfaces:** Produz `TowerExpeditionV2`, `TowerMemberState = "ACTIVE" | "DOWNED" | "AFK_ABANDONED"`, `newExpeditionState(graph, memberIds): TowerExpeditionV2`, `isExpeditionV2(value: unknown): value is TowerExpeditionV2`. Consome `TowerExplorationState` existente sem reescrever runs V1.

- [ ] **Step 1: Write the failing test** — `newExpeditionState` coloca 1–3 membros na entrada com estado `ACTIVE`, salas independentes e `version: 2`; `isExpeditionV2` recusa JSON V1 incompleto.
- [ ] **Step 2: Run test to verify it fails** — `npx tsx --test src/lib/tower/expedition-state.test.ts`; esperado FAIL antes das exportações.
- [ ] **Step 3: Implement the interfaces** — criar os tipos e inicializar V2 somente em novas runs; `resolveTowerTurnLocked` mantém branch V1 existente para runs antigas.
- [ ] **Step 4: Run test and typecheck** — mesmo teste PASS; `npm run typecheck` PASS.
- [ ] **Step 5: Commit** — apenas arquivos desta task, `feat(tower): version expedition state`.

### Task 2: Posição individual e caminhos de reencontro

**Files:** Create `src/lib/tower/route-rules.ts`, `src/lib/tower/route-rules.test.ts`; modify `src/lib/tower/rooms.ts` (arestas reversíveis após descoberta).

**Interfaces:** `moveMember(state: TowerExpeditionV2, memberId: string, destinationId: string): TowerExpeditionV2`; `shortestKnownPath(state, fromRoomId, toRoomId): string[] | null`. Produz erros tipados para movimento inválido; não move outros membros.

- [ ] **Step 1: Write the failing test** — Ana e Bruno escolhem saídas distintas e terminam em salas distintas; retorno por conexão aberta funciona; conexão oculta/não adjacente é recusada; caminho conhecido até o chefe identifica o aliado distante.
- [ ] **Step 2: Run failing test** — `npx tsx --test src/lib/tower/route-rules.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement movement/path** — usar grafo existente, manter posições no estado e não substituir escolhas divergentes por maioria.
- [ ] **Step 4: Verify** — teste PASS e `npm run typecheck` PASS.
- [ ] **Step 5: Commit** — `feat(tower): track individual routes`.

### Task 3: Salas e chefes por frente

**Files:** Create `src/lib/tower/room-resolver.ts`, `src/lib/tower/room-resolver.test.ts`; modify `src/lib/tower/turn.ts` para chamar o resolvedor V2.

**Interfaces:** `groupActiveMembersByRoom(state): Map<string, string[]>`; `canStartBoss(state, bossRoomId): { allowed: boolean; missingMemberIds: string[] }`; `resolveRoomFront(state, roomId, actions, combatAdapter): RoomFrontResult`. `RoomFrontResult` carrega mudanças daquela sala, eventos e KOs, sem alterar outras salas.

- [ ] **Step 1: Write the failing test** — encontro comum usa só mascotes presentes; duas salas resolvem sem misturar HP; chefe bloqueia Ana viva distante, mas não Bruno `DOWNED`/Caio `AFK_ABANDONED`.
- [ ] **Step 2: Run failing test** — `npx tsx --test src/lib/tower/room-resolver.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement isolated resolution** — reaproveitar motor de combate e catálogo atuais por adapter; cada sala mantém preview e replay próprios.
- [ ] **Step 4: Verify** — teste PASS e `npm run typecheck` PASS.
- [ ] **Step 5: Commit** — `feat(tower): resolve separated room fronts`.

### Task 4: Janela global, validação e AFK

**Files:** Modify `src/lib/tower/turn.ts`, `src/app/(app)/combates/torre-dos-rebeldes/actions.ts`; create `src/lib/tower/turn-v2.test.ts`.

**Interfaces:** `resolveTowerTurnV2(runId: string, expectedTurn: number): Promise<void>` sob lock; a submissão contém `roomId` e `globalTurn` validados contra posição/turno persistidos. Estado de AFK permanece em `TowerExpeditionV2`.

- [ ] **Step 1: Write the failing test** — turno não resolve antes de todos confirmarem, resolve no prazo com ação defensiva; segunda falta consecutiva remove; confirmação zera sequência; duas chamadas concorrentes não reaplicam efeitos.
- [ ] **Step 2: Run failing test** — `npx tsx --test src/lib/tower/turn-v2.test.ts`; esperado FAIL com adapter de persistência de teste.
- [ ] **Step 3: Implement orchestration** — validar e travar submissões, computar apenas membros `ACTIVE`, manter cron `tower-resolve` e registrar aviso/abandono nominal.
- [ ] **Step 4: Verify** — teste PASS e `npm run typecheck` PASS.
- [ ] **Step 5: Commit** — `feat(tower): synchronize turns and AFK safely`.

### Task 5: Pressão, Sobrecarga e transição de andar

**Files:** Create `src/lib/tower/pressure-rules.ts`, `src/lib/tower/pressure-rules.test.ts`; modify `src/lib/tower/turn.ts`, `src/lib/tower/talents.ts` para preservar relevância dos talentos de Pressão/movimento.

**Interfaces:** `pressureDelta(input: { activeFronts: number; mistakes: number; waits: number; shield: number }): PressureResult`; `overloadFromResults(results: RoomFrontResult[]): number`; `transitionFloor(state: TowerExpeditionV2, nextFloor: number): TowerExpeditionV2`. Constantes iniciais ficam num único objeto `TOWER_BALANCE_SEED`, substituíveis após simulações.

- [ ] **Step 1: Write the failing test** — trio unido paga base uma vez, não três; dividir aumenta custo controlado; dois sucessos em frentes distintas geram Sobrecarga limitada; um sucesso não; transição cura vivos e diminui pressão, mas não revive `DOWNED`.
- [ ] **Step 2: Run failing test** — `npx tsx --test src/lib/tower/pressure-rules.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement pure rules and connect V2** — manter modificadores existentes legíveis e teto de Sobrecarga; não criar contador comunitário.
- [ ] **Step 4: Verify** — teste PASS e `npm run typecheck` PASS.
- [ ] **Step 5: Commit** — `feat(tower): balance pressure across fronts`.

### Task 6: Recuperação e cativos

**Files:** Create `src/lib/tower/recovery-rules.ts`, `src/lib/tower/recovery-rules.test.ts`; modify `src/lib/tower/turn.ts`, `src/app/(app)/combates/torre-dos-rebeldes/actions.ts` (uso de item/sala e libertação).

**Interfaces:** `canUseRecoveryRoom(currentFloor: number, lastUsedFloor: number | null): boolean`; `reviveMember(state, targetId, source: { kind: "ITEM" | "ROOM"; actorId: string }): TowerExpeditionV2`. Item requer ator na sala do alvo; sala alcança alvo distante. `releaseCapturedMascot(mascotId, encounterId)` executa uma única vez na transação.

- [ ] **Step 1: Write the failing test** — uso no piso 2 bloqueia 3/libera 4; revive dois mascotes a 50% e só permite agir no próximo turno; item remoto é recusado; sala remota aceita; derrotar cativo devolve ao dono em repouso exatamente uma vez.
- [ ] **Step 2: Run failing test** — `npx tsx --test src/lib/tower/recovery-rules.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement recovery and captive release** — persistir `lastRecoveryFloor`, consumo idempotente e vínculo dono/mascote; AFK devolve mascotes vivos em repouso sem gerar cativeiro.
- [ ] **Step 4: Verify** — teste PASS e `npm run typecheck` PASS.
- [ ] **Step 5: Commit** — `feat(tower): recover allies and captured mascots`.

### Task 7: Espólio selado por andar e liquidação final

**Files:** Create `src/lib/tower/reward-ledger.ts`, `src/lib/tower/reward-ledger.test.ts`; modify `src/lib/tower/turn.ts` (boss/encerramento) e `src/app/(app)/combates/torre-dos-rebeldes/actions.ts` (relatório).

**Interfaces:** `recordFloorDrop(state, floor, reward): TowerExpeditionV2`; `secureFloorDrops(state, floor): TowerExpeditionV2`; `planRewardSettlement(state): RewardGrant[]` exclui membros AFK; `settleRunRewards(store: RewardGrantStore, grants: RewardGrant[]): Promise<SettlementReport>` usa `store.grantOnce(runId,userId,rewardId)` para garantir entrega única na transação.

- [ ] **Step 1: Write the failing test** — derrota no 2 descarta pendências; chefe 2 sela ovo e derrota no 3 preserva esse ovo; membro `DOWNED` recebe; AFK não recebe nada; segunda liquidação não duplica ovo/ZC/item.
- [ ] **Step 2: Run failing test** — `npx tsx --test src/lib/tower/reward-ledger.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement ledger and settlement** — prêmios de chefe existentes deixam de entrar imediatamente no inventário em V2; relatório discrimina encontrado/garantido/perdido/entregue.
- [ ] **Step 4: Verify** — teste PASS e `npm run typecheck` PASS.
- [ ] **Step 5: Commit** — `feat(tower): settle floor rewards at run end`.

### Task 8: Projeção e mapa jogável

**Files:** Create `src/lib/tower/expedition-projection.ts`, `src/lib/tower/expedition-projection.test.ts`; modify `src/app/(app)/combates/torre-dos-rebeldes/actions.ts`, `_components/tower-room-view.tsx`, `_components/tower-run-panel.tsx`.

**Interfaces:** `projectExpeditionForMember(state: TowerExpeditionV2, viewerId: string): TowerRunProjection` fornece `mine.roomId`, `members[].roomId/status/confirmed/misses`, `routes`, `bossGate`, `recoveryAvailability`, `pressureExplanation`, `floorLoot`; `getTowerRunStateAction` usa essa projeção. UI não calcula autoritativamente elegibilidade.

- [ ] **Step 1: Write the failing projection test** — membro distante aparece pelo nome e posição; rota atual, próxima e bloqueada são distintas; sala oculta não revela inimigo; chefe lista apenas vivos ausentes.
- [ ] **Step 2: Run failing test** — `npx tsx --test src/lib/tower/expedition-projection.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement projection and components** — mapa responsivo com legenda textual além de cor, escolhas travadas após confirmação, sinal nominal de separação/AFK, estado de sala e objetos interativos distinguíveis.
- [ ] **Step 4: Verify** — teste PASS, `npm run typecheck` PASS e QA manual em largura móvel/desktop com solo, dupla e trio separados.
- [ ] **Step 5: Commit** — `feat(tower): visualize separated expeditions`.

### Task 9: Classes, habilidades, lore e onboarding

**Files:** Modify `src/lib/tower/config.ts`, `src/lib/tower/talents.ts`, `src/lib/tower/narrative.ts`, `src/app/(app)/combates/torre-dos-rebeldes/actions.ts`, componentes `tower-lobby.tsx`, `tower-intro.tsx`, `tower-narrative.tsx`; create `src/lib/tower/class-effects.test.ts`, `src/lib/tower/narrative-triggers.test.ts`.

**Interfaces:** `resolveTowerClassEffects(role, context)` devolve modificadores e razões exibíveis; `sceneTriggersForTowerEvent(event)` mapeia evento real para gatilhos do catálogo. Sem cenas disparadas apenas por polling genérico.

- [ ] **Step 1: Write failing tests** — cada classe produz os bônus descritos e respeita limite/posturas; pista de sala, pressão, cativo, resgate, chefe e derrota liberam cenas corretas uma vez e na ordem; fala não revela andar futuro.
- [ ] **Step 2: Run failing tests** — `npx tsx --test src/lib/tower/class-effects.test.ts src/lib/tower/narrative-triggers.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement effects and narrative wiring** — corrigir divergências de textos, destacar impacto do rank e tornar tutorial contextual; Xandinho explica acontecimentos, sem interromper repetidamente o combate.
- [ ] **Step 4: Verify** — testes PASS, `npm run typecheck` PASS e leitura manual do fluxo narrativo nos sete andares.
- [ ] **Step 5: Commit** — `feat(tower): align classes and narrative with gameplay`.

### Task 10: Página do evento e transparência de acesso

**Files:** Create `src/lib/tower/event-disclosure.ts`, `src/lib/tower/event-disclosure.test.ts`; modify `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-lobby.tsx`, `_components/tower-run-panel.tsx`.

**Interfaces:** `buildTowerEventDisclosure(config, inventory): TowerEventDisclosure` fornece fontes/consumo/saldo de ticket por membro, regras de drop selado, estados de recuperação, ganho de Semanal→Doces e Rush→Travessuras. Dados concretos de preço/probabilidade somente de configuração aprovada na futura especificação econômica, nunca texto inventado no cliente.

- [ ] **Step 1: Write failing content tests** — informações de entrada, elegibilidade e risco antes de `Pronto`; nenhuma tela afirma ticket obrigatório quando desligado; nenhum percentual inexistente é mostrado.
- [ ] **Step 2: Run failing tests** — `npx tsx --test src/lib/tower/event-disclosure.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement visible disclosure** — textos e cartões claros; catálogo Doces/Travessuras exibe apenas itens configurados; animações e compras ficam para o plano econômico, sem stub funcional enganoso.
- [ ] **Step 4: Verify** — teste PASS, `npm run typecheck` PASS, inspeção móvel e teclado.
- [ ] **Step 5: Commit** — `feat(tower): explain event rules and rewards`.

### Task 11: Simulações e portão de abertura

**Files:** Create `scripts/tower-simulate.ts`, `src/lib/tower/simulation.test.ts`; modify documentação operacional da Torre em `docs/`.

**Interfaces:** `simulateTower(seed, partySize, buildTier, pace, routePolicy)` usa regras V2 puras, sem DB; emite CSV/JSON local de andar alcançado, turnos, pressão, HP, quedas, recuperações e espólio. Resultados não ajustam parâmetros automaticamente.

- [ ] **Step 1: Write failing reproducibility test** — mesma seed/config gera mesmo relatório; solo/dupla/trio e zero/intermediário/preparado produzem métricas completas sem prêmio duplicado.
- [ ] **Step 2: Run failing test** — `npx tsx --test src/lib/tower/simulation.test.ts`; esperado FAIL.
- [ ] **Step 3: Implement simulation and run matrix** — documentar parâmetros iniciais e revisá-los conforme distribuição de vitórias, sem deixar zero investimento matematicamente impossível; testar manualmente sete andares completos Online/Lento.
- [ ] **Step 4: Verify gate** — testes `src/lib/tower/*.test.ts` PASS, `npm run typecheck` PASS, build PASS; registrar evidências de mobile, AFK, cativo, resgate, premiação e conclusão do 7º andar.
- [ ] **Step 5: Commit** — `test(tower): simulate and validate full expedition`.

## Handoff to the separate event-economy plan

Depois deste núcleo, escrever especificação e plano próprios para fonte gratuita previsível e eventual compra de tickets, conteúdo e probabilidades exatas dos dois baús, itens persistentes, integração Semanal/Rush e animações distintas com movimento reduzido. Não habilitar ticket obrigatório nem apresentar baú comprável antes dessa entrega; não inventar drops na UI da Task 10.
