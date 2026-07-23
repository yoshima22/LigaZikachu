import Link from "next/link";
import { GlobalResetPanel } from "./_components/global-reset-panel";
import { DeckReminderPanel } from "./_components/deck-reminder-panel";
import { BulkSendPanel } from "./_components/bulk-send-panel";
import { MascotSocialPanel } from "./_components/mascot-social-panel";
import { AdminExpeditionPanel } from "./_components/admin-expedition-panel";
import { AdminMascotPanel } from "./_components/admin-mascot-panel";
import { UserAccountPanel } from "./_components/user-account-panel";
import { MigrateImagesPanel } from "./_components/migrate-images-panel";
import { VipSchedulePanel } from "./_components/vip-schedule-panel";
import { AdminCommunicationPanel } from "./_components/admin-communication-panel";
import { RunawayRevertPanel } from "./_components/runaway-revert-panel";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  Gift,
  Package,
  ShieldCheck,
  Swords,
  Trophy,
  Users
} from "lucide-react";
import { MatchStatus, TournamentStatus, UserStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getGlobalNotice } from "@/lib/app-settings";
import { ensureSyncChallengeItems } from "@/lib/sync-challenge";
import { adminListActiveVips, adminGetSchedule, adminListScheduleLabels } from "@/app/(app)/passe-apoiador/actions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";

const adminCards = [
  {
    href: "/torneios",
    title: "Gerenciar torneios",
    description: "Criar torneios, publicar, iniciar, editar dias e acessar resultados.",
    icon: Trophy
  },
  {
    href: "/jogadores",
    title: "Gerenciar jogadores",
    description: "Aprovar contas, editar perfis, resetar senhas e acompanhar status.",
    icon: Users
  },
  {
    href: "/codigos",
    title: "Banco de codigos",
    description: "Importar, enviar, revogar e revisar codigos de booster.",
    icon: Package
  },
  {
    href: "/caixa-de-presentes",
    title: "Presentes",
    description: "Verificar o fluxo de presentes e resgates dos jogadores.",
    icon: Gift
  },
  {
    href: "/ranking",
    title: "Ranking geral",
    description: "Conferir pontuacao global e filtros por temporada.",
    icon: BarChart3
  },
  {
    href: "/temporadas",
    title: "Temporadas",
    description: "Organizar grupos de campeonatos por temporada.",
    icon: Calendar
  }
];

export default async function AdminPage() {
  await requireAdmin();
  await prisma.$transaction((tx) => ensureSyncChallengeItems(tx));

  const [
    pendingUsers,
    activeTournaments,
    draftTournaments,
    pendingMatches,
    disputedMatches,
    availableCodes,
    invalidCodes,
    pendingDecks,
    recentAuditLogs,
    allPlayers,
    globalNotice,
  ] = await Promise.all([
    prisma.user.count({ where: { status: UserStatus.PENDING_APPROVAL } }),
    prisma.tournament.count({ where: { status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS] } } }),
    prisma.tournament.count({ where: { status: TournamentStatus.DRAFT } }),
    prisma.match.count({ where: { status: MatchStatus.PENDING_CONFIRMATION } }),
    prisma.match.count({ where: { status: MatchStatus.DISPUTED } }),
    prisma.boosterCode.count({ where: { status: "AVAILABLE" } }),
    prisma.boosterCode.count({ where: { status: "INVALIDATED" } }),
    prisma.deckSubmission.count({ where: { status: "SUBMITTED" } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true } } }
    }),
    prisma.player.findMany({
      where: { user: { status: UserStatus.ACTIVE } },
      select: { id: true, displayName: true, user: { select: { email: true } } },
      orderBy: { displayName: "asc" },
    }),
    getGlobalNotice(),
  ]);

  const vipsResult = await adminListActiveVips();
  // Carrega todos os schedules de todos os tipos de passe conhecidos
  const scheduleLabels = await adminListScheduleLabels();
  const allSchedules = await Promise.all(
    scheduleLabels.map(label => adminGetSchedule(label).then(r => ({
      label: r.label,
      schedule: r.schedule,
      isCustom: r.isCustom,
      allowRetroactiveClaims: r.allowRetroactiveClaims,
      displayTitle: r.displayTitle,
      description: r.description,
      flavorText: r.flavorText,
    })))
  );

  const allUsers = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, status: true }
  });

  const allShopItems = await prisma.shopItem.findMany({
    orderBy: [{ type: "asc" }, { active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, rarity: true, active: true }
  });

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">Painel Admin</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Central para operar torneios, jogadores, resultados, codigos, rankings e auditoria.
            </p>
          </div>
          <Link href="/torneios/novo">
            <Button className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
              Criar torneio
            </Button>
          </Link>
        </div>
      </div>

      {/* Ações prioritárias — itens que precisam de atenção do admin */}
      {(pendingUsers > 0 || pendingMatches > 0 || disputedMatches > 0 || pendingDecks > 0) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400">Ações pendentes</p>
          <div className="flex flex-wrap gap-2">
            {pendingUsers > 0 && (
              <Link href="/jogadores?status=PENDING_APPROVAL">
                <button className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors">
                  <ShieldCheck size={16} /> {pendingUsers} conta{pendingUsers > 1 ? "s" : ""} aguardando aprovação
                </button>
              </Link>
            )}
            {pendingMatches > 0 && (
              <Link href="/torneios">
                <button className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors">
                  <Swords size={16} /> {pendingMatches} partida{pendingMatches > 1 ? "s" : ""} aguardando confirmação
                </button>
              </Link>
            )}
            {disputedMatches > 0 && (
              <Link href="/torneios">
                <button className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors">
                  <AlertTriangle size={16} /> {disputedMatches} resultado{disputedMatches > 1 ? "s" : ""} disputado{disputedMatches > 1 ? "s" : ""}
                </button>
              </Link>
            )}
            {pendingDecks > 0 && (
              <Link href="/torneios">
                <button className="flex items-center gap-2 rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-3 py-2 text-sm font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/10 transition-colors">
                  <BookOpen size={16} /> {pendingDecks} deck{pendingDecks > 1 ? "s" : ""} enviado{pendingDecks > 1 ? "s" : ""} para revisar
                </button>
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/jogadores?status=PENDING_APPROVAL">
          <StatCard label="Contas pendentes" value={pendingUsers} icon={<ShieldCheck size={22} />} highlight={pendingUsers > 0} className="cursor-pointer transition-colors hover:border-[#FFCB05]/30" />
        </Link>
        <Link href="/torneios">
          <StatCard label="Torneios ativos" value={activeTournaments} icon={<Trophy size={22} />} className="cursor-pointer transition-colors hover:border-[#FFCB05]/30" />
        </Link>
        <Link href="/torneios">
          <StatCard label="Partidas p/ confirmar" value={pendingMatches} icon={<Swords size={22} />} highlight={pendingMatches > 0} className="cursor-pointer transition-colors hover:border-[#FFCB05]/30" />
        </Link>
        <Link href="/torneios">
          <StatCard label="Resultados disputados" value={disputedMatches} icon={<AlertTriangle size={22} />} highlight={disputedMatches > 0} className="cursor-pointer transition-colors hover:border-[#FFCB05]/30" />
        </Link>
        <Link href="/torneios">
          <StatCard label="Rascunhos" value={draftTournaments} icon={<BookOpen size={22} />} className="cursor-pointer transition-colors hover:border-[#FFCB05]/30" />
        </Link>
        <Link href="/torneios">
          <StatCard label="Decks p/ revisar" value={pendingDecks} icon={<BookOpen size={22} />} highlight={pendingDecks > 0} className="cursor-pointer transition-colors hover:border-[#FFCB05]/30" />
        </Link>
        <Link href="/codigos">
          <StatCard label="Codigos disponiveis" value={availableCodes} icon={<Package size={22} />} className="cursor-pointer transition-colors hover:border-[#FFCB05]/30" />
        </Link>
        <Link href="/codigos">
          <StatCard label="Codigos invalidos" value={invalidCodes} icon={<AlertTriangle size={22} />} highlight={invalidCodes > 0} className="cursor-pointer transition-colors hover:border-[#FFCB05]/30" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminCards.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:border-[#FFCB05]/30 hover:bg-slate-900/80">
              <Icon size={22} className="mb-3 text-[#FFCB05]" />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-2">{description}</CardDescription>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardTitle className="mb-4 text-base">Ultimas acoes registradas</CardTitle>
        {recentAuditLogs.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma acao registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentAuditLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">{log.action}</p>
                  <p className="text-xs text-slate-500">
                    {log.entityType} - {log.actor?.name ?? log.actor?.email ?? "Sistema"}
                  </p>
                </div>
                <time className="text-xs text-slate-500">
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <UserAccountPanel users={allUsers} />
      <AdminCommunicationPanel initialNotice={globalNotice.message} />
      <RunawayRevertPanel />
      <MascotSocialPanel players={allPlayers.map(p => ({ id: p.id, displayName: p.displayName }))} />
      <AdminExpeditionPanel players={allPlayers.map(p => ({ id: p.id, displayName: p.displayName }))} />
      <AdminMascotPanel players={allPlayers.map(p => ({ id: p.id, displayName: p.displayName }))} />
      <BulkSendPanel items={allShopItems} />
      <DeckReminderPanel players={allPlayers.map((p) => ({ id: p.id, displayName: p.displayName, email: p.user.email ?? null }))} />
      <VipSchedulePanel
        allSchedules={allSchedules}
        players={allPlayers.map(p => ({ id: p.id, displayName: p.displayName }))}
        activeVips={(vipsResult.passes ?? []).map(p => ({
          passId: p.id,
          displayName: p.player.displayName,
          passLabel: p.passLabel ?? "Passe Apoiador",
          expiresAt: p.expiresAt,
          totalDays: Math.max(1, Math.min(30, Math.ceil((new Date(p.expiresAt).getTime() - new Date(p.startsAt).getTime()) / 86400000))),
          daysRemaining: Math.max(0, Math.ceil((new Date(p.expiresAt).getTime() - Date.now()) / 86400000)),
          claimedDays: p.claimsCount,
          allowRetroactiveClaims: p.allowRetroactiveClaims,
        }))}
      />
      <MigrateImagesPanel />

      {/* ── Referência: IDs especiais de Pokémon ── */}
      <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[#FFCB05]" />
          <h3 className="font-semibold text-slate-200">Referência — IDs especiais de Pokémon</h3>
        </div>
        <p className="text-xs text-slate-500">
          IDs fora do range 1–1025 usados no sistema de mascotes. Use-os no painel "Adicionar Mascote" ou nos pools de ovo.
          Lendários (marcados ★) entram no pool lendário e ganham +30% de pontos de stat por nível.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-slate-500">
                <th className="pb-2 pr-4 font-semibold">ID</th>
                <th className="pb-2 pr-4 font-semibold">Nome</th>
                <th className="pb-2 pr-4 font-semibold">Tipos</th>
                <th className="pb-2 pr-4 font-semibold">Lendário</th>
                <th className="pb-2 font-semibold">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                // ── Formas especiais clássicas ──────────────────────────────────
                { id: 10004, name: "Wormadam-Arenosa",   types: "Bug / Ground",          legendary: false, note: "Wormadam capa de areia" },
                { id: 10005, name: "Wormadam-Lata",      types: "Bug / Steel",           legendary: false, note: "Wormadam capa de lata" },
                { id: 10006, name: "Shaymin-Céu",        types: "Grass / Flying",        legendary: true,  note: "Forma celeste do Shaymin" },
                { id: 10007, name: "Giratina-Origem",    types: "Ghost / Dragon",        legendary: true,  note: "Forma de origem do Giratina" },
                { id: 10008, name: "Rotom-Calor",        types: "Electric / Fire",       legendary: false, note: "Forma do forno micro-ondas" },
                { id: 10009, name: "Rotom-Lavagem",      types: "Electric / Water",      legendary: false, note: "Forma da lavadora" },
                { id: 10010, name: "Rotom-Gelo",         types: "Electric / Ice",        legendary: false, note: "Forma da geladeira" },
                { id: 10011, name: "Rotom-Ventilador",   types: "Electric / Flying",     legendary: false, note: "Forma do ventilador" },
                { id: 10012, name: "Rotom-Corte",        types: "Electric / Grass",      legendary: false, note: "Forma do cortador de grama" },
                // ── Formas Alolan (Gen 7) ────────────────────────────────────────
                { id: 10091, name: "Rattata-Alola",      types: "Dark / Normal",         legendary: false, note: "Base — evolui em 10092 (Nv.20)" },
                { id: 10092, name: "Raticate-Alola",     types: "Dark / Normal",         legendary: false, note: "Evolução de 10091" },
                { id: 10100, name: "Raichu-Alola",       types: "Electric / Psychic",    legendary: false, note: "Evolução de Pikachu (25)" },
                { id: 10101, name: "Sandshrew-Alola",    types: "Ice / Steel",           legendary: false, note: "Base — evolui em 10102 (Nv.22)" },
                { id: 10102, name: "Sandslash-Alola",    types: "Ice / Steel",           legendary: false, note: "Evolução de 10101" },
                { id: 10103, name: "Vulpix-Alola",       types: "Ice",                   legendary: false, note: "Base — evolui em 10104 (Nv.36)" },
                { id: 10104, name: "Ninetales-Alola",    types: "Ice / Fairy",           legendary: false, note: "Evolução de 10103" },
                { id: 10105, name: "Diglett-Alola",      types: "Ground / Steel",        legendary: false, note: "Base — evolui em 10106 (Nv.26)" },
                { id: 10106, name: "Dugtrio-Alola",      types: "Ground / Steel",        legendary: false, note: "Evolução de 10105" },
                { id: 10107, name: "Meowth-Alola",       types: "Dark",                  legendary: false, note: "Base — evolui em 10108 (Nv.28)" },
                { id: 10108, name: "Persian-Alola",      types: "Dark",                  legendary: false, note: "Evolução de 10107" },
                { id: 10109, name: "Geodude-Alola",      types: "Rock / Electric",       legendary: false, note: "Base — evolui em 10110 (Nv.25)" },
                { id: 10110, name: "Graveler-Alola",     types: "Rock / Electric",       legendary: false, note: "Evolução de 10109 — evolui em 10111 (Nv.36)" },
                { id: 10111, name: "Golem-Alola",        types: "Rock / Electric",       legendary: false, note: "Evolução de 10110" },
                { id: 10112, name: "Grimer-Alola",       types: "Poison / Dark",         legendary: false, note: "Base — evolui em 10113 (Nv.38)" },
                { id: 10113, name: "Muk-Alola",          types: "Poison / Dark",         legendary: false, note: "Evolução de 10112" },
                { id: 10114, name: "Exeggutor-Alola",    types: "Grass / Dragon",        legendary: false, note: "Forma final (evolui de Exeggcute 102)" },
                { id: 10115, name: "Marowak-Alola",      types: "Fire / Ghost",          legendary: false, note: "Forma final (evolui de Cubone 104)" },
                // ── Formas Galar (Gen 8) ─────────────────────────────────────────
                { id: 10158, name: "Meowth-Galar",       types: "Steel",                 legendary: false, note: "Base — evolui em Perrserker 863 (Nv.28)" },
                { id: 10159, name: "Ponyta-Galar",       types: "Psychic",               legendary: false, note: "Base — evolui em 10160 (Nv.40)" },
                { id: 10160, name: "Rapidash-Galar",     types: "Psychic / Fairy",       legendary: false, note: "Evolução de 10159" },
                { id: 10161, name: "Slowpoke-Galar",     types: "Psychic",               legendary: false, note: "Base — evolui em 10162 (Nv.37)" },
                { id: 10162, name: "Slowbro-Galar",      types: "Poison / Psychic",      legendary: false, note: "Evolução de 10161" },
                { id: 10163, name: "Farfetch'd-Galar",   types: "Fighting",              legendary: false, note: "Base — evolui em Sirfetch'd 865 (Nv.30)" },
                { id: 10164, name: "Weezing-Galar",      types: "Poison / Fairy",        legendary: false, note: "Forma final (sem evolução)" },
                { id: 10165, name: "Mr. Mime-Galar",     types: "Ice / Psychic",         legendary: false, note: "Base — evolui em Mr. Rime 866 (Nv.42)" },
                { id: 10166, name: "Articuno-Galar",     types: "Psychic / Flying",      legendary: true,  note: "Lendário Galar" },
                { id: 10167, name: "Zapdos-Galar",       types: "Fighting / Flying",     legendary: true,  note: "Lendário Galar" },
                { id: 10168, name: "Moltres-Galar",      types: "Dark / Flying",         legendary: true,  note: "Lendário Galar" },
                { id: 10169, name: "Slowking-Galar",     types: "Poison / Psychic",      legendary: false, note: "Evolução alternativa de 10161" },
                { id: 10170, name: "Corsola-Galar",      types: "Ghost",                 legendary: false, note: "Base — evolui em Cursola 864 (Nv.38)" },
                { id: 10171, name: "Zigzagoon-Galar",    types: "Dark / Normal",         legendary: false, note: "Base — evolui em 10172 (Nv.20)" },
                { id: 10172, name: "Linoone-Galar",      types: "Dark / Normal",         legendary: false, note: "Evolução de 10171 — evolui em Obstagoon 862 (Nv.35)" },
                { id: 10173, name: "Darumaka-Galar",     types: "Ice",                   legendary: false, note: "Base — evolui em 10174 (Nv.38)" },
                { id: 10174, name: "Darmanitan-Galar",   types: "Ice",                   legendary: false, note: "Evolução de 10173" },
                { id: 10175, name: "Yamask-Galar",       types: "Ground / Ghost",        legendary: false, note: "Base — evolui em Runerigus 867 (Nv.34)" },
                { id: 10176, name: "Stunfisk-Galar",     types: "Ground / Steel",        legendary: false, note: "Forma final (sem evolução)" },
                // ── Formas Hisui (Lendas Pokémon: Arceus) ───────────────────────
                { id: 10229, name: "Growlithe-Hisui",    types: "Fire / Rock",           legendary: false, note: "Base — evolui em 10230 (Nv.38)" },
                { id: 10230, name: "Arcanine-Hisui",     types: "Fire / Rock",           legendary: false, note: "Evolução de 10229" },
                { id: 10231, name: "Voltorb-Hisui",      types: "Electric / Grass",      legendary: false, note: "Base — evolui em 10232 (Nv.30)" },
                { id: 10232, name: "Electrode-Hisui",    types: "Electric / Grass",      legendary: false, note: "Evolução de 10231" },
                { id: 10233, name: "Typhlosion-Hisui",   types: "Fire / Ghost",          legendary: false, note: "Forma final Hisui de Cyndaquil (155)" },
                { id: 10234, name: "Qwilfish-Hisui",     types: "Dark / Poison",         legendary: false, note: "Base — evolui em Overqwil 904 (Nv.40)" },
                { id: 10235, name: "Sneasel-Hisui",      types: "Fighting / Poison",     legendary: false, note: "Base — evolui em Sneasler 903 (Nv.40)" },
                { id: 10236, name: "Samurott-Hisui",     types: "Water / Dark",          legendary: false, note: "Forma final Hisui de Oshawott (501)" },
                { id: 10237, name: "Lilligant-Hisui",    types: "Grass / Fighting",      legendary: false, note: "Forma final Hisui de Petilil (548)" },
                { id: 10238, name: "Zorua-Hisui",        types: "Normal / Ghost",        legendary: false, note: "Base — evolui em 10239 (Nv.30)" },
                { id: 10239, name: "Zoroark-Hisui",      types: "Normal / Ghost",        legendary: false, note: "Evolução de 10238" },
                { id: 10240, name: "Braviary-Hisui",     types: "Psychic / Flying",      legendary: false, note: "Forma final Hisui de Rufflet (627)" },
                { id: 10241, name: "Sliggoo-Hisui",      types: "Steel / Dragon",        legendary: false, note: "Evolução de Goomy 704 (forma Hisui)" },
                { id: 10242, name: "Goodra-Hisui",       types: "Steel / Dragon",        legendary: false, note: "Evolução de 10241" },
                { id: 10243, name: "Avalugg-Hisui",      types: "Ice / Rock",            legendary: false, note: "Evolução de Bergmite 712 (forma Hisui)" },
                { id: 10244, name: "Decidueye-Hisui",    types: "Grass / Fighting",      legendary: false, note: "Forma final Hisui de Rowlet (722)" },
              ].map(row => (
                <tr key={row.id} className="text-slate-300">
                  <td className="py-2 pr-4 font-mono text-[#FFCB05]">{row.id}</td>
                  <td className="py-2 pr-4 font-medium">{row.name}</td>
                  <td className="py-2 pr-4 text-slate-400">{row.types}</td>
                  <td className="py-2 pr-4 text-center">{row.legendary ? <span className="text-yellow-400">★</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-2 text-slate-500">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-600">
          SQL de referência: <code className="bg-slate-800 px-1 rounded">SELECT id, &quot;displayName&quot; FROM players WHERE &quot;displayName&quot; ILIKE &apos;%nome%&apos;;</code>
        </p>
      </div>

      <GlobalResetPanel />
    </div>
  );
}
