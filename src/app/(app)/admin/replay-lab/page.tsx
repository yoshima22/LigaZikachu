import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { getStaticSpriteUrl } from "@/lib/mascot-data";
import { type Combatant, type ReplayTurn } from "@/components/replay/replay-canvas";
import { ReplayLabClient } from "./_components/replay-lab-client";
import { listLeagueReplays } from "./actions";

// Preview ISOLADO do replay animado (admin-only). Usa sprites reais e uma
// batalha roteirizada que demonstra: ataques por tipo (raio/projétil/corpo),
// super-eficácia, cura (Cuidador), debuff (Oportunista), interceptação
// (Guardião) e nocaute. Nada aqui toca em dados reais ou no motor de combate.

const MAX_HP = 100;
function mk(id: string, name: string, pokemonId: number, type: string, side: "A" | "B", role: string): Combatant {
  return { id, name, pokemonId, type, side, role, maxHp: MAX_HP, sprite: getStaticSpriteUrl(pokemonId) };
}

const teams: Combatant[] = [
  mk("a1", "Charizard", 6, "fire", "A", "Atacante"),
  mk("a2", "Blastoise", 9, "water", "A", "Defensor"),
  mk("a3", "Alakazam", 65, "psychic", "A", "Cuidador"),
  mk("b1", "Venusaur", 3, "grass", "B", "Guardião"),
  mk("b2", "Golem", 76, "rock", "B", "Defensor"),
  mk("b3", "Gengar", 94, "ghost", "B", "Oportunista"),
];

const turns: ReplayTurn[] = [
  { turn: 1, actorId: "b1", targetId: "a2", action: "ATTACK", attackerType: "grass", damage: 28, advantageApplied: true, multiplier: 1.5, targetHpAfter: 72, abilityName: "Folha Navalha" },
  { turn: 2, actorId: "a1", targetId: "b1", action: "ATTACK", attackerType: "fire", damage: 34, advantageApplied: true, multiplier: 1.5, targetHpAfter: 66, abilityName: "Lança-Chamas" },
  { turn: 3, actorId: "b2", targetId: "a1", action: "ATTACK", attackerType: "rock", damage: 30, advantageApplied: true, multiplier: 1.5, targetHpAfter: 70, abilityName: "Rocha Veloz" },
  { turn: 4, actorId: "a3", targetId: "a1", action: "HEAL", damage: 20, actorRole: "HEALER", targetHpAfter: 90, abilityName: "Cuidar" },
  { turn: 5, actorId: "a3", targetId: "b3", action: "ATTACK", attackerType: "psychic", damage: 18, targetHpAfter: 82, abilityName: "Psíquico" },
  { turn: 6, actorId: "b3", targetId: "a3", action: "ABILITY", actorRole: "OPPORTUNIST", debuff: true, damage: 0, targetHpAfter: 100, effect: "Reduz precisão", abilityName: "Olhar Maligno" },
  { turn: 7, actorId: "a2", targetId: "b2", action: "ATTACK", attackerType: "water", damage: 26, advantageApplied: true, multiplier: 1.5, targetHpAfter: 74, guardianInterceptId: "b1", guardianHpAfter: 56, guardianInterceptDamage: 10, abilityName: "Hidro Bomba" },
  { turn: 8, actorId: "a1", targetId: "b1", action: "ATTACK", attackerType: "fire", damage: 56, advantageApplied: true, multiplier: 1.5, targetHpAfter: 0, abilityName: "Rajada de Fogo" },
  { turn: 9, actorId: "a2", targetId: "b2", action: "ATTACK", attackerType: "water", damage: 36, advantageApplied: true, multiplier: 1.5, targetHpAfter: 38, abilityName: "Surf" },
  { turn: 10, actorId: "b2", targetId: "a2", action: "ATTACK", attackerType: "rock", damage: 16, targetHpAfter: 56, abilityName: "Deslizamento" },
  { turn: 11, actorId: "a3", targetId: "b3", action: "ATTACK", attackerType: "psychic", damage: 20, targetHpAfter: 62, abilityName: "Confusão" },
  { turn: 12, actorId: "b3", targetId: "a3", action: "ATTACK", attackerType: "ghost", damage: 30, advantageApplied: true, multiplier: 1.5, targetHpAfter: 70, abilityName: "Bola Sombria" },
];

// Troque este arquivo para ver a arena de fundo (fallback procedural se faltar).
const ARENA_BG = "/replay-lab/arena.webp";

export default async function ReplayLabPage() {
  await requirePlatformAdmin();
  const games = await listLeagueReplays();
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"><ArrowLeft size={14} /> Admin</Link>
        <h1 className="mt-2 text-xl font-bold text-white">Laboratório de Replay Animado</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Prévia isolada de como ficariam os replays de combate com sprites 2D se movendo pela arena, efeitos por tipo de ataque e feedback visual de Cuidador (cura), Oportunista (debuff) e Guardião (interceptação). Escolha a batalha de exemplo ou um jogo real da Liga Semanal (inclusive 6×6 e modos sem habilidades).
        </p>
      </div>
      <ReplayLabClient sample={{ teams, turns, bgUrl: ARENA_BG, winnerName: "Time Vermelho" }} games={games} />
      <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-xs text-slate-400 sm:grid-cols-2">
        <p><span className="text-cyan-300">Raio</span> — elétrico, água, gelo, dragão, psíquico.</p>
        <p><span className="text-orange-300">Projétil</span> — fogo, grama, veneno, fantasma, fada, inseto.</p>
        <p><span className="text-red-300">Corpo-a-corpo</span> — lutador, pedra, terra, aço, normal, voador.</p>
        <p><span className="text-emerald-300">+ verde</span> cura do Cuidador · <span className="text-purple-300">DEBUFF roxo</span> do Oportunista · <span className="text-sky-300">🛡 escudo</span> do Guardião.</p>
      </div>
    </div>
  );
}
