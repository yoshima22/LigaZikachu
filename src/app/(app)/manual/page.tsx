import { BookOpen } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getManualContent } from "@/lib/manual-content";
import { EditableText } from "./_components/EditableText";
import { CombatRoleHelpButton } from "@/components/combat-role-help";
import { COMBAT_ROLE_OPTIONS } from "@/lib/combat-roles";

function Section({ id, title, emoji, children }: { id: string; title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-border bg-slate-950/60 p-6 space-y-4 scroll-mt-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-[#FFCB05]">
        <span>{emoji}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-slate-400 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 hover:bg-slate-900/30">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-slate-300 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-3 py-2 text-xs text-slate-400">
      <span className="text-[#FFCB05] font-semibold">ℹ </span>{children}
    </div>
  );
}

export default async function ManualPage() {
  const session = await getAppSession();
  const admin = session?.user ? isAdmin(session.user.role) : false;
  const c = await getManualContent();

  const tocSections = [
    { id: "mascotes",     label: "Mascotes & EXP" },
    { id: "evolucoes",    label: "Evoluções" },
    { id: "interacoes",   label: "Interações" },
    { id: "expedicoes",   label: "Expedições" },
    { id: "itens",        label: "Itens & Buffs" },
    { id: "atributos-combate", label: "Atributos & Combate" },
    { id: "posturas",     label: "Posturas" },
    { id: "personalidades", label: "Personalidades" },
    { id: "laboratorio-analise", label: "Lab & Análise" },
    { id: "arena",        label: "Arena Z (PvP/PvE)" },
    { id: "economia",     label: "Economia & ZikaCoins" },
    { id: "bazar",        label: "Bazar" },
    { id: "tcg",          label: "Partidas TCG" },
    { id: "torneios",     label: "Torneios & Insígnias" },
    { id: "apoiador",     label: "Passe Apoiador" },
  ];

  function ET(key: string, className?: string) {
    if (!admin) return <p className={className}>{c[key]}</p>;
    return <EditableText textKey={key} value={c[key]} className={className} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] flex items-center gap-2">
            <BookOpen size={18}/> Manual da Liga Zikachu
          </h1>
          <p className="text-xs text-slate-500">
            Referência completa dos sistemas do jogo.
            {admin && <span className="ml-2 text-[#FFCB05]">✎ Passe o mouse sobre os textos para editar.</span>}
          </p>
        </div>
      </div>

      {/* Índice */}
      <nav className="rounded-2xl border border-border bg-slate-950/60 p-4">
        <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Índice</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {tocSections.map(s => (
            <a key={s.id} href={`#${s.id}`}
              className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-[#FFCB05] hover:bg-[#FFCB05]/5 transition-colors">
              → {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── 1. Mascotes & EXP ──────────────────────────────────────────────── */}
      <Section id="mascotes" title="Mascotes & EXP" emoji="⚡">
        <Sub title="Como o EXP funciona">
          {ET("mascotes.intro", "text-xs text-slate-400")}
          <Table
            headers={["Nível", "EXP p/ próximo", "EXP total acumulado"]}
            rows={[
              [1, 120, 0],
              [2, 140, 120],
              [5, 200, 700],
              [10, 300, 2200],
              [15, 400, 4700],
              [20, 500, 8200],
            ]}
          />
        </Sub>

        <Sub title="Fontes de EXP (base, sem bônus)">
          <Table
            headers={["Atividade", "EXP base"]}
            rows={[
              ["Partida TCG jogada", 15],
              ["Vitória em partida TCG", 35],
              ["Vitória em sequência (streak)", 15],
              ["Deck submetido à semana", 5],
              ["Brincar com mascote", 25],
              ["Acariciar mascote", 10],
              ["Alimentar com comida", 15],
              ["Alimentar com doce", 35],
              ["Expedição concluída (base)", 50],
            ]}
          />
        </Sub>

        <Sub title="Multiplicadores de EXP por posição">
          <Table
            headers={["Posição", "Multiplicador"]}
            rows={[
              ["Companheiro Ativo (equipado)", "×1.5 em interações"],
              ["Equipe Favorita (favorito)", "×1.25 em interações"],
              ["Banco (não favorito)", "×0.5 (expedições / batch)"],
            ]}
          />
        </Sub>

        <Note>{ET("mascotes.pos.note", "inline")}</Note>
      </Section>

      {/* ── 2. Evoluções ──────────────────────────────────────────────────── */}
      <Section id="evolucoes" title="Evoluções" emoji="🥚">
        <Sub title="Como evoluir">
          {ET("evolucoes.intro", "text-xs text-slate-400")}
        </Sub>
        <Sub title="Ovos — como obter e chocar">
          {ET("evolucoes.eggs", "text-xs text-slate-400 mb-2")}
          <Table
            headers={["Tipo de Ovo", "Pool"]}
            rows={[
              ["Ovo Comum", "Pokémon comuns de todas as gerações"],
              ["Ovo Raro", "Pokémon raros de todas as gerações"],
              ["Ovo Especial", "Pokémon épicos e lendários"],
              ["Ovo Gen 1–9", "Pokémon específicos da geração"],
              ["Ovo de Evento", "Pokémon sazonais ou especiais"],
            ]}
          />
        </Sub>
        <Note>{ET("evolucoes.note", "inline")}</Note>
      </Section>

      {/* ── 3. Interações ─────────────────────────────────────────────────── */}
      <Section id="interacoes" title="Interações com Mascotes" emoji="🐾">
        <Sub title="Ações disponíveis">
          <Table
            headers={["Ação", "EXP base", "Felicidade", "Cooldown"]}
            rows={[
              ["Brincar (PLAY)", 25, "+5 a +15", "45 min"],
              ["Acariciar (PET)", 10, "+3 a +8", "30 min"],
              ["Alimentar — Comida", 15, "+5 a +10", "2 h"],
              ["Alimentar — Doce", 35, "+10 a +20", "2 h"],
            ]}
          />
        </Sub>
        <Sub title="Bônus social (aliados e rivais)">
          {ET("interacoes.social", "text-xs text-slate-400")}
          <Table
            headers={["Relação", "Bônus de EXP"]}
            rows={[
              ["Amigo (Friend)", "+5%"],
              ["Melhor Amigo (Best Friend)", "+10%"],
              ["Super Amigo", "+15%"],
              ["Rival", "+5% por rival (máx +15%)"],
              ["Rival Direto (3+ interações)", "+10% por rival direto"],
            ]}
          />
        </Sub>
        <Note>{ET("interacoes.note", "inline")}</Note>
      </Section>

      {/* ── 4. Expedições ─────────────────────────────────────────────────── */}
      <Section id="expedicoes" title="Expedições" emoji="🎒">
        <Sub title="Modos de expedição">
          <Table
            headers={["Modo", "Objetivo", "EXP", "Itens"]}
            rows={[
              ["Padrão (STANDARD)", "EXP + itens balanceados", "✓ normal", "✓ ovos, comida, moedas"],
              ["Treinamento (TRAINING)", "Foco total em EXP", "✓ muito alto", "✗ sem itens"],
              ["Itens (ITEMS)", "Foco em drops de itens", "✗ sem EXP", "✓ ovos em destaque"],
            ]}
          />
        </Sub>

        <Sub title="Multiplicadores de EXP por duração (modo Padrão)">
          <Table
            headers={["Duração", "Mult. EXP Padrão", "Mult. EXP Treinamento", "Bônus de Recompensa"]}
            rows={[
              ["30 min", "0.5×", "4×", "+0%"],
              ["1 hora", "1.2×", "8×", "+5%"],
              ["3 horas", "3.2×", "20×", "+15%"],
              ["6 horas", "7.0×", "40×", "+30%"],
            ]}
          />
          {ET("expedicoes.formula", "text-xs text-slate-500 mt-1")}
        </Sub>

        <Sub title="Bônus de aliados e rivalidade">
          <Table
            headers={["Fator", "Bônus"]}
            rows={[
              ["Cada aliado (amigo)", "+10% EXP"],
              ["Rival em expedição", "+5% EXP (Rival Direto: +10%)"],
              ["Cap de aliados (itens)", "máx. +20% drop weight"],
              ["3+ aliados", "Elimina chance de não-drop"],
            ]}
          />
        </Sub>

        <Sub title="Drops de itens em expedição — Modo Padrão">
          <Note>{ET("expedicoes.padrao.note", "inline")}</Note>
          <Table
            headers={["Duração", "Ovo", "Doce", "Comida", "Moedas", "Item Especial"]}
            rows={[
              ["30 min", "~12%", "~11%", "~30%", "~47%", "0%"],
              ["1 hora",  "~16%", "~12%", "~29%", "~43%", "0%"],
              ["3 horas", "~22%", "~14%", "~27%", "~37%", "0%"],
              ["6 horas", "~29%", "~15%", "~25%", "~30%", "~3%"],
            ]}
          />
        </Sub>

        <Sub title="Drops de itens em expedição — Modo Itens">
          <Note>{ET("expedicoes.itens.note", "inline")}</Note>
          <Table
            headers={["Duração", "Ovo", "Doce", "Comida", "Item Especial"]}
            rows={[
              ["30 min", "~18%", "~28%", "~51%", "~3%"],
              ["1 hora",  "~21%", "~27%", "~48%", "~4%"],
              ["3 horas", "~30%", "~25%", "~40%", "~5%"],
              ["6 horas", "~44%", "~20%", "~29%", "~7%"],
            ]}
          />
        </Sub>

        <Sub title="Qualidade dos ovos em expedição">
          <Table
            headers={["Duração", "Condição", "Qualidade"]}
            rows={[
              ["6h", "Instinto > 9", "Especial"],
              ["6h", "Instinto ≤ 9", "Raro"],
              ["3h", "Instinto > 10", "Raro"],
              ["3h", "Instinto ≤ 10", "Comum"],
              ["1h / 30min", "Instinto > 22", "Raro"],
              ["1h / 30min", "Instinto ≤ 22", "Comum"],
            ]}
          />
          <Note>{ET("expedicoes.qualidade.note", "inline")}</Note>
        </Sub>

        <Sub title="Itens Especiais — pool de drops">
          <Note>{ET("expedicoes.especiais.note", "inline")}</Note>
          <Table
            headers={["Item", "Drop 6h", "Drop 3h", "Drop 1h/30min"]}
            rows={[
              ["Vitamina Elétrica", "34%", "42%", "55%"],
              ["Amuleto da Sorte", "28%", "30%", "45%"],
              ["Cesta de Piquenique", "16%", "15%", "—"],
              ["Política de Fraqueza", "14%", "13%", "—"],
              ["Ovo da Sorte", "8%", "—", "—"],
            ]}
          />
        </Sub>
      </Section>

      {/* ── 5. Itens & Buffs ──────────────────────────────────────────────── */}
      <Section id="itens" title="Itens & Buffs" emoji="🧪">
        <Sub title="Buffs de EXP">
          <Table
            headers={["Item", "Efeito", "Duração", "Onde se aplica"]}
            rows={[
              ["⚡ Vitamina Elétrica", "+25% EXP em 1 mascote", "2h (admin config)", "Expedição, Arena, Interações"],
              ["🧺 Cesta de Piquenique", "-30% na próxima duração; bônus de EXP/loot por modo", "3h para bônus; redução no próximo uso", "Expedições"],
              ["🥚 Ovo da Sorte", "+20% EXP em 1 expedição", "1 uso (diário)", "Expedição de Treinamento"],
            ]}
          />
          <Note>{ET("itens.buffs.note", "inline")}</Note>
        </Sub>

        <Sub title="Cálculo final de EXP em interações (exemplo: Brincar)">
          {ET("itens.calc", "text-xs text-slate-400")}
          {ET("itens.calc.exemplo", "text-xs text-slate-500 mt-1")}
        </Sub>

        <Sub title="Outros itens">
          <Table
            headers={["Item", "Efeito"]}
            rows={[
              ["🍀 Amuleto da Sorte", "Dobra chance de loot raro em expedições por 6h"],
              ["💊 Proteína Zika", "+2 permanentes em todos os 5 atributos (máx 3 doses por mascote)"],
              ["🍯 Bala de Mel", "Felicidade vai para 100 e sempre cria uma nova amizade (até 10 amigos) ou um evento bônus com presente enviado por um amigo"],
              ["💧 Água Sagrada", "Remove humor negativo (ANGRY/TIRED/NEEDY) imediatamente"],
              ["🛡️ Política de Fraqueza", "Recupera completamente um mascote ferido/em repouso, remove todo o repouso e protege contra o próximo ataque oportunista"],
              ["📡 Compartilhador de XP", "Distribui 50% do EXP de Treinamento para mascotes com buff ativo. Pode ser desequipado pelo card do mascote — o item volta ao inventário."],
              ["📡 Compartilhador Geral", "Distribui 10% da EXP de Treinamento a todos os outros favoritos. Apenas um Compartilhador pode ficar equipado."],
              ["🏖️ Ticket de Férias", "Ao retornar, concede 4.000 EXP + 10 EXP por nível, além das recompensas de férias"],
              ["🌈 Pena Arco-Íris", "IRREVERSÍVEL — volta ao Nv.1 e ressorteia personalidade/status no intervalo do ovo original; sem registro usa Ovo Raro"],
            ]}
          />
        </Sub>

        <Sub title="Comida de Mascote">
          <Table
            headers={["Tipo", "Efeito", "Cooldown"]}
            rows={[
              ["Comida de Mascote (FOOD)", "+15 EXP · melhora fome", "2h"],
              ["Doce de Mascote (SWEET)", "+35 EXP · melhora fome · anima humor", "2h"],
            ]}
          />
        </Sub>

        <Sub title="Exemplos numéricos de itens">
          <Table
            headers={["Item", "Exemplo prático"]}
            rows={[
              ["Vitamina Elétrica", "Se uma expedição renderia 240 EXP, com +25% ela rende 300 EXP."],
              ["Ovo da Sorte", "Se uma expedição de treino renderia 1.000 EXP, com +20% ela rende 1.200 EXP."],
              ["Cesta de Piquenique", "Treino recebe +25% EXP; Padrão +12% EXP e +1,5 ponto percentual em ovo/item especial; Itens +3 pontos percentuais em ovo/item especial."],
              ["Proteína Zika", "+2 em Força, Agilidade, Carisma, Instinto e Vitalidade. Uma dose = +10 pontos totais; 3 doses = +30."],
              ["Amuleto da Sorte", "Dobra o valor de sorte usado na expedição. Um mascote Nv.25 com 60 Instinto rola como se tivesse 130 de sorte: (60 + 5) × 2."],
              ["Mega Stone", "Só cai em expedição de Itens de 6h, com 0,5% antes da rolagem normal de recompensa."],
            ]}
          />
          <Note>Os percentuais de drop são rolagens ponderadas: aumentar Instinto, usar Amuleto da Sorte e levar aliados melhora o peso de ovos/itens, mas não transforma todo resultado em item raro.</Note>
        </Sub>
      </Section>

      {/* ── 6. Atributos & Combate ────────────────────────────────────────── */}
      <Section id="atributos-combate" title="Atributos & Cálculo de Combate" emoji="🧮">
        <Sub title="O que cada atributo faz">
          <Table
            headers={["Atributo", "Uso direto no combate", "Posturas que mais aproveitam"]}
            rows={[
              ["Força", "Entra no dano base com peso 0,42. Também aumenta Atacante, Duelista e Especialista.", "Atacante, Duelista, Especialista"],
              ["Agilidade", "Entra no dano base com peso 0,18. Ajuda Flanco/Batedor a furar defesa e escolher alvos frágeis.", "Flanco, Batedor, Sabotador"],
              ["Instinto", "Entra no dano base com peso 0,12. Ajuda efeitos de debuff, alvo oportunista e sobrevivência.", "Oportunista, Sabotador, Duelista, Sobrevivente"],
              ["Vitalidade", "Entra na defesa com peso 0,28 e sustenta HP, redução de dano e proteção.", "Defensor, Guardião, Sobrevivente"],
              ["Carisma", "Entra na defesa com peso 0,08 e fortalece suporte, cura, provocação e bônus de equipe.", "Encorajador, Cuidador, Provocador, Guardião"],
            ]}
          />
        </Sub>

        <Sub title="Fórmula base de dano">
          <Table
            headers={["Etapa", "Cálculo"]}
            rows={[
              ["Dano base", "máx(5, Força × 0,42 + Agilidade × 0,18 + Instinto × 0,12)"],
              ["Defesa do alvo", "Vitalidade × 0,28 + Carisma × 0,08"],
              ["Dano bruto", "máx(1, Dano base - Defesa × 0,35)"],
              ["Dano final", "Dano bruto × vantagem de tipo × postura × variação aleatória de 0,85 a 1,15"],
            ]}
          />
          <Note>Modos especiais como Liga Semanal, Arena Sincronizada e Raid Boss podem aplicar modificadores por cima dessa base, mas a lógica principal parte desses atributos.</Note>
        </Sub>

        <Sub title="Exemplo de dano">
          <Table
            headers={["Situação", "Resultado aproximado"]}
            rows={[
              ["Atacante: 120 Força, 80 Agilidade, 60 Instinto", "Dano base = 50,4 + 14,4 + 7,2 = 72"],
              ["Alvo: 100 Vitalidade, 50 Carisma", "Defesa = 28 + 4 = 32"],
              ["Sem postura e sem vantagem de tipo", "Dano bruto = 72 - 11,2 = 60,8, então cerca de 61 antes da variação"],
              ["Mesmo mascote como Atacante", "Postura adiciona até +26%; 61 vira cerca de 77 antes da variação"],
            ]}
          />
        </Sub>
      </Section>

      {/* ── 7. Posturas ───────────────────────────────────────────────────── */}
      <Section id="posturas" title="Posturas de Combate" emoji="🧭">
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <p className="text-xs font-semibold text-cyan-200">Abra uma postura para ver turnos, iniciativa, alvos e fórmulas detalhadas.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMBAT_ROLE_OPTIONS.map((role) => (
              <div key={role.value} className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-[10px] text-slate-300">
                <span>{role.label}</span>
                <CombatRoleHelpButton role={role.value} mode="GENERAL" className="h-5 w-5" />
              </div>
            ))}
          </div>
        </div>
        <Sub title="Efeitos por postura">
          <Table
            headers={["Postura", "Atributos diretos", "Efeito em números"]}
            rows={[
              ["Defensor", "Vitalidade", "Atrai 62% a 78% dos ataques e reduz 8% a 35% do dano recebido."],
              ["Atacante", "Força", "+8% a +26% de dano; +15% extra contra Defensores."],
              ["Flanco", "Agilidade", "+4% a +18% de dano, 35% a 82% de chance de furar defesa e +12% contra suportes."],
              ["Oportunista", "Instinto", "22% a 62% de chance de reduzir um atributo inimigo em 8% a 25%; +10% dano se superar Instinto do alvo."],
              ["Encorajador", "Carisma", "Enquanto ativo, concede +4% a +18% de dano para a equipe."],
              ["Guardião", "Vitalidade + Carisma", "Intercepta 15% a 40% do dano de aliados; recebe 5% a 20% menos dano; causa 10% menos dano."],
              ["Duelista", "Força + Instinto", "+6% a +18% de dano base; +12% enquanto mantém duelo no mesmo alvo."],
              ["Sabotador", "Instinto + Agilidade", "Prioriza suportes e reduz 15% a 40% dos bônus de Encorajadores inimigos."],
              ["Cuidador", "Carisma + Vitalidade", "Cura aliados com 35% do Carisma + 25% da Vitalidade; 2 a 5 curas por combate; causa 20% menos dano."],
              ["Batedor", "Agilidade + Instinto", "Até +8% de dano para a equipe; 35% a 82% de chance de focar alvo frágil; causa 5% menos dano."],
              ["Provocador", "Carisma + Instinto", "20% a 55% de chance de redirecionar ataques para si e reduz 8% do dano desviado; causa 8% menos dano."],
              ["Especialista", "Maior atributo", "+6% a +20% de dano usando o melhor atributo do mascote."],
              ["Sobrevivente", "Vitalidade + Instinto", "Reduz até 15% de dano; abaixo de 30% HP ganha +15% dano e redução extra de 25%; sobrevive uma vez com 1 HP."],
            ]}
          />
        </Sub>
        <Note>Regra geral de Agilidade: cada mascote começa com 1 ação por rodada. Na Arena e Liga, recebe 2 ações quando sua Agilidade supera a média adversária em 60 pontos e 3 ações quando supera em 140. Na Raid, a comparação usa a média dos companheiros. Cuidador pode trocar essas ações por curas; buffs de Encorajador, Batedor, Guardião, Sabotador e Provocador são passivos e não impedem o ataque.</Note>
        <Note>A recomendação automática usa os atributos atuais do mascote. Ela é boa como ponto de partida, mas você pode trocar a postura para encaixar melhor na estratégia do time.</Note>
      </Section>

      {/* ── 8. Personalidades ─────────────────────────────────────────────── */}
      <Section id="personalidades" title="Personalidades dos Mascotes" emoji="💬">
        <Sub title="Prós e contras de cada personalidade">
          <Table
            headers={["Personalidade", "Prós", "Contras / cuidado"]}
            rows={[
              ["Leal", "Carinho dá +2 felicidade extra. No level-up, Carisma recebe peso ×1,15, então cresce melhor como suporte, Cuidador, Encorajador ou Provocador.", "Não melhora dano direto. Se o mascote tiver Força baixa, Leal não resolve isso sozinho."],
              ["Orgulhoso", "Reage melhor quando está feliz, confiante ou vindo de vitórias. Combina com mascotes usados em destaque, arena e eventos sociais positivos.", "Sofre mais narrativamente com derrotas e rivalidades. Pode exigir mais manutenção de humor/felicidade para render bem."],
              ["Travesso", "Tende a criar provocações e rivalidades leves, aumentando oportunidades de laços e eventos sociais entre mascotes.", "Pode acelerar rivalidades indesejadas. Bom para histórias e caos controlado; ruim se você quer um mascote sempre estável."],
              ["Preguiçoso", "Pode funcionar bem em mascotes naturalmente resistentes: Vitalidade alta compensa a tendência de cansar.", "Ao brincar, tende a ficar Cansado em vez de Feliz. Precisa de comida, carinho e descanso com mais atenção."],
              ["Competitivo", "Ganha 6 pontos brutos por nível em vez de 5 e favorece Força com peso ×1,15. Excelente para Atacante, Duelista e Especialista.", "Cresce ofensivamente, mas não dá defesa grátis. Se Vitalidade/Carisma forem baixos, pode bater forte e cair rápido."],
              ["Dramático", "Quando está feliz ou confiante, tende a render melhor em eventos emocionais e relações marcantes.", "Ganha 4 pontos brutos por nível em vez de 5 e Vitalidade tem peso ×0,85. É uma personalidade charmosa, mas menos eficiente para tanque puro."],
              ["Brincalhão", "Brincar dá +3 felicidade extra e cerca de +10% EXP nessa interação. Muito bom para evoluir mantendo humor alto.", "Depende de interação frequente. Se ficar abandonado, perde parte do valor prático."],
              ["Elétrico", "Tem melhor ritmo em interações curtas e expedições rápidas. É bom para jogadores que entram várias vezes ao dia.", "O benefício aparece mais em rotina ativa. Em longos períodos parado, não substitui alimentação e cuidado."],
              ["Tímido", "Depois que ganha confiança, tende a criar laços fortes e consistentes. Bom para mascotes de longo prazo.", "Se felicidade estiver abaixo de 40, pode recusar carinho. No começo exige mais paciência para estabilizar."],
              ["Caótico", "Com Instinto alto, aumenta a chance de eventos sociais incomuns, viradas narrativas e interações fora do padrão entre mascotes.", "É menos previsível. Pode gerar situações boas ou inconvenientes; não é a melhor escolha para quem quer controle total."],
            ]}
          />
        </Sub>

        <Sub title="Pontos de atributo por nível">
          <Table
            headers={["Tipo", "Pontos brutos antes dos multiplicadores"]}
            rows={[
              ["Mascote comum", "5 pontos brutos por nível, depois ×0,55 e multiplicador de raridade/espécie."],
              ["Competitivo", "6 pontos brutos por nível e viés para Força."],
              ["Leal", "6 pontos brutos por nível e viés para Carisma."],
              ["Dramático", "4 pontos brutos por nível e viés menor para Vitalidade."],
              ["Pseudo/raros especiais", "Multiplicador de crescimento 1,1."],
              ["Míticos/lendários especiais", "Multiplicador de crescimento 1,3."],
            ]}
          />
          <Note>Exemplo: um mascote comum normalmente recebe arredondado perto de 3 pontos por nível (5 × 0,55). Um Competitivo recebe perto de 3 a 4, e ainda tende a jogar mais desses pontos em Força.</Note>
        </Sub>

        <Sub title="Como ler personalidade na prática">
          <Table
            headers={["Objetivo", "Personalidades que combinam", "Por quê"]}
            rows={[
              ["Dano bruto", "Competitivo, Brincalhão", "Competitivo cresce melhor em Força; Brincalhão facilita EXP por interação."],
              ["Suporte e cura", "Leal, Orgulhoso", "Leal favorece Carisma; Orgulhoso se beneficia de humor alto e vitórias."],
              ["Mascote social / laços", "Leal, Tímido, Travesso, Caótico", "Geram ou aproveitam melhor relações, confiança, rivalidade e eventos sociais."],
              ["Tanque / sobrevivência", "Leal, Preguiçoso com Vitalidade alta", "Leal pode crescer suporte/defesa por Carisma; Preguiçoso só vale se a base defensiva já for boa."],
              ["Build arriscada", "Dramático, Caótico", "Podem render momentos fortes, mas exigem mais leitura de humor, laços e contexto."],
            ]}
          />
          <Note>Personalidade não muda a espécie nem garante vitória. Ela inclina crescimento, humor e eventos sociais. O melhor mascote ainda depende de atributos, postura, nível, itens, laços e modo de jogo.</Note>
        </Sub>
      </Section>

      {/* ── 9. Laboratório & Análise ──────────────────────────────────────── */}
      <Section id="laboratorio-analise" title="Laboratório & Análise de Potencial" emoji="🔬">
        <Sub title="Como a previsão do Laboratório é calculada">
          <Note>A análise do Laboratório é uma previsão aproximada baseada nas regras atuais do jogo. Ela não é promessa de resultado exato: mudanças futuras de balanceamento, itens usados depois da análise, travas de evolução, Mega Evolução e eventos especiais podem alterar o caminho real do mascote.</Note>
          <Table
            headers={["Parte da análise", "Como funciona"]}
            rows={[
              ["Custo", "Cada análise custa ZikaCoins e salva o resultado no mascote para consulta posterior."],
              ["Nível-alvo", "A simulação projeta o mascote até o nível escolhido, limitado ao Nv.100."],
              ["Evolução", "Se evolução não estiver travada, o Lab simula a evolução no nível correto e aplica marcos de progresso."],
              ["Crescimento", "Usa a mesma regra real de level-up: pontos por personalidade × 0,55 × multiplicador da espécie."],
              ["Distribuição", "Os pontos vão para atributos com pesos baseados nos stats atuais, com variação determinística e anti-freeze para não abandonar atributo fraco."],
              ["Poder projetado", "Força ×1,1 + Vitalidade ×1,0 + Agilidade ×0,95 + Instinto ×0,95 + Carisma ×0,9."],
            ]}
          />
        </Sub>

        <Sub title="Por que é previsão, não garantia">
          <Table
            headers={["Fator", "O que o Lab consegue prever", "O que pode mudar depois"]}
            rows={[
              ["Level-up", "Simula o ganho de níveis com a regra atual, incluindo saltos de vários níveis.", "Novos itens, buffs permanentes ou ajustes de balanceamento podem mudar os atributos finais."],
              ["Evolução", "Projeta a cadeia evolutiva se ela estiver destravada.", "Se o jogador travar evolução, destravar depois, usar Mega Stone ou Pena Arco-Íris, a rota muda."],
              ["Personalidade", "Aplica os pesos reais: Competitivo favorece Força, Leal favorece Carisma, Dramático reduz Vitalidade.", "Humor, laços e escolhas do jogador ainda afetam eventos e desempenho situacional."],
              ["Stats iniciais", "Estima a qualidade do nascimento removendo crescimento já conquistado.", "Como o jogo não salva cada ponto histórico separadamente, essa parte é uma estimativa conservadora."],
              ["Combate", "Sugere posturas e calcula poder projetado por soma ponderada.", "Resultado real ainda depende de tipo, postura adversária, variação de dano, itens, laços e modificadores do modo."],
            ]}
          />
        </Sub>

        <Sub title="Nota de potencial (IV Score)">
          <Table
            headers={["Componente", "Peso no score"]}
            rows={[
              ["Qualidade estimada do nascimento", "55% do score. O Lab estima o roll inicial removendo crescimento já conquistado."],
              ["Teto da espécie/evolução", "45% do score. Considera multiplicador da espécie e quantas evoluções ainda existem."],
              ["Lendários/Míticos", "Teto de espécie tratado como alto por natureza."],
              ["Ratings", "SSS ≥92, SS ≥82, S ≥72, A ≥60, B ≥47, C ≥34, D ≥20, E abaixo de 20."],
            ]}
          />
          <Note>Use o IV Score como bússola de investimento, não como sentença. Um mascote B com boa postura e item certo pode ser mais útil em um modo específico do que um S mal encaixado.</Note>
        </Sub>

        <Sub title="Pó de Criação ao reciclar">
          <Table
            headers={["Raridade do mascote", "Pó base"]}
            rows={[
              ["Comum", "1"],
              ["Raro", "2"],
              ["Especial / Lendário / crescimento 1,1+", "3"],
            ]}
          />
          <Table
            headers={["Duplicatas restantes da mesma espécie", "Multiplicador"]}
            rows={[
              ["Nenhuma duplicata", "×1,0"],
              ["1 duplicata", "×1,5"],
              ["2 ou mais duplicatas", "×3,0"],
            ]}
          />
          <Note>Exemplo: reciclar um mascote Especial com 2 duplicatas rende 3 × 3,0 = 9 Pó de Criação. Favoritos, mascotes em Liga Semanal, Arena, expedição ou bazar não devem aparecer como recicláveis.</Note>
        </Sub>
      </Section>

      {/* ── 10. Arena Z ───────────────────────────────────────────────────── */}
      <Section id="arena" title="Arena Z (PvP e PvE)" emoji="⚔️">
        <Sub title="Salas e limites de nível">
          {ET("arena.intro", "text-xs text-slate-400")}
        </Sub>

        <Sub title="Tipos de partida">
          <Table
            headers={["Tipo", "Descrição"]}
            rows={[
              ["PvP (vs jogador)", "Desafie times de outros jogadores. Usa mecânica de tipos e atributos."],
              ["PvE (vs bot)", "Enfrente times gerados automaticamente. Limite diário de ganhos em moedas."],
            ]}
          />
        </Sub>

        <Sub title="Sistema de batalha — Cálculo de dano">
          {ET("arena.batalha", "text-xs text-slate-400")}
        </Sub>

        <Sub title="Recompensas de Arena">
          <Table
            headers={["Evento", "Recompensa"]}
            rows={[
              ["Vitória em PvP", "ZikaCoins + EXP ao mascote"],
              ["Derrota em PvP", "EXP reduzido ao mascote"],
              ["Vitória PvE", "ZikaCoins (com cap diário)"],
              ["Espólios do chão", "Chance aleatória de item extra ao vencer PvP"],
            ]}
          />
        </Sub>

        <Sub title="Limite diário de PvE">
          <Note>{ET("arena.pve.note", "inline")}</Note>
        </Sub>

        <Note>{ET("arena.note", "inline")}</Note>
      </Section>

      {/* ── 7. Economia ───────────────────────────────────────────────────── */}
      <Section id="economia" title="Economia & ZikaCoins" emoji="🪙">
        <Sub title="Fontes de ZikaCoins">
          <Table
            headers={["Fonte", "Valor aproximado"]}
            rows={[
              ["Expedição Padrão — 30min", "50–160 ZC"],
              ["Expedição Padrão — 1h", "80–230 ZC"],
              ["Expedição Padrão — 3h", "140–370 ZC"],
              ["Expedição Padrão — 6h", "230–580 ZC"],
              ["Vitória em Arena PvP", "variável por sala"],
              ["PvE (dentro do limite diário)", "variável"],
              ["Venda no Bazar", "livre negociação"],
              ["Código de resgate", "definido pelo admin"],
            ]}
          />
        </Sub>

        <Sub title="Gastos principais">
          <Table
            headers={["Gasto", "Custo"]}
            rows={[
              ["Troca global de um slot do Miauvadão", "250 ZC (1× por rotação de 6h)"],
              ["Taxa de listagem no Bazar", "definida pelo admin"],
              ["Compras na ZikaShop", "variável por item"],
              ["Pacotes de figurinhas", "definido por pacote"],
            ]}
          />
        </Sub>

        <Note>{ET("economia.note", "inline")}</Note>
      </Section>

      {/* ── 8. Bazar ──────────────────────────────────────────────────────── */}
      <Section id="bazar" title="Bazar" emoji="🏪">
        <Sub title="O que é o Bazar">
          {ET("bazar.intro", "text-xs text-slate-400")}
        </Sub>

        <Sub title="Regras gerais">
          <Table
            headers={["Regra", "Detalhe"]}
            rows={[
              ["Limite de anúncios simultâneos", "8 anúncios ativos por jogador"],
              ["Duração máxima do anúncio", "30 dias"],
              ["Taxa de listagem", "cobrada ao criar o anúncio (vai ao cofre do Miauvadão)"],
              ["Propostas de troca", "O anunciante aceita ou recusa manualmente"],
            ]}
          />
        </Sub>

        <Sub title="Miauvadão — Ofertas especiais">
          {ET("bazar.miauvadao", "text-xs text-slate-400")}
        </Sub>
      </Section>

      {/* ── 9. TCG ────────────────────────────────────────────────────────── */}
      <Section id="tcg" title="Partidas TCG" emoji="🃏">
        <Sub title="Sistema de pontuação">
          <Table
            headers={["Resultado", "Pontos", "EXP ao mascote"]}
            rows={[
              ["Vitória", "+2 pontos + prêmios", "35 EXP"],
              ["Derrota", "+0 pontos", "15 EXP"],
              ["Partida jogada (qualquer)", "contabiliza para streaks e conquistas", "—"],
            ]}
          />
        </Sub>

        <Sub title="Prêmios de partida">
          {ET("tcg.premios", "text-xs text-slate-400")}
        </Sub>

        <Sub title="Insígnias de Ginásio">
          {ET("tcg.insignias", "text-xs text-slate-400")}
          <Table
            headers={["Insígnia", "Tipo"]}
            rows={[
              ["Boulder (Pedra)", "Defesa"],
              ["Cascade (Água)", "Velocidade"],
              ["Thunder (Elétrico)", "Ataque"],
              ["Rainbow (Grama)", "Cura"],
              ["Soul (Psíquico)", "Habilidade"],
              ["Marsh (Fantasma)", "Controle"],
              ["Volcano (Fogo)", "Poder Bruto"],
              ["Earth (Lutador)", "Resistência"],
            ]}
          />
        </Sub>
      </Section>

      {/* ── 10. Torneios ──────────────────────────────────────────────────── */}
      <Section id="torneios" title="Torneios & Ranking" emoji="🏆">
        <Sub title="Formatos de torneio">
          <Table
            headers={["Formato", "Descrição"]}
            rows={[
              ["Semana Normal", "Partidas livres entre jogadores. Pontuam V/D, prêmios e insígnias."],
              ["Guerra de Times", "Jogadores divididos em times. Média de pontos decide o vencedor."],
              ["Desafio de Insígnia", "Partida oficial entre detentor e desafiante de uma insígnia."],
            ]}
          />
        </Sub>

        <Sub title="Ranking Geral">
          {ET("torneios.ranking", "text-xs text-slate-400")}
        </Sub>

        <Sub title="Conquistas">
          {ET("torneios.conquistas", "text-xs text-slate-400")}
        </Sub>
      </Section>

      {/* ── 11. Passe Apoiador ────────────────────────────────────────────── */}
      <Section id="apoiador" title="Passe Apoiador" emoji="🌟">
        <Sub title="Benefícios do Passe">
          <Table
            headers={["Benefício", "Detalhe"]}
            rows={[
              ["Dias de bônus liberados por calendário", "um dia de bônus por dia corrido"],
              ["Bônus de EXP global", "+% em todas as fontes de EXP enquanto ativo"],
              ["Itens exclusivos", "acesso a cosméticos e itens exclusivos de apoiador"],
            ]}
          />
        </Sub>
        <Note>{ET("apoiador.note", "inline")}</Note>
      </Section>

      {/* Rodapé */}
      <div className="rounded-xl border border-border/40 bg-slate-900/30 px-4 py-3 text-[11px] text-slate-500 text-center">
        {ET("footer")}
      </div>
    </div>
  );
}
