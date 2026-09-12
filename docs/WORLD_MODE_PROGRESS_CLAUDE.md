# World Mode — progresso da continuação (Claude)

Continuação do handoff do Codex (`docs/WORLD_MODE_HANDOFF_CLAUDE.md`). O modo
segue **exclusivo para ADMIN/SUPER_ADMIN**, com validação no servidor,
transações + advisory lock `world:<playerId>` e sem cron. Motor de combate
continua sendo o oficial (`runLeagueCombat`).

## Commits desta fase (Claude)

```text
a15fc24a  feat: add World Mode party formation
e1263d32  feat: add World Mode persistent HP and item usage
de91c11c  feat: scale World Mode trainers to player level and difficulty tiers
```

## 1. Formação própria do World Mode (prioridade #1 do handoff) — feito

- `WorldPlayerState.partyJson` guarda `[{ mascotId, posture }]` (até 6).
- `getWorldPartyMascotsAction` lista os mascotes do jogador; `saveWorldPartyAction`
  valida propriedade (**sem tocar em `isEquipped`**), limita a 6, deduplica e
  normaliza posturas.
- `challengeWorldTrainerAction` usa a formação salva (com postura por mascote) e
  revalida a propriedade a cada batalha; só cai nos equipados/favoritos quando
  não há formação — **o fallback implícito foi eliminado**.
- `readWorldParty` num módulo compartilhado (`src/world-data/party.ts`), fora do
  arquivo `"use server"`.
- UI: painel “Sua equipe do World Mode” com busca, paginação, seleção de até 6 e
  postura editável.

## 2. HP e condições persistentes (prioridade #2) — feito

- `WorldPlayerState.mascotStateJson` guarda `{ hp, poisoned }` por mascote.
- Motor da Liga ganhou `options.startingHp` (HP inicial por mascote;
  **backward-compatible**, teto continua o HP máximo — nenhum outro modo é
  afetado). Não houve reimplementação de combate.
- A batalha injeta o HP persistente, **exclui mascotes desmaiados** (erro claro
  se todos caírem) e grava o HP final reconstruído do log. **Dano permanece
  entre batalhas e rotas** e nunca é escrito nos campos permanentes do `Mascot`.
- Pokémon Center restaura **HP e condições** além da fadiga.
- `useWorldItemAction`: Potion (+60 HP) e Antídoto (remove veneno) com consumo
  real do inventário da aventura.
- UI: barra de HP por mascote, estado (desmaiado/envenenado) e botões
  Potion/Antídoto.

## 3. Dificuldade dos treinadores pareada ao jogador — feito

- Módulo puro `src/world-data/difficulty.ts` com tiers:
  - `TRAINER` (Difícil): +1 nível, força-alvo 1.18× a média do jogador.
  - `VETERAN` (Muito difícil): +2 níveis, 1.35×.
  - `LEADER` (Líder · Extremo): +3 níveis, 1.6×, **handicap ofensivo do jogador
    de −10%** (vitalidade intacta p/ HP coerente) e **iniciativa para o líder**.
- `scaleTrainerTeam` escala nível e status ao jogador **preservando a
  distribuição** (identidade dos NPCs); nunca enfraquece a base configurada.
- Cada treinador em `trainers.ts` recebe um `tier`. UI mostra badge de
  dificuldade.
- Continua no motor oficial (nenhuma fórmula paralela).

## Banco (migrações aplicadas isoladamente com `prisma db execute`)

```text
prisma/migrations/20260912200000_add_world_party         (partyJson)
prisma/migrations/20260912210000_add_world_mascot_state  (mascotStateJson)
```

A migração antiga `20260806153000_add_admin_species_registry` continua marcada
como falha e **não foi tocada**; por isso as novas foram aplicadas via
`prisma db execute`, como no handoff.

## Decisões de protótipo (pendentes de confirmação do proprietário)

- **Desmaiado (HP 0):** não pode lutar; batalha bloqueada se todos desmaiarem.
- **Recuperação:** só no Pokémon Center (full) ou via Potion (+60). Sem cura
  automática entre batalhas.
- `POTION_HEAL = 60` (constante fácil de ajustar em `actions.ts`).
- **Handicap do líder:** −10% em Força/Agilidade/Instinto/Carisma do jogador.
- **Força dos bots:** 1.18 / 1.35 / 1.6× a média de status do jogador.
- **Veneno:** estrutura + Antídoto prontos, mas **ainda não há fonte de veneno**
  (nenhum encontro/treinador aplica). Cabeado para uso futuro.

## Assets ainda faltando

Nenhum asset novo foi adicionado nesta fase (party/HP/dificuldade usam sprites
já existentes). Continuam pendentes do handoff:

- **Ginásio de Pewter — fundo interno** (~1920×800).
- **Retrato transparente de Liam** (`/world-mode/kanto/pewter-city/...`).
- **Retrato transparente de Marcus**.
- **Retrato transparente de Brock**.

Enquanto não existirem, os cards usam placeholders (nenhuma URL quebrada foi
inventada). Já existem: fundo e retratos da Viridian Forest (Noah, Milo, Iris).

Assets prováveis para as próximas etapas (ainda não solicitados/produzidos):

- Arte de fundo por rota/cidade nova ao expandir o mapa (Route 3, Mt. Moon,
  Cerulean) e para **caminhos alternativos** ao mesmo destino.
- Fundo/arte de **encontro selvagem** (hoje usa o sprite do Pokémon como
  placeholder) — recomendável ao transformar captura em batalha.

## Pedidos novos do proprietário registrados nesta sessão

- **Feito:** treinadores pareados ao nível do jogador; bots mais difíceis que a
  Arena; líderes ainda mais duros (força + iniciativa + debuff no jogador).
- **Futuro (pós-protótipo):**
  - **Mapa com vários caminhos para o mesmo lugar** (múltiplas conexões/rotas
    alternativas). Hoje o grafo em `src/world-data/kanto/mvp.ts` suporta várias
    conexões por localização; falta desenhar rotas paralelas e arte.
  - **Captura exige batalha** e **salva o estado dos Pokémon** (curados só no
    Center). A base de HP persistente (#2) já viabiliza isso; falta iniciar um
    fluxo de batalha selvagem (reaproveitando o motor + `startingHp`) antes da
    tentativa de captura.

## Próximos passos recomendados

1. **Captura por batalha** usando o motor + HP persistente (encaixa direto no
   que já existe): batalhar o selvagem, aplicar dano persistente, e só então
   permitir a Poké Ball com chance influenciada pelo HP restante.
2. **Rotas alternativas** no mapa (vários caminhos para o mesmo destino) com
   tempos/fadiga distintos.
3. **Apresentação do Ginásio de Pewter** (depende dos 4 assets): confirmação
   antes da batalha, prévia de recompensas, animação da insígnia, replay
   paginado.
4. **Fonte de veneno** (encontros/hazards) para dar uso real ao Antídoto.
5. `ITEM_SEARCH` (busca de itens por área) com tabelas configuráveis.
