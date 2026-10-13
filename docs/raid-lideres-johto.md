# Raid dos Líderes de Johto (evento da Semana 8)

Evento cooperativo do servidor: os 8 líderes de ginásio de Johto são chefes **em sequência** (Falkner → Bugsy → Whitney → Morty → Chuck → Jasmine → Pryce → Clair). Cada líder luta com **6 mascotes** e tem **5.000.000 de HP** por padrão (1/6 por mascote ≈ 833 mil; editável ao criar o evento). O dano dos jogadores é somado; cada líder fica disponível por **até 5 dias** (se ninguém o vencer a tempo, **ele vence** e o próximo entra, sem recompensa por ele (o Professor Enguiça avisa)).

## Estado atual: oculto
- `/combates/raid-johto` e o item de menu "Líderes de Johto" só aparecem para **ADMIN/SUPER_ADMIN**. Jogadores só veem depois de **Liberar para jogadores** (Admin → aba **Eventos**, ou a caixa de admin na própria página).
- O evento nasce **inativo**: criar → conferir/testar → abrir ataques. "Liberar" e "Abrir ataques" são interruptores independentes. O prazo de 5 dias do líder só começa a contar ao **abrir os ataques** (ou quando o líder anterior cai/foge).

## Combate (motor oficial da Liga, `runLeagueCombat`)
- O jogador usa 6 mascotes livres contra os mascotes **vivos** do líder (o time dele encolhe conforme caem).
- **Cada mascote do líder luta com a vida global real** (ex.: 833.333, 1/6 dos 5 mi) — a luta mostra essa vida cheia. O dano que o jogador causa é **persistente**: fica registrado para todos. Na prática **toda luta termina em derrota do time do jogador** (o dano causado numa luta é de ~3,5 a 6 mil), até o líder estar quase caído.
- Quando a vida de um mascote chega a 0, ele sai de **todas** as lutas futuras contra esse líder. Quando os 6 caem, o líder cai: prêmios disponíveis e o próximo líder começa. Quem causa o último dano leva o **golpe final**.
- O líder tem atributos equilibrados com o time atacante (principal da postura +15%, demais −5%, +2% por ginásio avançado) e cada mascote tem postura+personalidade que combinam.
- Multiplicador de dano (padrão ×1 = dano real; editável) existe só para calibrar a duração. **Calibração (time do Glauco, o mais forte, dano real ×1):** ~850 a 1.400 lutas por líder com 5 mi (≈4 a 6 mil de dano por luta); o servidor todo divide esse total. Use o laboratório para conferir antes de abrir.
- Atômico: as 6 linhas de mascote são travadas (`FOR UPDATE`) na transação. Trava por jogador impede dois ataques por duplo clique.
- **Ferimentos como na Arena:** mascotes do jogador que caíram ficam feridos (SUS na página ou no resultado da luta).
- Espera entre ataques: **20 min** (editável). Luta vai até um lado cair (sem empates).
- **Replays:** os últimos **20 combates** do servidor ficam com replay (modal da Liga); os mais antigos mantêm só o resumo.
- **Elegibilidade por líder:** só recebe as recompensas de um líder quem o atacou (estatística por líder). Quem não atacou aquele líder não é elegível a ele.

## Combo de ataque em grupo
Cada treinador (não admin) que atacou nos últimos **5 minutos** vale **+2%** em todos os status do próximo atacante, até **+8%**. O líder escala pelo time sem o bônus. Sem ataques por 5 minutos, o bônus zera. A página mostra o combo e o cronômetro do próximo degrau.

## Recompensas (por líder derrotado — `DEFAULT_JOHTO_REWARDS`, editável em `rewardConfigJson`)
| Quem | ZC | Mascote do líder (escolha 1 dos 6) |
|---|---|---|
| Atacou ≥ 1 vez | 2.500 | Nv. 55 |
| 1º em dano no líder | 10.000 | Nv. 85 |
| 2º | 8.000 | Nv. 75 |
| 3º | 6.500 | Nv. 65 |
- Pódio recebe o prêmio do pódio **no lugar** do de participante.
- **Golpe final:** bônus de participante + **ovo especial (+15% de raridade)**. Se já era só participante, o ovo vem no mesmo prêmio; se estava no pódio, ganha também uma linha `FINAL_BLOW` (participante + ovo).
- ZC e ovo caem na hora (idempotente por jogador/faixa); o **mascote é escolhido** na página (seletor com os 6 do líder, escolha única e confirmada). Notificação "o líder foi derrotado" com o aviso de escolher.
- Contas de admin não entram em ranking nem prêmios.

## Professor Enguiça
A cada mascote do líder derrubado (e a cada líder vencido), a faixa de avisos do topo recebe uma mensagem do Professor Enguiça com o nome de quem derrotou e chamando todos a continuar o ataque. Só é publicada se a página estiver **liberada** e o autor não for admin.

## Painel do admin (aba Eventos / topo da página)
Criar/recriar evento (HP por líder), liberar/ocultar, abrir/pausar ataques, espera entre ataques, **escala de dano**, dias por líder, ajustar prazo do líder atual (±h), debug (tirar HP, restaurar, derrubar líder, zerar cooldown, zerar progresso), prévia/entrega de prêmios por líder e o **Laboratório de combate**: monta um time de 6, roda 1–50 simulações contra um líder (sem gravar) e mostra taxa de vitória, dano de combate × dano convertido, mascotes caídos, **nº de ataques estimado para derrubar o líder** e permite assistir ao replay. Use-o para calibrar a escala de dano.

## Arquivos
- Migrações: `prisma/migrations-manual/045_johto_raid.sql`, `046_johto_raid_teams.sql` (aplicadas; `scripts/apply-046-johto-raid-teams.ts`). Eventos criados antes da 046 são completados sozinhos (`ensureLeaderMascots`).
- Lib: `src/lib/johto-raid.ts` (estado, ataque, prêmios, escolha, replays, laboratório) · `src/lib/johto-raid-sim.ts` (líderes, recompensas, time do líder, análise do log, `runJohtoBattle`).
- UI: `src/app/(app)/combates/raid-johto/` · imagens dos treinadores no Supabase Storage (`assets/JohtoLeaders/`, enviadas por `scripts/upload-johto-leaders.ts`) · seletor de equipe compartilhado com a Ordem (`OrderRaidTeamSelector`, com `attackAction`, `labels`, `renderResult`, `extraFields`).
- Testes: `npx tsx scripts/test-johto-raid.ts --db` (puro + fluxo completo no banco com evento/contas temporárias).

## Pendências / ideias
- Calibrar a escala de dano com o laboratório antes de abrir (time médio ≈ 60 mil de dano por ataque a ×10; times fortes ≈ o dobro).
- Texto no manual só ao liberar.
- A raid da Ordem ainda tem a própria simulação (não foi tocada).
