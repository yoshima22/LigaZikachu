# Capacidade e resposta — primeira etapa, 29/09/2026

## Implementação

- Presentes: página limitada a 24 cards, com navegação e contagem total.
- Resgate em massa: chamadas sequenciais de até 25 presentes, interrompendo a seleção de novos itens após 8 segundos. A transação que já começou pode levar mais tempo. A interface continua os lotes automaticamente, mostra restantes e interrompe em falha ou ausência de progresso.
- O cliente não solicita revalidação das cinco páginas a cada lote; as tags do jogador são invalidadas e a página é atualizada ao terminar.
- Pacotes concedidos por presentes usam a mesma transação do resgate. Falha na abertura mantém o presente disponível. Figurinhas inexistentes também não são marcadas como entregues.
- Conversões em moedas só são exibidas depois do commit.
- Alimentação: seleção de elegíveis no SQL, limite de 100 por chamada e continuação automática. Estoque, alimentação e jobs de EXP continuam na mesma transação.
- Felicidade é incrementada sobre o valor atual do banco, evitando sobrescrever uma interação concorrente com o snapshot antigo. O update também verifica novamente o estado de Arena.
- Cards e lista do banco recebem o horário de alimentação confirmado pelo servidor e a alteração de estoque. Um refresh com horário anterior não desfaz o horário local confirmado.
- A lista do banco deixou de disparar duas consultas na montagem.
- Logs de resgate incluem duração, quantidade concluída, falhas e restantes.
- EXP em lote invalida o cache uma vez por jogador e limita o processamento imediato a 40 segundos entre grupos; jobs restantes continuam disponíveis para o cron.

## Backup

Concluído e verificado: `backups/consistent-2026-09-29T17-21-54-864Z/manifest.json`, com 186 tabelas e 987.962 registros. Inclui 26 usuários, 23 jogadores, 23 carteiras ZikaCoin, 2.786 mascotes e 59.261 registros de presentes. O verificador independente também passou. O schema Prisma e as migrations locais foram copiados para essa pasta como referência. A tentativa anterior foi interrompida e marcada `INCOMPLETE.txt`.

`node scripts/backup-consistent.mjs` carrega o ambiente como Next.js e exporta todas as tabelas públicas em transação somente leitura e REPEATABLE READ. Usa cursor de servidor para leitura sequencial. Os JSONs mantêm a representação numérica do PostgreSQL. Cada página tem SHA-256 e contagem no manifesto.

Somente `manifest.completed: true` indica que a exportação inteira e a verificação de arquivos terminaram. Diretórios sem manifesto ou com `completed: false` são incompletos. Os arquivos ficam em `backups/`, ignorado pelo Git, e contêm dados sensíveis.

Esta exportação é de dados. Não inclui funções, permissões, objetos de outros schemas, arquivos do Storage ou uma restauração testada. Para recuperação integral da infraestrutura, manter também o backup nativo/PITR do provedor e ensaiar restauração em banco isolado. Não importar uma cópia antiga sobre jogadores ativos: isso apagaria progresso posterior.

## Verificação e publicação

- `npm run typecheck`, `git diff --check` e `node --test scripts/verify-backup.test.mjs` passaram durante esta etapa.
- Simulação isolada executa o código real das ações com adaptador Prisma reduzido e PostgreSQL WASM (PGlite), autenticação sintética e dependências externas substituídas. Passaram: autorização, lotes 25/25/11, rollback após falha de auditoria, rollback do pacote, 20 resgates concorrentes do mesmo presente, alimentação 100/100/5 e alimentação concorrente sem desconto duplicado.
- Testes de componentes em React/jsdom passaram: loading imediato, continuação automática, interrupção em falha, erros visíveis e eventos de atualização de card/estoque com horário confirmado pelo servidor.
- `npm run build` passou: compilação, tipos e geração de 73 páginas estáticas.
- Ainda precisam de homologação ponta a ponta: rede interrompida, card expandido, concorrência entre alimentação e entrada na Arena, execução real dos jobs de EXP e outras recompensas. O teste de pacotes valida compartilhamento/rollback da transação por um substituto da entrega; não cobre sorteio e todos os tipos de pacote.
- Conferir saldo, inventário, estado dos presentes e jobs de EXP antes/depois. Não basta verificar toasts.
- Nenhuma migração de schema foi necessária. O envio ao branch principal aciona a publicação configurada no repositório.

### Simulação de carga local

| Contas concorrentes | Presentes | Tempo total | p95 por operação | Erros |
| --- | --- | --- | --- | --- |
| 50 | 150 | 238 ms | 237 ms | 0 |
| 200 | 600 | 917 ms | 914 ms | 0 |
| 500 | 1.500 | 2.416 ms | 2.407 ms | 0 |

Esses números são de PostgreSQL WASM local com consultas adaptadas, sem HTTP, pool remoto, latência de rede ou orçamento Vercel. Não equivalem a um teste de 500 jogadores no site hospedado nem estabelecem um limite de capacidade. A checagem de consistência validou a quantidade entregue, além do retorno das ações.

Reprodução (Node 24):

```sh
npm install --prefix .codex-tmp/performance --no-audit --no-fund @electric-sql/pglite@0.5.8 jsdom@30.1.1
node scripts/simulate-bulk-actions.mjs
node scripts/simulate-bulk-ui.mjs
```

Os simuladores não carregam `.env` e não instanciam PrismaClient. Os dados são descartados ao final. O relatório detalhado local é salvo em `reports/bulk-actions-simulation.json`.

## Próximas etapas de escala

Leitura do PostgreSQL em 29/09/2026 17:29 UTC (`node scripts/capacity-baseline.mjs`): `player_activity_logs` tinha estimativa de 615.419 linhas e 513 MB incluindo índices; `arena_battles`, 24.021 e 59 MB; `player_gifts`, 59.261 e 27 MB. Essas estatísticas são estimativas cumulativas, não medições de latência. O histórico de atividades é prioridade para revisar consultas e política de arquivamento sem apagar dados. Nenhum histórico foi excluído.

1. Medir p50/p95/p99, erros, conexões, duração/idade das filas, bytes transferidos e invocações por jogador ativo. Comparar ambientes e revisão de código iguais.
2. Testar 200/500/1.000 usuários em homologação com banco separado, incluindo rajadas e economia concorrente. Os limites de lote não comprovam capacidade global.
3. Fila durável própria para presentes com chave por pedido, progresso persistido, retomada e concorrência global limitada. A continuação atual depende da página aberta; transações concluídas sobrevivem e pendentes permanecem na caixa.
4. Revisar a fila de interações: limites atuais de 100 mascotes e 6 favoritos, retomada após expiração do lock e justiça entre jogadores. Não trocar esses limites sem preservar a semântica de todos e a idempotência.
5. Acrescentar backoff aos jobs de EXP e separar workers do orçamento das requisições web. Não aumentar paralelismo sem medir o pool compartilhado.
6. Investigar consultas com maior total de tempo/bytes antes de criar índices. Migrar índices separadamente e medir planos de execução.
7. Auditar cache público versus cache por jogador e polling nas telas mais acessadas. Inventário/saldo confirmados devem aparecer imediatamente, sem compartilhar cache privado entre contas.

Não há garantia de quantidade de jogadores suportada até concluir medição e teste de carga. Não houve medição de economia real de Vercel/egress nesta etapa.
