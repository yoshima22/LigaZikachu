import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { getStaticSpriteUrl } from "@/lib/mascot-data";
import { ReplayCanvas, type Combatant, type ReplayTurn } from "./_components/replay-canvas";

// Preview ISOLADO do replay animado (admin-only). Usa sprites reais e uma
// batalha roteirizada que demonstra: ataques por tipo (raio/projétil/corpo),
// super-eficácia, cura (Cuidador), debuff (Oportunista), interceptação
// (Guardião) e nocaute. Nada aqui toca em dados reais ou no motor de combate.

const MAX_HP = 100;
function mk(id: string, name: string, pokemonId: number, type: string, side: "A" | "B"): Combatant {
  return { id, name, pokemonId, type, side, maxHp: MAX_HP, sprite: getStaticSpriteUrl(pokemonId) };
}

const teams: Combatant[] = [
  mk("a1", "Charizard", 6, "fire", "A"),
  mk("a2", "Blastoise", 9, "water", "A"),
  mk("a3", "Alakazam", 65, "psychic", "A"),
  mk("b1", "Venusaur", 3, "grass", "B"),
  mk("b2", "Golem", 76, "rock", "B"),
  mk("b3", "Gengar", 94, "ghost", "B"),
];

const turns: ReplayTurn[] = [
  { turn: 1, actorId: "b1", targetId: "a2", action: "ATTACK", attackerType: "grass", damage: 28, advantageApplied: true, targetHpAfter: 72, abilityName: "Folha Navalha" },
  { turn: 2, actorId: "a1", targetId: "b1", action: "ATTACK", attackerType: "fire", damage: 34, advantageApplied: true, targetHpAfter: 66, abilityName: "Lança-Chamas" },
  { turn: 3, actorId: "b2", targetId: "a1", action: "ATTACK", attackerType: "rock", damage: 30, advantageApplied: true, targetHpAfter: 70, abilityName: "Rocha Veloz" },
  { turn: 4, actorId: "a3", targetId: "a1", action: "HEAL", damage: 20, actorRole: "HEALER", targetHpAfter: 90, abilityName: "Cuidar" },
  { turn: 5, actorId: "a3", targetId: "b3", action: "ATTACK", attackerType: "psychic", damage: 18, targetHpAfter: 82, abilityName: "Psíquico" },
  { turn: 6, actorId: "b3", targetId: "a3", action: "ABILITY", actorRole: "OPPORTUNIST", debuff: true, damage: 0, targetHpAfter: 100, effect: "Reduz precisão", abilityName: "Olhar Maligno" },
  { turn: 7, actorId: "a2", targetId: "b2", action: "ATTACK", attackerType: "water", damage: 26, advantageApplied: true, guardianInterceptId: "b1", targetHpAfter: 40, abilityName: "Hidro Bomba" },
  { turn: 8, actorId: "a1", targetId: "b1", action: "ATTACK", attackerType: "fire", damage: 40, advantageApplied: true, targetHpAfter: 0, abilityName: "Rajada de Fogo" },
  { turn: 9, actorId: "a2", targetId: "b2", action: "ATTACK", attackerType: "water", damage: 36, advantageApplied: true, targetHpAfter: 4, abilityName: "Surf" },
  { turn: 10, actorId: "b2", targetId: "a2", action: "ATTACK", attackerType: "rock", damage: 16, targetHpAfter: 56, abilityName: "Deslizamento" },
  { turn: 11, actorId: "a3", targetId: "b3", action: "ATTACK", attackerType: "psychic", damage: 20, targetHpAfter: 62, abilityName: "Confusão" },
  { turn: 12, actorId: "b3", targetId: "a3", action: "ATTACK", attackerType: "ghost", damage: 30, advantageApplied: true, targetHpAfter: 70, abilityName: "Bola Sombria" },
];

// Troque este arquivo para ver a arena de fundo (fallback procedural se faltar).
const ARENA_BG = "/replay-lab/arena.png";

export default async function ReplayLabPage() {
  await requirePlatformAdmin();
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"><ArrowLeft size={14} /> Admin</Link>
        <h1 className="mt-2 text-xl font-bold text-white">Laboratório de Replay Animado</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Prévia isolada de como ficariam os replays de combate com sprites 2D se movendo pela arena, efeitos por tipo de ataque e feedback visual de Cuidador (cura), Oportunista (debuff) e Guardião (interceptação). Batalha de exemplo roteirizada — não altera nada real.
        </p>
      </div>
      <ReplayCanvas data={{ teams, turns, bgUrl: ARENA_BG }} />
      <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-xs text-slate-400 sm:grid-cols-2">
        <p><span className="text-cyan-300">Raio</span> — elétrico, água, gelo, dragão, psíquico.</p>
        <p><span className="text-orange-300">Projétil</span> — fogo, grama, veneno, fantasma, fada, inseto.</p>
        <p><span className="text-red-300">Corpo-a-corpo</span> — lutador, pedra, terra, aço, normal, voador.</p>
        <p><span className="text-emerald-300">+ verde</span> cura do Cuidador · <span className="text-purple-300">DEBUFF roxo</span> do Oportunista · <span className="text-sky-300">🛡 escudo</span> do Guardião.</p>
      </div>
    </div>
  );
}
