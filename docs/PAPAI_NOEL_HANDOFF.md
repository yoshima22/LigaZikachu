# Papai Noel (evento de Natal 2026)

Papai Noel de trenó cruza a tela e entrega um presente simples a cada 4–6 h por jogador.

- **Janela**: 01/12/2026 00:00 → 26/12/2026 00:00 BRT (`SANTA_STARTS_AT/ENDS_AT` em `src/lib/papai-noel.ts`).
- **Liga/desliga**: painel Admin → aba "Economia e passes" → "Papai Noel" (só ADMIN). Grava `AppSetting` `santa_event` `{enabled, ignoreWindow}`. Sem registro = ligado (dentro da janela). `ignoreWindow` serve para testar fora de dezembro (desligar depois). Efeito em até ~30 s (cache em memória).
- **Cooldown**: sorteado a cada resgate entre 4 e 6 h; guardado em `santa_claims.nextAvailableAt` (1 linha por jogador). Migração: `prisma/migrations/20261119130000_santa_claims` (já aplicada via `db execute`).
- **Prêmios** (pesos, soma 100): 10 ZC (30), 25 ZC (15), 50 ZC (5), 2 Comidas (25), 1 Doce (20), 3 Doces (4), 1 Doce Raro (1). Editar em `SANTA_PRIZES`.
- **Entrega direta** (sem Caixa de presentes, para o jogador ver o ganho na hora): ZC via `creditCoins` (increment atômico, tipo `ADMIN_ADJUSTMENT`, descrição "Presente do Papai Noel"); comidas via `mascotFoodItem` increment. Tudo em `$transaction` com `pg_advisory_xact_lock(hashtext('santa:<playerId>'))` — `claimSantaGiftAction` em `_components/papai-noel-actions.ts`.
- **Custo de banco**: o layout só chama `isSantaActive()` (setting em memoTtl 30 s; fora da janela nem consulta). O cliente (`papai-noel-gate.tsx`, lazy) guarda `santa-next-at` no localStorage e só pergunta ao servidor (1 consulta por PK) quando o cooldown local venceu.
- **Animação**: SVG inline + CSS, sem dependências; só o trenó recebe cliques; `prefers-reduced-motion` mostra um botão "Pegar presente".
