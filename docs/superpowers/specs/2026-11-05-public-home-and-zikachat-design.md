# Home pública e ZikaChat — design de produto

**Status:** proposta para aprovação  
**Data:** 2026-11-05  
**Escopo:** home pública da Liga, lobby público do ZikaChat e salas públicas ao vivo

## Intenção

Modernizar a primeira experiência da Liga Zikachu e o ZikaChat, preservando a separação entre os dois produtos. A home continua sendo a porta de entrada para jogadores e para o Campeonato TCG da Liga; ela também deixa visível que existe um ZikaChat utilizável sem conta. O ZikaChat torna-se um lobby público sofisticado onde qualquer visitante pode criar uma sala, entrar com um código, descobrir salas ao vivo e participar por chat, voz, tela e, quando suportado, câmera.

O resultado deve parecer um produto de jogo competitivo de alto nível: uma mesa de batalha/card game moderna, com energia de comunidade e de campeonato, sem criar uma cópia visual de marcas ou arte de terceiros.

## Base técnica encontrada

- Next.js 15 App Router, React 19, Tailwind CSS 3 e Lucide; não há biblioteca de animação instalada.
- Home pública atual: `src/app/page.tsx`.
- Lobby atual: `src/app/(public)/salas/page.tsx`; criação: `create-room-form.tsx`; sala: `src/components/quick-room/quick-room-client.tsx`.
- Salas já são anônimas, expiram após 30 minutos sem atividade e suportam até 13 pessoas. Usam Supabase Realtime + WebRTC P2P, STUN e TURN sob demanda.
- O código já existe como segredo de dez caracteres sem ambiguidades visuais (`abcdefghjkmnpqrstuvwxyz23456789`), mas só pode ser usado pela URL. A interface ainda não oferece entrada por código.
- Voz e compartilhamento de tela já existem. Câmera não existe; ela precisa ser adicionada com cuidado por causa da topologia P2P.
- Zika TV/SPEC é uma experiência distinta e autenticada para transmissões de partidas e torneios. A abertura pública dela não entra neste trabalho: as lives sem conta serão salas **públicas do ZikaChat**, o subsistema que já suporta visitantes anônimos.

## Objetivos

1. Dar à home pública uma linguagem visual coesa, moderna e premium, com referências estruturais de jogo de Pokémon/TCG e o Campeonato TCG da Liga.
2. Manter a Liga como objetivo principal da home, com um CTA permanente para o ZikaChat sem autenticação.
3. Transformar `/salas` em um lobby separado para criar, entrar por código e descobrir lives públicas.
4. Permitir que um visitante entre numa live/sala pública como participante completo: chat, voz, tela e câmera opcional.
5. Deixar visível quem está conectado e quais telas/câmeras podem ser assistidas, sem expor dados ou salas privadas.
6. Manter a experiência rápida, responsiva, acessível e utilizável em celular.

## Fora de escopo

- Redesenhar páginas autenticadas, regras de torneio ou o pipeline de transmissão Zika TV/SPEC.
- Remover acesso por link existente, alterar expiração de sala ou diminuir a capacidade atual de 13 pessoas.
- Inserir novos ativos oficiais de Pokémon ou TCG. Serão reutilizados apenas ativos já presentes e autorizados no projeto; novos elementos serão autorais.
- Tornar códigos, senhas ou conteúdo de salas não listadas visíveis em qualquer vitrine pública.

## Decisões de produto

- **Separação:** a home promove o ZikaChat; criação, descoberta e participação ficam em `/salas`.
- **Entrada pública:** abrir uma live equivale a entrar na sala como participante completo. Não haverá modo espectador separado nesta fase.
- **Microfone:** no formulário de entrada, a pessoa escolhe “entrar com microfone desligado” (padrão seguro) ou “entrar com microfone ligado”. A permissão do navegador só é solicitada quando escolhe ligado ou liga o controle depois.
- **Câmera:** é opcional e desligada inicialmente. O participante pode ligá-la depois de entrar; erro/permissão negada não bloqueia a sala.
- **Descoberta:** salas são não listadas por padrão. Na criação, o anfitrião pode habilitar “mostrar em Ao vivo agora”; só salas marcadas como públicas e com presença ativa entram na lista.
- **Senha:** código identifica/abre a sala; senha é uma segunda barreira, independente e opcional. Alterar senha vale para novas entradas, não expulsa quem já está conectado.
- **Privacidade:** uma sala pública pode mostrar título, apelido do anfitrião, total de conectados e quais tipos de mídia estão ativos. Código, senha, conteúdo de chat e miniaturas reais de tela/câmera não aparecem na vitrine.
- **Proteção básica:** preservar os limites atuais de criação/entrada e incluir limites equivalentes para busca de código/listagem. Nenhuma resposta de código inválido deve confirmar detalhes sensíveis de uma sala.

## Experiência da home (`/`)

### Estrutura

1. **Hero — Liga Zikachu**
   - Mantém torneios, mascotes e batalhas como história principal.
   - Cena abstrata de mesa/arena: camadas escuras, grade discreta, brilho energético amarelo, marcadores de turno e cards autorais.
   - CTA primário: entrar na Liga. Secundários: ver campeonatos e abrir o ZikaChat sem conta.
   - O botão ZikaChat aparece no cabeçalho, no hero e no rodapé.

2. **Campeonato TCG da Liga**
   - Nova seção editorial que comunica o campeonato, confrontos e comunidade competitiva.
   - Card de destaque para “Campeonato TCG” com link para a rota de torneios existente; caso ela peça login, o comportamento atual de autenticação é preservado.
   - A página não inventa classificações ou datas. Dados dinâmicos só entram se já houver uma consulta pública segura; caso contrário, usa conteúdo institucional estável.

3. **Faixa ZikaChat — aberta para todos**
   - Um módulo visual distinto do conteúdo da Liga: “ZikaChat: entre na resenha sem criar conta”.
   - Três provas rápidas: código de sala, voz/câmera/tela e participação ao vivo.
   - CTA para `/salas` e texto explícito “não exige conta”.

4. **Atividade pública opcional**
   - Se houver salas públicas ao vivo, exibir no máximo três cards resumidos e um link para o lobby.
   - Sem salas, manter uma composição ilustrativa/estática — não criar um estado vazio deprimente nem simular pessoas conectadas.

5. **Restante da home**
   - Reorganizar novidades, passos e competição com ritmo editorial, maior respiro e menos cartões equivalentes.
   - Conservar os links e a rota de autenticação existentes.

### Direção visual e movimento

- Paleta: azul-noite/quase preto, amarelo Zikachu para ação, violeta e ciano apenas como sinais de transmissão e mídia; cor não é o único indicador de estado.
- Superfícies: painéis foscos, bordas de cartas, brilho interno e profundidade. Referência de TCG vem da composição, de marcadores e da iluminação, não de molduras ou logotipos copiados.
- Hero: camadas de energia/arena movem-se lentamente; cards flutuam com amplitude discreta.
- Cartões e CTAs: elevação, foco e brilho em 150–220 ms. Estados “AO VIVO” usam pulso mínimo.
- `prefers-reduced-motion` remove movimento não essencial; não há autoplay agressivo.

## Lobby ZikaChat (`/salas`)

### Primeira dobra

- Cabeçalho compacto: marca ZikaChat, retorno para a Liga e selo “sem cadastro”.
- Título com valor direto: salas de voz, câmera, tela e chat para a comunidade.
- Dois caminhos igualmente claros:
  - **Criar sala**: apelido/título opcional da sala, visibilidade “não listada” ou “mostrar em Ao vivo”, senha opcional e CTA de criação.
  - **Entrar com código**: campo grande, aceitando colar/digitar o código com ou sem separadores; normalização no servidor antes de procurar a sala.
- A criação termina num painel de confirmação com código agrupado visualmente, ação de copiar/compartilhar e aviso de visibilidade. A URL continua funcionando.

### Lives públicas

- Seção “Ao vivo agora” abaixo das ações principais.
- Cards mostram, sem revelar segredo: título/apelido, indicador ao vivo, número de conectados, voz/câmeras/telas ativas e ação “entrar na sala”.
- Ordenação: salas públicas com presença e mídia ativa primeiro; salas públicas ativas sem mídia depois; inativas não aparecem.
- O contador e a presença exigem uma camada de presença consultável pelo servidor ou um resumo de atividade atualizado por heartbeat; a presença privada não sai do tópico secreto atual.

### Entrada e sala

- Tela de entrada preserva apelido e senha. Acima do botão, um seletor claro de microfone: desligado por padrão ou ligado ao entrar.
- Após entrar, controles persistentes: microfone, câmera, compartilhar tela, copiar convite e sair.
- Painel “Na sala” lista apelidos com sinais acessíveis: falando/microfone, câmera ativa, compartilhando tela e assistindo.
- Área de mídia tem uma tela em foco e uma faixa de fontes disponíveis. Pessoas escolhem quais telas/câmeras assistir; a troca é rápida e não interrompe chat ou voz.
- Câmeras seguem o mesmo princípio de assinatura sob demanda que já existe para telas. Para proteger upload/CPU em malha P2P, o cliente não deve receber automaticamente vídeo de todas as 13 pessoas; a interface expõe quem está com câmera ativa e permite escolher quais abrir.
- Chat permanece visível e usável em desktop e mobile; os controles não mudam de lugar quando mídia inicia.

### Estados obrigatórios

- Código inválido ou sala encerrada.
- Senha necessária/incorreta.
- Sala cheia.
- Navegador sem câmera/microfone ou permissão negada.
- Nenhuma live pública.
- Falha de conexão P2P/TURN, mantendo o caminho atual de recuperação.

## Mudanças técnicas previstas

### Dados e APIs

1. Evoluir `QuickRoom` com os metadados mínimos para vitrine pública: visibilidade, título/apelido público, estado de listagem e resumo seguro de atividade. Incluir migração Prisma.
2. Adicionar uma rota pública de resolução de código que normalize a entrada e redirecione para a sala sem devolver tópico secreto, senha ou metadados privados.
3. Adicionar rota/listagem limitada de salas públicas ativas. Ela deve retornar somente os campos permitidos da vitrine.
4. Estender heartbeat/presença para manter o resumo público de participantes e mídia sem tornar o tópico secreto público. Definir expiração coerente com os 30 minutos atuais.
5. Manter os endpoints atuais de criação, join, TURN e sala por link compatíveis com salas legadas.

### Cliente WebRTC

1. Estender presença de membro para estados de câmera e fonte de câmera, além dos estados atuais de microfone/tela.
2. Criar um fluxo de mídia inicial que só solicita áudio quando o visitante opta por microfone ligado.
3. Adicionar câmera opcional via `getUserMedia({ video: ... })`, com desligamento limpo de tracks, renegociação e tratamento de permissão.
4. Generalizar o mecanismo de inscrição sob demanda de tela para vídeo de câmera e aplicar orçamento de bitrate por fonte/espectador.
5. Atualizar os controles, cards de participante e seletor de fontes sem comprometer navegação por teclado ou leitores de tela.

### UI e qualidade

- Modernizar `src/app/page.tsx`, as rotas públicas de `/salas`, o formulário de criação e `QuickRoomClient` com componentes locais e Tailwind já existentes.
- Reaproveitar `Reveal`, tokens da marca e ícones Lucide; não é necessário instalar um plugin ou biblioteca externa neste momento. Uma pequena camada CSS/React de animação é suficiente, reduz dependências e respeita o estilo atual.
- Testes para normalização/resolução do código, regras de listagem, privacidade de dados, criação/entrada e estados de permissão. Verificação manual com dois ou mais navegadores para WebRTC.

## Abordagens consideradas

1. **Hub público único:** criaria e descobriria salas diretamente na home. Rejeitada porque enfraquece a separação desejada entre Liga e ZikaChat.
2. **ZikaChat como destino separado — escolhida:** home promove a experiência e oferece CTA sem autenticação; `/salas` concentra entrada, criação e lives. Mantém a home focada na Liga e dá espaço para um lobby completo.
3. **Abrir Zika TV/SPEC para visitantes:** exigiria alterar o modelo autenticado de transmissão de torneios e suas permissões. Não atende tão bem a criação anônima já suportada por QuickRoom e aumenta risco de expor o sistema competitivo.

## Critérios de aceitação

1. Usuário não autenticado abre `/`, entende que há Liga, Campeonato TCG e ZikaChat, e encontra CTA para ZikaChat sem login.
2. Usuário não autenticado entra em `/salas`, cria sala, recebe/copia código e outra pessoa entra digitando esse código, sem depender de URL.
3. Salas não listadas nunca aparecem em descoberta; salas listadas ativas mostram apenas metadados permitidos.
4. Visitante entra em live como participante completo, podendo permanecer com mic/câmera desligados ou ativá-los, além de chat/tela.
5. A sala comunica participantes, fontes de tela/câmera e seleção de visualização com clareza em desktop e celular.
6. Fluxos de erro, foco, contraste e `prefers-reduced-motion` são verificados.
7. Typecheck, testes direcionados e build passam antes de qualquer alteração de produção.

## Verificação antes de produção

1. Testar desktop e breakpoints móveis por captura visual.
2. Testar criação, código válido/inválido, senha, sala cheia e expiração.
3. Testar sala listada e não listada, inclusive ausência de vazamento de código/senha/tópico.
4. Testar microfone inicial ligado/desligado, câmera negada/aceita, tela e troca de fontes com pelo menos dois clientes.
5. Rodar typecheck, testes relevantes e build; revisar o diff antes de deploy.


