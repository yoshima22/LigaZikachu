# Posturas desbloqueáveis por Marco de Treinamento

## Intenção

Criar posturas avançadas conquistadas por mascote. Um `Marco de Postura - [Postura]` é um item negociável; ao consumi-lo no mascote escolhido, inicia uma jornada permanente de 4--8 marcos. Todo progresso começa no lançamento, sem retroatividade.

## Decisões de produto

- O Marco pode ser comprado, aparecer no Miauvadão e ser negociado no Bazar enquanto não for consumido. Compras comuns usam `boundQuantity = 0`; Marcos nunca entram em rotas que vinculem o item à conta.
- O consumo é atômico: retira uma unidade do inventário e cria uma jornada para o mascote. A jornada, seu progresso e a postura liberada não são transferíveis.
- As 13 posturas atuais continuam livres. Só as novas exigem desbloqueio.
- Toda jornada tem pelo menos um Marco de Afinidade: objetivo específico para a combinação personalidade + postura-alvo, nunca uma tarefa genérica de personalidade.
- O lançamento usará um catálogo versionado no servidor; painel para criar missões livremente é evolução futura.

## Fontes permitidas

| Fonte | Conta? | Uso |
|---|---:|---|
| Arena-Z PvP validada | Sim | marco competitivo e artefatos |
| Liga Semanal e Liga Rush resolvidas | Sim; BYE/W.O. não contam | participação e artefatos |
| Expedições Padrão, Treinamento e Itens coletadas | Sim | variedade de expedições |
| Raid normal e Raid Johto | Sim, somente artefatos explicitamente permitidos | prática de combate |
| Arena Draft e Batalha de Terreno | Não | nunca geram progresso |
| Mundo, Torre, testes, admin, modo desligado ou indisponível | Não no lançamento | nunca geram progresso |

Uma allowlist central bloqueia por padrão todo modo novo; nenhuma tela do cliente escolhe se um evento vale.

## Arena-Z PvP válida e anti-entrega

Uma partida somente credita se: (1) for `PVP`, resolvida e entre dois jogadores distintos; (2) os dois snapshots iniciarem com ao menos dois mascotes; (3) o replay tiver seis ou mais ações resolvidas; (4) for a primeira partida válida daquela dupla não ordenada de jogadores nas últimas 24 horas; e (5) a jornada ainda não tiver recebido dois créditos Arena-Z no dia nem oito na semana. Vitória não é exigida: derrota disputada também ensina. Combates que não passam na regra seguem normais na Arena-Z, mas não incrementam a jornada.

## Artefatos: definições sem ambiguidade

| Texto na missão | Regra do servidor |
|---|---|
| Dano efetivo | Dano direto realmente retirado do HP; não inclui cura, sobre-dano após 0 HP nem texto narrativo. |
| Cura efetiva | HP recuperado limitado ao HP faltante antes da cura. Cura em alvo cheio vale 0. |
| K.O. | Ataque direto do mascote leva inimigo vivo de HP positivo a 0. |
| Aliado em perigo | Aliado vivo com `HP atual / HP máximo < 0,50` imediatamente antes da ação. Empate: menor slot. |
| Proteção em perigo | O mascote em treino cura ou intercepta dano para aliado em perigo; registra alvo, HP antes/depois e valor efetivo. |
| Dano mitigado | Diferença positiva entre dano-base e dano aplicado depois de defesa, guarda, interceptação, redirecionamento ou redução; origem fica registrada. |
| Debuff aplicado | Alteração negativa aceita após resistência. Tentativa, renovação sem ganho e texto não contam. |
| Ação de postura | Ação resolvida com a postura indicada equipada; ataque, defesa, cura e habilidade são categorias distintas. |

Os motores produzem resumo estruturado por mascote. As missões leem esse resumo, nunca procuram palavras no replay.

## Dados e segurança

- `MascotTrainingJourney`: `mascotId`, `stanceKey`, `catalogVersion`, `startedAt`, `completedAt`, `sourceItemId`; única por `(mascotId, stanceKey)`.
- `MascotTrainingMilestoneProgress`: `journeyId`, `milestoneKey`, `value`, `target`, `completedAt`, `detailsJson`; única por `(journeyId, milestoneKey)`.
- `MascotTrainingBattleRecord`: resumo imutável por participante com `mascotId`, `sourceMode`, `sourceBattleId`, `occurredAt`, `pvpValid`, `outcome`, `stanceKey`, `artifactsJson`; único por `(mascotId, sourceMode, sourceBattleId)`.
- `MascotTrainingExpeditionRecord`: expedição coletada após lançamento, única por `(mascotId, expeditionId)`.
- `MascotStanceUnlock`: relação permanente usada por todos os seletores e validada no servidor.

O registro é criado na mesma transação que resolve combate ou coleta expedição. Repetição de requisição não duplica progresso. `preferredCombatRole`, Arena-Z, Liga Semanal, Liga Rush, Sincronizado e raids validam a postura no servidor.

## Protótipo de lançamento

Os valores abaixo são hipóteses e precisam de simulação antes de publicação. A base histórica tem concentração alta de adoção em Arena: Duelista 89.182 ações, Guardião 68.625, Defensor 56.179; Especialista 1.357, Provocador 2.385, Sabotador 2.539 e Oportunista 5.832. Isso mede uso, não poder causal: nível, espécie e idade confundem taxas de vitória.

### Executor — Força + Agilidade — 7 marcos

**Efeito:** ao atacar inimigo já abaixo de 35% do HP máximo, causa +6% a +15% de dano direto, escalado pela média de Força e Agilidade até 250. Só vale naquele golpe.

| Marco | Meta verificável |
|---|---|
| Arena-Z | 8 partidas válidas, em 6 dias e contra 6 adversários distintos. |
| Liga | 6 participações resolvidas em Liga Semanal ou Rush. |
| Exploração | 6 expedições: 2 Padrão, 2 Treinamento e 2 Itens. |
| Prática | 50 ataques como Atacante ou Flanco. |
| Dano | 10.000 de dano efetivo. |
| Finalização | 12 K.O.s. |
| Afinidade | Feito de personalidade voltado a finalização. |

### Comandante — Força + Carisma — 7 marcos

**Efeito:** no primeiro K.O. do Comandante, cada aliado vivo recebe uma carga. Até o fim do round seguinte, a próxima ação direta de cada aliado consome sua carga e recebe +4% a +10% de dano, pela média de Força e Carisma até 250. Uma ordem por equipe por combate; carga expira sem uso.

| Marco | Meta verificável |
|---|---|
| Arena-Z | 6 partidas válidas, em 5 dias e contra 5 adversários distintos. |
| Liga | 8 participações resolvidas em Liga Semanal ou Rush. |
| Exploração | 8 expedições cobrindo Padrão, Treinamento e Itens. |
| Prática | 35 ataques como Atacante ou 35 ações como Encorajador, somadas até 35. |
| Iniciativa | 8 K.O.s em fonte permitida. |
| Equipe | 10 combates em que dois aliados também resolvem uma ação. |
| Afinidade | Feito de personalidade voltado a liderança. |

### Purificador — Agilidade + Carisma — 7 marcos

**Efeito:** no início do round, havendo aliado vivo abaixo de 50% do HP máximo com redução de atributo ativa, remove 45% a 100% da maior redução, pela média de Agilidade e Carisma até 250. Escolhe o menor percentual de HP, depois menor slot; só uma vez a cada dois rounds. Não cura nem reduz dano.

| Marco | Meta verificável |
|---|---|
| Arena-Z | 8 partidas válidas, em 6 dias e contra 6 adversários distintos. |
| Liga | 6 participações resolvidas em Liga Semanal ou Rush. |
| Exploração | 7 expedições: no mínimo 2 em cada categoria e uma livre. |
| Prática | 45 ações como Encorajador, Batedor ou Cuidador. |
| Recuperação | 5.000 de cura efetiva como Cuidador **ou** sobreviver a 10 combates permitidos. |
| Resistência | Participar de 20 eventos estruturados de buff/debuff. |
| Afinidade | Feito de personalidade voltado a recuperação de estado. |

## Marco de Afinidade

O catálogo terá uma regra e um texto para cada par de personalidade e postura (13 × 3). Ele não pode depender de RNG, de postura bloqueada, de modo fora da allowlist ou de ação voluntária de outro jogador. Exemplos de textos finais:

- Competitivo + Executor: “Finalize 4 inimigos cujo total de atributos no snapshot era maior que o seu.”
- Orgulhoso + Comandante: “Cause 3 K.O.s estando acima de 70% do HP máximo antes do golpe.”
- Leal + Purificador: “Ajude 6 vezes aliado em perigo: remova redução ativa ou realize cura/proteção efetiva quando ele estava abaixo de 50% do HP.”

As 39 descrições e seus predicados são obrigatórios antes de ativar o catálogo; a UI mostra o objetivo completo e contador, nunca “feito de personalidade”.

## Economia, interface e observabilidade

`ShopItemType.TRAINING_MILESTONE` terá metadata `{ stanceKey, catalogVersion }`, será consumível, empilhável e elegível a loja, Bazar e Miauvadão. A confirmação de uso mostra mascote, consumo definitivo e data de início. A ficha do mascote exibe posturas livres/bloqueadas/em treino, contador, evidência do último evento que contou e razão de reprovação PvP.

Antes de ativar: simular equipes com nível/atributos pareados e acompanhar vitória, dano por ação, cura efetiva, mitigação e duração. Metas iniciais: nenhuma postura acima de 52% de vitória em espelho; efeito médio abaixo de 8% do dano total da equipe; Purificador nunca remove mais de um alvo por round; Comandante não pode emitir duas ordens.

O admin acompanha jornadas iniciadas/concluídas, tempo por marco, reprovações PvP, fontes do progresso e adoção/vitória pós-lançamento. Não entram no lançamento: retroatividade, Draft/Terreno/Mundo/Torre/admin, cancelamento de jornada, transferência de jornada ou criação livre de missões.

## Critérios de aceite

1. Marco não consumido é negociável; consumi-lo cria uma única jornada no mascote.
2. Apenas eventos posteriores ao lançamento e de fonte permitida avançam contadores.
3. Arena-Z passa integralmente pelas regras anti-entrega antes de creditar.
4. Cada marco tem texto, contador e evidência verificáveis; “em perigo” usa exatamente o limiar de HP desta especificação.
5. Todos os seletores recusam no servidor uma nova postura não liberada.
6. Draft, Terreno, testes, modos desligados e admin nunca produzem registros de treinamento.

## Protótipo admin — revisão de 2026-11-02

Antes de qualquer lançamento, o projeto terá somente um laboratório local em `/admin#testes`. Ele não cria `ShopItem`, não consome ZC, não grava jornada, não altera o banco e não libera/equipa postura. O admin seleciona postura, personalidade, atributos de foco e seed para inspecionar a trilha sorteada, os limites, o efeito calculado e as razões de aprovação/reprovação de um evento sintético.

### Vocabulário de jogador

- Dano ofensivo que atravessa defesa é **Penetração de Armadura**.
- Casos defensivos são **Resistência de Dano** ou **Bloqueio**. O texto de jogador não usa “mitigação de dano”.

### Ritmo aprovado para o laboratório

- Jornadas sorteiam 5--7 marcos compatíveis, sem repetir tipo de objetivo.
- Objetivos de K.O. têm teto de 2 créditos por combate; buffs e curas, 3; sobrevivência especial, último vivo e múltiplos K.O.s no mesmo combate, 1.
- Referências iniciais: 6 créditos de Arena-Z, 12 combates de Liga, 24 expedições (ao menos 6 de cada tipo), 20 K.O.s, 30 proteções em perigo, 40 buffs, 35 curas, 50 super-efetivos e 25 ultraefetivos.
- Objetivos de valor (dano, cura e Penetração de Armadura) serão exibidos como número final escalado pelo mascote no consumo do Marco, depois da validação de distribuição no laboratório.
- A meta é uma jornada ativa de aproximadamente 3--5 semanas; nenhum marco comportamental pode ser concluído em uma única batalha.

### Arena-Z sem exigir base grande de jogadores

Uma partida válida deve ser Arena-Z PvP, entre proprietários diferentes, com no mínimo dois mascotes por lado, seis ações resolvidas e um foco de treino escolhido. A mesma dupla recebe no máximo um crédito em janela móvel de 24h; cada proprietário recebe no máximo dois créditos por dia; uma batalha só credita um mascote em treino por proprietário. Não há requisito de adversários distintos. Draft, Terreno, admin, teste, modo desligado e fonte inacessível são sempre rejeitados com motivo explícito.

### Objetivo removido

“Recuperar HP próprio depois de atacar abaixo de 50%” não entra em nenhuma trilha pré-liberação, pois poderia depender da própria postura Sanguinário. A alternativa válida é “Pressão sob risco”: causar dano direto abaixo de 50% de HP e sobreviver até o próximo round, com teto de 2 créditos por combate.
