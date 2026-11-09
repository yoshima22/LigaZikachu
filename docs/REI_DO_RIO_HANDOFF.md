# Rei do Rio — Trono de Natal (handoff v1)

Modo semanal PvP assíncrono. **Fechado ao público: só ADMIN/SUPER_ADMIN** (nunca GM). Sem recompensas reais.

## Onde está
| O quê | Caminho |
|---|---|
| Regras e motor (puros, sem banco) | `src/lib/rei-do-rio/{config,schedule,team,scoring,standings,auto-build,engine,simulate,report}.ts` |
| Banco / máquina de estados / cron | `src/lib/rei-do-rio/service.ts`, `view.ts`, `src/app/api/cron/rei-do-rio/route.ts` (`*/5 * * * *`) |
| UI e actions | `src/app/(app)/combates/rei-do-rio/` |
| Tabelas | `rdr_editions/participants/day_states/rounds/matches` — `prisma/migrations-manual/20261109_rei_do_rio.sql` (já aplicada) |
| Testes | `npx tsx --test src/lib/rei-do-rio/rei-do-rio.test.ts` · E2E no banco: `npx tsx scripts/rei-do-rio-e2e.ts` (edição de teste, apaga no fim) · balanceamento: `npx tsx scripts/rei-do-rio-sim.ts 16 2` |

## Reuso (nada duplicado)
- Combate: `runLeagueCombat` (Liga Semanal) com `startingHp` + `includeFinalHp`. Seed reproduzível: `Math.random` é trocado por mulberry32 durante a luta (seed gravada em `rdr_matches.seed`).
- Pareamento: `swissPairSlot` (BYE justo, anti-revanche). Posturas: `canSelectTrainingStance` + `MascotStanceUnlock`. Replay: `LeagueBattleReplayModal`.
- Acesso: mesmo padrão da Torre (`platformAdminOnly` no menu + guard no servidor na página **e** em cada action).

## Decisões / hipóteses (ajustáveis em `ReiConfig`, por edição via `configJson`)
- **Snapshot no fechamento (seg 21h):** atributos dos 18 ficam congelados na semana (isolamento de outros modos). Quem não passa na revalidação do fechamento (ex.: vendeu mascote no bazar) sai da edição e fica em `configJson.lockDropped`.
- **Trocas:** só entre combates (`applyBattleToState` → `chooseActives`). `KEEP` padrão; `PRESERVE` com limiar `swapHpGapPct = 15` pp.
- **Pontos** (centésimos, inteiros): orçamento por equipe/combate dano 25 · KO/assist 20 · suporte 25 · resistência 15 · vitória 15 (+ topo ≤ 3). Só dano/cura **efetivos** contam; sobra de dano e cura acima do HP perdido não pontuam. Origem por categoria em `statsJson` e `scoresJson.points`.
- **Pressão do Trono / Corrente Favorável:** níveis por classificação congelada da rodada anterior (−2/−4/−6% topo 20%; +2/+4% base 25%; decaem 1 nível/rodada ao sair). Aplicados como multiplicador em Força/Instinto/Vitalidade/Carisma **só no combate** (Agilidade e HP intactos; engine compartilhado não foi alterado).
- **Time sem combatentes:** adversário vence sem luta (só pontos de vitória). **Ímpar:** BYE sem pontos (regra do suíço existente).
- **Confiabilidade:** rodada reivindicada por token (PENDING→PROCESSING), cálculo em memória, gravação numa transação com advisory lock; falha devolve para PENDING; PROCESSING > 5 min é recuperado. Descanso só abre na mesma transação que consolida a rodada das 21h.

## Limites conhecidos / próximos passos
1. **Habilidades passivas:** o motor da Liga Semanal não executa habilidades (só Arena Draft). O Rei do Rio herda exatamente isso; integrar exige extensão compatível do motor.
2. **Debuff/buff no pontuador** usa o texto do log (Encorajador/Oportunista). Se o motor ganhar eventos estruturados, trocar o parser.
3. **Desempenho:** ~5 s/rodada com 7 participantes (latência do banco, updates sequenciais). Para dezenas de jogadores: atualizar participantes/estados em lote (SQL único). Cron roda no máx. 4 rodadas por chamada.
4. **Balanceamento (sim. 16 jogadores):** ≈4,7 KOs/combate e ~3 slots esgotados por jogador/dia — o dia é duro; força do time pesa mais que a composição. Avaliar reservas mais fortes, limiar de troca e teto de suporte antes de abrir ao público.
5. Recompensas, notificações e abertura ao público ficam para depois (nada foi criado/descontado).
6. Edições reais usam `autoRun` (cron). Edições de teste avançam pelo painel Admin e ignoram horários.
