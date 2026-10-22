# Torre dos Rebeldes V2 — validação e portão de abertura

Estado em 22/10/2026: **teste fechado; não abrir ao público ainda**. Este documento complementa o retrato narrativo de agosto e descreve o motor V2. Runs V1 existentes não são convertidas silenciosamente.

## Curvas Solo/Grupo — 22/10/2026

Runs novas persistem perfil `SOLO` (um treinador, quatro mascotes em 2+2) ou `GROUP` (dois/três treinadores, dois mascotes cada), formação ordenada e versão de balanceamento 2. Runs sem perfil/versão mantêm a curva e a seleção de dois mascotes anteriores. O combate solo insere reservas no mesmo encontro após o K.O. dos dois ativos; HP, efeitos, replay e relatório continuam únicos. A sala de recuperação solo devolve os caídos a 50% do HP uma vez a cada dois andares, enquanto o grupo pode reanimar um aliado caído. Uma dupla ganha 3% de vantagem de reunião ao vencer duas salas distintas simultaneamente; um trio ganha 8% com duas frentes ou 16% com três. A vantagem fica guardada até o próximo combate de chefe e é consumida uma vez. A política offline `STRATEGIC_SPLIT` busca isso uma vez por andar e converge no menor caminho comum adiante.

A interface fechada agora apresenta a escolha explícita Solo/Grupo, o selecionador ordenado 2+2 com posturas, a formação persistida no lobby e a reorganização entre salas antes da confirmação. Recuperação solo e disponibilidade da sala por andar aparecem durante a run. A vantagem de reunião tem porcentagem e consequência explícitas no painel e no mapa; o replay esconde a identidade da segunda formação até o evento real de entrada. O tutorial foi versionado para reaparecer aos testadores. O botão de início de Grupo aguarda no mínimo dois treinadores. A revisão curta do polling inclui `formationSlot`, de modo que uma troca de ordem apareça mesmo sem avanço de turno.

Transição do ajuste de 22/10: uma dupla que já havia guardado 8% numa run fechada conserva essa vantagem até consumi-la no chefe; a Sobrecarga temporária antiga expira normalmente. Somente novas conquistas usam 3%. Não retirar retroativamente um bônus que os testadores já obtiveram.

**Portão de teste:** a página e cada ação de jogo continuam verificando admin ou ID incluído explicitamente na lista de testadores; a configuração de evento público não dá acesso. Não houve alteração nos tickets, baús ou toggle público. A verificação visual real em 360/720 px e as runs persistidas exigem uma conta de teste autenticada e banco isolado; nenhum resultado é inferido dos testes unitários. A migração de perfil/formação foi aplicada ao banco configurado neste checkout em 17/10; conferir que o ambiente do deploy aponta para esse mesmo banco antes de testar runs persistidas.

Parâmetros efetivos do modelo V2 após a atualização global de efetividade de tipos: Solo: primeiro andar `0,95`, andares 2–4 `1,00`, andares 5–7 `1,162`; Grupo: `0,88`, `0,961`, `0,98`, com escala por tamanho da party de `−9,5%` para dupla e `+9,5%` para trio no primeiro andar, `−16,5%` para dupla e `+15,5%` para trio nos andares 2–4 e `−10%`/`+10%` nos andares 5–7. Em ambos, primeiro chefe tem duas escoltas a menos (mínimo dois defensores), transição cura 18% do HP máximo dos vivos e alivia quatro pontos de Pressão. A escala de grupo não é um terceiro perfil: é uma regra adaptativa dentro de `GROUP`. A Sobrecarga temporária e a vantagem guardada também usam 3% por frente extra na dupla e 8% no trio, até o teto de 16%. As classes e talentos seguem suas regras anteriores.

A regra global de tipos passou de uma vantagem simples para passos de vantagem **e resistência**. Isso alterou drasticamente as lutas sintéticas da Torre; a curva anterior chegou a `0/200` vitórias de dupla unida e `40/200` no Solo. Os números abaixo foram refeitos com o mesmo motor de combate da versão atual. No V2, ter mais HP ao fim do limite de rodadas não basta para concluir a sala se algum defensor ainda estiver vivo; o HP de ambos os lados continua fiel ao combate, sem K.O. artificial dos mascotes que sobreviveram. O simulador Solo retrocede até uma enfermaria já visitada e acessível quando pode; se não houver enfermaria alcançável, o último mascote vivo ainda pode lutar. A tentativa termina em derrota quando a equipe cai ou não consegue mais avançar. O jogo real ainda oferece os itens obtidos na run. Combates com reservas usam o replay clássico porque o canvas animado ainda não representa a entrada tardia da segunda formação.

A revisão corrigiu duas distorções que invalidavam parte da calibração anterior: agora o HP persistido vem do estado final do motor (incluindo dano interceptado pelo Guardião), não de uma reconstrução incompleta do log; e o nível dos inimigos Solo usa somente os ativos vivos, sem permitir que reservas de nível baixo reduzam a dificuldade antes de entrarem. O relatório associa cada mascote ao ID de usuário correto e contabiliza o dano interceptado pelo Guardião por dados estruturados do combate. A entrada em lobby é serializada por conta, com disponibilidade revalidada na transação. A corrida concorrente ainda precisa ser exercitada com banco de teste.

Vitórias do modelo `PREPARED`, 100 sementes independentes por coorte, sem AFK nem cativo; ordem das colunas: unido / separado estrategicamente. O solo só possui rota unida.

| Coorte | Solo | Dupla | Trio |
|---|---:|---:|---:|
| `validate-0..99` | 14/100 | 9/100 · 9/100 | 11/100 · 10/100 |
| `holdout-0..99` | 9/100 | 13/100 · 14/100 | 13/100 · 14/100 |

Nas duas coortes combinadas, a conclusão preparada ficou em 23/200 Solo, 22/200 e 23/200 dupla, 24/200 e 24/200 trio. Em 12 coortes independentes de 100 sementes (`validate`, `holdout`, `audit-a` a `audit-j`), os totais foram 117/1200 Solo, 104/1200 dupla unida, 121/1200 dupla separada, 122/1200 trio unido e 120/1200 trio separado; cada coorte individual ficou entre 5 e 15 vitórias. Os resultados antigos de `ZERO` e `INTERMEDIATE` não foram refeitos após esta calibração e não devem ser tomados como atuais; o salto entre andares continua sendo ponto de atenção para o teste humano. Online e Lento usam o mesmo combate para a mesma semente; a diferença de ritmo é a janela e o fragmento de relíquia.

Os testes anteriores mostraram sensibilidade alta a espécies, atributos, classes, cativos e ausência por janela; as contagens dessas variantes precisam ser refeitas após a regra de K.O. obrigatório e a rota de retorno Solo. **A calibração central não basta para liberar o evento.** Precisamos amostrar mascotes/builds reais, itens e classes escolhidos pelos jogadores e observar runs humanas fechadas antes de ajustar a curva final. Não converter esses números em promessa de vitória real.

## Reproduzir as verificações

```powershell
npx tsx --test src/lib/tower/*.test.ts scripts/tower-balance-check.test.ts
npm run typecheck
npm run build
npx tsx scripts/tower-simulate.ts --seeds 100 --seed-prefix validate --balance before --summary-only --format json
npx tsx scripts/tower-simulate.ts --seeds 100 --seed-prefix validate --balance current --summary-only --format json
npx tsx scripts/tower-simulate.ts --seeds 100 --seed-prefix validate --balance current --first-boss-captive synthetic --summary-only --format json
npx tsx scripts/tower-simulate.ts --seeds 20 --seed-prefix afk-validation --balance current --afk-rates 0.05,0.15 --summary-only --format json
npx tsx scripts/tower-simulate.ts --seeds 100 --seed-prefix holdout --balance current --routes UNITED,STRATEGIC_SPLIT --summary-only --format json
```

O simulador não escreve no banco nem entrega recompensas. JSON traz amostras e resumo por tamanho da party, build e política de rota; CSV traz uma linha por tentativa. A semente fixa permite comparar mudanças sem ruído aleatório. Online e Lento têm o mesmo combate, mas Online concede dois fragmentos de relíquia por chefe elegível, enquanto Lento concede um. Suas janelas reais são 5 minutos e 4 horas por ação; o simulador mede turnos, não horas de calendário.

## O que o modelo mede — e o que não mede

`simulateTower(seed, partySize, buildTier, pace, routePolicy, afkRate = 0, balance?, firstBossCaptive = false)` percorre o grafo V2 com movimento individual, encontros por sala, combate convencional, Pressão, Sobrecarga, recuperação por andar, transição de andares e espólio pendente/garantido/perdido. O parâmetro opcional de balanceamento permite comparar variantes **somente offline**; sem ele, o simulador usa os mesmos valores da resolução V2 persistida. O modelo agora separa o turno de entrada do turno de ação, dimensiona o primeiro chefe com todos os mascotes vivos dos membros ativos e cobra espera no chefe apenas quando simula a decisão `WAIT`. Registra pressão antes de cada tentativa de chefe, recuperações com seus turnos, faltas/abandonos e concessões planejadas por jogador. A chamada síncrona fixa temporariamente a fonte de aleatoriedade do combate e a restaura depois; este código é somente para CLI/testes, nunca para uma requisição do site.

Perfis sintéticos atuais (quatro mascotes no Solo, dois por treinador no Grupo):

| Perfil | Nível | Cada atributo | Legado simulado |
|---|---:|---:|---|
| ZERO | 70 | 220 | nenhum ponto |
| INTERMEDIATE | 70 | 225 | 2 ranks em COMBAT, PRESSURE, VIGOR, BULWARK, COMPOSURE e PATHFINDER |
| PREPARED | 70 | 240 | COMBAT/PRESSURE/VIGOR/BULWARK/COMPOSURE/PATHFINDER 4; BOSS/FORCE/VITALITY 3 |

Os participantes usam Artífice, Ritualista e Protetor nessa ordem. A política `UNITED` percorre a primeira rota em cada sala; `SPLIT` escolhe ramos diferentes e retorna a encontros pendentes antes do chefe. Ambas acertam enigmas, interagem com descobertas e acionam a sala de recuperação quando alcançada, consumindo uma decisão posterior à chegada e reanimando somente em turno posterior à queda. Uma taxa AFK opcional sorteia ausências com fonte aleatória independente e reproduz aviso/defesa na primeira falta e abandono na segunda consecutiva. **Isso não equivale à distribuição real de mascotes, inventários, itens, escolhas humanas ou comportamento AFK.** Não é uma estimativa de taxa de vitória de jogadores reais. O parâmetro de cativo adiciona apenas um adversário sintético ao primeiro chefe, com espécie e nível fixados pelo modelo; não simula cativos em salas comuns nem a captura/libertação ou persistência real.

## Ajuste controlado de dificuldade — 14/10/2026 (histórico anterior à formação 2+2)

A primeira matriz de 20 sementes do checkpoint `52500b8c` foi **desconsiderada para balanceamento**: o simulador deixava agir no mesmo turno da entrada e, na rota separada, dimensionava o chefe apenas com os mascotes já presentes. Isso não reproduzia o motor V2. A matriz abaixo foi refeita após as correções de paridade.

Regra V2 escolhida para o teste fechado: defensores do 1º andar com **95%** do atributo calculado; primeiro chefe com **duas escoltas a menos**, mínimo de dois defensores no total. Se houver um cativo no primeiro chefe, ele **substitui** uma escolta gerada em vez de exceder o limite; em combate comum continua sendo um inimigo adicional. Andares 2–7, Pressão, cura, Sobrecarga, duração e prêmios ficaram sem alterações. O reforço proposto para os andares finais foi testado e **rejeitado** porque a rota separada já apresentava baixa conclusão com a sequência de turnos correta. V1 não foi alterada.

Comparação pareada de **100 sementes** (`validate-0` a `validate-99`) por célula, sem AFK nem cativo, ritmo Online. Cada entrada é *vitórias no 1º chefe / conclusões dos sete andares*, antes → agora. Os comandos `--balance before` e `--balance current` acima reproduzem a tabela.

| Party | Build | Unidos antes → agora | Separados antes → agora |
|---:|---|---:|---:|
| 1 | ZERO | 0/0 → 0/0 | 0/0 → 0/0 |
| 1 | INTERMEDIATE | 3/0 → 10/0 | 4/0 → 5/0 |
| 1 | PREPARED | 75/0 → 83/0 | 59/0 → 72/0 |
| 2 | ZERO | 0/0 → 11/0 | 0/0 → 0/0 |
| 2 | INTERMEDIATE | 0/0 → 15/0 | 2/0 → 31/0 |
| 2 | PREPARED | 97/0 → 100/0 | 74/0 → 93/0 |
| 3 | ZERO | 0/0 → 20/0 | 0/0 → 12/0 |
| 3 | INTERMEDIATE | 0/0 → 99/0 | 2/0 → 60/0 |
| 3 | PREPARED | 100/98 → 100/100 | 100/11 → 100/9 |

Com um **cativo sintético somente no primeiro chefe**, o trio ZERO venceu esse chefe em 43/100 unidos e 12/100 separados; INTERMEDIATE em 99/100 e 61/100; PREPARED continuou em 100/100 nas duas rotas. Os 100 casos de cativo usam uma única espécie (`448`) e nível igual à média dos aliados, não a distribuição real dos cativos. A troca de espécie e ordem de alvos pode inclusive favorecer alguns confrontos; o cativo não é automaticamente um aumento de dificuldade. Combates comuns com cativos continuam fora do modelo.

Em 20 sementes adicionais de AFK (`afk-validation-0` a `afk-validation-19`), o trio PREPARED concluiu 15/20 unidos e 2/20 separados com 5% de ausência sintética por janela; com 15%, não concluiu nenhuma run. Não houve teto de 1.200 turnos nesse lote. Online e Lento mantêm o mesmo combate por semente, com fragmentos diferentes. `dropsByPlayer` representa concessões planejadas, não entrega confirmada no banco; a revogação de fragmentos pessoais após AFK tardio ainda exige teste persistido.

**Leitura de game design:** a primeira vitória sem Legado deixou de ser virtualmente bloqueada para trios, mas o segundo chefe continua 0/100 para ZERO e INTERMEDIATE nesta amostra, e o trio PREPARED unido conclui 100/100 enquanto o separado conclui 9/100. Portanto, a curva completa **não está balanceada**. Rota, salas encontradas e tempo de reunião confundem essa comparação. Antes de ajustar os andares 2–7, são necessários dados de mascotes/builds reais, testes humanos das duas rotas e runs autenticadas com cativos. Nenhum percentual acima deve ser tratado como taxa prevista para jogadores reais.

O teste de navegação revelou um deadlock: chegar à câmara do chefe com encontro pendente em outra frente bloqueava o chefe e também impedia sair da sala. A revisão encontrou outro: a chegada de um aliado ao chefe invalidava o retorno que outro já havia confirmado. Agora o retorno por corredor aberto é sempre permitido na câmara, mesmo quando o chefe poderia começar; a rota aparece no mapa e tem testes de regressão. O motor V2 também passou a preencher dano, cura, K.O., salas resolvidas sem combate e reanimações no relatório, e o encerramento lista os mascotes ainda cativos daquela tentativa.

## Portão de abertura pública

- [x] Regras puras testadas: rota individual/retorno, boss, AFK, Pressão, Sobrecarga, resgate, cativo, drop e idempotência.
- [x] Prévia local responsiva do mapa e das informações de entrada; detalhe de regras operável por teclado.
- [x] Simulação determinística de solo/dupla/trio, Online/Lento, juntos/separados, taxas AFK e tentativa completa dos sete andares.
- [x] Seleção Solo/Grupo, 2+2, troca da formação antes de confirmar, recuperação solo, replay por estágio e vantagem de reunião visível apenas sob acesso fechado.
- [ ] Inspeção visual autenticada em 360 px e 720 px, inclusive teclado e movimento reduzido, com dados reais de uma sala Solo e Grupo.
- [ ] Cenários repetíveis de captura/libertação de cativos e teste persistido da revogação dos fragmentos obtidos antes de abandono AFK tardio.
- [ ] Run **autenticada e persistida** de todos os sete andares em Online e Lento, incluindo reconexão, concorrência do cron e último clique, relatório final e entrega única no banco de teste.
- [ ] Testes humanos com mascotes reais, equipamentos e partidas sem investimento, verificando se a primeira run é difícil, mas não impossível por fórmula.
- [ ] Economia separada aprovada: fonte gratuita previsível de ticket; conteúdo e probabilidades exatas de Doces/Travessuras; integração Semanal/Rush; efeitos/obtenção de itens. Não habilitar exigência pública de ticket nem baús compráveis antes disso.
- [ ] Auditoria de custo/tempo de transações V2 com três frentes e muitos participantes simultâneos, e teste de publicação fechado antes de remover a restrição administrativa.

Enquanto faltar qualquer item do portão, não anunciar a Torre V2 como pronta nem publicar o acesso aberto. O código pode ser mantido no repositório sob a restrição atual para continuar os testes.
