# Liga Zikachu — Diagnóstico de Supabase Shared Pooler Egress
> Gerado em 09/06/2026 — Baseline antes de otimizações.  
> Pico identificado: **Shared Pooler Egress** (não Storage nem Cached Egress).  
> Causa raiz: queries Prisma retornando payload grande a cada page load/refresh.

---

## 1. Resumo executivo

| Área | Risco | Causa |
|---|---|---|
| **Shop page** | 🔴 Alto | `findMany` em `ShopItem` sem `select` — puxa `imageUrl` (`@db.Text`) de todos os itens em cada visita |
| **Álbum page** | 🔴 Alto | `findMany` em `PokemonCard` sem `select` — puxa `imageUrl` de centenas de cards por visita |
| **Arena-Z page** | 🔴 Alto | Vários `findMany` com `include: { mascot: true }` (objeto completo), + `ArenaLiveRefresh` dispara `router.refresh()` a cada mudança em 5 tabelas |
| **Bazar page** | 🟠 Médio-Alto | `autoCleanupStaleBazarListings()` + `autoRefreshMiauvadaoIfNeeded()` executam no **page load** + `BazarLiveRefresh` dispara `router.refresh()` a cada evento em 4 tabelas |
| **Ranking page** | 🟠 Médio | `computeGlobalRanking()` recalcula score de todos jogadores a cada visita (múltiplos `findMany`) |
| **Perfil público** | 🟠 Médio | Carrega stickers, inventário, conquistas, mascotes favoritos e matches em paralelo sem paginação |
| **Mascotes page** | 🟡 Baixo-Médio | Já otimizado com `select` mínimo. Detalhe carregado por modal (lazy). OK. |

---

## 2. Realtime e router.refresh — maior risco de cascata

### `ArenaLiveRefresh` (`src/app/(app)/arena-z/_components/arena-live-refresh.tsx`)
- Assina **5 tabelas**: `arena_teams`, `arena_team_members`, `arena_battles`, `arena_ground_spoils`, `mascots`
- Qualquer evento → `router.refresh()` após 650ms
- `router.refresh()` na Arena recarrega o `page.tsx` da Arena, que executa ~6 `findMany` com `include: { mascot: true }` e `include: { members: { include: { mascot: true } } }`
- **Impacto**: cada batalha de arena gera 1-2 eventos que disparam refresh completo para TODOS os usuários na página

### `BazarLiveRefresh` (`src/app/(app)/bazar/_components/bazar-live-refresh.tsx`)
- Assina **4 tabelas**: `bazar_listings`, `bazar_proposals`, `bazar_transactions`, `miauvadao_config`
- Qualquer evento → `router.refresh()` após 450ms
- Payload do bazar não foi auditado em detalhe, mas inclui listagens com dados de itens

### `revalidatePath("/", "layout")` em múltiplas actions
- Usado em: `album/actions.ts`, `zikabet/actions.ts`, `zikaloot/actions.ts`, `partidas/actions.ts`
- Invalida o **layout raiz inteiro**, forçando recarga de navbar e dados globais para todos os usuários no próximo request

---

## 3. Queries pesadas sem select/paginação

### 🔴 `ShopItem` sem select (shop/page.tsx linha 27)
```ts
prisma.shopItem.findMany({ where: { active: true }, ... })
// Sem select → puxa imageUrl (@db.Text), flavorText (@db.Text), metadata (Json), etc.
// Executado em CADA visita à loja
```

### 🔴 `PokemonCard` sem select (album/page.tsx linha 35)
```ts
prisma.pokemonCard.findMany({ ... })
// Sem select → puxa imageUrl (@db.Text) de potencialmente centenas de cards
// Executado em CADA visita ao álbum
```

### 🔴 Arena-Z mascotes com include completo (arena-z/page.tsx)
```ts
prisma.mascot.findMany({ include: { expeditions: { where: { status: "ACTIVE" }, take: 1 } } })
prisma.arenaTeam.findMany({ include: { members: { include: { mascot: true } } } })  // mascot: true = objeto COMPLETO
prisma.arenaBattle.findMany({ include: { ... } })
prisma.mascot.findMany({ include: { player: { select: { displayName: true } } } })
// Total: ~5 findMany com includes, executados a cada router.refresh() do ArenaLiveRefresh
```

### 🟠 Ranking recalculado a cada visita (ranking/page.tsx)
```ts
// computeGlobalRanking() executa dentro de lib/ranking/:
prisma.tournamentRegistration.findMany({ include: { player: ... } })
prisma.challenge.findMany(...)  // x2
prisma.playerBadge.findMany(...)  // x2
prisma.playerAchievement.findMany(...)
prisma.seasonPlayer.findMany(...)
prisma.match.findMany(...)
// +5 queries adicionais dependendo de filtros
// Página tem `export const dynamic = "force-dynamic"` — nunca cacheia
```

### 🟠 Perfil público — payload paralelo (jogadores/[id]/page.tsx)
```ts
prisma.player.findUnique({ include: { ... } })  // com vários includes
prisma.match.findMany({ include: { ... } })
prisma.playerSticker.findMany({ include: { card: { select: { imageUrl: true, ... } } } })
prisma.playerInventory.findMany({ include: { item: { select: { imageUrl: true, ... } } } })
prisma.playerAchievement.findMany({ include: { ... } })
prisma.savedDeck.findMany(...)
prisma.mascot.findMany(...)  // mascotes favoritos
// 7 queries em paralelo sem paginação
```

### 🟠 Bazar — automações no page load (bazar/page.tsx linhas 37-38)
```ts
// Executado em CADA visita ao Bazar:
autoRefreshMiauvadaoIfNeeded()   // lê + possivelmente escreve no banco
autoCleanupStaleBazarListings()  // deleta/atualiza listings expirados
```

---

## 4. Assets com imageUrl `@db.Text`

| Model | Campo | Risco |
|---|---|---|
| `ShopItem` | `imageUrl @db.Text` | 🔴 Carregado sem select em shop/page.tsx |
| `PokemonCard` | `imageUrl @db.Text` | 🔴 Carregado sem select em album/page.tsx |
| `LeagueBadge` | `imageUrl @db.Text` | 🟡 Verificar se é base64 ou URL |
| `StickerPack` | `imageUrl @db.Text` | 🟡 Carregado em album; verificar tamanho |
| `ShopItem` | `flavorText @db.Text` | 🟡 Texto longo, incluído em todas as queries do shop |

**Não há evidência de base64 no código** (`data:image` só aparece em validações de input, não como dado salvo).  
**Confirmar via SQL** (ver seção 7) se imageUrl contém `data:` em algum registro.

---

## 5. Fluxos transacionais — NÃO mexer

Estes fluxos devem continuar lendo e escrevendo no banco normalmente:

- Compra na ZikaShop (`shop/actions.ts`)
- Incubação e chocagem de ovos (`mascotes/actions.ts`)
- Arena Z — batalha, defesa, renda passiva
- Bazar — listar, propor, aceitar, transação
- Apostas (`zikabet/actions.ts`)
- ZikaLoot (`zikaloot/actions.ts`)
- Partidas de torneio (`partidas/actions.ts`)
- Mascotes — expedições, interações, buffs

---

## 6. Fluxos candidatos a cache/snapshot

| Fluxo | Estratégia |
|---|---|
| Lista de itens da shop (catálogo) | Next.js `fetch` com `revalidate` ou rota `GET /api/shop/catalog` com `Cache-Control` longo |
| Catálogo de cards do álbum | JSON cacheado em memória no servidor ou rota cacheada |
| Ranking global | Calcular apenas ao registrar partida/conquista; cache por `revalidate` |
| Perfil público resumido | Paginação de stickers/mascotes; não carregar coleção inteira |
| Arena-Z live refresh | Badge "há atualizações" + botão manual em vez de `router.refresh()` automático |

---

## 7. SQLs de diagnóstico para executar no Supabase

```sql
-- 7.1 Verificar se imageUrl tem base64
SELECT count(*) AS total_base64, pg_size_pretty(sum(octet_length("imageUrl"))::bigint) AS estimated_size
FROM "shop_items" WHERE "imageUrl" LIKE 'data:%';

-- 7.2 Tamanho total das tabelas mais pesadas
SELECT relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;

-- 7.3 Volume de imageUrl no shop e cards
SELECT id, name, type, octet_length("imageUrl") AS bytes, left("imageUrl", 80) AS preview
FROM "shop_items" WHERE "imageUrl" IS NOT NULL ORDER BY octet_length("imageUrl") DESC LIMIT 20;

SELECT id, "displayName", octet_length("imageUrl") AS bytes, left("imageUrl", 80) AS preview
FROM "pokemon_cards" WHERE "imageUrl" IS NOT NULL ORDER BY octet_length("imageUrl") DESC LIMIT 20;

-- 7.4 Queries mais pesadas (se pg_stat_statements ativo)
SELECT calls, rows, round(mean_exec_time::numeric, 2) AS mean_ms, left(query, 300) AS query_preview
FROM pg_stat_statements ORDER BY rows DESC LIMIT 20;
```

---

## 8. Plano de ação priorizado

### Fase 1 — Impacto imediato (sem risco de regressão)
1. **Shop** — adicionar `select` explícito no `findMany` de `ShopItem`, excluindo `flavorText` e `entranceEffect` da listagem (carregar apenas ao clicar no item)
2. **Álbum** — adicionar `select` no `findMany` de `PokemonCard`, excluindo `imageUrl` da listagem geral (usar sprite local ou URL construída, não campo do banco)
3. **Arena** — trocar `include: { mascot: true }` por `include: { mascot: { select: { id, pokemonId, nickname, level, ... } } }` — excluindo campos não usados na arena

### Fase 2 — Realtime seguro (requer teste)
4. **Arena Live Refresh** — substituir `router.refresh()` automático por badge "novidades" + botão manual "Atualizar"
5. **Bazar Live Refresh** — idem, ou aumentar debounce de 450ms para 5000ms

### Fase 3 — Automações fora do page load
6. **Bazar cleanup** — mover `autoCleanupStaleBazarListings()` para cron (ex: a cada hora via Vercel cron) em vez de page load
7. **Ranking** — adicionar `unstable_cache` com revalidação por evento em vez de `force-dynamic`

### Fase 4 — Perfil público
8. Paginar stickers e mascotes no perfil (`take: 20`)
9. Não carregar inventário completo de cosméticos na primeira renderização

---

## 9. O que NÃO fazer

- Não migrar para Firebase — não resolve queries Prisma
- Não transformar saldo/inventário em JSON público
- Não adicionar `prisma db push` no build
- Não adicionar Realtime em mais páginas
- Não salvar imagens base64 em novos campos
