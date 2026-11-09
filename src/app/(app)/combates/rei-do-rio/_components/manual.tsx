"use client";

import type { ReactNode } from "react";
import { ROUND_HOURS } from "@/lib/rei-do-rio/config";
import type { EditionView } from "@/lib/rei-do-rio/view";
import { Card, Pill } from "./rei-ui";
import { ScoringExplainer } from "./stats-views";

type Cfg = EditionView["edition"]["cfg"];

const SECTIONS = [
  ["visao", "Visão geral"], ["calendario", "Calendário"], ["equipe", "Montando a equipe"], ["dia", "Seus mascotes durante o dia"],
  ["exemplo", "Exemplo passo a passo"], ["noite", "Descanso e recuperação"], ["pareamento", "Quem enfrenta quem"],
  ["pontos", "Pontuação e classificação"], ["equilibrio", "Pressão do Trono e Calor da Lareira"], ["relatorio", "Relatório e replays"], ["faq", "Perguntas frequentes"],
] as const;

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3 rounded-2xl border border-sky-200/10 bg-slate-950/70 p-5">
      <h2 className="text-lg font-black text-amber-200">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}
const B = ({ children }: { children: ReactNode }) => <b className="text-white">{children}</b>;
const Note = ({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "gold" }) => (
  <div className={`rounded-xl border p-3 text-xs ${tone === "gold" ? "border-amber-300/30 bg-amber-300/5 text-amber-100/90" : "border-sky-300/20 bg-sky-500/5 text-sky-100/90"}`}>{children}</div>
);

export function Manual({ cfg }: { cfg: Cfg }) {
  const pr = cfg.pressure.steps; const cu = cfg.current.steps;
  const topPct = Math.round(cfg.pressure.topFraction * 100); const botPct = Math.round(cfg.current.bottomFraction * 100);
  const limited = cfg.maxRounds < 150;
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Índice do manual" className="lg:sticky lg:top-4 lg:self-start">
        <Card>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-sky-200/70">Manual</p>
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
            {SECTIONS.map(([id, label]) => <li key={id} className="shrink-0"><a href={`#${id}`} className="block rounded-lg px-2 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white">{label}</a></li>)}
          </ul>
        </Card>
      </nav>

      <div className="space-y-4">
        <Sec id="visao" title="Visão geral">
          <p>É uma disputa de <B>sobrevivência por equipes</B>, de terça a sexta. Você monta <B>18 mascotes</B> na segunda e, depois disso, <B>não precisa entrar no site</B>: os combates acontecem sozinhos, cinco por dia. Quanto mais seus mascotes lutam, sobrevivem e ajudam o time, mais pontos a sua equipe soma. Ao fim da sexta, quem tiver mais pontos é coroado.</p>
          <p>Seus mascotes continuam livres para os outros modos da Liga (expedições, Arena, treinos). Participar aqui não ocupa nem prejudica nenhum deles, e o contrário também vale: o HP deste modo é só deste modo.</p>
          <Note>O modo está em teste e visível apenas para administradores. Ainda não há recompensas reais.</Note>
        </Sec>

        <Sec id="calendario" title="Calendário (horário de Brasília)">
          <ul className="space-y-1.5">
            <li><Pill tone="gold">Segunda</Pill> Inscrição e montagem da equipe. Você pode mudar tudo até <B>21h</B>. Às 21h as inscrições fecham, os 18 mascotes ficam <B>travados</B>, a formação original é guardada para sempre e as equipes são reveladas.</li>
            <li><Pill tone="blue">Terça a sexta</Pill> Cinco rodadas por dia: <B>{ROUND_HOURS.map((h) => `${h}h`).join(" · ")}</B>. São 20 rodadas no total. Cada jogador luta uma vez por rodada.</li>
            <li><Pill tone="purple">Descanso</Pill> Depois da rodada das 21h (terça a quinta) e até as <B>08h</B>. É a janela para ajustar a formação do dia seguinte.</li>
            <li><Pill tone="green">Sexta 21h</Pill> Última rodada. Depois dela a pontuação é consolidada e o campeão é declarado.</li>
          </ul>
          <Note>O descanso só abre depois que a rodada das 21h foi totalmente processada. Se ela atrasar, o descanso espera — mas o prazo das 08h continua o mesmo.</Note>
        </Sec>

        <Sec id="equipe" title="Montando a equipe">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>São <B>18 mascotes diferentes</B>, divididos em <B>6 slots</B> de 3: um <B>titular</B> e <B>duas reservas</B>.</li>
            <li>Cada slot tem <B>uma postura</B> (Defensor, Atacante, Cuidador…). Posturas podem se repetir entre slots. Os três mascotes do slot lutam com a postura do slot.</li>
            <li>Posturas avançadas só podem ser usadas por mascotes que <B>já as desbloquearam</B> (a missão é por mascote, não vale para todos). O servidor confere isso sempre.</li>
            <li>A <B>ordem importa</B>: titular entra primeiro; se ele cair, entra a Reserva 1, depois a Reserva 2.</li>
            <li>O botão <B>Montar minha equipe automaticamente</B> escolhe 18 mascotes equilibrados (não só os mais fortes) e distribui nos slots. Se você tiver menos de 18, ele explica o que falta — nunca inventa nem duplica mascotes.</li>
            <li>Estratégia de trocas: <B>Manter os sobreviventes</B> (padrão) ou <B>Preservar os feridos</B> (veja a próxima seção).</li>
          </ul>
        </Sec>

        <Sec id="dia" title="Como seus mascotes respondem durante o dia">
          <h3 className="font-black text-white">Dentro de um combate</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Entram <B>seis mascotes de cada lado</B>: o ativo de cada slot, com o HP que tinham ao fim do combate anterior.</li>
            <li>A luta é automática, com o mesmo motor da Liga Semanal: ordem por Agilidade, posturas, vantagem de tipo e personalidade.</li>
            <li><B>Não existe substituição no meio da luta.</B> Quando um mascote cai, o lugar dele fica vazio até o fim do combate.</li>
            <li>{limited ? <>O combate dura no máximo <B>{cfg.maxRounds} rodadas</B>. Se ninguém for eliminado até lá, vence quem tem mais HP total somado.</> : <>O combate termina quando um dos lados fica sem mascotes em pé. Se estourar o limite de rodadas do motor, vence quem tem mais HP total somado.</>}</li>
            <li>Buffs e debuffs do combate (Encorajador, Oportunista, etc.) valem <B>só naquela luta</B>; não ficam para a próxima.</li>
          </ul>
          <h3 className="pt-2 font-black text-white">Entre um combate e outro</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><B>Sobrevivente</B> leva o HP em que terminou. <B>Não há cura automática</B> entre combates; só a cura feita dentro da luta (por exemplo, por um Cuidador) conta.</li>
            <li><B>Derrotado</B> fica indisponível <B>até a noite</B>. O slot dele escala o próximo da fila que ainda esteja vivo — <B>somente no próximo combate</B>, nunca no mesmo.</li>
            <li>Cada slot anda <B>sozinho</B>: um titular caindo não mexe nos outros cinco slots, e nunca há troca de mascote entre slots durante o dia.</li>
            <li><B>Manter os sobreviventes:</B> quem sobreviveu fica no slot, mesmo ferido. Só os derrotados saem.</li>
            <li><B>Preservar os feridos:</B> se uma reserva viva do mesmo slot tiver pelo menos <B>{cfg.swapHpGapPct} pontos percentuais</B> de HP a mais que o ativo, ela assume. O ferido continua vivo na fila, com o HP que tem (não se cura). Essa folga mínima evita trocas de vai-e-vem entre dois mascotes com HP parecido.</li>
            <li>Se os três mascotes de um slot caírem, o slot fica <B>vazio</B> até a noite. Sua equipe segue lutando com os slots restantes (cinco, quatro, três…).</li>
            <li>Se <B>todos</B> os slots esgotarem, sua equipe não tem quem escalar: o adversário vence a rodada sem luta (só recebe os pontos de vitória), e você não soma nada.</li>
          </ul>
        </Sec>

        <Sec id="exemplo" title="Exemplo passo a passo">
          <p>Slot 1 (Defensor) com <B>A · B · C</B>, e Slot 3 (Atacante) com <B>G · H · I</B>, estratégia padrão:</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs"><thead><tr className="text-left text-slate-500"><th className="py-1.5">Rodada</th><th>Slot 1</th><th>Slot 3</th></tr></thead><tbody className="text-slate-200">
            <tr className="border-t border-slate-800"><td className="py-1.5 font-bold">09h</td><td>A luta e é derrotado</td><td>G luta e termina com 35% de HP</td></tr>
            <tr className="border-t border-slate-800"><td className="py-1.5 font-bold">12h</td><td>B entra (A está fora até a noite)</td><td>G continua, com 35%</td></tr>
            <tr className="border-t border-slate-800"><td className="py-1.5 font-bold">12h (fim)</td><td>B termina com 80%</td><td>G é derrotado</td></tr>
            <tr className="border-t border-slate-800"><td className="py-1.5 font-bold">15h</td><td>B continua, com 80%</td><td>H entra (G fora até a noite)</td></tr>
            <tr className="border-t border-slate-800"><td className="py-1.5 font-bold">Noite</td><td colSpan={2}>Todos voltam com HP cheio; A e G estão disponíveis de novo</td></tr>
          </tbody></table></div>
          <Note>Com <B>Preservar os feridos</B>, às 12h o slot 3 poderia colocar H (100%) no lugar de G (35%), já que a diferença passa de {cfg.swapHpGapPct} pontos. G seguiria vivo e disponível na fila, ainda com 35%.</Note>
        </Sec>

        <Sec id="noite" title="Descanso e recuperação">
          <p>Depois da última rodada do dia, na janela de descanso, <B>todos os 18 mascotes recuperam o HP completo</B> e deixam de estar derrotados.</p>
          <p><B>Até as 08h você pode:</B> reordenar titular e reservas, mover mascotes entre slots, trocar a postura de qualquer slot (repetindo à vontade), mudar a estratégia de trocas, reaplicar o montador automático e ver uma prévia.</p>
          <p><B>Você não pode:</B> trocar, adicionar ou remover mascotes dos 18 originais, usar postura que o mascote não desbloqueou, ou mexer na equipe depois das 08h e durante as rodadas.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>A formação de <B>segunda é guardada</B> e nunca é sobrescrita. Se você não personalizar a noite, a equipe volta a usar a original.</li>
            <li>Dois atalhos: <B>Restaurar original de segunda</B> e <B>Reaproveitar a de ontem</B>.</li>
            <li>Quem ficar ausente a semana inteira continua participando normalmente com a formação original.</li>
          </ul>
        </Sec>

        <Sec id="pareamento" title="Quem enfrenta quem">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Antes de cada rodada a classificação é <B>congelada</B>. Todos os confrontos daquela rodada usam essa mesma foto, então a ordem em que as lutas são processadas não muda nada.</li>
            <li>O pareamento é o mesmo estilo suíço da Liga Semanal: o topo enfrenta o topo e a parte de baixo enfrenta adversários de pontuação parecida, evitando repetir o mesmo adversário.</li>
            <li>Com número ímpar de jogadores, um fica de <B>folga</B> na rodada: sem luta, sem pontos, sem desgaste. A folga é sorteada de forma justa, priorizando quem teve menos folgas.</li>
          </ul>
        </Sec>

        <Sec id="pontos" title="Pontuação e classificação">
          <p>A pontuação do jogador é a <B>soma dos pontos dos seus mascotes</B>, e cada mascote ganha pontos pelo que realmente faz. Toda a pontuação tem origem registrada (dá para ver no relatório o que veio de cada categoria).</p>
          <ScoringExplainer cfg={cfg} />
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Cura acima do HP que faltava, dano além do necessário para derrotar e efeitos sem efeito real <B>não geram pontos</B>.</li>
            <li>Mascotes que estão na reserva, fora de combate, <B>não pontuam</B>.</li>
            <li><B>Permanência no topo:</B> enquanto o jogador está entre os líderes, mascotes que estão em campo <B>e sobrevivem</B> recebem um pequeno bônus (até {cfg.leadershipCap} pontos por combate para a equipe), para premiar consistência sem valer mais do que jogar bem.</li>
            <li>Existe também o <B>ranking de mascotes</B>, que ordena cada mascote por pontos, KOs, dano, suporte ou sobrevivência.</li>
          </ul>
        </Sec>

        <Sec id="equilibrio" title="Pressão do Trono e Calor da Lareira">
          <p>Para ninguém dominar sem resistência, a classificação aplica ajustes <B>temporários</B>, só dentro dos combates do evento:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><Pill tone="red">👑 Pressão do Trono</Pill> Quem fica seguidamente no <B>topo ({topPct}% melhores)</B> perde {pr.slice(1).map((v) => `${v}%`).join(", depois ")} (limite de −{pr[pr.length - 1]}%) em Força, Instinto, Vitalidade e Carisma.</li>
            <li><Pill tone="gold">🔥 Calor da Lareira</Pill> Quem fica seguidamente na <B>base ({botPct}% piores)</B> ganha {cu.slice(1).map((v) => `+${v}%`).join(", depois ")} (limite de +{cu[cu.length - 1]}%) nos mesmos atributos.</li>
            <li>Ao sair da faixa, o efeito <B>diminui um nível por rodada</B>, em vez de sumir de uma vez.</li>
            <li>Agilidade e HP <B>não</B> são alterados, nada é permanente, e o ajuste usa a classificação congelada da rodada anterior (sem cálculo circular). Os dois efeitos nunca se somam.</li>
          </ul>
          <Note tone="gold">Isso não força troca de liderança: boas composições continuam sendo recompensadas. É só um pequeno contrapeso.</Note>
        </Sec>

        <Sec id="relatorio" title="Relatório e replays">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Depois da rodada das 21h você acessa o <B>relatório do dia</B>: posição e variação, pontos do dia e totais, vitórias e derrotas, KOs, dano e cura, desempenho de cada um dos 18 mascotes (com a origem dos pontos), linha do tempo das cinco lutas e comparação com os dias anteriores.</li>
            <li>O resumo em texto é gerado só com dados reais do dia — nada é inventado.</li>
            <li>Cada luta tem <B>replay</B>. Ele é o combate já resolvido (não é sorteado de novo), então sempre bate com o resultado.</li>
            <li>Você vê as equipes adversárias (slot, postura do dia, nome e nível), mas <B>nunca o HP ou os atributos</B> dos mascotes deles.</li>
          </ul>
        </Sec>

        <Sec id="faq" title="Perguntas frequentes">
          <dl className="space-y-3">
            {([
              ["Por que alguém com mais derrotas aparece na frente?", "Porque a posição vem dos pontos, e vencer vale uma fatia pequena deles. Veja a seção Pontuação e toque numa linha do ranking para ver a composição."],
              ["Perdi um mascote no bazar depois de me inscrever. E agora?", "Até as 21h de segunda a equipe é revalidada; mascote que sumiu invalida a inscrição. Depois do fechamento, os atributos ficam congelados e a equipe segue como foi inscrita."],
              ["Os atributos dos meus mascotes mudam durante a semana?", "Não neste modo: eles são fotografados no fechamento de segunda."],
              ["Meu mascote pode ser usado em outros modos ao mesmo tempo?", "Sim. O HP e a derrota daqui existem só neste evento."],
              ["Habilidades passivas funcionam?", "Ainda não: o motor de combate usado aqui (o da Liga Semanal) não as executa."],
              ["Há recompensas?", "Ainda não. Serão definidas depois, e todas as colocações receberão algo."],
            ] as [string, string][]).map(([q, a]) => <div key={q}><dt className="font-black text-white">{q}</dt><dd className="text-slate-400">{a}</dd></div>)}
          </dl>
        </Sec>
      </div>
    </div>
  );
}
