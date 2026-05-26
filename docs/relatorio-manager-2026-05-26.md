# Relatório de Alterações — Liga Zikachu App

**Data:** 2026-05-26
**Autor:** Manager (Verdent)
**Commits:** `3052d84`, `557ccae`, `2100207`

---

## 1. Correção Crítica: Schema Prisma (commit `3052d84`)

**Problema:** O build do Vercel falhou com erro P1012 — relações `reportedMatches` e `confirmedMatches` no modelo `Player` não tinham campos correspondentes no modelo `Match`.

**Solução:** Removidas as duas relações do modelo `Player`:
- `reportedMatches Match[] @relation("MatchReportedBy")`
- `confirmedMatches Match[] @relation("MatchConfirmedBy")`

Essas relações já existiam corretamente no modelo `User` (quem reporta/confirma é o usuário logado, não o jogador). O modelo `Match` mantém `reportedById`, `confirmedById` e as relações `reportedBy`/`confirmedBy` apontando para `User`.

**Arquivo:** `prisma/schema.prisma`

---

## 2. Chore: Limpeza (commit `557ccae`)

**Removido:** `tsconfig.tsbuildinfo` que foi gerado acidentalmente.

---

## 3. Landing Page Temática (commit `2100207`)

**Arquivo:** `src/app/page.tsx` (reescrito completamente)

A home pública foi transformada de uma página técnica de desenvolvimento em uma landing page temática da Liga Zikachu.

### Estrutura da nova página:

1. **Hero principal**
   - Badge "Liga Zikachu • Versão Alpha"
   - Título: "Entre na arena da Liga Zikachu"
   - Subtítulo explicativo com destaques (Top do Dia, Ranking Geral, códigos de booster)
   - Botões: "Entrar no app" (amarelo) e "Ver campeonatos" (outline)
   - Aviso Alpha em box sutil
   - Card lateral: "Sua liga em um só lugar" com lista de funcionalidades

2. **Seção "O que é a Liga Zikachu?"**
   - Texto explicativo sobre a competição
   - Menção à substituição da planilha

3. **Seção "O que você poderá fazer no app"**
   - 6 cards com ícones: Campeonatos, Partidas, Ranking Geral, Top do Dia, Códigos, Caixa de presentes
   - Hover com brilho amarelo

4. **Seção "Ranking Geral vs Top do Dia"**
   - Dois cards lado a lado explicando a diferença
   - Ranking Geral = acumulado de todos os campeonatos
   - Top do Dia = desempenho de um dia específico

5. **Seção Alpha / Roadmap**
   - Badge "Versão Alpha"
   - 3 cards: Em desenvolvimento, Em validação, Em breve

6. **Seção para Administradores**
   - Título: "Controle da liga sem depender da planilha"
   - Lista de capacidades admin

7. **CTA final**
   - "Pronto para entrar na liga?"
   - Botões de entrada e campeonatos

8. **Footer**
   - Logo Liga Zikachu + badge Alpha

### Tom visual:
- Fundo escuro gradiente (azul/roxo)
- Amarelo elétrico `#FFCB05` como cor principal
- Cards escuros com bordas luminosas
- Pattern hexagonal sutil no hero
- Fonte pixel para títulos
- Ícones Lucide (Trophy, Swords, TrendingUp, Zap, Gift, Package, etc.)

---

## Estado do Projeto (para continuidade do Codex)

### O que o Codex deixou pronto (não commitado):
- `src/app/(app)/torneios/[slug]/semanas/[weekNumber]/partidas/actions.ts` — confirmação do segundo jogador reescrita
- `src/app/(app)/torneios/[slug]/semanas/[weekNumber]/partidas/page.tsx` — busca deckSubmissions
- `src/app/(app)/torneios/[slug]/semanas/[weekNumber]/partidas/_components/match-card.tsx` — exibe decklist

Esses arquivos já estão no working tree (modificados mas não commitados na última rodada do Codex). O commit `3052d84` incluiu essas mudanças junto com a correção do schema.

### Próximos passos sugeridos:
1. Verificar build do Vercel após o push `2100207`
2. Se build verde, validar landing page em produção
3. Continuar Slice 3: partidas, resultados, confirmação (lógica já está no actions.ts)
4. Slice 4: Ranking automático
5. Slice 5: Decks + Códigos

### Arquivos importantes:
- `prisma/schema.prisma` — schema corrigido
- `src/app/page.tsx` — landing page nova
- `src/app/(app)/layout.tsx` — header Pokemon style (feito em commit anterior)
- `src/app/(app)/torneios/[slug]/admin/page.tsx` — painel admin do torneio
- `src/app/(app)/torneios/[slug]/semanas/[weekNumber]/partidas/` — partidas (Codex)

---

**Build status:** Aguardando verificação do deploy Vercel
**URL:** https://liga-zikachu.vercel.app/
