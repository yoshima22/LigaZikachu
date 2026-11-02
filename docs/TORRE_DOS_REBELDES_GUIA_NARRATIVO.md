# Torre dos Rebeldes — guia da narrativa e dos desbloqueios

Documento interno de direção narrativa e auditoria do estado atual. Revisado em 15/10/2026. **Contém spoilers do evento inteiro; não publicar para jogadores antes da abertura.** A Torre continua restrita a administradores/testadores.

## Leitura rápida

A história não é simplesmente “subir sete andares e derrotar sete chefes”. Barão Pikachuque fundou uma rebelião contra a ideia de que mascotes sejam propriedade dos treinadores. Seu medo de que a liberdade permita novas correntes o levou a construir uma Torre que vigia, controla e, pela Psicose, altera até a vontade daqueles que diz libertar. A expedição começa desconfiando da Torre, aprende o preço de seus métodos, resgata os perdidos e reúne provas de que companheirismo voluntário é diferente de posse. O confronto final não prova que treinadores sempre fazem boas escolhas: defende o direito do mascote de escolher — inclusive de errar e de voltar a um treinador.

Xandinho é o arquivista e guia, não um narrador onisciente. Ele registra falhas, descobertas e nomes dos perdidos, e transforma tentativas individuais em conhecimento da comunidade. Cada regente encarna uma distorção da tese do Barão; sua derrota não precisa significar captura ou conversão automática. Sir Lucardio é a primeira dissidência explícita dentro da Rebelião. Madame Espeã revela que o projeto do Barão nasceu de futuros temidos, não de certeza moral. No topo, o Barão perde o trono, mas não desaparece nem renega toda a crítica aos treinadores. A Torre continua como problema e cenário de pós-jogo.

## Como o jogador vê a história hoje

Ao abrir o lobby, o jogador recebe um quadro ilustrado de diálogo de Xandinho. Durante a expedição V2, os acontecimentos são acumulados numa fila; cada consulta do estado da run seleciona **uma** cena ainda inédita compatível com o evento, o andar e o número mínimo de falhas. A cena aparece como quadro narrativo na tela da run. Depois de registrada, ela pode ser revista em **Diálogos encontrados por você**, no lobby. Grupos de andares futuros são ocultados como `???`; o Arquivo da Torre mostra as descobertas de conhecimento. A liberação é individual, mesmo quando o acontecimento ocorre numa party.

Isso significa que duas falas escritas para acontecer “imediatamente” após o mesmo chefe podem aparecer em consultas ou até vitórias diferentes. A fila não tem mecanismo de capítulo obrigatório nem garante que todas as falas da conclusão sejam vistas em uma única run. O texto em `conditionNotes` é **descrição editorial**, não uma condição executada. As 143 cenas do catálogo têm `minFailures` ausente/zero; logo, “segunda derrota”, “após conhecer o regente”, “com o regente aliado”, marcos da comunidade e condições semelhantes **não são validados** apenas por estarem descritos ali.

O campo `oncePerPlayer` também não altera a seleção V2: mesmo as 13 cenas catalogadas como repetíveis ficam registradas por ID e não são escolhidas novamente após o primeiro desbloqueio. A sequência de cenas depende de novas ocorrências de eventos, não apenas de abrir/atualizar a página repetidamente.

### Legenda do inventário

- **Ativo**: o motor V2 emite um evento compatível; ainda depende de o jogador chegar ao local e de a cena ser a próxima inédita da fila.
- **Parcial**: o evento existe, mas um requisito narrativo específico não é verificado, ou o evento representa outra situação.
- **Sem gatilho V2**: a cena está escrita e pode ser liberada manualmente pelo admin, mas a progressão normal V2 não emite seu gatilho.

“Desbloquear” abaixo descreve **a intenção narrativa**. O estado na última coluna diz se o jogo a executa fielmente. No jogo atual, entre candidatas do mesmo evento o catálogo escolhe por `order` e por cena ainda não vista; andar `0` significa qualquer andar. Não há `minFailures` configurado em nenhuma cena padrão.

## Mapa de apresentação e progressão recomendada

| Momento | O que o jogador deve perceber | Apresentação recomendada |
| --- | --- | --- |
| Primeira visita | Xandinho apresenta o Arquivo, a equipe e a tese desconfortável de que mascotes podem mudar de lado. | Cena de abertura no lobby; tutorial curto antes de montar equipe. |
| Primeira derrota e novas tentativas | Perder não é apenas punição: traz mapa, pontos de preparação e um vínculo de confiança com Xandinho. | Uma cena por marco de derrota, contagem real; nunca exigir derrotas artificiais para entender a trama principal. |
| Andares 1–3 | Contratos, identidade e vigilância são três modos de confundir proteção com controle. | Entrada do andar, encontro, apresentação do chefe e resolução no mesmo capítulo; variantes de espera/erro no Arquivo. |
| Andar 4 e perdidos | Psicose é a virada moral: mascotes capturados pela Torre são condicionados e podem ser resgatados. | Revelação em sala e chefe, com indicação clara do dono e da consequência mecânica do resgate. |
| Andares 5–6 | Lucardio rompe com a violência da própria Rebelião; Espeã explicita o medo que guia o Barão. | Falas obrigatórias de chefe e pós-chefe; estudos da comunidade acrescentam contexto, sem bloquear a história principal. |
| Andar 7 | Regentes que vierem voluntariamente podem contradizer o Barão; o clímax responde à pergunta sobre escolha. | Trocas específicas de aliados presentes e sequência atômica de vitória: Barão → Xandinho → epílogo. |
| Pós-jogo | A Torre não é magicamente resolvida. Cada antigo regente encara uma nova relação com liberdade e responsabilidade. | Cenas ao reabrir o lobby e ao levar o aliado correspondente em nova run. |

Modo solo e cooperativo devem compartilhar os sete capítulos e o mesmo final. Cenas de separação, resgate por aliados e pressão podem variar por modo, mas não podem tornar a conclusão da história exclusiva de um deles. No cooperativo, um diálogo importante não deve consumir a janela de confirmação dos outros jogadores: pausar/exibir após a resolução conjunta ou permitir “ler depois” no Arquivo.

O alvo de balanceamento acordado é que uma primeira equipe muito habilidosa possa concluir os sete andares depois de aproximadamente **duas a três semanas** de aprendizado/preparação da comunidade. Isso é uma meta de experiência, **não** uma trava de calendário da narrativa. Se um grupo extraordinário vencer antes, o final deve aparecer inteiro. As cenas de falha enriquecem a leitura de quem perdeu, mas a compreensão essencial dos sete andares não pode exigir derrotas deliberadas.

### Papel dramático dos personagens

| Personagem | Função na história | Mudança que o jogador deve acompanhar |
| --- | --- | --- |
| Xandinho Guia | Arquivista, testemunha e guia; conserva nomes e conhecimento entre runs. | Passa de cronista sarcástico a aliado responsável pela memória dos perdidos e pela pergunta final. |
| Dom Miano | Questiona a propriedade pela linguagem dos contratos. | Pode trocar obrigações por presença voluntária. |
| Quase Barão Trapinho | Personifica a identidade deformada para agradar e obter reconhecimento. | Aprende que pode ser visto sem máscara ou título completo. |
| Umbrelord | Defende vigilância em nome da proteção. | Descobre que também é vigiado e que o vigia pode estar errado. |
| Gengartola | Executa a Psicose, mostrando a contradição mais cruel da Torre. | Sua derrota interrompe o método; sua eventual cooperação não apaga sua responsabilidade. |
| Sir Lucardio | Dissidente interno e prova de que a Rebelião pode rever os próprios meios. | Escolhe caminhar com os treinadores sem se tornar propriedade deles. |
| Madame Espeã | Conhece futuros possíveis e o medo original do Barão. | Aceita que uma possibilidade não prevista pode ser melhor que o controle total. |
| Barão Pikachuque | Fundador e antagonista ideológico. | Perde o direito de impor a resposta, sem perder sua crítica legítima à posse de mascotes. |

## Inventário das 143 cenas

### 00 — A Porta da Torre (6)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR00-001` O Arquivo Ainda Está Vazio | Primeira abertura da página da Torre. | Ativo no lobby. |
| `TR00-002` Entrada Registrada | Primeiro lobby após a apresentação. | Ativo no lobby. |
| `TR00-003` Primeira Expedição | Iniciar a primeira run. | Ativo, mas “primeira” depende só de ordem/inédito. |
| `TR00-004` A Torre se Moveu | Iniciar outra run e notar layout novo. | Parcial: novo layout não é checado. |
| `TR00-005` Não É uma Missão | Entrar na primeira sala com objeto interativo. | Parcial: qualquer entrada de sala serve. |
| `TR00-006` Primeiro Contato | Primeiro encontro hostil. | Ativo via encontro encontrado. |

### 01 — O Arquivista (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR01-001` Primeira Queda | Primeira run derrotada. | Ativo, sem contagem específica. |
| `TR01-002` Uma Proposta | Após a primeira derrota; oportunidade de obter Xandinho. | Parcial: entra na fila de derrotas, mas a concessão de Xandinho por primeira derrota só foi encontrada no caminho legado, não no V2. |
| `TR01-003` Segunda Queda | Segunda derrota. | Parcial: não há trava de segunda derrota. |
| `TR01-004` Terceira Queda | Terceira derrota. | Parcial: não há trava de terceira derrota. |
| `TR01-005` Ela Reconhece Seus Passos | Quinta derrota. | Parcial: não há trava de quinta derrota. |
| `TR01-006` De Novo | Abrir nova run após uma derrota. | Parcial: derrota anterior não é condição. |
| `TR01-007` Uma Página a Mais | Nova run após três derrotas. | Parcial: três derrotas não são condição. |
| `TR01-008` Ainda Não Acabou | Primeira vez que treinador fica espectador, com seus dois mascotes caídos. | Sem gatilho V2. |
| `TR01-009` Sem Mascotes | Segunda ocorrência como espectador. | Sem gatilho V2. |
| `TR01-010` O Registro Não Termina | Uma derrota posterior. | Ativo como próxima cena da fila; “posterior” não é contado. |

### 02 — A Torre Observa (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR02-001` A Torre Observa | Primeira Pressão 2. | Parcial: V2 emite evento apenas ao cruzar Pressão 6. |
| `TR02-002` Eu Vejo | Pressão 2 no andar 3, depois da apresentação de Umbrelord. | Parcial: limiar e apresentação não são checados. |
| `TR02-003` Fome do Vazio | Primeira Pressão 4. | Parcial: só cruzamento de 6 é emitido. |
| `TR02-004` Só Um Golinho | Pressão 4 no andar 4. | Parcial: só cruzamento de 6 é emitido. |
| `TR02-005` Caçada Rebelde | Primeira Pressão 6. | Ativo quando cruza 6, sujeito à ordem das cenas anteriores. |
| `TR02-006` Formação de Caça | Pressão 6 no andar 5. | Parcial: há cruzamento de 6, mas cenas anteriores podem ocupar a fila. |
| `TR02-007` Rebelião Total | Primeira Pressão 8. | Parcial: não há evento específico para 8. |
| `TR02-008` Agora É Pessoal | Pressão 8 no andar 7. | Parcial: não há evento específico para 8. |
| `TR02-009` Esperar Também É Escolher | Primeira espera diante de encontro. | Parcial: V2 emite espera, sem exigir encontro. |
| `TR02-010` Fiquem Parados | Espera no andar 3. | Ativo via espera no andar 3, sujeito à cena geral anterior. |

### 03 — Tentativa e Erro (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR03-001` Resposta Registrada | Primeiro enigma correto. | Ativo. |
| `TR03-002` Resposta Registrada Também | Primeiro enigma errado. | Ativo. |
| `TR03-003` Lucidez | Encontrar relíquia/evento favorável. | Parcial: qualquer evento dispara o gatilho positivo. |
| `TR03-004` Escolha Ruim | Primeira interação desfavorável. | Sem gatilho V2 negativo. |
| `TR03-005` Letras Miúdas | Sorte negativa no andar 1. | Sem gatilho V2 negativo. |
| `TR03-006` Termos Favoráveis | Sorte favorável no andar 1. | Parcial: qualquer Sorte dispara gatilho positivo. |
| `TR03-007` Uma Chama Pequena | Primeiro descanso. | Ativo. |
| `TR03-008` Não É Ressurreição | Descanso com mascote K.O. | Parcial: condição de K.O. não é checada. |
| `TR03-009` Sala Conhecida, Problema Novo | Sala de template conhecido com conteúdo novo. | Parcial: qualquer entrada de sala pode mostrar a cena. |
| `TR03-010` Conhecimento Compartilhado | Descoberta que alimenta o arquivo público. | Parcial: acerto em enigma não exige publicação no arquivo. |

### 04 — Contratos / Dom Miano, andar 1 (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR04-001` Primeiro Andar — Administração | Entrar pela primeira vez no andar 1. | Ativo. |
| `TR04-002` Visitantes sem Reserva | Primeiro encontro do andar 1. | Ativo. |
| `TR04-003` Multa Administrativa | Primeiro erro de enigma do andar 1. | Ativo. |
| `TR04-004` Cláusula de Propriedade | Chegar ao chefe Dom Miano. | Ativo via aproximação do chefe; não garante apresentação antes de qualquer combate. |
| `TR04-005` Contrato Encerrado | Primeira derrota para Dom Miano. | Sem gatilho V2 de derrota para chefe específico. |
| `TR04-006` Cliente Recorrente | Derrota posterior para Dom Miano. | Sem gatilho V2. |
| `TR04-007` Contrato Rasgado | Primeira vitória sobre Dom Miano. | Ativo. |
| `TR04-008` Registro: Dom Miano | Imediatamente depois da primeira vitória. | Parcial: requer novo evento de vitória/consulta; não há sequência atômica. |
| `TR04-009` Termos Revisados | Primeira run usando Dom Miano como aliado exclusivo. | Sem gatilho V2 de líder aliado. |
| `TR04-010` A Primeira Chave | Concluir o andar 1. | Ativo. |

### 05 — Rostos / Quase Barão Trapinho, andar 2 (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR05-001` Segundo Andar — Rostos | Primeira entrada no andar 2. | Ativo. |
| `TR05-002` Você Gosta Assim? | Primeiro encontro do andar 2. | Ativo. |
| `TR05-003` Máscara Errada | Primeiro evento negativo do andar 2. | Sem gatilho V2 negativo. |
| `TR05-004` Quase | Introdução do Trapinho. | Ativo via chefe. |
| `TR05-005` Agora Eu Pareço Forte? | Primeira derrota para Trapinho. | Sem gatilho V2. |
| `TR05-006` Outra Tentativa de Me Definir | Derrota posterior para Trapinho. | Sem gatilho V2. |
| `TR05-007` Sem Máscara | Primeira vitória contra Trapinho. | Ativo. |
| `TR05-008` Registro: Trapinho | Imediatamente após a primeira vitória. | Parcial: segundo evento/consulta; não é sequência garantida. |
| `TR05-009` Escolhido | Primeiro uso de Trapinho como aliado. | Sem gatilho V2. |
| `TR05-010` Sem Rostos Iguais | Concluir o andar 2. | Ativo. |

### 06 — Olhos / Umbrelord, andar 3 (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR06-001` Terceiro Andar — Vigilância | Primeira entrada no andar 3. | Ativo. |
| `TR06-002` Rastro | Primeiro encontro do andar 3. | Ativo. |
| `TR06-003` Hesitação Catalogada | Primeira espera no andar 3. | Ativo. |
| `TR06-004` Nenhuma Liberdade Sem Vigilância | Introdução de Umbrelord. | Ativo via chefe. |
| `TR06-005` Previsto | Primeira derrota para Umbrelord. | Sem gatilho V2. |
| `TR06-006` Desvio Interessante | Derrota posterior para Umbrelord. | Sem gatilho V2. |
| `TR06-007` Ponto Cego | Primeira vitória contra Umbrelord. | Ativo. |
| `TR06-008` Registro: Umbrelord | Imediatamente após a primeira vitória. | Parcial: segundo evento/consulta. |
| `TR06-009` Fora do Alcance das Câmeras | Primeiro uso de Umbrelord como aliado. | Sem gatilho V2. |
| `TR06-010` Ponto Cego Aberto | Concluir o andar 3. | Ativo. |

### 07 — Psicose / Gengartola, andar 4 (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR07-001` Quarto Andar — Sorrisos | Primeira entrada no andar 4. | Ativo. |
| `TR07-002` Voluntários | Primeiro encontro do andar 4. | Ativo. |
| `TR07-003` Eu Conheço Esse Registro | Primeiro mascote cativo/corrompido encontrado. | Ativo se houver cativo no encontro. |
| `TR07-004` Ele Escolheu | Outro encontro após a revelação. | Parcial: não exige revelação prévia, apenas próximo evento. |
| `TR07-005` Psicose | Introdução de Gengartola. | Ativo via chefe. |
| `TR07-006` Novo Recruta? | Primeira derrota para Gengartola com mascote perdido. | Sem gatilho V2 de derrota do chefe com essa condição. |
| `TR07-007` Já Sabe Como Funciona | Derrota repetida para Gengartola. | Sem gatilho V2. |
| `TR07-008` Sem Graça | Primeira vitória contra Gengartola. | Ativo. |
| `TR07-009` Do Lado de Cá | Primeiro uso de Gengartola como aliado. | Sem gatilho V2. |
| `TR07-010` Agora Você Sabe | Concluir o andar 4. | Ativo. |

### 08 — Juramento / Sir Lucardio, andar 5 (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR08-001` Quinto Andar — Disciplina | Primeira entrada no andar 5. | Ativo. |
| `TR08-002` Formação | Primeiro encontro do andar 5. | Ativo. |
| `TR08-003` Isso Não Foi Vitória | Mascote perdido no andar 5. | Parcial: `MASCOT_LOST` é associado ao fim derrotado, não à perda confirmada naquele instante. |
| `TR08-004` O Juramento | Introdução de Sir Lucardio. | Ativo via chefe. |
| `TR08-005` Ainda Não | Primeira derrota para Lucardio. | Sem gatilho V2. |
| `TR08-006` Persistência sem Disciplina | Derrota posterior para Lucardio. | Sem gatilho V2. |
| `TR08-007` Escolha | Primeira vitória contra Lucardio. | Ativo. |
| `TR08-008` Registro: Lucardio | Imediatamente após a primeira vitória. | Parcial: segundo evento/consulta. |
| `TR08-009` Por Escolha Própria | Primeiro uso de Lucardio como aliado. | Sem gatilho V2. |
| `TR08-010` Uma Rebelião Dentro da Rebelião | Concluir o andar 5. | Ativo. |

### 09 — Possibilidades / Madame Espeã, andar 6 (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR09-001` Sexto Andar — Possibilidades | Primeira entrada no andar 6. | Ativo. |
| `TR09-002` Eu Já Vi | Primeiro encontro do andar 6. | Ativo. |
| `TR09-003` Uma Linha Menos | Primeiro enigma correto do andar 6. | Ativo. |
| `TR09-004` O Futuro do Barão | Introdução de Madame Espeã. | Ativo via chefe. |
| `TR09-005` Essa Possibilidade | Primeira derrota para Espeã. | Sem gatilho V2. |
| `TR09-006` Você Mudou o Futuro, Não o Resultado | Derrota posterior para Espeã. | Sem gatilho V2. |
| `TR09-007` Uma Possibilidade Nova | Primeira vitória contra Espeã. | Ativo. |
| `TR09-008` Registro: Madame Espeã | Imediatamente após a primeira vitória. | Parcial: segundo evento/consulta. |
| `TR09-009` Linha Improvável | Primeiro uso de Espeã como aliada. | Sem gatilho V2. |
| `TR09-010` O Topo Está Aberto | Concluir o andar 6. | Ativo. |

### 10 — Rebelião / Barão Pikachuque, andar 7 (17)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR10-001` Sétimo Andar — O Topo | Primeira entrada no andar 7. | Ativo. |
| `TR10-002` Vocês Subiram Muito | Primeira sala comum do andar 7. | Parcial: qualquer entrada de sala. |
| `TR10-003` Traidores | Entrar no andar 7 com qualquer regente exclusivo voluntário. | Sem gatilho V2 de líder aliado. |
| `TR10-004` Eu Escolhi | Chegar ao topo com Lucardio aliado. | Sem gatilho V2 e sem filtro de identidade. |
| `TR10-005` Sem Contrato | Chegar ao topo com Dom Miano aliado. | Sem gatilho V2 e sem filtro de identidade. |
| `TR10-006` Olha Para Mim | Chegar ao topo com Trapinho aliado. | Sem gatilho V2 e sem filtro de identidade. |
| `TR10-007` Sem Olhos | Chegar ao topo com Umbrelord aliado. | Sem gatilho V2 e sem filtro de identidade. |
| `TR10-008` Sem Truque | Chegar ao topo com Gengartola aliado. | Sem gatilho V2 e sem filtro de identidade. |
| `TR10-009` Uma Linha Diferente | Chegar ao topo com Espeã aliada. | Sem gatilho V2 e sem filtro de identidade. |
| `TR10-010` Liberdade Definitiva | Introdução do Barão. | Ativo via chefe. |
| `TR10-011` A Prova | Primeira derrota para o Barão. | Sem gatilho V2 de derrota para chefe. |
| `TR10-012` Outra Marcha Até o Topo | Derrota posterior para o Barão. | Sem gatilho V2. |
| `TR10-013` Não Dê a Ele uma Resposta Fácil | Após a primeira derrota para o Barão. | Sem gatilho V2. |
| `TR10-014` O Direito de Estar Errado | Primeira vitória contra o Barão. | Ativo. |
| `TR10-015` Resposta | Imediatamente após `TR10-014`. | Parcial: segunda cena `BOSS_DEFEAT` pode depender de outro evento/vitória. |
| `TR10-016` Sem Trono | Desfecho da primeira run concluída. | Ativo via vitória final, sujeito à fila. |
| `TR10-017` Não É Rendição | Primeira run futura usando o Barão como aliado. | Sem gatilho V2 de líder aliado. |

### 11 — Os Perdidos (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR11-001` Primeiro K.O. | Primeiro K.O. de mascote. | Sem gatilho V2 de K.O. |
| `TR11-002` Nome Adicionado | Primeiro mascote efetivamente `LOST_IN_TOWER`. | Parcial: fim de run derrotada é mapeado para `MASCOT_LOST` mesmo sem checar a perda específica. |
| `TR11-003` A Torre Cuida | Perder mascote depois de conhecer Gengartola. | Parcial: nem perda específica nem conhecimento prévio são checados. |
| `TR11-004` Ala Anti-Psicose | Primeira sala de resgate de mascote. | Parcial: gatilho `RESCUE` também ocorre ao reanimar treinador caído. |
| `TR11-005` De Volta ao Dono | Resgatar primeiro mascote corrompido. | Ativo se o registro de combate indicar libertação. |
| `TR11-006` Resgate | Resgatar após conhecer Lucardio. | Parcial: Lucardio conhecido não é condição. |
| `TR11-007` Três Nomes | Usar Protocolo Anti-Psicose ampliado. | Parcial: qualquer resgate pode disparar, sem conferir estudo/capacidade. |
| `TR11-008` Conhecido | Encontrar cativo de outro jogador após revelação inicial. | Parcial: dono e encontro posterior não são conferidos. |
| `TR11-009` Dois Perdidos | Segundo mascote perdido pelo mesmo dono. | Parcial: quantidade e dono não são checados. |
| `TR11-010` Mensagem ao Dono | Variante rara de resgate com aviso ao dono. | Parcial: qualquer resgate posterior pode selecionar; raridade/aviso não são condições da cena. |

### 12 — Legado da Comunidade (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR12-001` Estudo Concluído | Primeiro estudo coletivo concluído. | Sem gatilho V2 de estudo. |
| `TR12-002` Conhecimento Vazando | Estudo de mapa/pistas após conhecer Umbrelord. | Sem gatilho V2 e sem condição composta. |
| `TR12-003` Anti-Psicose | Conclusão do Protocolo Anti-Psicose. | Sem gatilho V2 específico. |
| `TR12-004` Legado das Runs | Primeiro ponto global investido no Legado. | Sem gatilho V2 de legado. |
| `TR12-005` Força Herdada | Marco alto de Legado após conhecer o Barão. | Sem gatilho V2 e sem condição composta. |
| `TR12-006` Vinte e Cinco Retornaram | 25 mascotes resgatados globalmente. | Sem gatilho V2 de marco comunitário. |
| `TR12-007` Cem Enigmas | 100 enigmas corretos globalmente. | Sem gatilho V2 de marco comunitário. |
| `TR12-008` Probabilidades Mudaram | Marco alto de descoberta da Biblioteca. | Sem gatilho V2 de marco comunitário. |
| `TR12-009` Primeiro a Chegar | Primeiro acesso global a novo andar. | Sem gatilho V2 de marco comunitário. |
| `TR12-010` Primeiro Regente Derrubado | Primeira vitória global sobre um chefe. | Sem gatilho V2 de marco comunitário. |

### 13 — Depois do Topo (10)

| Cena | Desbloqueio pretendido | Estado V2 |
| --- | --- | --- |
| `TR13-001` Arquivo Completo? | Primeira vitória final, depois de `TR10-016`. | Parcial: compartilha gatilho com `TR10-016`; a sequência não é garantida na primeira conclusão. |
| `TR13-002` A Torre Continua | Primeira abertura do lobby após concluir a Torre. | Sem gatilho V2 de pós-jogo no lobby. |
| `TR13-003` Depois do Topo | Início de run após a primeira vitória final. | Parcial: `RUN_START` existe, mas vitória prévia não é verificada. |
| `TR13-004` Nova Administração | Pós-jogo com Dom Miano desbloqueado. | Sem gatilho V2 nem filtro de aliado. |
| `TR13-005` Sem Quase | Pós-jogo com Trapinho desbloqueado. | Sem gatilho V2 nem filtro de aliado. |
| `TR13-006` Olhos Abertos | Pós-jogo com Umbrelord desbloqueado. | Sem gatilho V2 nem filtro de aliado. |
| `TR13-007` Sem Psicose? | Pós-jogo com Gengartola desbloqueado. | Sem gatilho V2 nem filtro de aliado. |
| `TR13-008` A Rebelião Continua | Pós-jogo com Sir Lucardio desbloqueado. | Sem gatilho V2 nem filtro de aliado. |
| `TR13-009` Futuro Aberto | Pós-jogo com Madame Espeã desbloqueada. | Sem gatilho V2 nem filtro de aliado. |
| `TR13-010` Supervisão | Pós-jogo com Barão desbloqueado. | Sem gatilho V2 nem filtro de aliado. |

## História completa, em prosa

A Torre dos Rebeldes nasceu de uma denúncia legítima: treinadores chamam mascotes de “seus” e muitas vezes confundem vínculo com posse. Barão Pikachuque reuniu quem havia sofrido essa contradição e prometeu um lugar onde mascote nenhum seria propriedade. O problema não foi a pergunta que ele fez, e sim a resposta que passou a impor. Vendo — ou acreditando ver — futuros em que as antigas correntes sempre voltariam, ele construiu uma instituição que decide pelos próprios mascotes o que eles podem desejar. A rebelião contra a obediência tornou-se uma máquina de obediência.

O treinador entra na Torre acompanhado de mascotes e de Xandinho Guia, seu arquivista. Xandinho primeiro parece sarcástico e distante: contabiliza tentativas, salas e derrotas. Com as quedas, porém, revela sua função essencial. Ele não entrega a solução da Torre; mantém a memória de quem tentou, para que a próxima expedição comece menos cega. A Torre muda de corredores, aprende os hábitos dos invasores e aumenta a pressão sobre quem hesita ou se separa. Xandinho responde registrando. Cada descoberta compartilhada e cada mascote resgatado tornam mais difícil para o Barão dizer que nenhum vínculo com treinadores poderia ser voluntário.

Nos primeiros andares, os regentes testam aspectos distintos da mesma questão. Dom Miano administra contratos, chaves e dívidas; quer saber se a frase “meu mascote” exprime cuidado ou propriedade. Quase Barão Trapinho veste máscaras porque passou a acreditar que só merece respeito se corresponder à forma que os outros desejam. Umbrelord vigia todos, convencido de que olhar sem descanso impede novas submissões — até perceber que a Torre também o vigia. Derrotá-los abre portas, mas o argumento deles permanece. Eles só podem se tornar companheiros posteriores se a história tratar sua presença como escolha deles, não como troféu de conquista.

No quarto andar a dúvida abstrata ganha vítimas concretas. Gengartola chama de Psicose o condicionamento que faz mascotes capturados parecerem soldados voluntários. Os “perdidos” não são mortos nem prêmios para quem os encontra: possuem nomes, donos esperando do lado de fora e vontade a recuperar. O resgate quebra o controle e devolve cada um ao respectivo vínculo. A partir daí, a expedição entende que a linguagem da liberdade pode esconder uma ordem implantada. Xandinho deixa de ser apenas narrador de fracassos e passa a ser guardião de identidades que a Torre tentou apagar.

Sir Lucardio, no quinto andar, representa a rachadura ética da própria Rebelião. Ele mantém a crítica aos treinadores que tratam mascotes como equipamento, mas se recusa a chamar Psicose de libertação. Sua disciplina exige que o grupo cuide dos aliados, não apenas que vença combates. Quando decide acompanhá-los, o gesto é uma dissidência voluntária. No sexto andar, Madame Espeã completa a revelação: Barão Pikachuque viu futuros demais em que os treinadores retomavam o domínio e escolheu impedir até a possibilidade de uma decisão que julgasse ruim. O controle total nasce de medo, não de uma liberdade superior. A vitória contra Espeã mostra que o futuro pode mudar sem que alguém precise determiná-lo antecipadamente.

No topo, o Barão confronta o grupo com sua objeção mais forte: se um mascote puder escolher voltar para um treinador cruel, vocês deixarão? As respostas dos regentes que subirem como aliados são a prova viva de que nenhum deles precisou ser capturado para caminhar ao lado de treinadores. Xandinho formula o centro da história: liberdade não garante escolhas corretas; garante que a escolha pertença a quem viverá suas consequências. Vencer o Barão não absolve os treinadores nem apaga a história dos Rebeldes. Rompe, isso sim, o direito que ele tomou para si de decidir por todos.

O final é deliberadamente aberto. O Barão pode deixar o trono sem oferecer um perdão fácil. Lucardio continua combatendo a objetificação; Umbrelord aprende que o vigilante também precisa ser questionado; Trapinho pode existir sem completar um título; Miano registra relações que já não cabem em contrato; Espeã aceita linhas de futuro imprevisíveis; Gengartola é lembrança incômoda de que manipulação não se desfaz com uma única vitória. Xandinho mantém o Arquivo aberto. A Torre permanece em pé, ainda há perdidos e ainda há vínculos para proteger. Os sete andares encerram uma tentativa completa e resolvem a disputa central, mas não transformam liberdade em um estado permanente e simples.

## O que falta para essa progressão ser verdadeira no jogo

1. **Gatilhos com dados, não só nomes.** Emitir derrota com `bossId`, `floor` e índice de tentativa; K.O., perda efetiva, espectador, aliado escolhido, conclusão de estudo, marcos globais e pós-jogo. Distinguir resultado positivo/negativo de Evento e Sorte e níveis reais de Pressão 2/4/6/8.
2. **Condições compostas executáveis.** Cada cena deve declarar e validar pré-requisitos (falhas, cena anterior, aliado presente, estudo, dono do cativo, quantidade de resgates), sem depender de `conditionNotes` ou da posição na lista.
3. **Sequências essenciais atômicas.** A primeira vitória contra um regente deve entregar a fala do regente e a nota de Xandinho no mesmo capítulo. A primeira vitória final deve entregar `TR10-014` → `TR10-015` → `TR10-016` → `TR13-001`, sem exigir repetir o chefe ou atualizar a página várias vezes.
4. **Recompensa de Xandinho no V2.** Ligar a proposta após primeira derrota à concessão pendente real, com teste de idempotência; o catálogo sozinho não concede mascote.
5. **Arquivo que explique o próximo passo sem spoilers.** Mostrar o que já foi visto, a categoria da próxima pista (“avance ao próximo andar”, “ajude um estudo”, “resgate um cativo”), mas manter textos futuros ocultos. Marcadores de progresso não devem obrigar o jogador a falhar intencionalmente.
6. **Testes de jornada solo e trio.** Simular primeira entrada, derrota, retomada, cada chefe, resgate, estudo e final; confirmar a ordem e que as cenas essenciais aparecem uma vez por jogador. O modo permanece fechado ao público enquanto essas lacunas e o balanceamento não forem validados.
7. **Revisão de texto para o solo de quatro mascotes.** `TR00-003` fala em “dois mascotes por cabeça” e `TR01-008` pressupõe que dois K.O.s tornam o treinador espectador. Essas falas precisam de variante por modo quando a reserva de dois mascotes do solo estiver implementada. Também revisar falas que prometem efeito mecânico imediato sem confirmação do motor.

### Fontes desta auditoria

- `src/lib/tower/narrative-catalog.json` — textos, IDs, notas editoriais e ordem das 143 cenas.
- `src/lib/tower/narrative.ts` — filtros reais, mapeamento de eventos e persistência no Arquivo.
- `src/lib/tower/turn.ts` — eventos emitidos pelo motor V2 e concessão legada de Xandinho.
- `src/app/(app)/combates/torre-dos-rebeldes/actions.ts` — seleção no lobby e na run.
- `src/app/(app)/combates/torre-dos-rebeldes/_components/tower-narrative.tsx` — apresentação e revisão das cenas.
- `src/lib/tower/exclusive-catalog.ts` — ordem dos regentes e recompensas de chefes; a ordem correta é Miano, Trapinho, Umbrelord, Gengartola, Lucardio, Espeã, Barão.
