# Posturas desbloqueáveis — design de produção

## Intenção

Liberar 13 novas posturas como progressão permanente por mascote. O jogador compra, negocia ou encontra um `Marco de Postura - [Nome]`, consome-o no mascote e completa uma jornada longa. A postura continua bloqueada para todos os outros mascotes; só entra em combate depois do desbloqueio daquele mascote.

## Abordagens consideradas

1. **Implementação completa com gate de desbloqueio — escolhida.** O catálogo, itens, jornadas, eventos, interface e efeitos de combate são implantados juntos. A postura existe em todos os motores, mas o servidor só permite selecioná-la se houver desbloqueio.
2. Infraestrutura/economia antes dos efeitos: descartada porque não entrega o uso real das posturas.
3. Lançamento por ondas: descartada porque o pedido é disponibilizar todas.

## Decisões de produto

- As posturas são: Executor, Comandante, Purificador, Sanguinário, Artilheiro, Revidador, Corrosivo, Estrategista, Inabalável, Fortaleza, Acumulador, Explosivo e Armadilheiro.
- Toda faixa `A–B` escala continuamente pelos atributos de foco da postura, até o cap de 250; dois atributos usam a média inicial do combate.
- Cada mascote pode ter vários desbloqueios permanentes, mas somente **uma jornada ativa**. Consumir outro Marco nesse mascote exige confirmação: a jornada anterior muda para `CANCELED_REPLACED`, perde todo progresso e o novo Marco inicia outra. Cancelamento voluntário também apaga o progresso e não devolve o item.
- Marco não consumido é negociável. Após consumo, a jornada e a postura liberada pertencem ao mascote e não são transferíveis.
- Ativar jornada consome **exatamente uma unidade** de `Marco de Postura - [Nome]` na mesma transação que cancela/substitui a jornada anterior e cria a nova; falha em qualquer etapa não consome o item.
- Não há retroatividade: só eventos ocorridos depois do lançamento e depois do início da jornada contam.
- A UI de jogador mostra posturas livres, bloqueadas, em treinamento e liberadas; o card do mascote abre a missão ativa, seus contadores, a última evidência e a ação de cancelar/substituir.

## Itens, Shop, Miauvadão e expedições

- Criar 13 `ShopItem`s, um por postura, chamados `Marco de Postura - [Nome]`, com a arte `public/items/marco-de-postura.png`, `price = 5000` ZC, `boundQuantity = 0`, item consumível e metadata de postura/versão.
- A Shop pode vender todos. O preço cheio é 5.000 ZC e as promoções normais da Shop se aplicam.
- O Miauvadão pode aplicar seus descontos normais, mas entre os slots públicos só um Marco de Postura pode aparecer por rotação. O slot exclusivo do jogador é exceção e pode mostrar Marco independentemente; a Shop não tem esse limite.
- Expedição de Itens de 6h pode premiar um Marco aleatório. Probabilidade proposta: 0,75% base, linear até 1,20% com Instinto 250 e multiplicador de Amuleto da Sorte de 1,25, com teto de 1,50%. A pedra de Mega atual fica entre 0,10% e 0,50%; portanto Marco é raro, porém materialmente mais encontrável. Somente uma unidade pode cair por expedição.

## Dados, jornada e contagem confiável

- Adicionar modelos `MascotTrainingJourney`, `MascotTrainingMilestoneProgress`, `MascotTrainingBattleRecord`, `MascotTrainingExpeditionRecord` e `MascotStanceUnlock`.
- `MascotTrainingJourney` guarda `mascotId`, `stanceKey`, `status`, `catalogVersion`, `startedAt`, `cancelledAt`, `completedAt`, `sourceItemId` e `seed`. Uma restrição parcial garante uma jornada `ACTIVE` por mascote; desbloqueios têm unicidade por `(mascotId, stanceKey)`.
- Cada resolução permitida produz artefatos estruturados por mascote na mesma transação: ataques, dano efetivo, Penetração de Armadura, cura efetiva, proteção de aliado em perigo, buff, debuff aceito, resistência, tipo, K.O., sobrevivência, alvo e round. Requisições repetidas não duplicam registros.
- Ao atualizar qualquer marco, a transação trava a jornada, aplica o teto por combate, persiste evidência e, quando todos os marcos atingem sua meta, cria `MascotStanceUnlock`, marca a jornada `COMPLETED` e registra auditoria.
- A simulação administrativa deve executar jornadas até conclusão usando eventos sintéticos e também reprocessar replays de cada fonte permitida. Ela falha se qualquer objetivo alcançável não avançar, se evento duplicado avançar duas vezes, se uma jornada cancelar/liberar errado ou se uma postura for selecionável sem unlock.

## Fontes e anti-exploit

- Contam: Arena-Z PvP válida, Liga Semanal resolvida, Liga Rush resolvida e expedições Padrão/Treinamento/Itens coletadas. Artefatos de raid podem entrar apenas se o objetivo os permitir explicitamente; Draft, Terreno, admin, testes, Mundo, Torre, modos desligados/inacessíveis e BYE/W.O. nunca contam.
- Arena-Z exige dois proprietários distintos, dois mascotes por lado, seis ações resolvidas, um foco de treino escolhido e uma primeira partida da dupla em janela móvel de 24h. Há teto de dois créditos/dia por proprietário e uma batalha só progride o foco escolhido. As razões de reprovação ficam visíveis.
- Os marcos têm 5–7 objetivos selecionados de pools compatíveis. K.O.s têm teto 2 por combate; buffs/curas, 3; sobrevivência/múltiplos K.O.s/último vivo, 1. O objetivo impossível de autocura pré-Sanguinário não existe.
- Afinidade será uma matriz explícita de 13 personalidades × 13 posturas. Não há texto genérico, RNG obrigatório, requisito de postura bloqueada de terceiro ou evento oculto.

## Efeitos de combate e escopo dos motores

- Adicionar os 13 valores ao enum/catálogo de posturas e um resolvedor compartilhado de efeitos, com estado por combate e eventos estruturados.
- Todos os motores que hoje interpretam `MascotCombatRole` recebem o mesmo resolvedor: Arena-Z, Liga Semanal, Liga Rush, Liga sincronizada, raids/Johto, combate de laços e simuladores/replays. Arena Draft permanece sem progresso de missão, mas reconhece postura desbloqueada para manter consistência de combate quando aplicável.
- O servidor valida desbloqueio ao salvar seleção, montar time e iniciar combate. Dados antigos continuam usando as 13 posturas livres atuais.

### Contrato executável das 13 posturas

Esta tabela substitui qualquer versão anterior do efeito.

| Postura | Foco | Regra, duração e limites |
|---|---|---|
| Executor | Força + Agilidade | Uma vez por round, antes de dano de um ataque direto, se o HP atual do alvo é `<= 5–20%` do HP máximo, o alvo vai a 0. Checagens de Sobrevivente e Dramático ocorrem normalmente. |
| Comandante | Força + Carisma | No primeiro K.O. próprio do combate, escolhe o inimigo vivo de menor HP (empate: slot). Até o fim do round seguinte, a próxima ação direta de cada aliado vivo mira esse alvo, sem mudar iniciativa; se ele cair, mira o novo menor HP. Uma ordem/equipe/combate. |
| Purificador | Agilidade + Carisma | No início do round, uma vez a cada dois rounds, remove por inteiro até duas reduções negativas de atributo no aliado vivo com menor % de HP (empate: slot), somente se a origem for Oportunista ou Estrategista. Ganha Agilidade de `5–20%` até o fim do combate; reaplicar renova, não acumula. Se Estrategista não gerar redução, não há remoção dessa origem. |
| Sanguinário | Força + Vitalidade | Ataque direto no alvo principal cura `5–20%` do dano realmente causado. Cura por round limitada a `8%` do HP máximo próprio; área, reflexo, sobre-dano e dano secundário não curam. |
| Artilheiro | Força + Agilidade | Primeiro ataque direto de cada round causa `15–25%` do dano final ao inimigo vivo de menor HP além do alvo principal (empate: slot). Secundário não recalcula tipo, não rebate, não rouba vida e não ativa postura. |
| Revidador | Vitalidade + Força | Uma vez por round, se sobrevive após receber no round dano acumulado `>=15%` do próprio HP máximo, desfere contra o primeiro agressor vivo um ataque reativo de `20%` do dano-base de seu próximo ataque; reação não aciona reação, roubo de vida ou postura. |
| Corrosivo | Força + Instinto | Ataque direto aplica Ferida aceita pela resistência: reduz cura efetiva recebida em `30–60%` até o fim do round seguinte. Não acumula; maior intensidade prevalece e nova aplicação só renova duração. |
| Estrategista | Instinto + Agilidade | Primeiro alvo atingido no round recebe Marca. O primeiro aliado diferente que o acerta recebe `4–10%` Agilidade até o combate acabar. Cada aliado acumula no máximo `20%`; todas as Marcas e ganhos desta postura acabam quando o Estrategista morre. Ele prioriza inimigos sem Marca. |
| Inabalável | Vitalidade + Instinto | Após cada ataque direto próprio, recebe escudo de `5%` do HP máximo. O escudo substitui o anterior, não acumula, e termina no combate. |
| Fortaleza | Vitalidade + Instinto | Após cada golpe direto recebido, Vitalidade e Instinto-base ganham `2–4%`, enquanto Força-base perde a mesma parcela. Não composto; cada uma limita em `+20%`, `+20%` e `-20%`, respectivamente, e termina no combate. |
| Acumulador | Força + Agilidade | Ao sobreviver ao fim de round em que agiu, ganha uma carga (máximo 3, uma por round). Com três cargas, o próximo ataque direto recebe `15–35%` de dano e consome as três; não explode imediatamente. |
| Explosivo | Agilidade + Vitalidade | No terceiro ataque direto do combate, mira o inimigo vivo de maior Agilidade (empate: slot), soma `50%` do HP atual próprio ao dano-base e então morre, ignorando suas próprias sobrevivências. Defesa, tipo, interceptação e sobrevivência do alvo continuam funcionando. |
| Armadilheiro | Instinto + Agilidade | Nos rounds 3 e 5, desliga todos os bônus de postura inimigos por aquele round. Não desliga ataque-base, personalidade, tipo, item ou habilidade; não remove estados já aplicados. |

## Resoluções de integridade e transferência

- Créditos Arena-Z são reservados na transação que finaliza a batalha: locks em ordem determinística no proprietário e na dupla não ordenada, unicidade por batalha, limites de dia em `America/Sao_Paulo` e foco capturado no snapshot inicial. Duas resoluções concorrentes não podem ultrapassar o teto.
- Cada fonte captura `journeyId`, proprietário, foco e instante no início; na resolução só credita se a mesma jornada ainda estiver ativa. Expedição só conta se iniciada após a jornada e coletada depois; cancelamento/substituição nunca transfere evento pendente ao novo Marco.
- Desbloqueio acompanha o mesmo `mascotId`, inclusive se ele for negociado; isso preserva “postura específica do mascote”, não transfere a outro mascote. Um mascote com jornada ativa não pode entrar em venda/escrow até cancelar ou concluir.
- A matriz de modo terá colunas `seleção`, `efeito`, `progresso`, `replay`: Arena-Z, Liga Semanal/Rush, Sincronizado, raid normal/Johto, laços, Torre, Mundo, Arena Online e Draft. Todos os modos que permitem seleção de mascote persistido aplicam efeito; apenas allowlist de fontes produz progresso. Unidades NPC/virtuais rejeitam posturas desbloqueáveis.

## Catálogo de afinidade e simulação de conclusão

- O lançamento só avança com 169 entradas explícitas, uma por `(postura, personalidade)`, contendo texto, predicado, alvo, teto por combate e fonte permitida. O texto genérico do laboratório é removido antes de ativar jogadores.
- Cada Marco persiste os sete objetivos e parâmetros concretos escolhidos: tipo/posição alvo, postura pública alvo, meta de dano escalada, afinidade e seed. A variação de 5–7 objetivos será usada assim: 5 objetivos de fonte/comportamento + 1 afinidade + 1 marco específico; nenhuma trilha tem menos de 7 no lançamento inicial, apesar de o sistema suportar 5–7 para catálogos futuros.
- A simulação de lançamento percorre todos os 13 × 13 catálogos e cenários de replays sintéticos/reais, verifica avanço, teto, evidência, conclusão única, cancelamento, substituição, venda bloqueada e recusa de evento repetido. Qualquer falha mantém `trainingStancesLive = false`.

## Ordem de entrega e portão de lançamento

1. Modelos, catálogo, itens negociáveis, consumo/cancelamento/substituição e tela do card.
2. Instrumentação de eventos e simulador de jornada com testes de conclusão/duplicação.
3. Efeitos de postura no resolvedor compartilhado e testes de todos os motores.
4. Shop, Miauvadão e expedição 6h, ainda sob flag de lançamento.
5. Rodar simulações completas e relatórios de progresso; só então ativar `trainingStancesLive` para jogadores.

## Não objetivos antes do lançamento

- Não liberar retroatividade, progresso de Draft/Terreno/admin/teste, ou criação livre de missões pelo admin.
- Não ativar itens, drop ou seleção real sem o relatório de simulação aprovado.
