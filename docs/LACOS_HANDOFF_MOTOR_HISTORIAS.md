# Laços — Handoff do motor de histórias, arcos e brigas

Documento de continuidade para quem for seguir o trabalho (Codex). Cobre **o que já
foi implementado** (Fases 1–3b, no ar), **onde mexer** (arquivos, tabelas, knobs) e
**os planos** das etapas restantes (3c, 4, 5) com notas de design.

Fonte de conteúdo narrativo: [`docs/LACOS_EXPANSAO_HISTORIAS_MODULARES.md`](LACOS_EXPANSAO_HISTORIAS_MODULARES.md)
(banco do usuário). Panorama do sistema antigo: [`docs/LACOS_SISTEMA_DE_HISTORIAS.md`](LACOS_SISTEMA_DE_HISTORIAS.md).

## 0. Commits desta frente (main)

| Commit | Fase | Conteúdo |
|---|---|---|
| `3ae44d3a` | 0 | Banco modular como dados (`bond-stories-data.ts`) + doc-fonte em `docs/` |
| `70269f57` | 1 | Motor narrativo contextual (seleção por pontuação, cooldowns, placeholders) |
| `2a7b8edb` | 2 | Arcos + callbacks + memória estruturada (tabela `MascotBondPairState`, migração 041) |
| `d9506c14` | 3a | Brigas reais no refúgio (combate da Liga, narrativa, replay guardado, sem punição) |
| `be794973` | 3b | Replay gráfico das brigas no diário (reuso do `LeagueBattleReplayModal`) |

---

## 1. Arquitetura atual

### Arquivos
- **`src/lib/bond-stories-data.ts`** — GERADO do documento. 408 frases (`BOND_STORY_PHRASES`) + 16 arcos (`BOND_STORY_ARCS`). Tipos `StoryPhrase`, `StoryArc`. **Regenerar** a partir do .md, não editar à mão (o script de extração lê os blocos ```json do documento).
- **`src/lib/bond-story-engine.ts`** — motor puro (sem DB):
  - `tierFromScore(score)` → tier (`NEMESIS…SUPER_AMIGO`).
  - `selectPhrase(slot, ctx)` — filtra `slot/local/resultado`, **exclui** frases com `personalidade/tier/tipoElemental` incompatíveis, dá **bônus** às que casam, **penaliza** `id`/`familiaNarrativa` recentes (cooldown), sorteia por peso.
  - `buildRefugeStory(ctx, localLabel)` → `{ text, phraseIds, families }`. Monta `[ABERTURA] {A} e {B} [VERBO] quando [REAÇÃO]. [DESFECHO]`; detecta aberturas terminadas em "quando" (forma alternativa).
  - `resolvePlaceholders(text, ctx, localLabel)` — `{A} {B} {DONO_A} {DONO_B} {ELEMENTO_A/B} {PERSONALIDADE_A/B} {LOCAL} {CONTAGEM_ENCONTROS}`; limpa `{MEMORIA_*}`/`{OBJETO_MEMORIA}` não resolvidos.
  - `stepArc(state, location, ctx)` — inicia/avança arco do local; PAYOFF cria **tag**; devolve `{ text, arcId, beat, resultado, newState, tagCreated }`.
  - `pickCallback(ctx, tags, localLabel)` — callback raro liberado por tag de arco concluído.
  - Tipos exportados: `StoryContext`, `StoryActor`, `PairStoryState`, `PairArcState`, `StoryTier`.
- **`src/lib/bond-fight.ts`** — `runRefugeFight(a, b)` (reusa `toLeagueMascot` + `runLeagueCombat` de `league-combat.ts`) e `fightNarrative(fight, label)`. **Puro** — não grava HP/dano/lesão.
- **`src/lib/mascot-bonds-v2.ts`** — orquestra tudo em `simulateRefugeMoment(tx, playerId, location)`. É o coração; ver seção 2.

### Banco de dados
- **`MascotBondPairState`** (migração manual `prisma/migrations-manual/041_bond_pair_state.sql`, já aplicada em prod):
  - `pairKey String @id` — ids dos 2 mascotes ordenados por `:`.
  - `arcsJson Json?` — `[{ arcId, beatIndex }]` (arcos ativos; `beatIndex` = próximo beat a tocar).
  - `tagsJson Json?` — `string[]` de tags de payoff (hoje = `arcId` concluído).
- **`MascotBondMemory.metadata`** agora carrega: `location, scoreDelta, conflict, trainerInfluence, personalities, phraseIds, families, arcId?, arcBeat?, fight?`.
  - `fight = { winnerId, loserId, rounds, replay: { log, lineupA, lineupB } }` — quando o encontro virou briga.

### UI
- **`bonds-v2-admin.tsx`** — monta os objetos `stories` (a partir das memórias) e injeta `fight` de `metadata.fight`.
- **`bonds-v2-controls.tsx`** — `RefugeLocationScene` renderiza o diário; cada relato com `fight` mostra **"⚔️ Ver briga"** que abre `LeagueBattleReplayModal` (importado de `combates/liga-semanal/_components/league-battle-replay`).

---

## 2. Fluxo do `simulateRefugeMoment` (ordem atual)

1. Seleciona 2 mascotes (dono + visitante de outra conta quando existe). Admins são excluídos.
2. `socialDelta(location, personality) + suggestion(influência do jogador)` → `delta` base. `conflictChance` por local (Treino 0.55, resto 0.18), reduzida pela influência.
3. `conflict` tentativo.
4. Se há `second`: carrega donos, relação atual (score/tier/interações), últimas 20 memórias (cooldown) e `MascotBondPairState`.
5. **Arco**: `stepArc` pode iniciar/avançar um arco → o `resultado` do beat **sobrescreve** `conflict`. Senão, `buildRefugeStory` gera a história modular.
6. **Callback**: se há tags, `pickCallback` pode prefixar uma frase de memória.
7. **Briga**: se `conflict` e `score <= -15`, com chance (`Treino 0.35 / resto 0.15` + bônus por Inimigo/Nêmesis), roda `runRefugeFight`; `storyText` vira a narrativa da briga e `fightData` guarda o replay.
8. `appliedDelta`: briga → forte negativo; arco POSITIVE/CONFLICT → sinal do beat; senão regra antiga.
9. Atualiza `MascotRelation` (direção first→second), **persiste `MascotBondPairState`**, grava a memória (com `phraseIds/families/arcId/fight`), e cria evento importante (**pula** quando foi briga).

### Knobs (onde equilibrar)
- **Cooldowns**: `selectPhrase` em `bond-story-engine.ts` (`recentIds` peso ×0.02, `recentFamilies` ×0.12). Janelas: últimas 20 memórias (ids) / 8 (famílias) em `mascot-bonds-v2.ts`.
- **Bônus de especificidade**: `selectPhrase` (personalidade ×2.2, tier ×1.8, elemento ×1.8, local ×1.3, resultado ×1.2).
- **Arcos**: `stepArc` — avançar 45%, iniciar novo 22%, máx. 2 ativos.
- **Conflito por local**: `conflictChance` em `simulateRefugeMoment`.
- **Brigas**: `fightChance` em `simulateRefugeMoment`.

---

## 3. Plano — Fase 3c: dinâmicas multi (amigo se une / rival se intromete)

Objetivo do usuário: durante uma briga, um **amigo pode se juntar** contra um rival (2v1),
ou um **rival pode se intrometer** para atacar um oponente enfraquecido.

Notas de design sugeridas:
- No momento da briga (passo 7), olhar os **outros mascotes ATIVOS no mesmo local** (já há
  `locationMascots` e é possível carregar relações via `mascotRelation`).
- **Aliado**: um mascote com relação **AMIGO+ (score ≥ 40)** com um dos brigões e **hostil
  (≤ −15)** com o outro pode entrar do lado do amigo → time 2×1 em `runLeagueCombat([amigo, brigãoX], [brigãoY])`.
- **Intruso**: um mascote **RIVAL/INIMIGO (≤ −15)** de um dos dois pode entrar como 3º atacante
  oportunista (pode ser modelado como 1×2 ou um segundo round).
- Efeitos de relação: vitória/derrota ajusta a relação de **todos os envolvidos** (o aliado
  ganha relação com quem ajudou e perde com quem atacou). Continuar **sem punição** de HP/repouso.
- Reaproveitar `bond-fight.ts` — generalizar `runRefugeFight` para aceitar `teamA[]`/`teamB[]`
  em vez de 1×1, e `fightNarrative` para múltiplos.
- O replay já suporta lineups com vários mascotes (é o motor da Liga), então o visualizador
  não muda.
- Frequência baixa (é um evento "especial"); logar `fight.participants` na metadata.

---

## 4. Plano — Fase 4: itens ativáveis + anti-afastamento

Pedido do usuário:
1. Manter os itens úteis nas "perguntinhas", **mas** permitir **ativá-los** numa janela
   própria para **construir a relação de propósito** (sem exagero — itens são abundantes).
2. Ao tentar **desfazer um vínculo** (afastamento), o **outro dono** deve receber uma
   **notificação** para poder **usar um item e impedir o afastamento**.

Notas:
- **Janela de ativação**: nova ação server (`activateBondItemAction(itemType, mascotAId, mascotBId)`)
  que consome um item `BOND_*` e aplica um efeito direto na relação (ex.: `BOND_SHARED_BERRY`
  +4/+2; `BOND_TRUCE_BELL` limita variação a ±2; `BOND_REVENGE_TOKEN` cria rivalidade
  controlada). Ver catálogo em `docs/LACOS_2_ITENS_E_BALANCEAMENTO.md`. Limitar por
  cooldown/dia para não virar "farm" (itens são abundantes).
- **Anti-afastamento**: o fluxo de "afastamento/distância" já existe em `mascot-bonds.ts`
  (procurar `distanceStartedAt`, `dormantAt`, `promiseCharm*`, `BOND_DISTANCE_*`). Quando um
  jogador inicia o afastamento de um vínculo que envolve o mascote de **outro** dono, criar
  `PlayerNotification`/DM (categoria `MASCOTES`, respeitar preferências — ver
  [`project_notification_preferences`]) para o outro dono, com uma ação para **usar
  `BOND_PROMISE_CHARM`** (Amuleto de Promessa) e cancelar. Já existe `promiseCharmResolvesAt`
  no schema e tratamento no cron `api/cron/mascot-bonds/route.ts` — reaproveitar.

---

## 5. Plano — Fase 5: UI

### 5.1 Círculo de Amigos / Clube da Luta
- **Bug atual**: o card do "círculo do Zigzagoon" nem inclui o Zigzagoon e não mostra o efeito
  de cada um. A detecção está em `simulateRefugeMoment` (`friendCircleActive`/`fightClubActive`
  via `nearbyRelations`) e o efeito de combate vem de `getTeamBondCombatContext` /
  `getOpposingBondCombatEffects` em `mascot-bonds.ts`.
- **Objetivo**: no card, listar **os mascotes envolvidos + o dono de cada** e o **efeito exato**
  que cada um recebe ali (ex.: "+2% dano / −2% recebido enquanto ambos aptos"), estando ou não
  no refúgio. Reusar `relationEffectV2(score)` (em `mascot-bonds-v2.ts`) para o texto do efeito.

### 5.2 Perfil social entre jogadores
- Hoje mostra uma lista de conhecidos pouco útil.
- **Objetivo**: ao ver o perfil de **outro jogador**, destacar os mascotes que têm **amizade
  ou rivalidade** com os mascotes dele, exibir **ações diretas** disponíveis (influência, item),
  e uma **estatística geral** de como seus mascotes se relacionam com os dele (nº de amizades /
  rivalidades / tier médio). Dados vêm de `MascotRelation` cruzando os mascotes dos dois donos.

### 5.3 Gerenciar mascotes
- Adicionar **paginação** e mostrar a **personalidade** de cada mascote.
- Se o mascote estiver **ocupado** em outra atividade, exibir um badge do tipo ("Em expedição",
  "No Refúgio", "No Bazar"…). Obs.: os que **já são removidos da lista** por ocupação não
  precisam do badge. Componente: `bonds-v2-controls.tsx` (seleção/gerência de mascotes).

### 5.4 Relatos: 50 páginas + relatório gráfico
- **Problema**: os relatos têm "páginas incontáveis".
- **Objetivo**: limitar a **50 páginas** (as mais recentes) e montar um **relatório-resumo
  gráfico** por treinador/mascote: pontos de **rivalidade e amizade**, **conquistas** e
  **estatísticas** dos mascotes envolvidos. Ex.: contagem por tier, top rivais/amigos, evolução
  no tempo. Fonte: `MascotBondMemory` (metadata: `conflict`, `scoreDelta`, `fight`) e
  `MascotRelation`. A paginação de relatos hoje está em `RefugeLocationScene`
  (`storyPage`/`storiesPerPage`).

---

## 6. Como testar rápido (sem prod)
- Motor puro: importar `buildRefugeStory`/`stepArc`/`pickCallback` de `bond-story-engine.ts`
  num script `tsx` e imprimir amostras (foi assim que validamos Fases 1–2).
- Briga: `runRefugeFight(a, b)` com stats de exemplo imprime vencedor/rodadas/log.
- Ciclo real: `simulateRefugeMoment` roda no cron `api/cron/mascot-bonds/route.ts` e na ação
  admin `simulateRefugeV2Action`.

## 7. Gotchas
- `simulateRefugeMoment` roda dentro de `$transaction`; combates são compute puro (ok), mas
  evitar queries pesadas extras no loop.
- Preferências de notificação: qualquer `sendNotificationTo*` novo deve passar `category`
  (ver `project_notification_preferences`).
- Saldos/itens: usar operações atômicas (increment/decrement), nunca ler-e-regravar
  (ver `project_wallet_atomic_updates`).
- `bond-stories-data.ts` é gerado — ao ampliar o banco, editar o `.md` e regenerar.
