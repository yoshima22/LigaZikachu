# Guia de manutenção — Liga Zikachu

Para quem vai mexer no código ou no ambiente de produção. Estado em **22/out/2026**.
O `README.md` da raiz descreve os primeiros slices e está desatualizado em pontos de deploy — **este guia prevalece**.

---

## 1. Visão geral

| Camada | O que é |
|---|---|
| App | Next.js **15.5** (App Router, Server Components + Server Actions), React, Tailwind. PWA + app Android (WebView). |
| Banco | PostgreSQL no **Supabase**, acessado só pelo servidor via **Prisma 6.19** com driver adapter `@prisma/adapter-pg`. |
| Auth | Auth.js v5 (NextAuth) com sessão em banco (`sessions`). **Não** usa Supabase Auth. |
| Storage | Supabase Storage, bucket público `assets` (imagens de loja, notícias, eventos, avatares). |
| Tempo real | Supabase Realtime **Broadcast** disparado pelo servidor (ver §7). |
| Hospedagem | **Vercel**. Push na `main` = deploy de produção. Crons em `vercel.json`. |
| Pagamentos | Mercado Pago (Pix + cartão BR). Pagamento internacional foi descartado — não propor. |

Estrutura principal:

```
src/app/(app)/<modo>/        páginas + actions.ts (Server Actions) de cada modo
src/app/api/cron/*           rotas chamadas pelos crons da Vercel
src/app/api/admin/*          rotas administrativas (ver §11 — algumas são perigosas)
src/lib/                     regras de negócio compartilhadas (combate, economia, notificações…)
src/hooks/                   hooks de cliente (ex.: use-realtime-signal)
prisma/schema.prisma         schema
prisma/migrations-manual/    SQL aplicado à mão em produção (ver §5.2)
scripts/                     manutenção, auditoria, geração de dados, backups
docs/                        especificações e handoffs por modo (ver §14)
```

---

## 2. Variáveis de ambiente

Ficam em `.env` / `.env.local` (nunca commitados) e no painel da Vercel.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Supavisor **modo transação** (porta 6543). Pode conter `?pgbouncer=true` — o código remove esse parâmetro ao usar o driver adapter. |
| `DIRECT_URL` | Conexão de sessão (porta 5432). Usada por `prisma db execute` e scripts de diagnóstico. |
| `AUTH_SECRET` / `NEXTAUTH_SECRET`, `AUTH_URL` / `NEXTAUTH_URL` | Auth.js. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vão para o navegador. A chave anon **só** abre canais de Realtime — não tem acesso a nenhuma tabela (§5.4). |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor apenas: upload no Storage e envio de sinais Realtime. |
| `CRON_SECRET` | Toda rota `/api/cron/*` exige `Authorization: Bearer <CRON_SECRET>`. |
| `SEED_SECRET` | Protege `/api/admin/seed` e `/api/admin/db-push` (ver alerta em §11). |
| `PRISMA_DRIVER_ADAPTER=off` | **Kill switch**: volta ao motor antigo do Prisma (ver §5.1). |
| `DB_POOL_MAX` | Conexões por instância serverless no adapter (padrão 2). |

---

## 3. Rodando localmente

```bash
npm install          # roda prisma generate no postinstall
npm run dev          # next dev --turbopack
npm run typecheck    # tsc --noEmit
npx next build       # build de produção (mesmo que a Vercel roda)
```

O banco local aponta para o **mesmo Supabase de produção** (não há staging). Consequência: scripts e telas rodando na sua máquina mexem em dados reais. Leia §12 antes de rodar qualquer coisa que escreva.

---

## 4. Fluxo de entrega

1. Altere só o necessário para a tarefa.
2. `npx tsc --noEmit` **e** `npx next build` — os dois, sempre, inclusive quando só mexeu em `scripts/` (o type-check da Vercel inclui `scripts/`; um erro de tipo num script já derrubou um deploy).
3. Não deixe arquivos `_tmp*.ts` na raiz durante o build — eles entram no type-check.
4. Commit **só dos arquivos da tarefa**. Nunca commitar `tsconfig.tsbuildinfo`, `.claude/worktrees`, anexos, `.asset-staging/` ou mudanças de outra pessoa.
5. `git push` na `main` → a Vercel publica. Outras branches geram só preview.
6. Se o push for rejeitado (alguém subiu antes): `git rebase origin/main`. Se o rebase reclamar de arquivos não rastreados, confira com `git hash-object` se são idênticos ao remoto antes de tirá-los do caminho.

**Skew Protection (Vercel):** abas abertas antes de um deploy continuam executando o código antigo por um tempo. Após mudanças grandes, parte da carga no banco ainda vem do código velho (veja "contar DEALLOCATE ALL" em §10). Recarregar as abas/app resolve; manter o *max age* da Skew Protection baixo nas configurações da Vercel reduz o problema.

---

## 5. Banco de dados

### 5.1 Conexão (`src/lib/prisma.ts`)

- Usa `@prisma/adapter-pg` (pg com statements **sem nome**), compatível com o Supavisor em modo transação. Isso eliminou o `BEGIN` + `DEALLOCATE ALL` + `COMMIT` que o modo `pgbouncer=true` adicionava a **cada** consulta (~70% das chamadas ao banco).
- TLS explícito (`ssl: { rejectUnauthorized: false }`): o pooler exige.
- O role `postgres` tem `extra_float_digits = 3` (`ALTER ROLE postgres SET …`) para o driver texto não perder precisão em floats. Reverter: `ALTER ROLE postgres RESET extra_float_digits`.
- **Custo conhecido:** o driver recebe resultados em **texto**; o motor antigo recebia em binário. Linhas com muitos números/datas (ex.: `mascots`) trafegam ~1,7x mais bytes → egress do banco ~+50%. Para reduzir, selecione só as colunas necessárias.
- **Não tente** usar o motor antigo sem `pgbouncer=true` no pooler de transação: foi testado e gera pânicos do motor e resultados trocados entre consultas.
- Emergência: `PRISMA_DRIVER_ADAPTER=off` na Vercel + redeploy volta ao motor antigo (lento, mas estável).

### 5.2 Migrações (manuais)

`prisma migrate deploy` está **bloqueado** por uma migration antiga falha (P3009). O processo é:

1. Escreva o SQL **idempotente** em `prisma/migrations-manual/NNN_descricao.sql` (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` …).
2. Aplique: `npx prisma db execute --file prisma/migrations-manual/NNN_descricao.sql --schema prisma/schema.prisma`
3. Atualize `schema.prisma` e rode `npx prisma generate`.
4. Mudanças de risco: deixe um `.rollback.sql` ao lado (exemplo: `20261020_lockdown_anon_public*.sql`).

Proibido em produção: `prisma db push --accept-data-loss`, `migrate reset`, `--force-reset`.

### 5.3 Armadilhas de SQL

- Em `LIKE` sobre enum, use cast `::text`. Mas **nunca** compare enum com `::text` em `WHERE`/`JOIN` de tabela grande — mata o índice (foi o gargalo nº 1 em `arena_battles`).
- Saldos (ZikaCoins / LigaCash) **só** com `increment`/`decrement` atômico. Ler-somar-gravar causa *lost update* (já gerou bug de reembolso em leilão).
- `upsert(..., update: {})` é uma **escrita** e trava a linha. Para "ler ou criar" configuração singleton use `getEconomySettings()` (`src/lib/economy-settings.ts`).
- Itens vinculados à conta: `player_inventory.boundQuantity` e `mascot_food_items.boundQuantity` são um **subconjunto** de `quantity`. O trigger `clamp_bound_quantity` mantém `0 ≤ boundQuantity ≤ quantity`; decrementar só `quantity` gasta a unidade **comum** primeiro. Para gastar a vinculada, decremente os dois (ver `consumeOne()` em `mascotes/actions.ts`).

### 5.4 Segurança do banco (RLS)

- O app conecta como `postgres` (`rolbypassrls = true`, dono das tabelas): RLS não afeta o servidor.
- Todas as tabelas de `public` têm RLS ligado e **anon/authenticated não têm nenhum privilégio** (nem em tabelas novas — privilégios padrão revogados). Aplicado em `prisma/migrations-manual/20261020_lockdown_anon_public.sql`; reversão no `.rollback.sql`.
- Se um dia uma tela precisar ler tabela direto do navegador (`supabase.from(...)`), será preciso `GRANT` + policy explícita para aquela tabela. Prefira Server Action.
- Auditoria: `npx tsx scripts/check-rls.ts` (somente leitura).

---

## 6. Convenções de código

### Server Actions
- Arquivos `"use server"` só exportam funções `async`. Helpers puros vão para módulo separado.
- Valide sessão, propriedade e permissão **no servidor**; nunca confie em preço, chance ou id vindos do cliente.
- Mutações concorrentes: `$transaction` + `pg_advisory_xact_lock(hashtext('<escopo>:<id>'))`.
- Locks **globais** disputados por todos (ex.: compras do Miauvadão): use `SET LOCAL lock_timeout = '4s'` antes do lock e trate o erro `55P03` com mensagem amigável — falhar rápido é melhor que travar o site.
- Trabalho que não precisa atrasar a resposta: `after(() => …)` de `next/server`.
- Revalide o que mudou: `revalidatePath` / `revalidateTag`.

### Permissões (`src/lib/auth/permissions.ts`)
- `isAdmin` = ADMIN ou SUPER_ADMIN. `isStaff` = admin **ou GameMaster**.
- `requireAdmin()` aceita **GM** (usa `isStaff`). Para algo exclusivo de admin de plataforma (ex.: Torre dos Rebeldes, World Mode) use `requirePlatformAdmin()`.

### Fronteira cliente/servidor
- Componente `"use client"` não pode importar (nem indiretamente) módulo que importe `@/lib/prisma`: o `pg` puxa `tls`/`net`/`dns` e o build quebra com "Can't resolve 'tls'". Extraia tipos/constantes puros para um módulo sem Prisma (ex.: `mascot-bonds-shared.ts`, `mascot-bonds-v2-config.ts`).

### Reuso obrigatório
- Combate: `runLeagueCombat` (`league-combat.ts`) e `runArenaCombat` (`arena-z.ts`). Não reimplemente dano/RNG/tipos/posturas; estenda via `options` compatíveis.
- Notificações: todo `sendNotificationTo*` deve passar `category` (central de preferências do perfil).
- Histórico do jogador: `recordPlayerActivity` (`player-activity.ts`).

---

## 7. Tempo real

A publicação `supabase_realtime` está **vazia** de propósito: escutas `postgres_changes` **nunca entregam nada**. Não use. O padrão é:

- **Servidor:** `signalRealtime(topic, event, payload?)` em `src/lib/realtime-signal.ts` — envia um sinal mínimo via REST de Broadcast depois da resposta (`after`). Nunca lança erro.
- **Cliente:** `useRealtimeSignal(topic, handler)` (`src/hooks/use-realtime-signal.ts`, um WebSocket por aba com contagem de referências) ou `<RealtimeRefresh topic event />` (`src/components/realtime-refresh.tsx`, faz `router.refresh()` com atraso aleatório e intervalo mínimo).
- Os canais são **públicos**: o payload nunca leva dado sensível — só "algo mudou". O cliente busca os dados pelas actions autenticadas.
- Mantenha sempre um **polling de reserva** lento (o WebSocket pode cair) e pause polling com a aba oculta (`document.visibilityState`).

| Tópico | Evento | Quem envia | Quem escuta |
|---|---|---|---|
| `player:{playerId}` | `dm`, `nav` | DM enviada; `createPlayerNotification` | menu (alertas), conversa aberta |
| `chat:general` | `msg` | chat geral | chat geral |
| `zikatv` | `live` (payload `streamId`, `anyLive`) | início/fim de live (`announceZikaTvChange`) | selo do menu, lista e página da Zika TV |
| `spec:{streamId}` | `stands` | chat, enquete, saída da arquibancada | arquibancada |
| `bazar` | `miauvadao` | compra, troca de slot, rotação | painel do Miauvadão (jitter 3s, máx. 1 refresh/5s) |

A sala do **Arena Draft** continua com sync de 1s por `stateVersion` (há ~19 pontos que incrementam a versão; instrumentar todos não compensou).

---

## 8. Crons (`vercel.json`)

Todos exigem `CRON_SECRET`. Horários em UTC (BRT = UTC−3).

| Agenda (UTC) | Rota | Função |
|---|---|---|
| `* * * * *` | `mascot-exp-grants` | EXP concedida aos mascotes |
| `*/2 * * * *` | `sync-event`, `mascot-interactions` | Desafio Sincronizado; interações em lote |
| `1,6,…,56 * * * *` | `weekly-league` | Liga Semanal |
| `*/5 * * * *` | `tower-resolve`, `bazar-auctions`, `mascot-occurrences`, `rush-league`, `push-notifications` | Torre, leilões, ocorrências, Liga Rush, push |
| `0 * * * *` | `mascot-bonds` | laços |
| `0 */3 * * *` | `birthday-ticker` | aniversários no ticker |
| `0,5 1,7,13,19 * * *` | `miauvadao-rotation` | rotação da vitrine (4h/10h/16h/22h BRT) com repescagem 5 min depois |
| `0 3 * * *` | `pass-store-activation`, `arena-pve-reset` | passe/loja; reset PvE da Arena |
| `30 4 * * *` | `data-retention` | limpeza/retenção |
| `0 12 * * *` | `deck-reminder` | lembrete de deck |
| `0 18 * * *` | `mascot-social` | eventos sociais |
| `51 20 * * *` | `sync-close` | fechamento do Sincronizado |

A rotação do Miauvadão é **voo único**: `autoRefreshMiauvadaoIfNeeded` usa `pg_try_advisory_xact_lock(hashtext('miauvadao-rotation'))`; quem perde só espera a publicação. Não remova — foi o que acabou com o travamento no reset.

---

## 9. Storage (imagens)

- Bucket `assets`, público. Upload só pelo servidor (`src/lib/asset-storage.ts`, `src/lib/avatar-storage.ts`) com **nome com timestamp** e `cacheControl: "31536000"` (1 ano). Nunca sobrescreva um caminho já publicado: o navegador vai manter a versão antiga por 1 ano — suba com nome novo.
- `scripts/optimize-storage-assets.ts`: converte PNG/JPEG grandes para WebP **no mesmo caminho** (as URLs no banco não mudam) e padroniza o cache. Ensaio por padrão; `--apply` grava. Originais ficam em `_originals/<caminho>` no próprio bucket.
- Restaurar uma imagem: baixe `_originals/<caminho>` e suba de volta em `<caminho>` com o `contentType` original.
- `next.config` usa `images.unoptimized: true` de propósito (o otimizador da Vercel só somava custo).

---

## 10. Diagnóstico e desempenho

### Ferramentas
- `pg_stat_statements` está ativo (desde 02/jul/2026). Para medir uma janela, tire duas fotos e subtraia, **chaveando por `userid` + `queryid`** (o mesmo `queryid` de `BEGIN` aparece em vários roles).
- Carga vinda de **código antigo** (abas pré-deploy): conte `DEALLOCATE ALL` numa janela — o código atual não emite esse comando.
- `SELECT … FROM pg_stat_activity WHERE usename='postgres'` amostrado várias vezes mostra o que está rodando agora.
- Antes de qualquer correção em massa: script `_tmp_*.ts` **somente leitura** para contar afetados; apague-o ao final.

### Gotchas já resolvidos (não reintroduza)
- `arena_battles`: comparação de enum com `::text` no ranking; `groupBy` de cooldown sem filtro de data.
- Layout do app (`src/app/(app)/layout.tsx`): consultas em **2 lotes paralelos**. Ele roda a cada navegação e a cada `router.refresh()` — não volte a encadear `await`s.
- Página `/admin`: carregamento em lotes `Promise.all` (Server Actions re-renderizam a página pesada).
- Polling: nada de 1s sem necessidade; sempre pausar com aba oculta.
- Selects de `mascots`, `mascot_relations`, `mascot_bond_memories` e `egg_pokemon_toggle` são os que mais trafegam bytes — use `select` enxuto.
- "Cache agressivo" foi vetado: prefira consulta enxuta e cache com tag invalidada no evento certo.

---

## 11. Segurança — pontos de atenção

- ⚠️ **`/api/admin/db-push`** roda `prisma db push --accept-data-loss` protegido apenas por `SEED_SECRET`, e um valor de exemplo desse segredo aparece publicado no `README.md` e no comentário da própria rota. Confirme que o `SEED_SECRET` de produção é diferente desse exemplo; o ideal é **remover essa rota**.
- `/api/admin/seed` também usa `SEED_SECRET`.
- `/api/admin/reset-all` apaga álbuns/inventários/carteiras de **todos** os jogadores e aceita ADMIN e SUPER_ADMIN (o comentário diz "apenas SUPER_ADMIN").
- Segredos só em env; nunca em código, URL ou log.
- Imagens enviadas pelo usuário viram arquivo no Storage; não volte a salvar base64 em coluna (`players.avatarUrl` já multiplicou o egress no passado).

---

## 12. Runbooks

**Site lento / banco sobrecarregado**
1. Foto do `pg_stat_statements` agora e de novo em 2–5 min; ordene o delta por chamadas e por linhas.
2. Conte `DEALLOCATE ALL` — se alto, é código antigo (abas pré-deploy / Skew Protection).
3. Procure loops de `router.refresh()`/polling no componente da página afetada.

**Bazar travou no reset (4h/10h/16h/22h BRT)**
- Verifique se a rotação publicou: `miauvadao_config."offersRefreshedAt"` (coluna `timestamp` **sem fuso**, armazenada em UTC).
- Compras recusadas com "Muita gente comprando no Miauvadão agora" são o `lock_timeout` funcionando, não bug.

**Deploy falhou na Vercel**
- Quase sempre type-check. Rode `npx tsc --noEmit` local (inclui `scripts/`).
- O site continua na versão anterior enquanto o build não passar.

**Push travado**
- O Git Credential Manager pode estar esperando login numa janela do Windows.

**Egress subiu**
- Divida no painel do Supabase (banco × Storage × Realtime). Banco: veja §5.1 (driver texto) e §10. Storage: confirme cache de 1 ano e tamanho dos arquivos novos.

**Reverter mudanças de infraestrutura**
- Driver do banco: `PRISMA_DRIVER_ADAPTER=off` + redeploy.
- RLS/privilégios: `prisma/migrations-manual/20261020_lockdown_anon_public.rollback.sql`.
- Float do role: `ALTER ROLE postgres RESET extra_float_digits`.
- Imagem otimizada: copiar de `_originals/` (§9).

**Backup**
- `node scripts/backup-consistent.mjs` gera um dump JSON consistente (transação somente leitura) em `backups/`; `scripts/verify-backup.mjs` confere.
- Antes de `deleteMany`/`updateMany` em massa: exporte os registros-alvo para JSON e faça a correção idempotente e abortável.

---

## 13. Regras de jogo que vivem no código (resumo)

- **W/O conta como BYE**: 3 pontos e 0 vitórias; faltosos são punidos. Postura em combate: use `preferredCombatRole`.
- **Vantagem de tipo**: ±20% por passo, teto ±40%; x4 = +40%; imunidade (0x) vira −40%. Atacante de 2 tipos: os passos de **cada** tipo se somam (Dragão/Terra contra Fada = −2 + 0 = −40%), teto ±40%. O log guarda `typeStep`/`typeDelta`. Não é retroativo.
- **Habilidades passivas + TM**: só no Arena Draft. Fonte = planilhas em `docs/`; `scripts/generate-ability-data.py` gera `data.generated.ts`.
- **Megas**: o painel (`EggPokemonToggle`) governa pedras e catálogo do Draft.
- **LigaCash (LC)**: moeda premium (loja, bazar, carteira, admin, ledger).
- **Zika TV**: modos Cloudflare SFU ou P2P mesh, escolhidos pelo admin. Não trocar o modo com live ativa.
- **Torre dos Rebeldes** e **World Mode**: protótipos só para admin (`requirePlatformAdmin`).
- **Replays**: estilo moderno (canvas) ou clássico, escolhido no perfil (`Player.replayStyle`).

---

## 14. Onde está o resto

| Documento | Assunto |
|---|---|
| `docs/otimizacao-capacidade.md`, `supabase-egress-current-state.md`, `egress-optimizations-2026-10-05.md`, `concurrency-improvements-2026-10-15.md` | histórico de desempenho/egress |
| `docs/ZIKASHOP_BAZAR_E_DUAS_MOEDAS.md` | economia, bazar, ZC/LC |
| `docs/sistema-de-lacos.md`, `LACOS_*.md` | sistema de laços |
| `docs/TORRE_DOS_REBELDES_*.md` | Torre dos Rebeldes |
| `docs/WORLD_MODE_*.md`, `world-mode-assets-personagem-modular.md` | World Mode |
| `docs/raid-lideres-johto.md`, `ordem-da-trapaca-especificacao-atualizada.md` | eventos |
| `docs/regulamento-2a-edicao.md` | regulamento do torneio |
| `docs/habilidades-*.xlsx` | fonte das habilidades |

Ao criar ou evoluir um modo de jogo, deixe um documento de handoff/progresso em `docs/`.
