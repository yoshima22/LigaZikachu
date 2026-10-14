# Recuperação do Desafio Sincronizado — 20/10/2026

## Objetivo

Recuperar o evento cancelado de 13/10/2026, reagendá-lo para 20/10/2026 e eliminar somente os efeitos indevidos daquela execução. As duplas e as escalações de nove mascotes já feitas devem permanecer disponíveis. O histórico de eventos anteriores não faz parte da recuperação.

## Estado auditado

- A sala de `2026-10-13` foi finalizada indevidamente.
- Ela possui 12 partidas, 45 seleções e 10 placares.
- Os 10 placares têm `rewardGranted=true`.
- A concessão indevida identificada contém 7.200 ZC, 18 ovos e 10 presentes de itens ainda não resgatados.
- Há histórico finalizado de `2026-08-05`; ele deve ser preservado integralmente.

## Dados a preservar

- Duplas existentes do evento de 13/10, incluindo jogadores e tickets vinculados.
- As nove entradas de `SyncEventLineup` de cada jogador.
- Configuração de recompensas, modificadores e tickets que não foram produzidos pela sala cancelada.

## Dados a reverter

O reset tem escopo exclusivo na sala de data `2026-10-13` e em seus efeitos rastreáveis.

1. Capturar um snapshot de auditoria antes das mutações, contendo sala, rounds, seleções, partidas, placares, lançamentos de ZC, ovos e presentes identificados.
2. Montar uma lista explícita de IDs a reverter a partir do snapshot da sala e do intervalo de concessão auditado; nenhuma exclusão ou estorno pode depender apenas de texto de descrição.
3. Estornar somente os lançamentos de ZC da lista explícita. Cada estorno cria uma transação de auditoria explícita. Antes de executar, validar que o saldo de cada conta comporta o débito; qualquer insuficiência interrompe a recuperação antes de mudar dados.
4. Remover os ovos da lista explícita, desde que ainda existam como ovos não chocados. Caso algum ovo já tenha sido chocado, a rotina interrompe e reporta o caso em vez de remover um mascote.
5. Cancelar/remover os presentes da lista explícita que ainda estiverem não resgatados. Se algum presente já tiver sido resgatado, a rotina interrompe e lista os itens resultantes para tratamento manual.
6. Apagar partidas, seleções, placares e rounds da sala de 13/10 e remover a sala.
7. Desvincular as duplas da sala removida, limpar somente o estado de resultado e restaurar `LINEUP_PENDING`/`LINEUP_READY` segundo o estado real de travamento, sem apagar lineups.

## Calendário BRT

| Marco | Data/hora |
|---|---|
| Inscrições encerram; lineups válidas são congeladas | 20/10/2026 19:00 |
| Seleção do time 1 | 19:00–19:59 |
| Round 1 automático | 20:00 |
| Seleção do time 2 | 20:01–20:19 |
| Round 2 automático | 20:20 |
| Seleção do time 3 | 20:21–20:39 |
| Round 3 automático | 20:40 |
| Seleção de desempate, quando necessário | 20:41–20:59 |
| Desempate automático, quando necessário | 21:00 |

As inscrições ficam abertas até 19:00. Duplas formadas até esse instante poderão entrar se os dois jogadores possuírem exatamente nove mascotes válidos e cumprirem as regras de divisão. Duplas incompletas permanecem cadastradas, mas não recebem sala nesta edição.

## Automação

O agendador passa a derivar a janela de seleção de cada rodada dos horários configurados, e não de uma constante fixa. A execução somente é permitida a partir do marco exato da rodada correspondente. O cron deve ser idempotente: repetições não criam salas, partidas, recompensas ou estornos duplicados.

O desempate só é criado automaticamente se os critérios de ranking mantiverem empate no primeiro lugar após o round 3. Nesse caso, a seleção abre às 20:41 e fecha às 20:59:59; às 21:00 o combate é executado automaticamente. Os jogadores reutilizam qualquer um dos nove mascotes da escalação travada.

## Interface

A interface deverá exibir a etapa ativa, o horário BRT de fechamento/execução e a próxima ação do jogador. Os textos antigos que citam 17:50 ou janela genérica de dez minutos serão substituídos pelo calendário acima.

## Verificação

- Testes de calendário para cada marco e fuso BRT.
- Teste de idempotência da recuperação e do cron.
- Teste de preservação de duplas e lineups.
- Teste de reversão estritamente vinculada à sala cancelada.
- Simulação em dados controlados, seguida de auditoria das contagens reais antes/depois.
