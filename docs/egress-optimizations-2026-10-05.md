# Otimizações de egress — 05/10/2026

## Alterações

- Laços: a renderização inicial lê 25 relatos para o resumo cronológico. O diário da região ativa busca nove relatos por página dentro dos últimos 25 por região/categoria, em vez de carregar até 450 de cada uma das quatro regiões.
- Categoria social/conflito é filtrada antes do limite de 25; a busca textual pesquisa apenas essa janela recente. Removida a opção de carregar relatos antigos, sem apagar registros. Mantidos os filtros que excluem mascotes de administradores, a busca por nomes de espécies e os replays de brigas da página exibida.
- O relatório regional resume os últimos 25 relatos com uma consulta compacta, sem descrição nem replay, e cache compartilhado de 60 segundos. Respostas antigas de buscas são ignoradas no cliente, e falhas permitem tentar novamente.
- Os quatro fundos PNG conhecidos são substituídos por WebP versionados em `public/refuge`. Resolução preservada, qualidade 82, cache imutável já configurado no projeto. URLs personalizadas permanecem intactas; os PNGs originais no Storage não foram apagados ou alterados.
- A listagem da Liga Semanal não carrega `replayJson` nem o `resultJson` completo. Mantém um indicador de disponibilidade e apenas odds e campos de W/O. Um clique carrega o replay por uma ação autenticada, incluindo escalação histórica e enriquecimento de nível para registros antigos.
- Destaques atuais: cache de 60 segundos. Destaques do campeão anterior: cache de uma hora, consultando somente as partidas desse campeão. As ações da Liga que revalidam sua página também invalidam os destaques, exceto salvar/excluir presets, que mantêm apenas a revalidação da página.

## Ajustes adicionais em 8 de outubro

- Arena Z: histórico pessoal e PvP limitados a 25. A consulta pessoal usa atacante OU defensor, sem duplicações e sem carregar duas listas intermediárias.
- Arena Draft: últimas 25 partidas concluídas na temporada, ordenadas da mais recente para a mais antiga. Seleção apenas de campos necessários à listagem, sem JSON de batalha. Ranking e partidas ativas não foram alterados.
- RLS ativado diretamente no banco nas 19 tabelas listadas em `prisma/migrations-manual/20261008_enable_rls_server_tables.sql`, por transação com timeout de locks. Verificados acesso de leitura do backend e RLS efetivo para `anon`/`authenticated`, sem registros visíveis nem políticas permissivas. Nenhuma dessas tabelas participa de publicação realtime. Reauditoria: `node scripts/secure-server-tables.cjs`; aplicação explícita: `node scripts/secure-server-tables.cjs --apply`.

- Avisos do topo: exclusão dos eventos visualizados feita dentro do banco, em uma consulta parametrizada. Preservados a janela dos últimos 500 vistos, prioridade, validade e limite de eventos. Elimina o retorno intermediário de até 500 IDs por atualização; não altera polling nem adiciona cache.
- Salvar/excluir presets não invalida globalmente os destaques de todas as ligas. A página continua sendo revalidada; portanto, não se promete eliminar toda recomputação da página atual.
- Nenhuma alteração nos intervalos de atualização, canais realtime, locks ou transações das arenas e do Bazar.
- Alterações de código locais: dependem de publicação para afetar o consumo em produção. A migração de RLS já foi aplicada; não houve exclusão nem alteração dos registros de jogo.

## Medições

| Comparação | Antes | Depois |
| --- | ---: | ---: |
| Quatro fundos, bytes dos arquivos | 10.565.562 | 1.120.434 |
| JSON dos históricos completos das quatro regiões versus primeira página de cada região | 1.702.074 | 14.718 |

Reduções de aproximadamente 89,4% e 99,1%, respectivamente. A segunda comparação mede os payloads serializados das consultas de histórico no momento do teste; não inclui o resumo cronológico, relatórios regionais, protocolo PostgreSQL, outras consultas da página ou autenticação. Não representa a redução do egress total faturado.

## Verificação

```powershell
node scripts/test-egress-optimizations.cjs
node scripts/test-egress-optimizations.cjs --live-readonly
npx tsc --noEmit --incremental false
npm run build
```

O modo padrão usa fixtures para testar cache por liga, estatísticas de combate, autenticação, replay sob demanda, enriquecimento de níveis, recuperação de escalações antigas e arquivos versionados. Também verifica parametrização/limites dos avisos e preservação da revalidação da página ao salvar/excluir presets. O modo `--live-readonly` usa as variáveis locais de conexão para comparar consultas novas com o histórico anterior nas quatro regiões: páginas, limites de janela, busca, filtros e totais. Compara também os avisos retornados pelas consultas antiga e nova para três jogadores amostrados e um identificador sem visualizações. Executa somente leituras, sem limpar estatísticas ou alterar dados.

Em Windows, não executar `prisma generate` enquanto o teste de integração usa a DLL do Prisma. O build pode ser executado com `npx next build` se o cliente já estiver gerado e o schema não tiver mudado.

## Publicação e acompanhamento

Não é necessária migração de schema nem atualização de registros no Storage. Publicar o código com os quatro WebPs. Após publicação, comparar Shared Pooler Egress e Storage Egress por dia, considerando visitas às páginas. Os percentuais acima são de payloads específicos e precisam ser confrontados com o uso real antes de estimar economia de faturamento.
