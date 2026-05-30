"use client";

import { Brain, Circle, Diamond, Droplet, Dumbbell, Flame, Heart, Leaf, Moon, Shield, Zap } from "lucide-react";

export const pokemonTypes = [
  { value: "Grass",     label: "Grama",    icon: Leaf,     className: "bg-emerald-500 text-emerald-950" },
  { value: "Fire",      label: "Fogo",     icon: Flame,    className: "bg-orange-500 text-orange-950" },
  { value: "Water",     label: "Água",     icon: Droplet,  className: "bg-sky-500 text-sky-950" },
  { value: "Lightning", label: "Elétrico", icon: Zap,      className: "bg-yellow-300 text-yellow-950" },
  { value: "Fighting",  label: "Lutador",  icon: Dumbbell, className: "bg-amber-700 text-amber-50" },
  { value: "Psychic",   label: "Psíquico", icon: Brain,    className: "bg-fuchsia-500 text-fuchsia-950" },
  { value: "Colorless", label: "Incolor",  icon: Circle,   className: "bg-slate-200 text-slate-900" },
  { value: "Darkness",  label: "Noturno",  icon: Moon,     className: "bg-zinc-800 text-zinc-100" },
  { value: "Metal",     label: "Metálico", icon: Shield,   className: "bg-slate-400 text-slate-950" },
  { value: "Dragon",    label: "Dragão",   icon: Diamond,  className: "bg-indigo-500 text-indigo-50" },
  { value: "Fairy",     label: "Fada",     icon: Heart,    className: "bg-pink-300 text-pink-950" }
];

interface Props {
  selected: string[];
  onChange: (types: string[]) => void;
}

export function PokemonTypeSelector({ selected, onChange }: Props) {
  const toggle = (value: string) =>
    onChange(
      selected.includes(value)
        ? selected.filter((t) => t !== value)
        : [...selected, value]
    );

  return (
    <div>
      <p className="mb-1.5 text-xs text-slate-400">Tipos do deck</p>
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 sm:grid-cols-4">
        {pokemonTypes.map((type) => {
          const active = selected.includes(type.value);
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => toggle(type.value)}
              className={[
                "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition",
                active
                  ? "border-[#FFCB05] bg-[#FFCB05]/10 text-white"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600"
              ].join(" ")}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${type.className}`}>
                <Icon size={13} strokeWidth={2.4} />
              </span>
              <span>{type.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-slate-500">Selecione um ou mais tipos presentes no deck.</p>
    </div>
  );
}
