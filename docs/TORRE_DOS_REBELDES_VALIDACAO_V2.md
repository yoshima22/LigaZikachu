# Torre dos Rebeldes V2 — validação e portão de abertura

Estado em 14/10/2026: **teste fechado; não abrir ao público ainda**. Este documento complementa o retrato narrativo de agosto e descreve o motor V2. Runs V1 existentes não são convertidas silenciosamente.

## Reproduzir as verificações

```powershell
npx tsx --test src/lib/tower/*.test.ts
npm run typecheck
npm run build
npx tsx scripts/tower-simulate.ts --seeds 20 --format json
npx tsx scripts/tower-simulate.ts --seeds 20 --format csv
npx tsx scripts/tower-simulate.ts --seeds 20 --format json --afk-rates 0.05,0.15
```

O simulador não escreve no banco nem entrega recompensas. JSON traz amostras e resumo por tamanho da party, build e política de rota; CSV traz uma linha por tentativa. A semente fixa permite comparar mudanças sem ruído aleatório. Online e Lento têm o mesmo combate, mas Online concede dois fragmentos de relíquia por chefe elegível, enquanto Lento concede um. Suas janelas reais são 5 minutos e 4 horas por ação; o simulador mede turnos, não horas de calendário.

## O que o modelo mede — e o que não mede

`simulateTower(seed, partySize, buildTier, pace, routePolicy, afkRate = 0)` percorre o grafo V2 com movimento individual, encontros por sala, combate convencional, Pressão, Sobrecarga, recuperação por andar, transição de andares e espólio pendente/garantido/perdido. Registra pressão antes de cada tentativa de chefe, recuperações com seus turnos, faltas/abandonos e concessões planejadas por jogador. A chamada síncrona fixa temporariamente a fonte de aleatoriedade do combate e a restaura depois; este código é somente para CLI/testes, nunca para uma requisição do site.

Perfis sintéticos atuais (dois mascotes por treinador):

| Perfil | Nível | Cada atributo | Legado simulado |
|---|---:|---:|---|
| ZERO | 70 | 220 | nenhum ponto |
| INTERMEDIATE | 70 | 225 | 2 ranks em COMBAT, PRESSURE, VIGOR, BULWARK, COMPOSURE e PATHFINDER |
| PREPARED | 70 | 240 | COMBAT/PRESSURE/VIGOR/BULWARK/COMPOSURE/PATHFINDER 4; BOSS/FORCE/VITALITY 3 |

Os participantes usam Artífice, Ritualista e Protetor nessa ordem. A política `UNITED` percorre a primeira rota em cada sala; `SPLIT` escolhe ramos diferentes e retorna a encontros pendentes antes do chefe. Ambas acertam enigmas, interagem com descobertas e acionam a sala de recuperação quando alcançada, consumindo uma decisão e reanimando somente em turno posterior à queda. Uma taxa AFK opcional sorteia ausências com fonte aleatória independente e reproduz aviso/defesa na primeira falta e abandono na segunda consecutiva. **Isso não equivale à distribuição real de mascotes, inventários, itens, escolhas humanas ou comportamento AFK.** Não é uma estimativa de taxa de vitória de jogadores reais. Os testes isolados cobrem cativos e liquidação idempotente, mas o simulador ainda não modela a captura/libertação em combate nem a persistência real.

## Amostra inicial de 20 sementes (720 tentativas incluindo os dois ritmos)

Vitórias abaixo usam somente Online; Lento reproduz o mesmo caminho de combate da mesma semente e difere nos fragmentos. Cada célula representa 20 tentativas.

| Party | Build | Juntos | Separados | Leitura |
|---:|---|---:|---:|---|
| 1 | ZERO | 0 | 0 | Queda no 1º andar em todas as amostras |
| 1 | INTERMEDIATE | 0 | 0 | Queda no 1º andar em todas as amostras |
| 1 | PREPARED | 0 | 0 | Média de andar 2,40 / 2,50 |
| 2 | ZERO | 0 | 0 | Queda no 1º andar em todas as amostras |
| 2 | INTERMEDIATE | 0 | 0 | Média de andar 1,00 / 1,65 |
| 2 | PREPARED | 0 | 0 | Média de andar 3,25 / 4,45 |
| 3 | ZERO | 0 | 0 | Queda no 1º andar em todas as amostras |
| 3 | INTERMEDIATE | 0 | 0 | Média de andar 1,00 / 2,40 |
| 3 | PREPARED | 19 | 20 | A recuperação em turno posterior revelou uma derrota adicional na rota unida |

Nenhuma das 720 tentativas atingiu o teto de segurança de 1.200 turnos após o conserto do retorno do chefe; o espólio não apresentou IDs duplicados. A curva sintética está **excessivamente polarizada**: os perfis sem Legado são punidos cedo e o trio preparado vence quase sempre. Isso não autoriza mudar atributos reais às cegas. O próximo balanceamento precisa usar distribuição de mascotes reais, builds representativas, estratégias de rota e partidas humanas. A separação parecer melhor em algumas amostras reflete também as salas escolhidas, não prova que seu risco/recompensa esteja correto.

Com as mesmas 20 sementes e trio preparado, taxa sintética de falta de 5% deu 16/20 vitórias na rota unida e 12/20 na dividida; 15% deu 1/20 e 0/20. Esses números mostram sensibilidade à ausência, **não** predizem AFK real. `dropsByPlayer` conta as concessões que a liquidação planejaria, não prova entrega no banco. `relicShardsByPlayer` conta fragmentos no momento de cada vitória, somente para membros elegíveis naquele chefe. No motor persistido, a transição para abandono agora remove os registros pessoais de fragmentos e contribuição de talentos obtidos anteriormente na mesma run. **Ainda falta demonstrar essa revogação em teste de banco** antes de abrir o modo.

O teste de navegação revelou um deadlock: chegar à câmara do chefe com encontro pendente em outra frente bloqueava o chefe e também impedia sair da sala. A revisão encontrou outro: a chegada de um aliado ao chefe invalidava o retorno que outro já havia confirmado. Agora o retorno por corredor aberto é sempre permitido na câmara, mesmo quando o chefe poderia começar; a rota aparece no mapa e tem testes de regressão. O motor V2 também passou a preencher dano, cura, K.O., salas resolvidas sem combate e reanimações no relatório, e o encerramento lista os mascotes ainda cativos daquela tentativa.

## Portão de abertura pública

- [x] Regras puras testadas: rota individual/retorno, boss, AFK, Pressão, Sobrecarga, resgate, cativo, drop e idempotência.
- [x] Prévia local responsiva do mapa e das informações de entrada; detalhe de regras operável por teclado.
- [x] Simulação determinística de solo/dupla/trio, Online/Lento, juntos/separados, taxas AFK e tentativa completa dos sete andares.
- [ ] Cenários repetíveis de captura/libertação de cativos e teste persistido da revogação dos fragmentos obtidos antes de abandono AFK tardio.
- [ ] Run **autenticada e persistida** de todos os sete andares em Online e Lento, incluindo reconexão, concorrência do cron e último clique, relatório final e entrega única no banco de teste.
- [ ] Testes humanos com mascotes reais, equipamentos e partidas sem investimento, verificando se a primeira run é difícil, mas não impossível por fórmula.
- [ ] Economia separada aprovada: fonte gratuita previsível de ticket; conteúdo e probabilidades exatas de Doces/Travessuras; integração Semanal/Rush; efeitos/obtenção de itens. Não habilitar exigência pública de ticket nem baús compráveis antes disso.
- [ ] Auditoria de custo/tempo de transações V2 com três frentes e muitos participantes simultâneos, e teste de publicação fechado antes de remover a restrição administrativa.

Enquanto faltar qualquer item do portão, não anunciar a Torre V2 como pronta nem publicar o acesso aberto. O código pode ser mantido no repositório sob a restrição atual para continuar os testes.
