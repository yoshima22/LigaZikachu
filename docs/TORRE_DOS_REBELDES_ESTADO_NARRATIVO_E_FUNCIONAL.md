# Torre dos Rebeldes — estado narrativo e funcional

> Documento de referência para direção narrativa. Retrata o que está implementado em 28/08/2026 e separa claramente comportamento funcional, suporte parcial e ideias ainda não conectadas ao motor.

## 1. Premissa narrativa atual

A Torre dos Rebeldes é controlada por Barão Pikachuque e sete regentes. Os Rebeldes defendem que os mascotes devem ser libertados dos treinadores e transformam criaturas capturadas em soldados sob Psicose.

Os jogadores entram em expedições de até três pessoas, levam dois mascotes cada e tentam atravessar sete andares. A Torre reage a cada decisão, aprende com a presença do grupo e fica mais perigosa por meio da **Pressão**.

Xandinho Guia, um Chandelure inicialmente apresentado como Arquivista, registra acontecimentos, descobertas e falhas. Após a primeira derrota de cada jogador, ele pode decidir acompanhar aquele treinador como mascote exclusivo.

O ciclo narrativo pretendido é:

1. entrar sem compreender a Torre;
2. falhar, descobrir mecanismos e perder mascotes;
3. compartilhar respostas corretas com a comunidade;
4. fortalecer o Legado das Runs;
5. reconhecer os regentes e suas motivações;
6. derrotar um chefe, receber sua forma exclusiva e subir ao andar seguinte;
7. compreender o plano de Barão Pikachuque antes do confronto final.

## 2. Estrutura da run

### Lobby

- Existem salas **Online** e **Lentas**, exibidas separadamente.
- Online: janela de 5 minutos por ação.
- Lento: janela de 4 horas por ação.
- Uma sala comporta até três jogadores.
- Todos escolhem uma classe, dois mascotes e posturas permitidas pela classe.
- Todos devem marcar `Pronto`; o dono inicia a expedição.
- O ticket é consumido somente no início efetivo da run, quando a exigência está ligada.
- O dono pode remover integrantes e cada integrante pode sair por conta própria antes do começo.
- O cooldown padrão entre entradas é de 60 minutos, configurável pelo administrador.

### Mapa e decisões

- Cada andar possui 39 salas procedurais, distribuídas em treze faixas de três salas.
- A subida visual ocorre de cima para baixo.
- Somente corredores realmente conhecidos são desenhados.
- Salas alinhadas sem passagem não são exibidas como falsas opções.
- Um caminho pode ser bloqueado por inimigos, porta dependente de enigma ou acontecimento ainda não resolvido.
- Salas desconhecidas mostram apenas uma indicação sem spoiler do que podem conter.
- Quando jogadores escolhem caminhos diferentes, a maioria define o caminho coletivo e a Pressão da ação é agravada.
- Cada ação confirmada adiciona Pressão. Esperar diante de um encontro adiciona custo adicional.

### Tipos de sala

| Tipo | Função funcional | Possibilidade narrativa |
|---|---|---|
| Entrada | Início do andar e apresentação do estado atual | Recepção, mudança de tom, comentário sobre o andar anterior |
| Combate | Mostra previamente os inimigos e abre combate convencional completo | Patrulha, emboscada, mascote sob Psicose, fala de um regente |
| Chefe | Combate que conclui o andar | Debate com o regente, revelação, derrota e transformação de aliança |
| Enigma | Votação coletiva; acerto registra descoberta, erro aumenta Pressão | Fragmento de lore, mecanismo da Torre, pista sobre o chefe |
| Evento | Escolha entre interagir ou ignorar | Objeto rebelde, mensagem, armadilha ou relíquia |
| Sorte | Escolha de risco; pode conceder proteção ou gerar Pressão | Oferta suspeita, barganha, artefato instável |
| Descanso | Recupera parte do HP dos mascotes vivos, com custo de Pressão | Chama, abrigo, conversa curta entre aliados |
| Resgate | Liberta mascotes perdidos em outras runs | Sala Anti-Psicose, reencontro e revelação sobre prisioneiros |

## 3. Pressão da Torre

A Pressão é a escalada central da run. Além do crescimento progressivo usado pelo motor, existem marcos narrativos:

| Pressão | Modificador atual | Leitura narrativa sugerida |
|---:|---|---|
| 2 | A Torre Observa: inimigos recebem +5% nos atributos | Olhos, ruídos e câmeras mágicas começam a seguir o grupo |
| 4 | Fome do Vazio: curas perdem 15% de eficiência | A Torre absorve energia vital e apaga fontes de recuperação |
| 6 | Caçada Rebelde: patrulhas recebem reforço adicional | Um regente ordena uma caça direcionada aos jogadores |
| 8 | Rebelião Total: inimigos recebem mais 12% | Alerta máximo; o andar passa a agir como um organismo |

Cada ponto também fortalece progressivamente os inimigos. Estudos e talentos podem absorver Pressão inicial ou reduzir sua escala.

## 4. Classes da expedição

### Investigador

- Propósito: interpretar pistas, mecanismos, objetos falsos e armadilhas.
- Efeito real: pista adicional em enigmas e +8% de Instinto nos combates.
- Posturas: Batedor, Especialista, Oportunista e Provocador.
- Uso narrativo: personagem que percebe contradições, inscrições e intenções escondidas.

### Navegador

- Propósito: ler conexões e manter o grupo unido.
- Efeito real: +3% de Agilidade e desconto de 1 Pressão na primeira espera da run.
- Posturas: Flanco, Batedor e Duelista.
- Uso narrativo: detecta rotas, atalhos e mudanças físicas da Torre.

### Protetor

- Propósito: sustentar o grupo em interações e confrontos.
- Efeito real: +6% de Vitalidade para seus mascotes.
- Posturas: Defensor, Guardião e Sobrevivente.
- Uso narrativo: recebe alertas sobre aliados vulneráveis e decisões de sacrifício.

### Artífice

- Propósito: lidar com geradores, portas, placas e alavancas.
- Efeito real: falhas de mecanismo geram 1 Pressão a menos e seus mascotes recebem +4% de Força.
- Posturas: Especialista, Sabotador, Encorajador e Atacante.
- Uso narrativo: conversa com a arquitetura, percebe sabotagens e pode contrariar sistemas dos Rebeldes.

### Ritualista

- Propósito: interpretar altares, runas, máscaras e espelhos.
- Efeito real: melhora curas de sala e concede +10% de Carisma.
- Posturas: Cuidador, Encorajador, Provocador e Sobrevivente.
- Uso narrativo: percebe memórias, emoções e a consciência presa nos mascotes.

### Batedor

- Propósito: reconhecer presença hostil e agir antes da patrulha.
- Efeito real: +7% de Agilidade.
- Posturas: Flanco, Batedor, Oportunista e Duelista.
- Uso narrativo: primeiro a avistar inimigos, rastros e movimentos de regentes.

## 5. Combates, derrota e mascotes perdidos

- Encontros exibem a formação inimiga antes da luta.
- Esperar não adiciona espécies escondidas; apenas aumenta a Pressão e fortalece a formação já revelada.
- O combate utiliza o motor convencional, com replay completo, posturas, atributos, cura e K.O.
- Se os dois mascotes de um jogador caem, ele permanece como espectador e deixa de bloquear o turno coletivo.
- Remoção por AFK derruba os mascotes e os coloca sob controle da Torre.
- Ao perder a run, mascotes derrotados ficam registrados como perdidos e indisponíveis até resgate.
- Mascotes perdidos podem surgir como inimigos sob Psicose em runs futuras.

### Formas atuais de recuperar HP ou mascotes

1. **Sala de Descanso:** cura aproximadamente 20% do HP máximo dos mascotes ainda vivos. Ritualista e estudo de primeiros socorros melhoram a cura. Não revive K.O.
2. **Sala Anti-Psicose/Ala de Contenção:** resgata de um a dois mascotes perdidos em outras runs; com o estudo `Protocolo Anti-Psicose`, pode libertar até três. Eles voltam aos donos.
3. **Ferramenta administrativa:** o administrador pode reviver manualmente um mascote perdido, devolvendo-o com 1 HP.

### Lacuna funcional importante

Não existe atualmente uma ação normal que reviva, durante a mesma run, um mascote derrubado em combate. A interface menciona que um espectador poderia voltar se revivido, mas nenhuma sala ou item faz isso hoje dentro daquela run. Isso pode virar uma futura mecânica narrativa: ritual de emergência, carga de Artífice, sacrifício de relíquia, habilidade limitada do Xandinho ou intervenção coletiva.

## 6. Recompensas realmente implementadas

### Ao derrotar um chefe

- A comunidade recebe 1 ponto global para a árvore de talentos.
- Cada participante não removido por AFK registra uma contribuição de talento.
- Cada jogador ativo recebe fragmentos de relíquia: 2 no modo Online ou 1 no modo Lento.
- Cada jogador da run recebe, apenas na primeira derrota daquele chefe, o direito de gerar o mascote exclusivo correspondente.
- O mascote nasce com origem de Laboratório, começa no nível 1 e simula crescimento nível a nível até o nível 55 com a personalidade escolhida.
- Ao vencer os andares 1 a 6, a run continua no andar seguinte. Ao vencer o sétimo, a expedição termina em vitória.

### Mascotes exclusivos por andar

| Andar | Recompensa exclusiva | Código | ID |
|---:|---|---|---:|
| 1 | Barão Pikachuque | `TORRE-PIKACHUQUE` | 210001 |
| 2 | Sir Lucardio | `TORRE-LUCARDIO` | 210002 |
| 3 | Umbrelord | `TORRE-UMBRELORD` | 210003 |
| 4 | Gengartola | `TORRE-GENGARTOLA` | 210004 |
| 5 | Quase Barão Trapinho | `TORRE-TRAPINHO` | 210005 |
| 6 | Dom Miano | `TORRE-DOM-MIANO` | 210006 |
| 7 | Madame Espeã | `TORRE-MADAME-ESPEA` | 210007 |

### Após a primeira run perdida

- O jogador recebe uma única oportunidade de gerar **Xandinho Guia** (`TORRE-XANDINHO`, ID 210008), também com origem de Laboratório e crescimento simulado até o nível 55.

### Relíquias durante a run

- Interações favoráveis em Evento/Sorte podem conceder `Fragmento de Lucidez`.
- O fragmento absorve 1 ponto futuro de Pressão naquela run.
- Uma interação desfavorável pode adicionar 2 de Pressão.

### O que ainda não é uma recompensa econômica completa

- Os fragmentos de relíquia dados ao vencer chefes são registrados como feitos, mas não possuem ainda loja, inventário utilizável ou conversão final.
- Não há distribuição configurada de ZC, ovos, comida, doces, tickets ZikaLoot ou itens comuns ao terminar a Torre.
- O score final é informativo; ele ainda não entrega prêmio nem alimenta uma classificação própria por score.
- Portanto, o desenho atual recompensa principalmente com mascotes exclusivos, metaprogressão comunitária, resgates e registro de feitos.

## 7. Legado das Runs e Estudos da Comunidade

### Legado das Runs

- É uma árvore compartilhada por toda a comunidade.
- Chefes derrotados geram pontos globais.
- Os pontos podem aumentar atributos, eficiência contra chefes, escudo de Pressão e tolerância à divisão de caminhos.
- Os talentos possuem até cinco níveis.
- O benefício vale para runs futuras, não apenas para quem conquistou o ponto.

### Estudos da Comunidade

- Existem dez estudos.
- Cada estudo exige 25 contribuições para ser ativado.
- Cada jogador pode contribuir apenas uma vez por dia e não pode contribuir em reforço já concluído.
- Estudos revelam mapa/pistas ou melhoram proteção, sorte, cura e resgate.

### Descobertas compartilhadas

- Uma resposta correta em um enigma cria ou aprimora uma entrada pública no Arquivo.
- A descoberta registra a lógica correta do mecanismo para ajudar runs futuras.
- Falhar não cria a resposta correta, mas aumenta a Pressão e pode alimentar narrativa de tentativa e erro.

## 8. Relatório final da run

Runs novas acumulam no servidor:

- dano causado e recebido por mascote;
- cura realizada;
- K.O. por mascote;
- resgates;
- salas e monstros derrotados;
- chefes derrotados;
- pontos de talento conquistados;
- score individual agregado do time.

Fórmula atual do score:

`dano + 500 × K.O. + 750 × resgates + 2.500 × chefes + 300 × salas vencidas − 20% do dano recebido`

O relatório aparece tanto na derrota quanto na vitória final. Runs anteriores à implantação da telemetria não são reconstruídas artificialmente.

## 9. Sistema narrativo disponível hoje

O administrador pode cadastrar cenas com:

- personagem/falante;
- título e texto;
- imagem de fundo;
- sprite do personagem;
- lado do personagem;
- andar;
- ordem;
- quantidade mínima de derrotas anteriores;
- informação que será liberada no Arquivo;
- estado ligado/desligado.

Gatilhos cadastráveis existentes:

- `LOBBY`
- `RUN_START`
- `ENCOUNTER`
- `BOSS`
- `VICTORY`

### Limitação técnica atual dos gatilhos

No fluxo procedural atual, `LOBBY`, `RUN_START` e a apresentação geral de `ENCOUNTER` estão conectados. Os gatilhos específicos de `BOSS` e `VICTORY` existem no editor, mas ainda precisam ser ligados explicitamente aos estados finais do novo motor de exploração. Também não existem gatilhos específicos para enigma, erro, descanso, resgate, pressão, divisão de grupo, perda de mascote ou mudança de andar.

## 10. Personagens disponíveis

- **Xandinho Guia / Chandelure:** guia, arquivista e futura ponte entre jogadores e Rebeldes.
- **Barão Pikachuque / Pikachu:** figura central e possível chefe final; defende a liberdade dos mascotes.
- **Sir Lucardio / Lucario:** regente guerreiro, honra e disciplina.
- **Umbrelord / Umbreon:** vigilância, noite, segredos e perseguição.
- **Gengartola / Gengar:** ilusão, humor cruel, Psicose e manipulação.
- **Quase Barão Trapinho / Mimikyu:** identidade, imitação e desejo de reconhecimento.
- **Dom Miano / Meowth:** mordomo, contratos, cobranças e administração da Torre.
- **Madame Espeã / Espeon:** previsão, consciência e leitura das intenções.

Observação: a ordem mecânica atual dos prêmios associa os sete chefes aos andares na ordem da tabela da seção 6. A direção narrativa pode propor outra ordem, mas isso exigirá alterar o catálogo mecânico junto com o roteiro.

## 11. Matriz sugerida para a próxima IA escrever

Para cada cena, devolver preferencialmente:

```yaml
id: identificador-unico
trigger_proposto: FLOOR_ENTER | ROOM_ENTER | ENCOUNTER_PREVIEW | WAIT | PUZZLE_SUCCESS | PUZZLE_FAILURE | PRESSURE_MILESTONE | PARTY_SPLIT | REST | RESCUE | MASCOT_LOST | BOSS_INTRO | BOSS_DEFEAT | RUN_FAILURE | FLOOR_VICTORY | FINAL_VICTORY
floor: 1-7 ou qualquer
min_failures: 0
max_failures: opcional
speaker: personagem
secondary_speaker: opcional
title: titulo curto
text: fala principal
response_or_followup: fala opcional de outro personagem
knowledge_title: opcional
knowledge_text: opcional
character_side: LEFT | RIGHT
tone: acolhedor | hostil | misterioso | revelacao | humor | urgencia
once_per_player: true | false
condition_notes: explicacao objetiva da condicao
```

## 12. Momentos recomendados para a progressão narrativa

1. Primeiro acesso ao evento.
2. Criação ou entrada na primeira sala.
3. Início da primeira run.
4. Primeira separação de caminhos.
5. Primeiro marco de Pressão 2, 4, 6 e 8.
6. Primeiro encontro e primeira decisão de esperar.
7. Primeiro K.O. de um mascote.
8. Primeiro jogador transformado em espectador.
9. Primeiro enigma correto e incorreto.
10. Primeira relíquia e primeira armadilha.
11. Primeiro descanso.
12. Primeiro resgate de mascote de outra run.
13. Primeira derrota; decisão de Xandinho de acompanhar o jogador.
14. Segunda e terceira derrotas, com falas que reconheçam repetição e conhecimento adquirido.
15. Entrada em cada andar.
16. Aproximação, apresentação e derrota de cada regente.
17. Reação de um regente ao jogador estar usando outro regente como mascote.
18. Ativação de cada Estudo da Comunidade.
19. Investimento relevante no Legado das Runs.
20. Confronto com Barão Pikachuque e vitória final.

## 13. Decisões de design ainda necessárias

- Definir se a ordem dos sete chefes permanecerá igual à ordem mecânica atual.
- Criar uma forma não administrativa de reviver dentro da mesma run, se desejado.
- Definir uso real dos fragmentos de relíquia obtidos após chefes.
- Definir recompensas econômicas, caso devam existir além dos exclusivos e da metaprogressão.
- Decidir se o score dará ranking ou prêmio.
- Expandir os gatilhos narrativos para eventos específicos e diálogos entre dois personagens.
- Definir se cenas são únicas por jogador, repetíveis por run ou variantes por número de falhas.
- Definir como personagens já derrotados reagem quando reaparecem como mascotes aliados.

