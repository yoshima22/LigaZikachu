# Convite de Johto — desenho técnico

## Objetivo

Lançar os Ginásios de Johto às 08:00 de 14/10/2026 (horário de Brasília) com uma experiência individual de convite: uma carta animada obrigatória de abrir, seguida de uma votação opcional e secreta sobre a 3ª edição da Liga Zikachu TCG. Abrir a carta, com ou sem votar, libera o acesso daquele jogador à raid. O evento continua sendo para todos os jogadores.

## Escopo e regras de produto

- A raid contém oito líderes em sequência; cada líder fica disponível por até cinco dias. O motor atual já controla essa regra.
- A carta é apresentada uma vez a cada jogador elegível após o lançamento. O conteúdo de instruções não é pulável; apenas a votação é opcional.
- Depois de abrir a carta, o jogador pode usar a página `/combates/raid-johto`, mesmo que tenha escolhido não votar.
- Quem pular terá uma única oportunidade posterior de votar na página dos Ginásios. Quem enviar o formulário não pode alterar ou reenviar os votos.
- Administradores podem abrir a prévia sem gravar abertura, liberar acesso ou voto. Eles não participam das métricas de jogadores.
- Às 08:00 BRT o cron envia, uma única vez, a notificação push “Ginásios de Johto” / “Johto em festa com a etapa final da Liga Zikachu TCG”, apontando para a raid.

## Persistência

Dois modelos novos mantêm o estado auditável e independente da visibilidade global atual da raid:

1. `JohtoInvitationCampaign`: campanha única por chave, data de lançamento, estado de publicação e timestamps de push. Ela permite preparar o evento antes de ativá-lo e retestar o agendamento com segurança.
2. `JohtoInvitationRecipient`: registro único por campanha/jogador, com `availableAt`, `openedAt`, `votingSkippedAt`, `voteSubmittedAt` e `pushSentAt`. O registro é a fonte de verdade para exibir a carta, liberar o acesso e compor métricas.
3. `JohtoInvitationVote`: uma linha por pergunta e destinatário, guardando a pergunta estável, jogador escolhido e timestamps. A restrição única campanha/destinatário/pergunta impede duplicidade; uma transação só grava o conjunto completo de seis respostas se o destinatário ainda não votou.

As perguntas são armazenadas como chaves estáveis e apresentadas com os textos aprovados. Os candidatos vêm dos participantes da 3ª edição da Liga Zikachu TCG, filtrados para não incluir contas administrativas. A lista é obtida no momento da votação; o voto conserva tanto o ID do jogador quanto um snapshot do nome exibido para relatórios históricos.

## Experiência do jogador

Um componente cliente montado no layout autenticado busca o estado do convite quando a campanha está disponível. Se ainda não foi aberto, ocupa a tela com uma camada de foco e bloqueia o clique no restante do app.

O envelope chega pelas laterais em duas passagens curtas, centraliza-se e ganha um brilho dourado no lacre. Toque/clique produz compressão tátil e rompe o lacre; a aba se eleva, a carta dobra-se para fora e revela o texto por páginas. As animações usam somente CSS transform/opacity, respeitam `prefers-reduced-motion` e têm alvos grandes para mobile.

As páginas são: convite narrativo; funcionamento dos oito líderes, cinco dias, equipe de seis, dano coletivo, vinte minutos, SUS e recompensas; chamada para `/combates/raid-johto`; e escolha entre votar ou continuar. A votação é um formulário progressivo de seis perguntas com um candidato por pergunta e confirmação final. Concluir a leitura marca `openedAt`; enviar ou pular marca a decisão correspondente.

Na página da raid, um cartão discreto de votação fica visível apenas a quem abriu a carta e ainda não enviou votos. Isso permite votar mais tarde sem permitir novo envio.

## Visibilidade e autorização

`isJohtoRaidVisibleToPlayers` permanece a chave global de publicação do evento. Para jogadores comuns, ela será combinada à permissão individual do convite: o menu, o redirecionamento da página e a ação de ataque exigem a campanha publicada e convite aberto. Administradores preservam o acesso operacional existente.

O admin precisa publicar a campanha e a raid antes do horário de lançamento. O cron só torna destinatários disponíveis e envia push quando chega o horário; o estado individual impede que um push ou refresh duplicado altere a experiência.

## Administração e debug

Na aba Eventos do painel admin, o bloco Johto passa a mostrar:

- preparação/publicação da campanha e o horário de lançamento em BRT;
- métricas: destinatários elegíveis, pushes enviados, cartas abertas, votos enviados e votos pulados;
- tabela de resultados secretos por pergunta, com totais por jogador e detalhamento acessível somente a admin;
- botão “Prévia do convite” que abre a mesma carta e formulário com dados fictícios, sem persistir nada;
- botão de teste controlado para enviar o push somente ao próprio administrador, sem antecipar a campanha para jogadores.

## Texto

O convite usa o texto aprovado pelo usuário: abertura dos Líderes de Johto, regras de sequência e limite de cinco dias por líder, equipe de seis e dano coletivo, recarga de 20 minutos, SUS/reanimação, recompensas por participação/pódio/golpe final e caminho “Combates → Líderes de Johto”. A página posterior informa que a votação é opcional, secreta e de envio único, com “Participar da votação” e “Continuar para os Ginásios”.

## Falhas e segurança

- Todos os Server Actions checam sessão, campanha e regras de administrador.
- O envio de votos é atômico e valida seis respostas válidas, distintas apenas quando permitido, e pertencentes à edição correta.
- O cron usa `PushNotificationMarker` e a campanha para idempotência. Reexecuções não enviam outra notificação.
- A falha de push não impede a carta de aparecer ao entrar no app.
- A prévia usa um modo explícito e não chama Server Actions de persistência.

## Verificação

- Testes unitários para regras de elegibilidade, acesso, candidatos e voto único.
- Teste de integração do cron às 08:00 BRT, incluindo idempotência.
- Teste de Server Actions para abrir, pular e enviar votação.
- `prisma validate`, `tsc --noEmit`, lint e suíte existente da raid.
- Verificação manual desktop/mobile da animação, navegação por teclado e `prefers-reduced-motion`.
