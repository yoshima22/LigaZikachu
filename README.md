# Liga Zikachu

Base inicial do app web/PWA da Liga Zikachu com Next.js, Prisma, PostgreSQL e Auth.js.

## O que já foi implementado

- estrutura inicial do projeto com App Router
- autenticação base com Auth.js usando email + senha
- schema Prisma completo para o domínio da liga
- seed inicial com temporada, jogadores, semanas, partidas, decks e códigos
- páginas públicas e protegidas para validação inicial
- manifesto base de PWA
- documento técnico da Fase 0 em `docs/plano-fase-0.md`

## Deploy MVP na Vercel + Supabase

Como este ambiente não possui `node`, `npm` nem `vercel`, o deploy deve ser finalizado pela Vercel conectada ao repositório GitHub.

### Variáveis de ambiente na Vercel

Configure em `Production`, `Preview` e `Development`:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `NEXTAUTH_URL=<url-final-da-vercel>`
- `SEED_SECRET=<segredo-forte-para-seed>`

### Build command

O projeto já está preparado para a Vercel executar:

```bash
prisma generate && prisma db push && next build
```

Essa escolha usa `db push` no primeiro deploy para destravar o MVP sem depender de migrations versionadas geradas localmente.

### Primeiro deploy

1. Importe o repositório na Vercel.
2. Preencha as variáveis acima.
3. Faça o primeiro deploy.
4. Após o deploy, atualize `NEXTAUTH_URL` com a URL final gerada pela Vercel e redeploy.

### Seed inicial

Depois que o deploy estiver verde, execute:

```bash
curl -X POST https://<url-final-da-vercel>/api/admin/seed -H "x-seed-secret: <SEED_SECRET>"
```

Se preferir, use qualquer cliente HTTP com o header `x-seed-secret`.

### Smoke test esperado

- `/login` abre sem erro 500
- criação de conta funciona
- login redireciona para `/dashboard`
- tabela `users` recebe novos cadastros
- seed cria 6 jogadores reais + admin

## Fluxo local rápido

Se houver ambiente Node local no futuro:

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## Credenciais seed

- admin: `admin@ligazikachu.com`
- senha: `LigaZikachu123`

Jogadores seed usam a mesma senha.