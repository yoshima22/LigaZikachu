# Navegação, Bazar e presentes — 15/10/2026

## Alterações locais

- Compra direta: lock por anúncio compatível com os fluxos de propostas; atualização condicional exige anúncio ativo, mesma versão, preço e vendedor. Débito ZC exige saldo suficiente no próprio UPDATE. Falhas abortam a transação, inclusive entrega e crédito.
- Crédito ao cofre global do Miauvadão movido para o último passo da compra direta. Continua na mesma transação, mas não mantém a linha global bloqueada durante entrega, estornos de propostas e logs.
- Resgate em lote: seleção inicial apenas dos IDs; UPDATE condicional com RETURNING recupera a recompensa atual e confirma o resgate em uma única consulta. Se a entrega falhar, a transação reverte o resgate. Tentativas repetidas não recebem a mesma recompensa novamente.
- Pacotes de figurinhas: consulta de propriedade limitada aos IDs sorteados, dentro da transação, sem carregar a coleção inteira.
- Navegação: contagem de presentes, duas carteiras e notícias são consultadas em paralelo. Cache, tags de invalidação e fallbacks preservados.

Não foram alterados pool de conexões, schema, RLS, polling ou realtime. Nenhum registro de produção foi modificado nesta revisão. Código não publicado.

## Verificação

- `node scripts/test-concurrent-flows.cjs`: executa funções reais com fronteiras de banco simuladas; cobre anúncio obsoleto, saldo consumido por outra operação, reversão em falha de entrega, ordem do crédito ao cofre, filtro de inventário, resgate repetido e paralelismo do menu.
- `npm test`: testes existentes do Bazar.
- `node scripts/test-egress-optimizations.cjs`: regressões anteriores.
- `npx tsc --noEmit --incremental false` e `npx next build`.
- EXPLAIN sem ANALYZE validou a consulta UPDATE RETURNING no banco configurado: plano com Index Scan. Não executou o UPDATE.

Os testes simulados não constituem teste de carga nem prova de concorrência PostgreSQL entre sessões reais. Na amostra atual de pg_stat_activity não havia bloqueios; não foi capturado o pico reportado pelo usuário.

## Limites e acompanhamento

O catálogo elegível de figurinhas ainda é consultado por pacote; não foi adicionado cache que pudesse deixar recompensas desatualizadas. O cofre continua sendo uma linha compartilhada e outros fluxos ainda o escrevem. Estas melhorias reduzem trabalho e duração dos locks, não eliminam todos os gargalos.

Após publicação, correlacionar duração de ações, logs existentes `[gift-claim-batch]`, erros Prisma de timeout, conexões/locks, CPU e I/O do banco durante pico. Testar concorrência em ambiente isolado antes de aumentar capacidade ou quantidade de conexões. Não prometer aumento de jogadores suportados sem esse teste.
