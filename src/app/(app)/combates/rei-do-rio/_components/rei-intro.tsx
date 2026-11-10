"use client";

import { useCallback, useEffect, useState } from "react";
import { REI_ASSETS } from "@/lib/rei-do-rio/assets";
import type { EditionView } from "@/lib/rei-do-rio/view";
import { Ornament, type OrnamentKey } from "./rei-ui";

const KEY = "rei-intro-seen-v2";
type Page = {
  eyebrow: string; title: string; text: string; points: string[]; orn: OrnamentKey;
  /** Exemplo com números, para quem aprende melhor vendo um caso. */
  example?: string;
  /** Dica prática. */
  tip?: string;
};

function buildPages(cfg: EditionView["edition"]["cfg"]): Page[] {
  const pr = cfg.pressure.steps; const cu = cfg.current.steps;
  const total = Object.values(cfg.budget).reduce((a, b) => a + b, 0);
  return [
    {
      eyebrow: "Resumo em 30 segundos", title: "O que é o Trono de Natal?", orn: "crown",
      text: "Uma disputa de equipes que dura a semana toda. Na segunda você escolhe 18 mascotes e monta o time. Depois disso os combates acontecem sozinhos, cinco por dia, de terça a sexta. Quem somar mais pontos até sexta à noite é o campeão.",
      points: ["Segunda: você monta o time (leva uns 2 minutos com a montagem automática).", "Terça a sexta: nada a fazer. Os combates rodam sozinhos e você só confere os resultados.", "Todas as noites você pode ajustar o time do dia seguinte (opcional).", `Para a semana valer, precisam se inscrever pelo menos ${cfg.minParticipants} jogadores; senão ela é cancelada e ninguém perde nada.`],
      tip: "Se preferir ler no seu ritmo, use o Índice (no alto) para pular para qualquer parte, ou abra o Manual para ver tudo em detalhes.",
    },
    {
      eyebrow: "Vocabulário", title: "As palavras que você vai ver", orn: "lantern",
      text: "Antes de começar, estas são as palavras mais usadas. Se alguma coisa não fizer sentido depois, volte aqui.",
      points: [
        "Mascote: cada um dos seus bichinhos. Você escolhe 18 diferentes.",
        "Slot: uma “vaga” do time. São 6 slots, e cada um tem 3 mascotes.",
        "Titular e reservas: dentro de um slot, o titular luta primeiro; as 2 reservas esperam a vez.",
        "Postura: o papel do slot na luta (Atacante, Defensor, Cuidador…). Todos os 3 mascotes do slot usam a postura dele.",
        "Habilidade: um poder passivo de cada mascote, que funciona sozinho durante a luta.",
        "HP: a vida do mascote. Ele só sai de combate quando chega a zero.",
        "Rodada: um dos 5 horários do dia em que todos os jogadores lutam (09h, 12h, 15h, 18h e 21h).",
        "Pontos: o que decide o ranking. Vêm de tudo o que seus mascotes fazem, não só de vencer.",
      ],
    },
    {
      eyebrow: "Segunda-feira · passo 1", title: "Montando o time", orn: "gift",
      text: "Na aba “Minha equipe” você escolhe os 18 mascotes e distribui nos 6 slots. Você tem até as 21h de segunda para mexer em tudo. Depois disso os 18 ficam travados.",
      points: ["Clique em “Montar minha equipe automaticamente”: o site escolhe 18 mascotes equilibrados e já arruma os slots.", "Confira o resultado nas fichas: cada uma mostra nome, nível, HP e os 5 atributos.", "Se quiser mudar algo, toque num mascote e depois no lugar onde quer colocá-lo (ou arraste).", "Quando o resumo disser “Equipe válida”, clique em “Confirmar inscrição”."],
      example: "Você tem 40 mascotes. O automático escolhe 18, forma 6 slots como Defensor, Atacante, Atacante, Cuidador, Encorajador e Flanco, e coloca o mais adequado de cada postura como titular. Você só confere e confirma.",
      tip: "Não tem 18 mascotes? O site explica quantos faltam. Nunca é criado nem duplicado mascote para completar o time.",
    },
    {
      eyebrow: "Segunda-feira · passo 2", title: "Posturas e a ordem dos mascotes", orn: "snowflake",
      text: "Cada slot tem uma postura que define como os 3 mascotes dele lutam. A ordem também importa: o titular entra primeiro; se ele cair, entra a Reserva 1; depois a Reserva 2.",
      points: ["Escolha a postura no seletor do slot. Pode repetir posturas entre slots.", "Algumas posturas avançadas só funcionam para mascotes que já as desbloquearam. Se um mascote não puder, aparece um cadeado vermelho.", "Quer o mais forte lutando primeiro? Coloque-o como titular.", "Use a seta ▲ para subir um mascote na fila do slot."],
      example: "Slot 4 = Cuidador, com Blissey (titular), Chansey e Audino (reservas). Blissey luta e cura os aliados; se cair, Chansey assume a vaga no combate seguinte.",
    },
    {
      eyebrow: "Segunda-feira · passo 3", title: "Habilidades dos mascotes", orn: "crown",
      text: "Cada mascote luta com uma habilidade passiva. Ela já vem escolhida (a habilidade que o mascote normalmente usa), mas você pode trocar por outra que ele possa ter, direto na ficha dele.",
      points: ["Na ficha, use o seletor “Habilidade” e toque em “ver o que faz” para ler o efeito com os números do seu mascote.", "A habilidade oculta só aparece para quem tem o TM dela.", "Em campo, cada categoria (Dano, Defesa, Reflexo, Controle, Suporte, Sobrevivência) liga poucas habilidades: a 1ª usa 100%, a 2ª usa 70% e a 3ª em diante fica desligada.", "Quem decide a ordem é a ordem dos slots. O painel “Habilidades em campo” mostra o que fica ligado."],
      example: "Se os slots 1, 2 e 3 têm três habilidades de Dano, a do slot 1 funciona 100%, a do slot 2 funciona 70% e a do slot 3 fica desligada nesse combate. Trocar uma delas por uma de Defesa religa o efeito.",
      tip: "Não se preocupe em acertar tudo: o automático usa a habilidade padrão de cada um e funciona bem.",
    },
    {
      eyebrow: "Segunda-feira · passo 4", title: "Troca por vida", orn: "lantern",
      text: `Para cada slot você decide quando o mascote em campo dá lugar ao próximo da fila: só quando cair (“Até cair”) ou assim que terminar um combate com pouca vida (por exemplo, 50% ou menos). O sugerido é 50%.`,
      points: ["A troca só acontece entre um combate e outro, nunca no meio da luta.", "O mascote que sai continua vivo na fila, mas não se cura sozinho.", "Se o próximo da fila também estiver fraco, entra o seguinte; se ninguém estiver bem, ninguém entra (nunca se troca por alguém pior).", "Você pode usar valores diferentes em cada slot."],
      example: "Slot com limite de 50%: o titular termina o combate das 09h com 40% de vida. Às 12h quem luta é a Reserva 1, com 100%. O titular segue vivo, esperando, com os mesmos 40%.",
    },
    {
      eyebrow: "Terça a sexta", title: "Um dia de combates", orn: "baubleBall",
      text: "Você não precisa fazer nada. Às 09h, 12h, 15h, 18h e 21h (horário de Brasília) o site junta você com um adversário de pontuação parecida e resolve a luta automaticamente.",
      points: ["Na página principal, “Seus combates” mostra o resultado de cada rodada e quem é o próximo adversário, assim que a rodada anterior termina.", "Cada luta tem um replay: toque em ▶ Replay para assistir.", "Se o número de jogadores for ímpar, alguém fica de folga na rodada: sem luta, sem pontos e sem desgaste.", "Todos os combates de todos os jogadores ficam na aba “Batalhas”."],
      example: "Quarta, 12h: você enfrenta o 3º colocado, que tem pontuação parecida com a sua. Às 15h o adversário muda, conforme a classificação naquele momento.",
    },
    {
      eyebrow: "Dentro da luta", title: "Como um combate funciona", orn: "crown",
      text: `Seis mascotes de cada lado (o ativo de cada slot) lutam em turnos. A ordem de ação depende da Agilidade. A luta dura no máximo ${cfg.maxRounds} rodadas.`,
      points: ["Quem cai fica fora até o fim do combate. Não há troca durante a luta.", "Se um lado for totalmente derrotado, o outro vence.", `Se passar de ${cfg.maxRounds} rodadas, vence quem tiver mais vida somada.`, `Neste evento a vida dos mascotes é ${cfg.hpMultiplier}× a normal (só aqui), para as lutas durarem e o time não ser varrido logo.`],
      tip: "Buffs e debuffs duram só aquele combate. No próximo, começa tudo limpo (só a vida continua).",
    },
    {
      eyebrow: "Ao longo do dia", title: "A vida continua de uma luta para a outra", orn: "lantern",
      text: "O que acontece com um mascote em um combate vale para o próximo, até a noite. Pense nele como um corredor que não descansa entre as provas.",
      points: ["A vida em que o mascote terminou é a vida com que ele começa o próximo combate.", "Não existe cura entre combates. Só a cura feita dentro da luta (por um Cuidador, por exemplo) conta.", "Mascote derrotado só volta na noite, com vida cheia.", "Se os 3 mascotes de um slot caírem, o slot fica vazio até a noite. O time segue lutando com os outros."],
      example: "09h: seu Atacante cai. 12h: a Reserva 1 do slot entra no lugar. 15h: ela termina com 20% de vida e segue lá. À noite, todos voltam com a vida cheia.",
    },
    {
      eyebrow: "Atenção", title: "E se o time ficar sem mascotes?", orn: "snowflake",
      text: "Pode acontecer nos últimos combates do dia, principalmente com times que vêm perdendo muitas lutas. Isso é registrado com clareza.",
      points: ["Se não restar nenhum mascote em pé, a rodada vira “Derrota por falta de mascotes”.", "Não há luta nem replay: o adversário vence, mas recebe só os pontos de vitória.", "Você não pontua naquela rodada, mas o desgaste não passa para o dia seguinte: à noite todos voltam com vida cheia.", "A troca por vida (50%) ajuda a espalhar o desgaste entre as reservas e evita chegar a esse ponto."],
    },
    {
      eyebrow: "Ranking", title: "Como os pontos funcionam", orn: "crown",
      text: `A classificação segue os pontos, não o número de vitórias. Em cada combate sua equipe pode somar até cerca de ${total} pontos, divididos por categorias, conforme o que cada mascote fez.`,
      points: [`Dano (até ${cfg.budget.damage}) e KOs/assistências (até ${cfg.budget.ko}): por derrubar e ferir os adversários.`, `Suporte (até ${cfg.budget.support}): curar aliados, absorver golpes, ajudar o time.`, `Resistência (até ${cfg.budget.resilience}): ficar em campo e aguentar dano.`, `Vitória (até ${cfg.budget.win}): vencer o combate. Perder também pontua pelo resto.`],
      example: "Time A perde, mas causa muito dano, faz 3 KOs e aguenta bastante: soma 55 pontos. Time B vence por pouco, sem fazer quase nada além de ganhar: soma 40. Quem tem mais pontos sobe no ranking, mesmo tendo perdido aquela luta.",
      tip: "Na aba “Ranking”, toque numa linha para ver de onde vêm os pontos de cada jogador.",
    },
    {
      eyebrow: "Equilíbrio", title: "Sequências de vitórias e derrotas", orn: "gift",
      text: "Para ninguém disparar sozinho, e para quem está perdendo ter uma chance, existe um pequeno ajuste nos combates. Ele depende só da sua sequência de resultados.",
      points: [`${cfg.pressure.minStreak} vitórias seguidas: Pressão do Trono, −${pr[1]}% a −${pr[pr.length - 1]}% em Força, Instinto, Vitalidade e Carisma.`, `${cfg.current.minStreak} derrotas seguidas: Calor da Lareira, +${cu[1]}% a +${cu[cu.length - 1]}% nos mesmos atributos.`, "Quebrou a sequência? O ajuste some na luta seguinte.", "Estar no topo ou no fim da tabela não ativa nada por si só. Só a sequência conta."],
      tip: "Você vê o ajuste ativo de cada jogador na coluna “Ajuste” da classificação.",
    },
    {
      eyebrow: "21h → 08h", title: "O descanso da noite", orn: "lantern",
      text: "Depois da rodada das 21h (de terça a quinta) todos os mascotes voltam com vida cheia. Até as 08h da manhã você pode ajustar o time do dia seguinte.",
      points: ["Pode: reordenar, mover mascotes entre slots, mudar posturas, habilidades e a troca por vida.", "Não pode: trocar, adicionar ou tirar os 18 mascotes escolhidos na segunda.", "Dois atalhos úteis: “Restaurar original de segunda” e “Reaproveitar a de ontem”.", "Não mexeu em nada? O time volta a usar a formação original. Quem não entra no site a semana toda continua jogando normalmente."],
      tip: "A aba “Minha equipe” mostra a contagem regressiva até as 08h.",
    },
    {
      eyebrow: "Para acompanhar", title: "Onde encontrar cada coisa", orn: "gift",
      text: "Resumo de onde olhar para cada necessidade.",
      points: ["Evento: a classificação, seus combates do dia e os destaques da edição.", "Minha equipe: montar o time na segunda e ajustar à noite; durante o dia mostra a vida de cada mascote.", "Ranking e Mascotes: pontos de cada jogador e de cada mascote, por categoria.", "Equipes: a postura de cada slot de todos os times (a vida e as habilidades dos adversários ficam ocultas).", "Batalhas: todos os combates, por dia, com replay.", "Relatório: o resumo do dia, com a contribuição de cada mascote em cada luta.", "Manual: tudo isto com mais detalhes."],
    },
    {
      eyebrow: "Dúvidas comuns", title: "Perguntas rápidas", orn: "baubleBall",
      text: "As dúvidas que mais aparecem para quem está começando.",
      points: ["“Preciso entrar todo dia?” Não. Os combates acontecem sozinhos.", "“Posso usar os mesmos mascotes em outros modos?” Pode. A vida e as derrotas daqui valem só aqui.", "“E se eu esquecer de ajustar à noite?” Nada acontece: o time usa a formação original.", "“Por que perdi e subi no ranking?” Porque os pontos vêm do que seus mascotes fizeram, não só do resultado.", "“Vi um adversário forte, isso é normal?” Sim: o pareamento aproxima pontuações parecidas, mas a sorte do sorteio e a composição variam."],
      tip: "Pronto! Você pode reabrir este guia a qualquer momento no botão “Como funciona”.",
    },
  ];
}

export function ReiIntro({ cfg, forceKey = 0 }: { cfg: EditionView["edition"]["cfg"]; forceKey?: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [index, setIndex] = useState(false);
  const pages = buildPages(cfg);
  useEffect(() => {
    if (forceKey > 0) { setPage(0); setIndex(false); setOpen(true); return; }
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* sem storage: não abre sozinho */ }
  }, [forceKey]);
  const close = useCallback(() => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setOpen(false); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setPage((p) => Math.min(pages.length - 1, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, pages.length]);
  if (!open) return null;
  const cur = pages[page];
  const last = page === pages.length - 1;
  const go = (i: number) => { setPage(i); setIndex(false); };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Como funciona o Trono de Natal">
      <section className="my-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-sky-300/30 bg-[#070d1c] shadow-[0_0_80px_rgba(56,189,248,.25)] lg:grid-cols-[minmax(280px,.7fr)_minmax(0,1.3fr)]">
        <div className="relative min-h-[180px] overflow-hidden border-b border-sky-300/15 lg:min-h-[640px] lg:border-b-0 lg:border-r">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={REI_ASSETS.cover} alt="Trono de Natal" className="absolute inset-0 h-full w-full object-cover object-[center_20%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070d1c] via-transparent to-black/10 lg:bg-gradient-to-r lg:from-transparent lg:to-[#070d1c]/30" />
        </div>
        <div className="relative flex min-h-[520px] flex-col p-5 sm:p-8 lg:min-h-[640px] lg:p-9">
          <div className="flex items-center gap-2 pr-12">
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-sky-300">Guia rápido · {page + 1}/{pages.length}</p>
            <button onClick={() => setIndex((v) => !v)} aria-expanded={index} className="rounded-full border border-slate-600 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white">☰ Índice</button>
          </div>
          <button onClick={close} aria-label="Fechar tutorial" className="absolute right-4 top-4 rounded-full border border-slate-700 bg-black/50 px-3 py-2 text-white hover:bg-black/70">✕</button>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemin={1} aria-valuemax={pages.length} aria-valuenow={page + 1}><div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${((page + 1) / pages.length) * 100}%` }} /></div>

          {index ? (
            <nav className="my-4 flex-1 overflow-y-auto" aria-label="Índice do guia">
              <ol className="space-y-1">
                {pages.map((p, i) => (
                  <li key={p.title}><button onClick={() => go(i)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${i === page ? "bg-amber-300/15 text-amber-200" : "text-slate-200 hover:bg-slate-800"}`}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-400/15 text-xs font-black text-sky-200">{i + 1}</span><span className="min-w-0"><b className="block truncate">{p.title}</b><span className="block truncate text-[11px] text-slate-500">{p.eyebrow}</span></span></button></li>
                ))}
              </ol>
            </nav>
          ) : (
            <div className="my-auto max-h-[62vh] overflow-y-auto py-5 pr-1 lg:max-h-[480px]" key={page}>
              <div className="flex items-center gap-3">
                <Ornament k={cur.orn} size={48} />
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">{cur.eyebrow}</span>
              </div>
              <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">{cur.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{cur.text}</p>
              <ul className="mt-4 space-y-2">
                {cur.points.map((pt, i) => (
                  <li key={pt} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/65 p-3 text-xs leading-relaxed text-slate-200">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-400/15 font-black text-sky-200">{i + 1}</span>{pt}
                  </li>
                ))}
              </ul>
              {cur.example && <div className="mt-3 rounded-xl border border-sky-300/25 bg-sky-500/5 p-3 text-xs leading-relaxed text-sky-100/90"><p className="mb-0.5 text-[10px] font-black uppercase tracking-wider text-sky-300">Exemplo</p>{cur.example}</div>}
              {cur.tip && <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-100/90"><p className="mb-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">Dica</p>{cur.tip}</div>}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button onClick={() => go(Math.max(0, page - 1))} disabled={page === 0} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 disabled:opacity-30">← Anterior</button>
            <span className="hidden text-[11px] text-slate-500 sm:block">use ← → do teclado</span>
            {last
              ? <button onClick={close} className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-2 text-sm font-black text-slate-900">Começar</button>
              : <button onClick={() => go(Math.min(pages.length - 1, page + 1))} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white">Próxima →</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
