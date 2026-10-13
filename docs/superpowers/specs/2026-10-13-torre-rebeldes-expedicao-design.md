# Torre dos Rebeldes — expedição cooperativa e balanceamento

Data: 13/10/2026. Estado: especificação para revisão; nenhuma regra deste documento está implementada por sua mera existência.

## Intenção e limites

A Torre deve ser uma expedição difícil de sete andares, vencida apenas ao concluir o sétimo, sem limite artificial de movimentos ou duração total. Preparação de mascotes, composição, decisões de rota e cooperação devem importar. Online e Lento usam as mesmas regras de combate; diferem na janela de decisão e na quantidade de recompensas, a ser calibrada. O desenho preserva Estudos da comunidade e Legado de talentos já existentes, sem criar outro ciclo ou moeda coletiva.

Esta especificação cobre o núcleo de expedição, recuperação, AFK, pressão, recompensas da run e feedback. A economia externa — fontes de tickets, catálogo e probabilidades de Doces/Travessuras, itens persistentes — terá especificação própria. A integração prevista é: participação válida na Liga Semanal concede um Baú de Doces por ciclo; participação válida na Liga Rush concede um Baú de Travessuras por ciclo. Tickets precisam de fonte gratuita previsível além de chances em baús; a decisão de compra não é pressuposta aqui.

## Estado e processamento

Cada membro ativo tem posição própria, dois mascotes e estado `ACTIVE`, `DOWNED` ou `AFK_ABANDONED`. Salas têm estado independente de encontro, enigma, recompensa e conclusão. O turno global coleta uma ação por membro ativo, resolve imediatamente quando todos confirmam ou ao vencer a janela. Uma submissão confirmada não pode ser alterada. A resolução usa lock e identificador de turno para ser idempotente, inclusive quando cron e última confirmação competem. Movimentos, combate, drops e mudanças de HP são calculados no servidor; a interface nunca os concede sozinha.

Cada ação é validada contra a posição e o estado daquele membro no início do turno. Membros na mesma sala cooperam e enfrentam um único encontro da sala; membros em salas diferentes resolvem acontecimentos separados. Rotas não são decididas por maioria. O mapa permite avançar e retornar por conexões abertas, sem teletransporte, e garante caminho de reunião. Um membro derrubado permanece na posição em que caiu como espectador, sem confirmar ações. Se todos ficarem derrubados, a run falha imediatamente.

## Decisões de sala e chefes

Combates comuns podem acontecer com parte da equipe distante; somente quem está na sala participa. Todos os membros `ACTIVE` precisam estar na câmara do chefe, sem encontro pendente, para iniciar o combate do andar. Membros `DOWNED` não bloqueiam o chefe; membros `AFK_ABANDONED` deixam de fazer parte da equipe. A interface identifica nominalmente quem está distante, sua posição e a rota mínima conhecida para reuni-lo. Enquanto a equipe se move para reunir-se, cada turno continua sujeito à pressão normal. A ação de chefe fica bloqueada com explicação legível até as condições serem cumpridas.

## Pressão e Sobrecarga

A pressão não aumenta pelo número de cliques ou membros. Cada turno resolvido tem custo básico único; manter frentes separadas, errar objetivos e optar por espera ou risco podem acrescentar custos limitados. Os números iniciais são parâmetros de simulação, não uma promessa de dificuldade final. Separar deve oferecer descobertas, pistas, oportunidades e ações paralelas, além de risco real por combater com menos aliados.

Sucessos em salas diferentes no mesmo turno podem gerar Sobrecarga temporária da Torre. O efeito reduz sua capacidade defensiva em encontros seguintes, tem teto e nunca se acumula indefinidamente. Não se cria uma segunda barra comunitária: os Estudos diários e o Legado de talentos existentes continuam sendo a metaprogressão coletiva. Na transição de andar, mascotes vivos recebem cura moderada e a pressão diminui parcialmente; membros derrubados não são revividos por essa transição. A Torre volta a ficar perigosa com os objetivos e inimigos do novo andar.

## Recuperação e mascotes cativos

Um item de reanimação usado por membro vivo exige que ele chegue à sala do aliado `DOWNED`; o item é consumido. Uma sala de recuperação permite que um membro vivo reanime um aliado derrubado em qualquer posição do andar. O uso da sala é compartilhado pela run e a próxima recuperação por sala só fica disponível no andar `andarDoUltimoUso + 2`; não há cronômetro. A interface mostra claramente o próximo andar elegível. Em ambos os casos, os dois mascotes do aliado retornam com 50% do HP máximo e ele pode agir a partir do próximo turno.

Mascotes cativos provenientes de outras runs podem surgir como defensores identificados, com identidade e dono preservados. Quando derrotados, são libertados e voltam ao respectivo dono em repouso padrão; nunca viram prêmio da equipe. Pistas e descobertas vêm dos defensores gerados pela Torre e dos objetivos de sala. Ao terminar uma run por derrota, mascotes da própria equipe que permaneceram derrotados podem ficar cativos, e o relatório enumera cada um. Abandono por AFK, isoladamente, não captura mascotes vivos: eles retornam em repouso.

## Ausência e fim da tentativa

Na primeira janela consecutiva sem confirmação, o servidor registra falta, aplica a ação defensiva segura do membro e avisa os demais no painel. Na segunda, o membro passa a `AFK_ABANDONED`, não bloqueia turnos nem chefe, perde todos os direitos a recompensas daquela tentativa e vê o motivo no relatório. Uma confirmação válida entre as duas faltas zera a sequência. A contagem é por janelas, portanto funciona nos dois ritmos. Abandono voluntário deve ter resultado explicitado antes da confirmação e não deve ser confundido com derrota em combate.

A tentativa termina em vitória apenas após o chefe do sétimo andar; termina em derrota se todos os membros ainda participantes ficarem derrubados. Concluir andares intermediários não registra vitória final nem cria checkpoint de início para a próxima run. O encerramento devolve ao lobby e apresenta duração, andar alcançado, contribuições, KOs, recuperações, drops preservados/perdidos e mascotes cativos.

## Recompensas por andar

Salas podem gerar achados modestos, inclusive ocasionalmente ovos ou itens do evento. Um drop descoberto fica `PENDING_FLOOR`. Vencer o chefe do mesmo andar torna-o `SECURED`; morrer antes do chefe descarta os achados pendentes desse andar. Itens `SECURED` permanecem no relatório mesmo se a equipe cair depois. A entrega ao inventário ocorre somente no encerramento da run, de forma idempotente e apenas a participantes que não abandonaram por AFK. Um membro `DOWNED` que não abandonou continua elegível. Ovos, moedas e prêmios de chefe que integrem a recompensa da tentativa seguem a mesma liquidação tardia, para não exigir confisco posterior. O prêmio principal de concluir a Torre depende do sétimo andar.

Itens operacionais encontrados e usados durante a run, como reanimação, são separados do espólio de inventário para evitar que um consumo tático seja entregue novamente no fim. O exemplo de ovo de evento com chance de 5% é hipótese de balanceamento, não taxa fixada por este desenho.

## Interface e comunicação

O mapa mostra retrato/posição/status de cada treinador, companheiros na mesma sala e distâncias conhecidas. A tela de decisão indica quem confirmou, quem falta, prazo, primeira falta e abandono por AFK, bem como as consequências esperadas de lutar sozinho ou reunir-se. O combate comum identifica participantes presentes; o chefe mostra a lista de vivos que ainda precisam chegar. A pressão apresenta causa da última mudança. Salas de recuperação mostram disponibilidade por andar. Achados exibem `pendente`, `garantido` ou `perdido`, sem insinuar entrega antecipada. O tutorial passa a ensinar ações contextualizadas e deixa de descrever a separação como votação por maioria.

### Leitura imediata do mapa e das salas

O jogador sempre vê sua sala, a próxima conexão válida e o destino que selecionou com hierarquia visual distinta. Linhas de rota abertas, percorridas, bloqueadas e ainda desconhecidas não compartilham o mesmo tratamento visual. Se um aliado escolher caminho divergente, o painel informa seu nome, destino e consequência antes da confirmação; após resolver, informa quando ele está se afastando, quantas conexões conhecidas os separam e qual rota permite o reencontro. O mapa não revela inimigos ou recompensas de salas encobertas: preserva a descoberta, mas mostra o grau de risco conhecido e a finalidade provável quando houver pistas.

Cada tipo de sala possui ícone, cor secundária e resumo funcional consistentes; cor nunca é o único sinal. Antes da interação, a sala explica as opções, custos conhecidos, quem será afetado e se a ação encerra a janela. Objetos interativos têm destaque separado da decoração, rótulo de alcance, efeito conhecido ou hipótese explicitamente marcada e confirmação para consequências irreversíveis. Salas de combate distinguem participantes presentes de aliados distantes. Na câmara do chefe, a lista nominal de vivos ausentes e a pressão estimada para reunir a equipe aparecem junto ao bloqueio de iniciar.

### Classes, habilidades e montagem de equipe

A montagem de equipe mantém apresentação visual caprichada e responsiva, mas prioriza comparação legível de mascotes, funções e posturas. Cada classe informa propósito, bônus numérico, gatilho, duração/limite, posturas permitidas e exemplo de aplicação. O servidor aplica exatamente os efeitos descritos; testes automatizados cobrem cada classe e talento, inclusive combinações e limites. Quando uma habilidade alterar um resultado, o relatório do turno aponta qual habilidade o fez. A árvore do Legado mostra efeitos do rank atual e do próximo, origem dos pontos e impacto prático contra Pressão, chefe ou mapa. O tutorial diferencia classe do treinador, postura do mascote, Estudos diários e talentos ganhos em runs.

### Narrativa e orientação progressiva

Xandinho guia o primeiro contato, a preparação, a primeira bifurcação, pressão, mascote caído, resgate e chefe; cada fala deve responder ao acontecimento real, não a uma consulta genérica da página. Descobertas opcionais aprofundam a lore sem bloquear o entendimento da trama principal. Diálogos têm leitura confortável no celular, avanço/retorno, opção de rever no Arquivo e sinal de conteúdo novo; não interrompem repetidamente o combate. Cenas de salas desconhecidas só aparecem quando a descoberta ocorre. A progressão de andar apresenta uma mudança narrativa perceptível e um resumo do que foi aprendido. A ordem e os gatilhos das cenas são validados em runs simuladas para evitar revelações prematuras ou capítulos inacessíveis.

### Transparência de itens, tickets e baús

A página do evento terá catálogo consultável de efeitos de itens, usos possíveis, restrições, origem e expiração; tickets mostram onde são obtidos, quando são consumidos e quantos cada membro possui antes de marcar Pronto. Se compra de ticket ou baú vier a ser habilitada, a mesma página mostrará moeda, preço total, limite, condição de entrega e alternativas gratuitas antes da confirmação. Nenhuma compra é assumida por esta especificação. Doces e Travessuras terão prévias distintas com todos os resultados possíveis, quantidades, probabilidades exatas e indicação clara dos exclusivos; a relação entre participação válida na Liga Semanal/Rush e um baú por ciclo fica visível. Chances não são escondidas atrás da animação.

A abertura de Doces e Travessuras terá animações temáticas diferentes e chamativas, com revelação clara do prêmio, mas respeitará preferência por movimento reduzido, permitirá pular a animação e nunca repetirá a entrega ao atualizar ou reconectar. O resultado é decidido e gravado no servidor antes da animação. A UI informa se o item é utilizável durante uma run, resgata mascote cativo fora dela ou é um drop de inventário. Catálogos, preços, probabilidades e fontes concretas pertencem à especificação separada de economia do evento; esta seção fixa o contrato de transparência e apresentação.

### Curva de dificuldade e critérios de UX

As primeiras runs, com Estudos e Legado ainda não investidos, devem ser intencionalmente muito difíceis mesmo para grupos organizados. Não devem ser impossíveis por fórmula, falta de informação ou obrigação de comprar itens. As simulações com zero investimento definem a linha de base; o ganho de cada estudo e talento precisa produzir melhora mensurável sem garantir vitória. Testes com jogadores verificam se eles conseguem explicar por que morreram, que preparação ou escolha poderia mudar o resultado, como voltar a tentar e como obter ticket. A dificuldade percebida deve vir de ameaça e decisões, não de controles ambíguos ou tutorial incorreto.

## Validação e abertura

Antes da abertura pública, testes automatizados cobrem posição individual, movimentos de retorno, confirmação e prazo, resolução concorrente, combates em salas separadas, reunião do chefe, pressão, Sobrecarga, duas faltas e exclusão de prêmio, recuperação presencial/remota, cooldown por andar, liberação de mascote cativo e liquidação de drops uma única vez. Runs legadas não são reinterpretadas silenciosamente pelo novo motor; novas runs usam versão de estado explícita, e runs antigas mantêm tratamento compatível até encerrar.

Simulações repetíveis usam solo, dupla e trio, builds fraca/intermediária/preparada, Online/Lento, rota unida/dividida e diferentes taxas de AFK. Medem distribuição de andar final, pressão antes dos chefes, HP restante, consumo de recuperação, capturas/libertações, drops por jogador e quantidade de turnos. Valores são ajustados antes de testes humanos completos dos sete andares. O modo permanece em teste fechado até existir ao menos uma conclusão integral validada e não haver falhas de perda ou duplicação de recompensas.
