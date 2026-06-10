import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

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

export default function ManualPage() {
  const tocSections = [
    { id: "mascotes",     label: "Mascotes & EXP" },
    { id: "evolucoes",    label: "Evoluções" },
    { id: "interacoes",   label: "Interações" },
    { id: "expedicoes",   label: "Expedições" },
    { id: "itens",        label: "Itens & Buffs" },
    { id: "arena",        label: "Arena Z (PvP/PvE)" },
    { id: "economia",     label: "Economia & ZikaCoins" },
    { id: "bazar",        label: "Bazar" },
    { id: "tcg",          label: "Partidas TCG" },
    { id: "torneios",     label: "Torneios & Insígnias" },
    { id: "apoiador",     label: "Passe Apoiador" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/album" className="rounded-lg border border-border p-2 text-slate-400 hover:text-slate-200">
          <ArrowLeft size={16}/>
        </Link>
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] flex items-center gap-2">
            <BookOpen size={18}/> Manual da Liga Zikachu
          </h1>
          <p className="text-xs text-slate-500">Referência completa dos sistemas do jogo.</p>
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
          <p className="text-xs text-slate-400">
            Cada mascote possui um medidor de EXP que avança com atividades. O EXP necessário para subir
            de nível é calculado como <strong className="text-slate-200">100 + (nível atual × 20)</strong> EXP.
          </p>
          <Table
            headers={["Nível", "EXP p/ próximo", "EXP total acumulado"]}
            rows={[
              [1, 120, 0],
              [2, 140, 120],
              [5, 200, 700],
              [10, 300, 2.200],
              [15, 400, 4.700],
              [20, 500, 8.200],
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

        <Note>
          Mascotes na bancada recebem 50% do EXP em expedições e ações em massa. Promova à Equipe Favorita
          para maximizar o ganho.
        </Note>
      </Section>

      {/* ── 2. Evoluções ──────────────────────────────────────────────────── */}
      <Section id="evolucoes" title="Evoluções" emoji="🥚">
        <Sub title="Como evoluir">
          <p className="text-xs text-slate-400">
            Mascotes evoluem automaticamente ao atingir os níveis determinados pela linha evolutiva de cada
            Pokémon. A evolução é detectada na hora que o mascote sobe de nível — não precisa de ação manual.
          </p>
        </Sub>
        <Sub title="Ovos — como obter e chocar">
          <p className="text-xs text-slate-400 mb-2">
            Ovos são obtidos em expedições, como recompensa de partidas e pelo bazar.
            Ao receber um ovo, ele entra automaticamente na incubadora (duração: <strong className="text-slate-200">10 minutos</strong>).
            Ao chocar, você recebe um mascote aleatório do pool correspondente.
          </p>
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
        <Note>
          Ovos são o item mais valioso das expedições longas (6h modo Itens). Em expedições de 6h no
          modo Itens, ovos são o drop dominante.
        </Note>
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
          <p className="text-xs text-slate-400">
            Relacionamentos com outros mascotes adicionam bônus de EXP em interações, com cap de +25%:
          </p>
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
        <Note>
          O humor do mascote afeta o EXP ganho. ANGRY e TIRED bloqueiam interações; CONFIDENT e
          COMPETITIVE concedem bônus extras.
        </Note>
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
          <p className="text-xs text-slate-500 mt-1">
            EXP final = Base (50) × multiplicador de duração × (1 + bônus de nível) × (1 + bônus de aliados)
          </p>
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
          <Note>Pesos aproximados para mascote nível 10, sem buff de sorte, sem aliados.</Note>
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
          <Note>Ovos são o drop mais frequente em expedições longas (6h).</Note>
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
          <p className="text-xs text-slate-500 mt-1">
            Instinto efetivo = statInstinct + floor(nível/5). Com Amuleto da Sorte ativo, o valor dobra.
          </p>
        </Sub>

        <Sub title="Itens Especiais — pool de drops">
          <p className="text-xs text-slate-400 mb-2">
            Itens especiais (buffs) têm baixa chance de drop, principalmente no modo Itens e nas expedições de 6h.
          </p>
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
          <p className="text-xs text-slate-500 mt-1">
            Percentuais dentro do pool de "Item Especial". Política de Fraqueza e Ovo da Sorte só caem em 6h (Padrão e Itens).
          </p>
        </Sub>
      </Section>

      {/* ── 5. Itens & Buffs ──────────────────────────────────────────────── */}
      <Section id="itens" title="Itens & Buffs" emoji="🧪">
        <Sub title="Buffs de EXP">
          <Table
            headers={["Item", "Efeito", "Duração", "Onde se aplica"]}
            rows={[
              ["⚡ Vitamina Elétrica", "+25% EXP em 1 mascote", "2h (admin config)", "Expedição, Arena, Interações"],
              ["🧺 Cesta de Piquenique", "+15% EXP + +5 felicidade", "2h", "Expedição, Arena, Interações (6 favoritos)"],
              ["🥚 Ovo da Sorte", "+20% EXP em 1 expedição", "1 uso (diário)", "Expedição de Treinamento"],
            ]}
          />
          <Note>
            Vitamina Elétrica e Cesta de Piquenique <strong>não se acumulam</strong> entre si para o mesmo mascote.
            Férias estão excluídas do bônus de EXP em todos os buffs.
          </Note>
        </Sub>

        <Sub title="Cálculo final de EXP em interações (exemplo: Brincar)">
          <p className="text-xs text-slate-400">
            EXP base = 25 · fator de posição (1.5 se companheiro, 1.25 se favorito, 1.0 se banco)
            · bônus social (0–+25%) · Vitamina (+25% se ativa) · Piquenique (+15% se ativo)
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Exemplo: Companheiro com Vitamina + Piquenique + 2 aliados = 25 × 1.5 × 1.15 × 1.25 × 1.10 ≈ <strong>59 EXP</strong>
          </p>
        </Sub>

        <Sub title="Outros itens">
          <Table
            headers={["Item", "Efeito"]}
            rows={[
              ["🍀 Amuleto da Sorte", "Dobra chance de loot raro em expedições por 6h"],
              ["💊 Proteína Zika", "+2 permanentes em todos os 5 atributos (máx 3 doses por mascote)"],
              ["🍯 Bala de Mel", "Felicidade vai para 100 instantaneamente + humor HAPPY"],
              ["💧 Água Sagrada", "Remove humor negativo (ANGRY/TIRED/NEEDY) imediatamente"],
              ["🛡️ Política de Fraqueza", "Protege contra ataques oportunistas na Arena Z (permanente)"],
              ["📡 Compartilhador de XP", "Distribui 50% do EXP de Treinamento para mascotes com buff ativo"],
              ["🏖️ Ticket de Férias", "Envia mascote para 7 dias com o Prof. Carvalho (+EXP e felicidade)"],
              ["🌈 Pena Arco-Íris", "IRREVERSÍVEL — reseta o mascote para nível 1"],
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
      </Section>

      {/* ── 6. Arena Z ────────────────────────────────────────────────────── */}
      <Section id="arena" title="Arena Z (PvP e PvE)" emoji="⚔️">
        <Sub title="Salas e limites de nível">
          <p className="text-xs text-slate-400">
            A Arena Z possui salas com limite máximo de nível. Mascotes acima do limite não podem entrar.
            Cada sala tem uma atmosfera diferente e influencia o tipo de adversário.
          </p>
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
          <p className="text-xs text-slate-400">
            O dano é calculado com base nos atributos do mascote: Força, Agilidade, Carisma, Instinto e Vitalidade.
            Vantagens de tipo (como Fogo &gt; Grama) concedem multiplicador de 1.5× no ataque.
          </p>
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
          <p className="text-xs text-slate-400">
            Existe um limite de ZikaCoins que pode ser ganho via PvE por dia. O contador reseta
            automaticamente à <strong className="text-slate-200">meia-noite (horário de Brasília)</strong>.
          </p>
        </Sub>

        <Note>
          Um mascote ferido (INJURED) ou em arena (ARENA) não pode participar de expedições ou
          interações até ser liberado.
        </Note>
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
              ["Atualização manual das ofertas do Miauvadão", "100 ZC (3× compartilhadas/dia)"],
              ["Taxa de listagem no Bazar", "definida pelo admin"],
              ["Compras na ZikaShop", "variável por item"],
              ["Pacotes de figurinhas", "definido por pacote"],
            ]}
          />
        </Sub>

        <Note>
          As taxas do Bazar vão para o cofre do Miauvadão, que usa esse saldo para financiar descontos maiores nas ofertas diárias.
        </Note>
      </Section>

      {/* ── 8. Bazar ──────────────────────────────────────────────────────── */}
      <Section id="bazar" title="Bazar" emoji="🏪">
        <Sub title="O que é o Bazar">
          <p className="text-xs text-slate-400">
            O Bazar é o mercado de jogadores: venda, compra e troca de mascotes, ovos e itens com
            outros participantes.
          </p>
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
          <p className="text-xs text-slate-400">
            O Miauvadão atualiza 3 ofertas com desconto todo dia automaticamente. Jogadores podem
            atualizar manualmente as ofertas pagando <strong className="text-slate-200">100 ZC</strong>,
            com um limite de <strong className="text-slate-200">3 atualizações compartilhadas por dia</strong>
            entre todos os jogadores. Quando o auto-refresh acontece, o contador compartilhado é zerado.
          </p>
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
          <p className="text-xs text-slate-400">
            Cada vitória concede prêmios à escolha do adversário (normalmente 3 cartas do baralho do perdedor).
            Prêmios são registrados manualmente no sistema pela administração.
          </p>
        </Sub>

        <Sub title="Insígnias de Ginásio">
          <p className="text-xs text-slate-400">
            Insígnias são mantidas por um detentor até serem conquistadas por um desafiante em partida oficial.
            Cada insígnia vale <strong className="text-slate-200">3 pontos</strong> enquanto possuída.
            Defender ou conquistar uma insígnia gera EXP ao mascote companheiro.
          </p>
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
          <p className="text-xs text-slate-400">
            O ranking combina pontos de vitórias, prêmios capturados e pontos de insígnias possuídas.
            O Top do Dia é definido pelo melhor desempenho na semana atual.
          </p>
        </Sub>

        <Sub title="Conquistas">
          <p className="text-xs text-slate-400">
            Conquistas são desbloqueadas realizando feitos específicos em partidas (ex: vencer com
            baralho completo de Habilidades, capturar 4 prêmios em uma investida, etc.).
            Bronze vale 5 pts · Prata vale 7 pts · Ouro vale 10 pts. Cada conquista tem apenas
            um detentor por vez.
          </p>
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
        <Note>
          O Passe Apoiador é ativado por código. Os dias de bônus são liberados por calendário BRT
          (horário de Brasília), não por período de 24h corridas.
        </Note>
      </Section>

      {/* Rodapé */}
      <div className="rounded-xl border border-border/40 bg-slate-900/30 px-4 py-3 text-[11px] text-slate-500 text-center">
        Manual da Liga Zikachu — versão interna. Valores podem ser ajustados pelo admin via ZikaShop ou configurações.
      </div>
    </div>
  );
}
