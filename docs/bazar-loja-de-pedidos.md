# Bazar: abas + Loja de Pedidos

## Abas (`/bazar?tab=`)
- `anuncios` (padrão, "Vitrine"): slots do Miauvadão, TMs da Semana, filtros e anúncios dos jogadores — `_components/anuncios-tab.tsx` (código movido do antigo `page.tsx`).
- `pedidos`: Loja de Pedidos — `_components/buy-orders-tab.tsx` + `buy-orders-panel.tsx`.
- `jogos`: jogos do Miauvadão (copos, fusão de ovos).
- Cada aba só faz as queries dela (a página antiga carregava tudo sempre → menos IO no Supabase).

## Loja de Pedidos (nome provisório; alternativa: "Mural de Compras")
Jogador publica "quero comprar X por N ZC"; qualquer outro vende com um clique e recebe na hora.

Decisões:
- **Moeda**: só ZikaCoins. LigaCash fica fora (o bazar só aceita LC sob `allowLcBazar`; pode ser uma 2ª fase).
- **Sem escrow**: ZC só é debitado do criador na venda. Na publicação exige-se saldo ≥ valor (anti-spam). Na venda: `updateMany({balance gte price}, decrement)`; se falhar → `BuyOrderNoFundsError` ("este jogador não tem esse valor… volte mais tarde") e **a transação inteira reverte**, o pedido continua aberto. Pré-checagem antes da transação devolve o mesmo aviso sem tocar nos itens do vendedor.
- **Lista**: cada card mostra "✓ Venda imediata" (saldo cobre) ou "⏳ Sem saldo agora" — só um booleano, nunca o saldo. Também "Você tem" quando o jogador logado possui o item/mascote.
- **Concorrência**: `pg_advisory_xact_lock('buyorder:<id>')` + `'bazarsell:<vendedor>'`, depois claim `updateMany(status ACTIVE → FILLED)`; só um vendedor vence. Saldos só com increment/decrement.
- **Entrega**: reusa `_reserveProposalOffers` + `_deliverProposalOffers` (mesmas validações de mascote travado/equipado/arena/liga/Rebote vinculado etc. do bazar).
- **Escopo do pedido**: mascote (espécie + nível mínimo) ou item de inventário (ShopItem, quantidade vendida de uma vez; comida/doce mapeados para `MascotFoodItem`). **Fora**: ovos (variam por bônus), cosméticos, itens ocultos do bazar (`HIDDEN_BAZAR_ITEM_TYPES`, TRACE_*). Lista em `lib/bazar-orders.ts`.
- **Requisitos opcionais (mascote)**: personalidade, origem do ovo (`hatchedFromEggType`: comum/raro/especial/lab/evento/celestial) e os 3 atributos mais altos (os 3 marcados precisam ser >= os outros 2; empate vale). Validado no servidor em `matchesMascotRequirements` (`lib/bazar-orders.ts`) na lista de mascotes elegíveis, no "Vender" e na dica "Você tem".
- **Limites**: 5 pedidos abertos por jogador, preço 1..1.000.000 ZC, quantidade 1..99, validade 3/7/14 dias (sem cron: pedidos expirados somem das queries por `expiresAt`).
- **Taxa**: nenhuma ao vendedor (igual compra direta). Cofre do Miauvadão recebe os 15% "faucet" como em `buyListing`.
- **Abuso**: não vende para si mesmo; respeita `BazarPlayerTradeBan`; preço/dono/saldo validados no servidor.
- **Notificações** (categoria `BAZAR`, in-game + push): criador ("Pedido atendido") e vendedor ("Venda concluída"); também grava `BazarTransaction` (aparece na atividade/histórico) e `recordPlayerActivity`.
- **Cancelar**: só o dono, `ACTIVE → CANCELLED`.

## Arquivos
- `prisma/schema.prisma` (`BazarBuyOrder`) + `prisma/migrations/20261108120000_bazar_buy_orders/migration.sql` (já aplicada via `prisma db execute`).
- `src/lib/bazar-orders.ts` (constantes/tipos), `src/lib/bazar-orders-queries.ts` (lista paginada 12/página, índice `(status, expiresAt, createdAt)`).
- Actions no fim de `src/app/(app)/bazar/actions.ts`: `createBuyOrder`, `cancelBuyOrder`, `getBuyOrderSellOptions`, `sellToBuyOrder`.

## Pendências
- Verificação visual no navegador (exige login) e teste de venda real com 2 contas.
- Fase 2: LigaCash, ovos, aviso ao criador quando o pedido expira.
