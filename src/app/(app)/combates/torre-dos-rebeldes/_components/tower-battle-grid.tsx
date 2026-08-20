"use client";

// Renderiza a sala da Torre com fog de time. Casas nunca vistas ficam ocultas;
// vistas antes (descobertas) aparecem esmaecidas; visíveis agora, normais.
// Aliados sempre aparecem; inimigos só nas casas visíveis (o servidor já filtra).

type Unit = { id: string; team: string; name: string; pokemonId: number; x: number; y: number; hp: number; maxHp: number; role: string };
type Battle = {
  room: { width: number; height: number; blocked: string[] };
  discovered: string[]; visible: string[];
  units: Unit[]; over: boolean; outcome: "WIN" | "LOSS" | null;
};

const TILE = 20;

export function TowerBattleGrid({ battle }: { battle: Battle }) {
  const { width, height } = battle.room;
  const blocked = new Set(battle.room.blocked);
  const discovered = new Set(battle.discovered);
  const visible = new Set(battle.visible);
  const unitAt = new Map<string, Unit>();
  for (const u of battle.units) if (u.hp > 0) unitAt.set(`${u.x}:${u.y}`, u);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-black/60 p-2">
      <div
        className="relative mx-auto"
        style={{ width: width * TILE, height: height * TILE, display: "grid", gridTemplateColumns: `repeat(${width}, ${TILE}px)`, gridTemplateRows: `repeat(${height}, ${TILE}px)` }}
      >
        {Array.from({ length: width * height }).map((_, i) => {
          const x = i % width, y = Math.floor(i / width);
          const key = `${x}:${y}`;
          const isVisible = visible.has(key);
          const isKnown = discovered.has(key);
          const isWall = blocked.has(key);
          const unit = unitAt.get(key);
          let bg = "#05060a"; // desconhecido (fog cheio)
          if (isKnown) bg = isWall ? "#3a3550" : isVisible ? "#171a2b" : "#0d0f18";
          return (
            <div key={i} style={{ background: bg, outline: "1px solid rgba(255,255,255,0.03)", position: "relative" }}>
              {unit && (
                <span
                  title={`${unit.name} · ${unit.hp}/${unit.maxHp} HP`}
                  style={{
                    position: "absolute", inset: 2, borderRadius: "50%",
                    background: unit.team === "ALLY" ? "#3b82f6" : "#ef4444",
                    boxShadow: `0 0 0 1px ${unit.team === "ALLY" ? "#93c5fd" : "#fca5a5"}`,
                    display: "grid", placeItems: "center", fontSize: 8, fontWeight: 700, color: "#fff",
                  }}
                >
                  {unit.team === "ALLY" ? "A" : "E"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-500">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#3b82f6" }} />Aliado</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#ef4444" }} />Inimigo (visível)</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 align-middle" style={{ background: "#3a3550" }} />Parede</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 align-middle" style={{ background: "#05060a", outline: "1px solid #222" }} />Névoa</span>
      </div>
    </div>
  );
}
