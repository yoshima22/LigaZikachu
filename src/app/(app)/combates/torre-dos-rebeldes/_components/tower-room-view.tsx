"use client";

type Exploration = NonNullable<Extract<Awaited<ReturnType<typeof import("../actions").getTowerRunStateAction>>, { ok: true }>["exploration"]>;

const kindLabel: Record<string, string> = { ENTRANCE: "Entrada", PUZZLE: "Enigma", COMBAT: "Combate", REST: "Descanso", EVENT: "Evento", BOSS: "Líder do andar" };

export function TowerRoomView({ exploration, routeId, puzzleChoice, disabled, onRoute, onPuzzle }: { exploration: Exploration; routeId?: string; puzzleChoice?: string; disabled: boolean; onRoute: (id: string) => void; onPuzzle: (id: string) => void }) {
  const room = exploration.currentRoom;
  return <div className="space-y-4">
    <div className="relative min-h-[390px] overflow-hidden rounded-3xl border border-purple-400/35 bg-slate-950 shadow-[0_0_42px_rgba(126,34,206,.2)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={room.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-purple-950/20" />
      <div className="relative flex min-h-[390px] flex-col justify-between p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><span className="rounded-full border border-purple-300/30 bg-purple-950/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-purple-200">{kindLabel[room.kind] ?? room.kind}</span><h2 className="mt-3 text-2xl font-black text-white">{room.title}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200">{room.description}</p></div>
          <div className="rounded-2xl border border-red-400/30 bg-red-950/65 px-4 py-3 text-right"><p className="text-[9px] font-black uppercase tracking-widest text-red-300">Pressão da Torre</p><p className="text-2xl font-black text-red-200">{exploration.pressure}</p></div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{exploration.rooms.map((node) => <div key={node.id} className={`rounded-xl border px-3 py-2 text-xs ${node.current ? "border-[#FFCB05] bg-[#FFCB05]/15 text-[#FFCB05]" : node.visited ? "border-purple-400/35 bg-purple-950/55 text-purple-100" : "border-slate-700 bg-slate-950/75 text-slate-500"}`}><b>{node.title}</b><span className="ml-2 text-[9px] uppercase">{node.current ? "Você está aqui" : node.cleared ? "Concluída" : node.visited ? "Visitada" : "Desconhecida"}</span></div>)}</div>
      </div>
    </div>

    {exploration.modifiers.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{exploration.modifiers.map((mod) => <div key={mod.key} className="rounded-xl border border-red-400/25 bg-red-950/20 p-3"><b className="text-sm text-red-200">⚠ {mod.name}</b><p className="mt-1 text-xs text-red-100/70">{mod.description}</p></div>)}</div>}

    {!room.cleared && room.kind === "PUZZLE" && room.puzzle && <div className="rounded-2xl border border-amber-300/30 bg-amber-950/15 p-5"><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Enigma coletivo</p><h3 className="mt-2 font-bold text-white">{room.puzzle.prompt}</h3><p className="mt-1 text-xs text-slate-400">A Torre não explica suas regras. Descobertas corretas entram no arquivo comunitário para as próximas runs.</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{room.puzzle.options.map((option) => <button type="button" disabled={disabled} key={option.id} onClick={() => onPuzzle(option.id)} className={`rounded-xl border p-3 text-sm font-bold ${puzzleChoice === option.id ? "border-amber-300 bg-amber-300/20 text-amber-100" : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-amber-300/50"}`}>{option.label}</button>)}</div></div>}

    {room.cleared && exploration.routes.length > 0 && <div className="rounded-2xl border border-cyan-300/25 bg-cyan-950/10 p-5"><p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Escolha coletiva da rota</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{exploration.routes.map((route) => route && <button type="button" disabled={disabled} key={route.id} onClick={() => onRoute(route.id)} className={`rounded-xl border p-4 text-left ${routeId === route.id ? "border-cyan-300 bg-cyan-300/15" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`}><b className="text-white">{route.title}</b><p className="mt-1 text-xs text-slate-400">{kindLabel[route.kind] ?? route.kind} · {route.visited ? "rota conhecida" : "conteúdo desconhecido"}</p></button>)}</div></div>}

    {!room.cleared && room.kind !== "PUZZLE" && <div className="rounded-2xl border border-purple-400/25 bg-purple-950/15 p-4 text-sm text-purple-100">{room.kind === "REST" ? "Confirme para investigar a chama e descansar." : "Confirme para entrar. Se houver inimigos, o combate convencional será registrado e exibido em replay completo."}</div>}
  </div>;
}
