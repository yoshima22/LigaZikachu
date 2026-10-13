# SUS, escudo cooperativo e cooldown da Raid de Johto

## Objetivo

Ampliar a área de Atendimento SUS da Raid de Johto para que jogadores recuperem a própria equipe em lote, encontrem aliados feridos e usem um escudo cooperativo. O escudo é exclusivo da raid: começa disponível, comporta uma única carga, só revive mascotes de outros jogadores e é recarregado ao jogador realizar um novo ataque válido na raid.

## Estado persistente

Criar `JohtoRaidShield` com `eventId`, `playerId`, `available`, `usedAt`, `rechargedAt`, timestamps e unicidade em `(eventId, playerId)`.

- Ausência de registro significa escudo disponível, garantindo a liberação imediata para todos os jogadores já existentes.
- Usar o escudo cria ou atualiza o registro para `available=false`.
- Um ataque real, não administrativo, faz upsert para `available=true`; cargas não acumulam.
- O estado é isolado por evento Johto e não lê nem grava `Player.susShieldDate`, que continua exclusivo da Arena Z.

## Fluxos do servidor

- `healAllJohtoMascotsSus` mantém a recuperação em lote atômica: valida todos os próprios mascotes, cobra o total e inicia o repouso de todos, ou não altera nada.
- A ação de escudo valida sessão, evento ativo, escudo disponível, propriedade diferente do usuário e alvo ainda `INJURED`. Em uma transação, revive o alvo para `FREE`, consome o escudo e grava os eventos/auditoria necessários.
- `runJohtoRaidAttack` recarrega o escudo dentro da transação do ataque somente para jogadores reais após a investida ser registrada.

## Interface

- O bloco SUS mostra recuperação em lote e paginação dos próprios mascotes feridos.
- Um segundo bloco paginado lista aliados feridos, com treinador, mascote e botão de resgate; não lista mascotes do próprio usuário.
- O cabeçalho do bloco mostra o estado do escudo. Quando disponível, explica: “Exclusivo de Johto: revive um aliado e volta após seu próximo ataque — diferente do escudo diário da Arena Z.” Quando gasto, explica que o próximo ataque o recarrega.
- O aviso de reagrupamento passa a ter contador local. Ao chegar a zero, executa `router.refresh()` automaticamente para liberar a seleção e o botão de ataque sem atualização manual da página.

## Segurança e consistência

- O servidor é a fonte de verdade para disponibilidade, propriedade e estado do alvo; a UI apenas antecipa estados.
- A atualização usa condição de estado no banco para impedir dois resgates concorrentes do mesmo mascote ou o gasto duplo da mesma carga.
- Escudos e páginas são consultados no escopo do evento atual; feridos de outros jogadores são exibidos sem expor dados além de treinador, mascote, nível e horário da lesão.

## Verificação

- Testes de estado: escudo inicia pronto, uso o consome, ataque o recarrega sem criar uma segunda carga e não permite alvo próprio ou não ferido.
- Testes de UI/dados: paginação própria e de aliados preserva filtros e limites.
- Teste do contador: o prazo de cooldown agenda uma atualização ao expirar.
- Typecheck, testes da raid e build de produção pela Vercel.
