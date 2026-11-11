# Amigo Oculto — handoff (admin-only, em construção)

Rotas: `/amigo-oculto` = tela do JOGADOR (só aparece quando o admin clica "publicar" na edição; antes disso só admin enxerga; sem link no menu) e `/amigo-oculto/admin` = painel de teste/debug (admin). Guard no servidor + em todas as actions (`actions.ts` admin, `player-actions.ts` jogador: o participante vem da sessão, nunca do cliente). Código: `src/lib/amigo-oculto/` (núcleo puro `core.ts`, `catalog.ts`, `cards.ts`, `service.ts`) e `src/app/(app)/amigo-oculto/`. Tabelas `ss_editions`/`ss_participants` (`prisma/migrations-manual/20261110_amigo_oculto.sql`, já aplicada).

## Fluxo
1. **Inscrição** (admin cria edição de teste; inscreve a si e testadores). Mínimo 6 para sortear.
2. **Sorteio**: ciclo único embaralhado (ninguém tira a si, sem troca direta A↔B). Publica `sha256(seed)` na hora; a seed aparece só após a entrega.
3. **Laços**: 1 check-in por dia por pessoa (dia BRT, idempotente via SQL). Meta = inscritos × dias × 75%. Níveis 1–4 em 25/50/75/100% da meta.
4. **Montagem**: presente do catálogo curado (`catalog.ts`, grátis; só tiers ≤ nível atual) + cartão só com frases prontas (`cards.ts`; sem texto livre, nada a moderar). Dá para salvar só o cartão enquanto o nível é 0.
5. **Entrega** (`deliver`, hoje botão manual): completa quem não montou com o presente padrão do nível + cartão simples. O recebedor abre o cartão (envelope animado) e só então o `PlayerGift` (TOURNAMENT_BOX) é criado na Caixa — sem bypass pelo "Receber todos". Mimo de constância (+5 comida, +3 doce) se ≥70% dos dias com check-in.

## Versão 2 (2026-11-11)
- **Pacotes reais da loja** (`catalog.ts`, 19 pacotes em 4 níveis, itens por nome resolvidos no banco com a imagem original — `catalog-db.ts`). O presenteador escolhe **3 pacotes**; na entrega o servidor sorteia **1** (determinístico: `pickIndex(seed:participante)`), sem escolha vale 3 pacotes padrão do nível. Ovos viram `MascotEgg` reais; comida/doce vão por payload; itens vão ao inventário pelo nome (TOURNAMENT_BOX).
- **Tela do jogador**: inscrição (e cancelar), "Você tirou" (persistente, dá para voltar e consultar), laços + check-in, montagem (3 pacotes + cartão), abertura animada do cartão e galeria "Cartões da Liga" depois da entrega (remetente oculto).
- **Ninguém é tirado 2×**: ciclo único + `@@unique([editionId, recipientId])` no banco; o sorteio ainda evita repetir pares de edições anteriores (best effort, `drawAvoiding`).
- **Entrega automática ao acessar**: passou de `deliverAt` e ninguém entregou → `playerView` chama `deliver` (idempotente, claim da fase). Data pretendida: 25/12/2026 00:00 BRT = `2026-12-25T03:00:00Z`. Não depende de cron.
- Migration: `prisma/migrations-manual/20261111_amigo_oculto_opcoes.sql` (já aplicada).

## Menu de debug (botão "🛠 Menu de debug" no painel)
- **Check-in diário:** grade jogador × dia; clique marca o dia (só edição de teste); atalhos "sortear 70%", "todos todos os dias", "zerar".
- **Loja de presentes:** catálogo com controle de nível simulado e conteúdo de cada item.
- **Cartinha:** montador com ilustração (emoji por enquanto; `IMAGES[].url` aceita arte pintada) e 10 frases engraçadas (`funny`), botão "Surpreenda-me".
- **Animação:** reproduz o envelope + cartão com a cartinha montada.
- **Regras:** meta %, faixas dos 4 níveis e % de constância editáveis até a entrega (`updateConfig`).

## Pendente / decisões abertas
- Datas reais, meta (75%) e catálogo final (itens/quantidades são palpite — conferir economia).
- Identidade: hoje o cartão não revela o remetente (assinatura "amigo oculto"); revelação opcional não implementada.
- Cron de entrega automática (depende de "acertar os crons"), inscrição pelo próprio jogador, artes pintadas de fundo (hoje gradientes CSS), lembrete de check-in por notificação, laços extras por atividade.
- Animação só validada por SSR/typecheck: o painel do navegador estava oculto, falta olhar no browser.
- Teste: `npx tsx --test src/lib/amigo-oculto/amigo-oculto.test.ts`; E2E de banco: `scripts/amigo-oculto-e2e.ts` (precisa de stub `server-only` em NODE_PATH).
