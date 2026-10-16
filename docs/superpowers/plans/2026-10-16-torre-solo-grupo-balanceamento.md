# Torre dos Rebeldes — Solo, Grupo e Balanceamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar jogáveis o solo de quatro mascotes e as curvas distintas Solo/Grupo, buscando cerca de 10 conclusões em 100 simulações preparadas sem condenar a separação estratégica.

**Architecture:** Persistir perfil/versão/formação no início da run, adicionar reservas opcionais ao motor de combate sem alterar seus demais chamadores e compartilhar as regras de batalha/balanceamento entre resolução V2 e simulador. Preservar runs legadas e o acesso fechado; medir a curva com coortes independentes antes de qualquer liberação.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma/PostgreSQL, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-16-torre-balanceamento-solo-grupo-design.md`

## Global Constraints

- Sete andares, sem limite de movimentos ou duração total da run; Online/Lento compartilham combate.
- Dois perfis apenas: `SOLO` (um treinador, quatro mascotes: dois ativos e dois reservas) e `GROUP` (dois ou três treinadores, dois mascotes cada).
- Reservas solo entram no mesmo encontro quando ambos os ativos chegam a 0 HP, sem curar inimigos, reiniciar efeitos/rodadas ou conceder turno global; teto desse encontro: 180 rodadas.
- Meta do modelo preparado: 5–15 vitórias/100 em duas coortes independentes para solo, dupla e trio unidos e grupo estrategicamente separado; não apresentar isso como previsão da taxa real.
- Nenhuma mudança em tickets, baús, economia, lore, modos não-Torre, acesso público ou dados legados; admin/testadores mantêm acesso fechado.
- Preservar alterações preexistentes do checkout. Fazer commits apenas dos caminhos deste plano; não usar worktree, conforme preferência expressa pelo usuário.

## Review Focus

- Lobby `SOLO` com pedido simultâneo de entrada de outro jogador deve rejeitar o convite sem criar membro (Task 2).
- Reserva com HP 0 ou ID repetido não deve entrar nem ser duplicado no replay ou no inventário (Tasks 1, 3 e 4).
- K.O. dos ativos no último ciclo permitido não pode gerar vitória por HP intocado dos reservas (Task 3).
- Cron e última confirmação concorrentes não podem consumir duas vezes vantagem de reunião, kit ou prêmio de chefe (Tasks 5, 6 e 8).
- Run V2 antiga, sem perfil/versão, deve manter exatamente a formação e os parâmetros anteriores (Tasks 1, 4 e 7).

---

## File map

- `prisma/schema.prisma` + uma migração nova: enum `TowerPartyProfile`, campos `partyProfile`, `balanceVersion` em `TowerRun`; `formationSlot` em `TowerRunMascot`, todos nulos para runs antigas.
- `src/lib/tower/formation.ts`: validação e ordenação de slots; `formation.test.ts`: regras puras.
- `src/app/(app)/combates/torre-dos-rebeldes/actions.ts`: criação/entrada/troca, projeções e validação de ações; componentes `_components/tower-lobby.tsx`, `tower-run-panel.tsx`, `tower-room-view.tsx` e `tower-intro.tsx`: escolhas e explicações; replay compartilhado `src/app/(app)/combates/liga-semanal/_components/league-battle-replay.tsx` aceita reservas opcionais sem mudar chamadas atuais.
- `src/lib/league-combat.ts`: reforço opcional `reserveTeamA`; `src/lib/tower/battle-waves.ts`: resultado e HP final compartilhados pelo V2 e simulador; testes de ambos.
- `src/lib/tower/turn.ts`, `recovery-rules.ts`, `pressure-rules.ts`, `expedition-state.ts`, `balance-rules.ts`: integração persistida, recuperação, vantagem de reunião e curvas.
- `src/lib/tower/simulation.ts`, `scripts/tower-simulate.ts`, testes e `docs/TORRE_DOS_REBELDES_VALIDACAO_V2.md`: paridade, coortes e registro das decisões.

### Task 1: Persistir perfil, versão e formação sem converter runs antigas

**Files:** Modify `prisma/schema.prisma:4567-4670`; create `prisma/migrations/20261016090000_tower_party_profile_formation/migration.sql`; create `src/lib/tower/formation.ts`, `src/lib/tower/formation.test.ts`.

**Interfaces:** Produce `type TowerPartyProfile = "SOLO" | "GROUP"`; `validateTowerFormation(profile: TowerPartyProfile, mascotIds: readonly string[]): { ok: true; slots: { mascotId: string; formationSlot: number }[] } | { ok: false; reason: string }`; `activeTowerMascots<T extends { formationSlot: number | null; currentHp: number }>(profile: TowerPartyProfile | null, mascots: readonly T[]): T[]`. `null` profile means legacy two-mascot behavior.

- [ ] **Step 1: Write failing tests.** `SOLO` accepts exactly four distinct IDs and returns slots 1–4 in submitted order; `GROUP` accepts exactly two; duplicate/empty IDs fail; legacy null profile returns both snapshots even with null slots; solo returns only alive slots 1–2.
- [ ] **Step 2: Run red.** `npx tsx --test src/lib/tower/formation.test.ts` must fail because the module/functions do not exist.
- [ ] **Step 3: Add the pure module and nullable Prisma fields/migration.** `partyProfile TowerPartyProfile?` with enum `SOLO`/`GROUP`; `balanceVersion Int?`; `formationSlot Int?`. New runs write version 2; preexisting null rows retain legacy semantics. Preserve input ordering rather than Prisma `findMany` order.
- [ ] **Step 4: Verify green.** `npx tsx --test src/lib/tower/formation.test.ts`; `npx prisma validate`; `npx prisma generate`; `npx tsc --noEmit --incremental false` all exit 0.
- [ ] **Step 5: Commit exact paths.** `git add prisma/schema.prisma prisma/migrations/20261016090000_tower_party_profile_formation src/lib/tower/formation.ts src/lib/tower/formation.test.ts` then `git commit -m "feat(tower): persist party profiles and formation slots"`.

### Task 2: Criar lobbies Solo/Grupo e travar escolhas com segurança

**Files:** Modify `src/app/(app)/combates/torre-dos-rebeldes/actions.ts:1107-1530,1590-1710,2240-2310`; create `src/lib/tower/lobby-rules.ts`, `src/lib/tower/lobby-rules.test.ts`.

**Interfaces:** Consume `validateTowerFormation`; produce `canJoinTowerLobby(profile: TowerPartyProfile | null, currentMembers: number): boolean`; `createTowerRunAction` accepts `partyProfile` and IDs ordenados; `updateTowerLobbyMascotsAction` preserva slots; o perfil é congelado e `balanceVersion=2` antes do primeiro turno. Runs legadas permanecem no caminho atual.

- [ ] **Step 1: Write failing tests.** `canJoinTowerLobby("SOLO",1) === false`, `canJoinTowerLobby("GROUP",1) === true`, `canJoinTowerLobby("GROUP",3) === false`; formação solo com quatro e grupo com dois passam pelo validador; tentativa de trocar equipe após `ready` falha; ordem escolhida é preservada.
- [ ] **Step 2: Run red.** `npx tsx --test src/lib/tower/lobby-rules.test.ts` fails on missing helper/behavior.
- [ ] **Step 3: Implement server paths.** Exigir quatro mascotes no solo e dois no grupo; `join` rejeita solo dentro da transação; revalidar disponibilidade e IDs antes de escrever; revalidar perfil e formação sob lock no `start`; atualizar projeção com perfil e slots. Não modificar cobrança de ticket.
- [ ] **Step 4: Verify green.** New tests, all `src/lib/tower/*.test.ts` and typecheck pass; execute against DB de teste: convite concorrente a lobby solo não cria membro.
- [ ] **Step 5: Commit exact paths.** Commit helper, test and `actions.ts` only.

### Task 3: Reforço opcional no combate contínuo

**Files:** Modify `src/lib/league-combat.ts:23-60,314-745`; create `src/lib/league-combat-reserves.test.ts`.

**Interfaces:** Extend `LeagueCombatOptions` with `reserveTeamA?: LeagueMascot[]` and result with optional `reserveLineupA?: LeagueMascot[]`, `reserveEntered?: boolean`. The default call path remains byte-for-byte equivalent in outcome; only the optional path uses a single 180-round encounter. A log entry announces deployment; `lineupA` contains initial actives and `reserveLineupA` the bench for replay.

- [ ] **Step 1: Write failing tests.** With deterministic RNG, two weak actives die, two reserves deploy exactly once, enemy HP after deployment stays below its initial HP, and the log places the deployment between attacks of both formations; reserves at 0 HP do not deploy. At the cap, untouched reserves cannot win by HP total alone. Without `reserveTeamA`, seeded log/result equals the existing combat behavior. Include a test for effect/one-use-state continuity across deployment.
- [ ] **Step 2: Run red.** `npx tsx --test src/lib/league-combat-reserves.test.ts` fails because the option/deployment behavior is absent.
- [ ] **Step 3: Implement optional reserve deployment inside the same battle loop.** Keep reserve HP outside `hp`/alive-team until entry; apply the same precombat normalization, introduce them at the next initiative cycle after both actives fall, preserve enemy and battle-local maps, cap at 180 only in this path, and emit replay metadata. Do not perform a second `runLeagueCombat` call.
- [ ] **Step 4: Verify green.** Reserve tests, Tower unit tests and `npm test` all pass; typecheck exit 0.
- [ ] **Step 5: Commit exact paths.** Commit `league-combat.ts` and its new test.

### Task 4: Integrar as duas formações ao V2 e ao simulador

**Files:** Create `src/lib/tower/battle-waves.ts`, `src/lib/tower/battle-waves.test.ts`; modify `src/lib/tower/turn.ts:130-312,990-1000`, `src/lib/tower/simulation.ts`, `src/lib/tower/simulation.test.ts`, `src/lib/tower/run-report.ts` and corresponding test.

**Interfaces:** Produce `resolveTowerBattle(input: { active: LeagueMascot[]; reserves: LeagueMascot[]; enemies: LeagueMascot[]; random?: () => number }): { battle: LeagueBattleResult; hpByMascotId: Record<string, number>; enemyHpById: Record<string, number> }`. Simulation and persisted V2 call it; production omits `random`. `partyProfile=null`/`balanceVersion=null` uses legacy two-mascot path.

- [ ] **Step 1: Write failing tests.** A solo encounter starts with two actives, reserves fight only after double K.O., all four HP snapshots and report metrics update once, and the replay has initial/bench lineups. A group fight uses only members present in that room, with no bench; a legacy null-profile run keeps its two-mascot selection. Same seeded inputs yield same battle HP/KO in simulated and pure persisted adapters.
- [ ] **Step 2: Run red.** `npx tsx --test src/lib/tower/battle-waves.test.ts src/lib/tower/simulation.test.ts src/lib/tower/run-report.test.ts` fails on new expectations.
- [ ] **Step 3: Implement shared adapter and V2/simulator calls.** Use authoritative snapshot HP, keep living bench out of defender-count calculations at normal combat start, count all four for solo downed/disposition/rewards, and include stage marker in replay. Preserve group and legacy code paths.
- [ ] **Step 4: Verify green.** New tests, all Tower tests, typecheck pass; compare a seeded solo encounter's HP and KO between shared adapter and simulator.
- [ ] **Step 5: Commit exact paths.** Commit only adapter/tests and the listed integration files.

### Task 5: Recuperação solo, troca entre salas e estados de término

**Files:** Modify `src/lib/tower/formation.ts` and test, `src/lib/tower/recovery-rules.ts` and test, `src/lib/tower/turn.ts:75-115,950-1000,1070-1145`, `src/app/(app)/combates/torre-dos-rebeldes/actions.ts:2430-2520`; create `src/lib/tower/solo-recovery.test.ts`.

**Interfaces:** Produce `recoverSoloMascots(state: TowerExpeditionV2, actorId: string, kind: "ITEM" | "ROOM", floor: number, vitals: TowerMascotVitals[]): { state: TowerExpeditionV2; hpByMascotId: Record<string, number> }`; `switchSoloFormation(mascots: readonly { mascotId: string; currentHp: number; formationSlot: number | null }[], orderedIds: readonly string[]): { mascotId: string; formationSlot: number }[]` rejects non-permutations and requires two living actives, then the action layer applies it during an unconfirmed global turn.

- [ ] **Step 1: Write failing tests.** With one living solo mascot, room/item restores the fallen ones to 50%, only once per two floors for room and once per inventory item; with four K.O.s run ends and recovery is rejected. Switching before submission works, after confirmation fails, does not heal or add a turn; an injured bench gets transition heal but not REST heal. Concurrent last-confirm/cron resolution spends at most one item.
- [ ] **Step 2: Run red.** Recovery tests and `turn-v2.test.ts` fail on new solo behavior.
- [ ] **Step 3: Implement pure recovery/switch rules and wire into validated submissions/resolver.** Keep two-mascot group `reviveMember` unchanged; ensure one-turn idempotence and inventory conditional decrement use the existing transaction lock.
- [ ] **Step 4: Verify green.** New tests, `recovery-rules.test.ts`, `turn-v2.test.ts`, typecheck all pass.
- [ ] **Step 5: Commit exact paths.** Commit recovery, test, turn and action edits.

### Task 6: Vantagem de reunião pela separação bem-sucedida

**Files:** Modify `src/lib/tower/expedition-state.ts`, `src/lib/tower/pressure-rules.ts` and test, `src/lib/tower/turn.ts:205-225,1000-1030`, `src/lib/tower/simulation.ts` and test.

**Interfaces:** Add optional `bossOverloadCharge: number` to V2 state; produce `earnBossOverloadCharge(state: TowerExpeditionV2, successfulRoomIds: readonly string[]): TowerExpeditionV2`, `bossOverloadValue(state): number`, `consumeBossOverloadCharge(state): TowerExpeditionV2`. Earn 0.08 for two and 0.16 for three distinct simultaneous successful fronts, once per floor; at boss use `max(temporaryOverload, charge)` capped to 0.16, consume when fight starts, reset on floor transition.

- [ ] **Step 1: Write failing tests.** Two distinct successful rooms yield 0.08; duplicate room or one failed room yields 0; three yield 0.16; repeated turns never exceed 0.16; arrival/wait does not consume; first boss fight does; failed boss retry has no free charge; new floor resets; solo never earns it. Simulated split route can carry charge through an 8+ turn reunion.
- [ ] **Step 2: Run red.** `npx tsx --test src/lib/tower/pressure-rules.test.ts src/lib/tower/simulation.test.ts` fails on new assertions.
- [ ] **Step 3: Implement state transition and use the same formula in V2/simulator.** Do not change Pressão split cost or make separated `WAIT` free. Show earned/consumed reason in last turn report.
- [ ] **Step 4: Verify green.** Relevant tests, all Tower tests, typecheck pass.
- [ ] **Step 5: Commit exact paths.** Commit state/rules/tests and V2/simulator integration.

### Task 7: Duas curvas e matriz de calibração sem superajuste

**Files:** Modify `src/lib/tower/balance-rules.ts` and test, `src/lib/tower/pressure-rules.ts` and test, `src/lib/tower/turn.ts:145-235,1070-1090`, `src/lib/tower/simulation.ts` and test, `scripts/tower-simulate.ts`, `scripts/tower-balance-check.test.ts`, `docs/TORRE_DOS_REBELDES_VALIDACAO_V2.md`.

**Interfaces:** Produce `towerBalanceFor(profile: TowerPartyProfile | null, version: number | null): Readonly<TowerBalance>`; `null` legacy returns current `TOWER_BALANCE`; version 2 maps to separate `TOWER_BALANCE_SOLO_V2`/`TOWER_BALANCE_GROUP_V2`. Extend floor-specific scale and transition settings in `TowerBalance`; simulator override remains offline. Extend `routePolicy` with `STRATEGIC_SPLIT`: seek two distinct successful fronts in one turn, then regroup by shortest known routes without optional detours. CLI outputs profile, version, seed cohort, route policy, boss progress and wins.

- [ ] **Step 1: Write failing tests.** Solo/group selectors differ, null legacy matches old attributes/escort/heal exactly, Online and Lento same-seed paths match, and CLI summary reports the independent cohorts without raw run dump. Baseline cohort tests fail before constants are tuned because trio 100/100 and solo 0/100.
- [ ] **Step 2: Run red.** `npx tsx --test src/lib/tower/balance-rules.test.ts src/lib/tower/simulation.test.ts scripts/tower-balance-check.test.ts` fails for the expected missing selectors/acceptance.
- [ ] **Step 3: Implement shared profile resolver, then calibrate one axis at a time.** Search enemy floor scales in 0.01 steps, transition-heal fractions in 0.02 steps and escort counts as integers; record before/after per floor. Tune canonical `PREPARED` solo, duo/trio united and strategic split on `validate-0..99`, then verify on `holdout-0..99`. Accept only 5–15 wins in both cohorts for each cell; if a single `GROUP` profile cannot meet duo/trio without extreme distortion, stop and report instead of adding a third profile. Keep `ZERO` trio first boss attainable and `INTERMEDIATE` capable of some floor-3 arrival.
- [ ] **Step 4: Verify green and robustness.** Run CLI matrix for both coortes and alternate species/stats/roles, AFK and cativo; all Tower tests, `npm test`, typecheck, and `npm run build` exit 0. Update validation document with exact constants and observed cells, including any unmet goal.
- [ ] **Step 5: Commit exact paths.** Commit profile, sim, CLI, tests and validation document.

### Task 8: Interface, persistência e portão de abertura

**Files:** Modify `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-lobby.tsx`, `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-run-panel.tsx`, `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-room-view.tsx`, `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-intro.tsx`, `src/app/(app)/combates/liga-semanal/_components/league-battle-replay.tsx`, `src/app/(app)/combates/torre-dos-rebeldes/actions.ts` projections; add focused UI/pure projection tests under `src/lib/tower`; update `docs/TORRE_DOS_REBELDES_VALIDACAO_V2.md`.

**Interfaces:** UI consumes persisted `partyProfile`, `formationSlot`, `reserveEntered` and `bossOverloadCharge`; no client-side reward/HP decisions. Solo/group copy and mobile layout must explain active/reserve and why group split earned/consumed a boss advantage.

- [ ] **Step 1: Write failing projection tests.** Admin-only solo displays four in 2+2 order and group two/member; replay announces the second formation and shows its mascotes only after deployment; recovered/defeated reports list all four; no public user receives access. Add a regression test that the optional replay prop leaves existing Liga Semanal callers unchanged.
- [ ] **Step 2: Run red.** Focused projection tests fail on missing fields/copy.
- [ ] **Step 3: Implement lobby/run/tutorial UI and server projection.** Add explicit Solo/Grupo control, 2+2 picker, swap confirmation, recovery actions, and visible capped boss advantage. Mobile check at 360px and 720px, reduced motion and keyboard interactions.
- [ ] **Step 4: Verify green.** Full Tower tests, `npm test`, Prisma validation, typecheck and build pass. In an isolated test DB perform authenticated Online and Lento seven-floor runs for solo and group, including reserve entry, cativo, reconnect and concurrent cron/last click; prove one inventory/prize grant and one charge consumption. If test DB or accounts unavailable, mark the public gate blocked—do not infer success from unit tests.
- [ ] **Step 5: Commit exact paths; keep event gated.** Review `git diff`/status to exclude unrelated user files. Deploy only behind existing admin/tester restriction; do not enable tickets/chests/public toggle. Document any remaining blocker and actual counts, never claim 10% real-player win rate.
