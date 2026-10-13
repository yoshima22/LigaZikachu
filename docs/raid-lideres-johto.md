# Raid dos Líderes de Johto (evento da Semana 8)

Evento cooperativo do servidor, no estilo da Ordem da Trapaça: os 8 líderes de ginásio de Johto são chefes **em sequência** (Falkner → Bugsy → Whitney → Morty → Chuck → Jasmine → Pryce → Clair), cada um com **100.000.000 de HP**. Todo o dano dos jogadores é somado. Se o servidor vencer o último, todos que participaram recebem prêmios.

## Estado atual: oculto
- A página `/combates/raid-johto` e o item de menu "Líderes de Johto" só aparecem para **ADMIN/SUPER_ADMIN**. Jogadores só veem depois que o admin clicar em **Liberar para jogadores** (painel Admin → aba **Eventos**, ou a caixa de admin na própria página).
- O evento nasce **inativo**: criar → conferir → abrir ataques. Liberar a página e abrir os ataques são interruptores independentes.

## Painel do admin (aba Eventos / topo da página)
Criar evento (HP por líder), Liberar/ocultar, Abrir/pausar ataques (com duração em horas), espera entre ataques (padrão 30 min), debug: tirar HP, curar/derrubar o líder atual, zerar meu cooldown, zerar progresso, recriar do zero, prévia/entrega de prêmios. Ataques de contas de admin contam como teste: **não entram no ranking nem nos prêmios** (e não recebem golpe final).

## Regras de combate
- 6 mascotes livres por ataque, posturas escolhidas pelo jogador (mesmo motor da Ordem, em `src/lib/johto-raid-sim.ts`).
- Tipo do ginásio: vantagem de tipo dá até +30% de dano ao mascote; o líder bate mais forte (até +25%) nos tipos que domina. A força do líder cresce +2% por ginásio.
- Mascote derrotado fica ferido (Atendimento SUS, 10 ZC, igual à Arena Z).
- O dano entra por `UPDATE` atômico com lock da linha do líder: ataques simultâneos somam certo e só um jogador recebe o **golpe final**. Travessia entre líderes é automática (o próximo é o primeiro com HP > 0).

## Prêmios (padrão em `DEFAULT_JOHTO_REWARDS`, editável em `rewardConfigJson`)
- Todo jogador que atacou ≥ 1 vez: 2.000 ZC + ovo raro (origem "Raid dos Líderes de Johto").
- Top 3 em dano total: 15.000 / 10.000 / 6.000 ZC.
- Maior dano em um único ataque: 5.000 ZC · Mais ataques: 5.000 ZC · Enfrentou mais líderes: 3.000 ZC.
- Golpe final: 2.500 ZC por líder derrubado.
- Entregues automaticamente ao cair o último líder (idempotente por jogador) + notificação no jogo. O admin pode ver a prévia e reentregar com segurança.
- **Pendente:** prêmios exclusivos (itens/cosméticos) ainda não definidos; entram no `rewardConfigJson`/`grantJohtoRaidRewards`.

## Arquivos
- Migração: `prisma/migrations-manual/045_johto_raid.sql` (aplicada) · `scripts/apply-045-johto-raid.ts`
- Lib: `src/lib/johto-raid.ts` (estado, ataque, prêmios, visibilidade) · `src/lib/johto-raid-sim.ts` (dados + simulação pura)
- UI: `src/app/(app)/combates/raid-johto/` · seletor de equipe compartilhado com a Ordem (`OrderRaidTeamSelector`, agora com `attackAction` e `labels`)
- Teste: `npx tsx scripts/test-johto-raid.ts --db`

## Pendências / ideias
- Prêmios exclusivos, arte própria dos treinadores e texto do manual (só depois de liberar).
- A raid da Ordem ainda tem a própria cópia da simulação; unificar é um refator futuro.
