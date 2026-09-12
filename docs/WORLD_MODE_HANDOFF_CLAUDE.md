# World Mode — handoff de desenvolvimento para Claude

## Objetivo deste documento

Este arquivo descreve o estado atual do World Mode da Liga Zikachu e a forma recomendada de continuar sua implementação. Leia também a bíblia original de conteúdo fornecida pelo proprietário do projeto antes de expandir regiões ou alterar regras narrativas.

O modo ainda é um protótipo exclusivo para administradores. Não libere a navegação para jogadores comuns ou GameMasters sem autorização explícita.

## Estado atual

O primeiro ciclo jogável cobre:

```text
Pallet Town
→ Route 1
→ Viridian City
→ Route 2
→ Viridian Forest
→ Pewter City
```

Já estão implementados:

- acesso apenas para `ADMIN` e `SUPER_ADMIN`;
- mapa responsivo com conexões adjacentes;
- localizações descobertas e progresso persistente;
- tempo de viagem e fadiga;
- conclusão de viagem calculada ao abrir a página, sem cron contínuo;
- botão administrativo para concluir uma viagem imediatamente;
- tabelas de encontros por localização, peso e período do dia;
- encontro selvagem persistente entre recarregamentos;
- tentativa de captura com consumo de Poké Ball;
- mascote capturado adicionado à coleção real e à Pokédex;
- fuga sem consumo de item;
- histórico auditável de encontros e rolagens;
- Pokémon Center removendo fadiga;
- Poké Mart debitando ZC real e entregando itens do inventário do World Mode;
- três treinadores sequenciais na Viridian Forest;
- progressão do Ginásio de Pewter com Liam, Marcus e Brock;
- Boulder Badge e recompensas entregues apenas na primeira vitória;
- revanche sem duplicar recompensas;
- histórico persistente das batalhas;
- uso do motor oficial da Liga para tipos, Agilidade, posturas, cura, buffs, debuffs e personalidades;
- reset administrativo do progresso de teste.

## Commits de referência

```text
6539caa7  feat: add admin-only World Mode foundation
2680a43a  feat: add World Mode exploration and captures
528899d1  feat: add World Mode centers and marts
ab46d3c7  feat: add World Mode trainer battles
9c541da3  feat: add Viridian Forest artwork
c364e9f8  feat: add Pewter gym progression
```

Observação: confira o histórico real do Git se alguma descrição acima divergir. Não reescreva esses commits.

## Arquivos principais

### Interface e ações

- `src/app/(app)/mundo/page.tsx`
  - valida acesso de administrador;
  - carrega estado, encontros, batalhas, carteira e conteúdo configurado;
  - transforma datas e dados do Prisma em propriedades serializáveis.

- `src/app/(app)/mundo/actions.ts`
  - contém todas as mutações do modo;
  - cada ação deve continuar usando `requirePlatformAdmin()` enquanto o protótipo for privado;
  - mutações importantes usam `pg_advisory_xact_lock` com a chave `world:<playerId>`;
  - nunca confie em localização, preço, chance ou recompensa enviados pelo cliente.

- `src/app/(app)/mundo/world-mode-client.tsx`
  - apresenta mapa, localização, viagem, exploração, captura, serviços, treinadores e histórico;
  - deve permanecer responsivo;
  - evite transformar este componente em fonte de regras de negócio.

### Conteúdo configurável

- `src/world-data/types.ts`
  - contratos de localizações, conexões, serviços, atividades, encontros e itens.

- `src/world-data/kanto/mvp.ts`
  - seis localizações iniciais;
  - coordenadas, atividades, serviços, conexões e pools de encontros.

- `src/world-data/kanto/mart.ts`
  - catálogo e preços provisórios do Poké Mart;
  - os valores devem continuar centralizados aqui.

- `src/world-data/kanto/trainers.ts`
  - treinadores, falas, equipes, atributos, posturas, pré-requisitos e recompensas;
  - novos NPCs devem ser conteúdo configurado, não blocos especiais dentro da action.

### Banco

Modelos adicionados ao `prisma/schema.prisma`:

- `WorldPlayerState`;
- `WorldTravelLog`;
- `WorldEncounterSession`;
- `WorldBattleSession`;
- `WorldEncounterStatus`.

Migrações:

```text
prisma/migrations/20260912090000_add_world_mode_foundation
prisma/migrations/20260912123000_add_world_encounters
prisma/migrations/20260912170000_add_world_trainer_battles
```

Existe uma migração antiga e não relacionada marcada como falha no banco (`20260806153000_add_admin_species_registry`). Isso bloqueou `prisma migrate deploy` durante esta implementação. As migrações do World Mode foram aplicadas isoladamente com `prisma db execute`. Não marque a migração antiga como resolvida sem investigar seu estado real.

## Assets existentes

Diretório:

```text
public/world-mode/kanto/viridian-forest/
```

Arquivos:

- `background.webp` — cenário horizontal da floresta;
- `trainer-noah.webp` — retrato transparente do treinador iniciante;
- `trainer-milo.webp` — retrato transparente do treinador intermediário;
- `trainer-iris.webp` — retrato transparente da treinadora veterana.

Os WebPs foram otimizados para reduzir egress e preservam a resolução original. Não substitua por PNGs maiores sem uma justificativa visual.

Assets ainda pendentes:

- fundo interno do Ginásio de Pewter, aproximadamente `1920×800`;
- retrato transparente de Liam;
- retrato transparente de Marcus;
- retrato transparente de Brock.

Até esses arquivos existirem, os cards usam placeholders. Não invente URLs que causem imagens quebradas.

## Regras que precisam ser preservadas

### Segurança e consistência

1. Toda regra decisiva deve ser validada no servidor.
2. Use transações para consumo de moeda, itens, recompensas e alterações de progresso.
3. Use o lock do jogador para impedir clique duplo e concorrência entre abas.
4. Recompensas de primeira vitória precisam ser idempotentes.
5. Um encontro ativo impede nova exploração e viagem.
6. Viajar impede exploração, serviços e batalhas.
7. Um treinador só libera o seguinte quando seu identificador entra em `defeatedTrainerIds`.
8. Capturas reais devem registrar procedência `WORLD:<locationId>` e atualizar a Pokédex.
9. O reset administrativo pode remover mascotes com essa procedência enquanto o modo ainda for protótipo.
10. Não crie processos consultando o banco a cada minuto. Prefira resolver timers quando a página ou uma action for acessada.

### Combate

Use sempre:

```ts
runLeagueCombat(...)
```

de `src/lib/league-combat.ts`.

Não implemente uma fórmula alternativa dentro do World Mode. O motor compartilhado já contém iniciativa por Agilidade, ações extras, tipos, posturas, cura, buffs, debuffs, resistência a debuffs e efeitos de personalidade.

Hoje a equipe do jogador é formada por até seis mascotes equipados. Se nenhum estiver equipado, a action usa favoritos e níveis como fallback. Uma etapa futura deve criar uma formação própria do World Mode, sem alterar a equipe da Arena ou de outros modos.

### Economia

- O Poké Mart usa ZikaCoins reais.
- Débitos passam por `creditCoins()` e ficam no histórico da carteira.
- O inventário de aventura fica dentro de `WorldPlayerState.inventoryJson`.
- Preços atuais são provisórios e devem permanecer fáceis de ajustar.
- Nunca aceite preço calculado pelo navegador.

## Próximas etapas recomendadas

### 1. Formação própria do World Mode

Criar uma seleção de até seis mascotes para a aventura:

- salvar IDs no estado do World Mode ou em modelo próprio;
- mostrar busca, paginação e posturas;
- bloquear mascotes que não pertençam ao jogador;
- validar novamente a propriedade dos mascotes em toda batalha;
- não alterar `isEquipped` da coleção principal;
- permitir equipe incompleta com ao menos um mascote;
- avisar claramente quando uma formação estiver inválida.

Esta é a próxima prioridade técnica, porque elimina o fallback implícito dos mascotes equipados.

### 2. Estado persistente de HP e condições

Atualmente cada batalha começa a partir dos atributos completos da coleção. Para completar o loop de exploração:

- criar estado isolado de HP/condições por mascote dentro da aventura;
- preservar dano entre batalhas e rotas;
- fazer Potion e Antidote terem uso real;
- fazer o Center restaurar HP e condições além da fadiga;
- definir comportamento para mascotes derrotados;
- não escrever dano temporário nos campos permanentes do modelo `Mascot`.

### 3. Apresentação completa do Ginásio de Pewter

- integrar os quatro assets pendentes;
- diferenciar visualmente treinador comum, veterano e líder;
- criar apresentação da insígnia após a primeira vitória;
- mostrar as recompensas antes do desafio;
- adicionar confirmação antes de iniciar batalha;
- exibir replay completo ou paginado, não somente os últimos eventos.

### 4. Descobertas e busca de itens

Implementar `ITEM_SEARCH` com tabelas configuráveis por área:

- Tiny Mushroom;
- Poké Ball;
- Antidote;
- Honey;
- berries.

O resultado deve ser persistente e auditável. Itens encontrados não devem depender de dados enviados pelo cliente.

### 5. Entregas

Reaproveitar conceitos do protótipo existente em `/mercado/entregas`, mas não acoplar diretamente os dois estados sem revisar as regras. Entregas devem criar motivo para viajar entre as cidades e respeitar tempo, localização e fadiga.

### 6. Route 3 e expansão

Somente depois de estabilizar o ciclo Pallet → Brock:

```text
Route 3
Mt. Moon
Cerulean City
Misty
```

Não comece Johto antes do loop principal de Kanto estar estável.

## Pontos de design ainda abertos

Não tome decisões definitivas sem confirmar com o proprietário:

- preços finais do Poké Mart;
- fórmula final de captura;
- quantidade de fadiga removida ou limites máximos;
- recuperação após derrota;
- limites diários de exploração;
- recompensas finais de Brock;
- regras de rematch e hard mode;
- impacto exato de clima e horário;
- possibilidade de shiny em captura selvagem;
- quais mascotes podem acompanhar visualmente o avatar;
- quando o modo deixará de ser exclusivo do admin.

Valores existentes são adequados para protótipo e teste, mas não devem ser tratados como balanceamento final.

## Como validar alterações

Execute, no mínimo:

```bash
npx prisma generate
npm run typecheck
npm run build
git diff --check
```

Se houver nova migração, primeiro inspecione o estado do banco. Não rode correções destrutivas, `reset`, `db push --force-reset` ou resolução artificial de migrações.

Teste manualmente com uma conta administrativa:

1. resetar o protótipo;
2. iniciar em Pallet;
3. viajar por conexões adjacentes;
4. concluir viagem por tempo e pelo botão de debug;
5. explorar e recarregar durante um encontro;
6. capturar, falhar e fugir;
7. comprar com saldo suficiente e insuficiente;
8. descansar no Center;
9. tentar usar serviços fora da cidade;
10. derrotar treinadores em ordem;
11. repetir uma vitória e confirmar que não duplica recompensa;
12. derrotar Brock e confirmar a Boulder Badge.

## Cuidados com o repositório

O worktree pode conter alterações locais não relacionadas. Antes de commitar:

```bash
git status --short
git diff --cached --name-only
```

Adicione somente arquivos do World Mode. Não inclua automaticamente:

- `tsconfig.tsbuildinfo`;
- worktrees internos;
- anexos remotos;
- alterações de mascotes ou Laços feitas por outro trabalho;
- arquivos de teste do Windows Transmitter.

Use commits pequenos e descritivos. Preserve as mudanças existentes do usuário.

## Instrução resumida para continuar

> Continue o World Mode a partir do estado existente, mantendo-o exclusivo para ADMIN/SUPER_ADMIN. Não reimplemente mapa, encontros, captura, Center, Mart ou motor de batalha. A próxima prioridade é uma formação persistente própria de até seis mascotes, seguida por HP/condições persistentes e uso real de Potion/Antidote. Centralize conteúdo em `src/world-data`, valide tudo no servidor, use transações e advisory locks, preserve idempotência das recompensas e não crie cron contínuo. Integre assets somente quando os arquivos existirem e mantenha placeholders sem URLs quebradas.
