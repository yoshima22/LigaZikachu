# Amigo Oculto — handoff (admin-only, em construção)

Rota `/amigo-oculto` (sem link no menu; guard admin no servidor + em todas as actions). Código: `src/lib/amigo-oculto/` (núcleo puro `core.ts`, `catalog.ts`, `cards.ts`, `service.ts`) e `src/app/(app)/amigo-oculto/`. Tabelas `ss_editions`/`ss_participants` (`prisma/migrations-manual/20261110_amigo_oculto.sql`, já aplicada).

## Fluxo
1. **Inscrição** (admin cria edição de teste; inscreve a si e testadores). Mínimo 6 para sortear.
2. **Sorteio**: ciclo único embaralhado (ninguém tira a si, sem troca direta A↔B). Publica `sha256(seed)` na hora; a seed aparece só após a entrega.
3. **Laços**: 1 check-in por dia por pessoa (dia BRT, idempotente via SQL). Meta = inscritos × dias × 75%. Níveis 1–4 em 25/50/75/100% da meta.
4. **Montagem**: presente do catálogo curado (`catalog.ts`, grátis; só tiers ≤ nível atual) + cartão só com frases prontas (`cards.ts`; sem texto livre, nada a moderar). Dá para salvar só o cartão enquanto o nível é 0.
5. **Entrega** (`deliver`, hoje botão manual): completa quem não montou com o presente padrão do nível + cartão simples. O recebedor abre o cartão (envelope animado) e só então o `PlayerGift` (TOURNAMENT_BOX) é criado na Caixa — sem bypass pelo "Receber todos". Mimo de constância (+5 comida, +3 doce) se ≥70% dos dias com check-in.

## Pendente / decisões abertas
- Datas reais, meta (75%) e catálogo final (itens/quantidades são palpite — conferir economia).
- Identidade: hoje o cartão não revela o remetente (assinatura "amigo oculto"); revelação opcional não implementada.
- Cron de entrega automática (depende de "acertar os crons"), inscrição pelo próprio jogador, artes pintadas de fundo (hoje gradientes CSS), lembrete de check-in por notificação, laços extras por atividade.
- Animação só validada por SSR/typecheck: o painel do navegador estava oculto, falta olhar no browser.
- Teste: `npx tsx --test src/lib/amigo-oculto/amigo-oculto.test.ts`; E2E de banco: `scripts/amigo-oculto-e2e.ts` (precisa de stub `server-only` em NODE_PATH).
