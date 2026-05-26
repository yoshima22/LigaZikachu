# Relatório de Alterações — Sistema de Códigos (Manager)

**Data:** 2026-05-26
**Autor:** Manager (Verdent)
**Commits:** `0330692` (em `34afa05` após rebase)

---

## Resumo

Sistema de códigos de booster completamente reformulado: importação em massa melhorada, paginação server-side, filtros de busca, e visibilidade diferenciada entre admin e jogador.

---

## 1. Importação em Massa de Códigos

**Arquivo:** `src/app/(app)/codigos/_components/code-admin-panel.tsx`

**Melhorias:**
- Parser de códigos agora suporta separadores: quebra de linha, vírgula, ponto-e-vírgula, espaço e tab
- Contador de códigos detectados em tempo real (ex: "Importar 150 código(s)")
- Preview dos primeiros 4 códigos + contagem total
- Placeholder atualizado indicando múltiplos separadores

**Arquivo:** `src/app/(app)/codigos/actions.ts`
- Função `parseRawCodes()` atualizada: regex `/[\r?\n,;\s]+/` para capturar todos os separadores
- Limite de importação aumentado para 500 códigos (era 100)

---

## 2. Paginação Server-Side

**Nova action:** `listBoosterCodesAction()` em `src/app/(app)/codigos/actions.ts`
- Parâmetros: `search`, `status`, `playerId`, `page`, `pageSize` (default 50)
- Retorna: `codes`, `total`, `page`, `pageSize`, `totalPages`
- Busca textual case-insensitive no campo `code`
- Filtro por status do código
- Filtro por jogador dono (via relação `distributions`)

**Arquivo:** `src/app/(app)/codigos/page.tsx` (admin view)
- Agora usa `searchParams` para receber filtros da URL
- Renderiza paginação com componente `CodeFilters`

---

## 3. Filtros e Busca (Admin)

**Novo componente:** `src/app/(app)/codigos/_components/code-filters.tsx`
- Campo de busca por texto (parte do código)
- Dropdown de status: Todos, Disponível, Atribuído, Resgatado, Invalidado, Expirado
- Dropdown de jogador: Todos, Sem dono, ou jogador específico
- Paginação com botões anterior/próximo
- Navegação via `<Link>` (server-side rendering preservado)

---

## 4. Visibilidade por Perfil

**Jogador padrão (não admin):**
- Vê apenas a aba "Meus códigos"
- Lista apenas códigos atribuídos a ele (via `CodeDistribution`)
- Códigos sem dono (AVAILABLE) **não aparecem**
- Status mostrado: ASSIGNED, REDEEMED, EXPIRED
- Pode marcar como resgatado

**Admin:**
- Vê painel completo: importação, distribuição, estatísticas
- Lista todos os códigos com paginação
- Filtros de busca, status e jogador
- Coluna "Jogador" mostra dono ou "Sem dono"
- Pode invalidar, revogar, distribuir

---

## 5. Componentes Novos

- `src/components/ui/input.tsx` — componente Input reutilizável
- `src/app/(app)/codigos/_components/code-filters.tsx` — filtros e paginação

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/app/(app)/codigos/actions.ts` | +`listBoosterCodesAction()`, parser melhorado, limite 500 |
| `src/app/(app)/codigos/page.tsx` | Server component com searchParams, player/admin views |
| `src/app/(app)/codigos/_components/code-admin-panel.tsx` | Contador de códigos, preview, separadores múltiplos |
| `src/app/(app)/codigos/_components/code-filters.tsx` | **Novo** — filtros e paginação |
| `src/components/ui/input.tsx` | **Novo** — componente Input |

---

## Estado para Continuidade do Codex

### O que o Codex estava fazendo (torneios/partidas):
- Arquivos em `src/app/(app)/torneios/[slug]/semanas/[weekNumber]/partidas/`
- Lógica de confirmação de partidas, decklists, etc.
- **Não modifiquei nenhum arquivo de torneios/partidas**

### Próximos passos sugeridos:
1. Validar build do Vercel (schema Prisma já está corrigido)
2. Testar importação de códigos em massa (100+ códigos)
3. Testar filtros e paginação na página de códigos
4. Verificar visibilidade: jogador só vê seus códigos
5. Slice 4: Ranking automático
6. Slice 5: Caixa de presentes + personalização de perfil

---

**Build status:** Aguardando verificação
**URL:** https://liga-zikachu.vercel.app/codigos
