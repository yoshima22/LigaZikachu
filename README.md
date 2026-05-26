# Liga Zikachu Live

App web/PWA da Liga Zikachu para gerenciar torneios de Pokémon TCG com Next.js, Prisma, PostgreSQL e Auth.js.

## Funcionalidades

### Slice 1 — Dashboard + Jogadores (concluído)
- Autenticação com email + senha (Auth.js v5)
- Dashboard administrativo e de jogador com dados reais
- Gestão de jogadores: aprovar, suspender, editar, remover
- Perfil de jogador com histórico de partidas, decks, conquistas e códigos
- Ranking em tempo real calculado por vitórias/derrotas
- Schema Prisma completo (15+ modelos)

### Slice 2 — Torneios, Semanas e Tema Visual Pokémon (concluído)
- **Torneios independentes** — múltiplos torneios paralelos com slug, edição, status e ciclo de vida completo
- **Semanas configuradas** — 8 semanas com modos especiais do regulamento (Padrão, GLC, Duplas Sincronizadas, Pontuação Dobrada, Construtor Misterioso, Guerra de Times, Batalha Final)
- **Inscrições** — self-register, aprovação/rejeição admin, audit log
- **Server Actions** com validação Zod e AuditLog em todas as ações
- **Tema visual Pokémon TCG** — paleta de 18 tipos, fontes Press Start 2P + Inter, textura hexagonal, animações
- **Componentes poke/** — TypeBadge, EnergyBadge, TournamentCard, WeekModeBadge, TrainerAvatar
- **Páginas de torneios**: lista, detalhe, semana, inscrições (admin), criar torneio
- **2ª Edição: Desafio das Insígnias Fantasmagóricas** configurada no seed com todas as 8 semanas
- Regulamento completo em `docs/regulamento-2a-edicao.md`
- Toasts via `sonner`

#### Páginas de Torneios
| Rota | Descrição |
|------|-----------|
| `/torneios` | Lista de todos os torneios com filtros por status |
| `/torneios/[slug]` | Detalhe do torneio, inscritos, cronograma de semanas |
| `/torneios/[slug]/semanas/[n]` | Detalhe da semana com modo, regras e datas |
| `/torneios/[slug]/inscricoes` | Admin: aprovar/rejeitar inscrições |
| `/torneios/novo` | Admin: criar novo torneio |

## Deploy (Vercel + Supabase)

O build da Vercel executa automaticamente:
```bash
prisma generate && prisma db push && next build
```

### Variáveis de ambiente
- `DATABASE_URL` — URL de conexão pooled (Supabase)
- `DIRECT_URL` — URL de conexão direta (Supabase, para migrations)
- `AUTH_SECRET` — segredo do Auth.js
- `AUTH_TRUST_HOST=true`
- `NEXTAUTH_URL=<url-da-vercel>`
- `SEED_SECRET=zikachu-seed-2026-trocar-depois`

### Seed (idempotente)
```bash
curl -X POST https://<url-vercel>/api/admin/seed \
  -H "x-seed-secret: zikachu-seed-2026-trocar-depois"
```

O seed cria/atualiza:
- Admin + 6 jogadores de teste
- Temporada 1 (legada) com semanas e partidas de exemplo
- **2ª Edição: Desafio das Insígnias Fantasmagóricas** com 8 semanas configuradas
- Inscrições dos 6 jogadores na 2ª edição (já aprovadas)
- Códigos booster de exemplo

## Credenciais de teste
| Email | Role |
|-------|------|
| `admin@ligazikachu.com` | SUPER_ADMIN |
| `luiz@ligazikachu.com`  | PLAYER |
| `rodrigo@ligazikachu.com` | PLAYER |

(demais jogadores usam a mesma senha)

## Documentação
- `docs/plano-fase-0.md` — arquitetura técnica e decisões da Fase 0
- `docs/regulamento-2a-edicao.md` — regulamento completo da 2ª edição

## Fluxo local (se Node disponível)
```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```
