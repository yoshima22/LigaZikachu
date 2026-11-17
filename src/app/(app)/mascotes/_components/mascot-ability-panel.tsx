"use client";

import { KeywordText } from "@/components/keyword-text";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  availableAbilities, describeAbility, describeAbilityAt, getAbilityInfo, getSpeciesAbilities, resolveAbilitySlug,
  type Stats,
} from "@/lib/abilities";
import { abilityTmItemName } from "@/lib/abilities/tm";
import { ABILITY_CATEGORY_STYLE } from "@/lib/abilities/style";
import { TYPE_LABELS_PT } from "@/lib/mascot-data";
import { setMascotAbilityAction, setMascotAbilityTypeAction } from "../actions";

export function MascotAbilityPanel({
  mascotId, pokemonId, hiddenAbilityUnlocked, abilityChoice, abilityTypeChoice, stats, pokedex,
}: {
  mascotId: string;
  pokemonId: number;
  hiddenAbilityUnlocked: boolean;
  abilityChoice: string | null;
  abilityTypeChoice?: string | null;
  stats: Stats;
  pokedex: { url: string | null; note: string | null } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<string | null>(abilityChoice);
  const [typeChoice, setTypeChoice] = useState<string | null>(abilityTypeChoice ?? null);
  const options = availableAbilities(pokemonId, hiddenAbilityUnlocked, "REAL");
  const current = resolveAbilitySlug({ pokemonId, choice, hiddenUnlocked: hiddenAbilityUnlocked, mode: "REAL" });
  const info = getAbilityInfo(current);
  const hidden = getSpeciesAbilities(pokemonId).hidden;
  const lockedHidden = hidden && !options.includes(hidden) ? getAbilityInfo(hidden) : null;

  const change = (slug: string) =>
    start(async () => {
      const res = await setMascotAbilityAction(mascotId, slug);
      if (res.error) toast.error(res.error);
      else { setChoice(slug); setTypeChoice(null); toast.success("Habilidade trocada."); router.refresh(); }
    });

  const changeType = (type: string) =>
    start(async () => {
      const res = await setMascotAbilityTypeAction(mascotId, type || null);
      if (res.error) toast.error(res.error);
      else { setTypeChoice(type || null); toast.success(type ? "Tipo escolhido." : "Tipo original restaurado."); router.refresh(); }
    });

  if (!info && !lockedHidden) return null;
  return (
    <div className="mt-1.5 rounded-lg border border-white/10 bg-slate-950/50 p-2 text-[10px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Habilidade</span>
        {info ? (
          <>
            <b className="text-xs text-white">{info.name}</b>
            {info.category && (
              <span className={`rounded border px-1 py-px text-[8px] font-bold ${ABILITY_CATEGORY_STYLE[info.category]}`}>{info.category}</span>
            )}
            {info.hasEffect && <span className="text-slate-500">{info.activations > 0 ? `${info.activations} ativações/luta` : "passiva"} · {info.trigger}</span>}
          </>
        ) : <span className="text-slate-500">—</span>}
        {pokedex && (
          pokedex.url ? (
            <a href={pokedex.url} target="_blank" rel="noreferrer" title={`Ver na Pokédex oficial${pokedex.note ? ` — ${pokedex.note}` : ""}`}
              className="ml-auto rounded p-1 text-slate-500 hover:bg-white/5 hover:text-cyan-300"><ExternalLink size={11} /></a>
          ) : (
            <span className="ml-auto text-[9px] text-slate-600" title={pokedex.note ?? undefined}>exclusiva do jogo</span>
          )
        )}
      </div>
      {info?.dex && <p className="mt-1 text-[9px] text-slate-500">Na Pokédex: {info.dex}</p>}
      {info && <p className="mt-0.5 leading-snug text-slate-300"><KeywordText text={info.hasEffect ? describeAbilityAt(info, stats) : describeAbility(info)} /></p>}
      {info?.hasEffect && info.scale && (
        <p className="mt-0.5 text-[9px] text-slate-600">O efeito cresce com o atributo {info.scale} (máximo em 250). Vale nos modos com habilidades.</p>
      )}
      {info?.effectCode === "TIPO_ESCOLHIDO" && (
        <label className="mt-1.5 block text-[9px] font-bold uppercase tracking-wider text-fuchsia-300">
          Tipo do mascote
          <select value={typeChoice ?? ""} disabled={pending} onChange={(e) => changeType(e.target.value)}
            className="mt-0.5 w-full rounded border border-fuchsia-400/30 bg-slate-900 px-1.5 py-1 text-[10px] font-semibold normal-case tracking-normal text-fuchsia-100">
            <option value="">Tipo original</option>
            {Object.entries(TYPE_LABELS_PT).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-slate-500">Vale no combate enquanto esta habilidade estiver equipada. Trocar de habilidade remove a escolha.</span>
        </label>
      )}
      {options.length > 1 && (
        <label className="mt-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-500">
          Trocar habilidade
          <select value={current ?? ""} disabled={pending} onChange={(e) => change(e.target.value)}
            className="mt-0.5 w-full rounded border border-white/10 bg-slate-900 px-1.5 py-1 text-[10px] font-semibold normal-case tracking-normal text-slate-200">
            {options.map((slug) => (
              <option key={slug} value={slug}>{getAbilityInfo(slug)?.name ?? slug}{getAbilityInfo(slug)?.hasEffect ? "" : " (sem efeito)"}{slug === hidden ? " · oculta" : ""}</option>
            ))}
          </select>
        </label>
      )}
      {lockedHidden && (
        <p className="mt-1.5 flex items-start gap-1 rounded border border-violet-400/20 bg-violet-500/5 p-1.5 text-[9px] text-violet-200/80">
          <Lock size={10} className="mt-px shrink-0" />
          <span>
            Oculta bloqueada: <b>{lockedHidden.name}</b>{lockedHidden.hasEffect ? ` (${lockedHidden.effectName})` : ""}.
            {lockedHidden.hasEffect ? ` Libere com o item ${abilityTmItemName(lockedHidden.slug)} (ZikaShop ou Bazar).` : " Sem efeito em combate nesta versão."}
          </span>
        </p>
      )}
      <Link href={`/habilidades?mascote=${pokemonId}`} className="mt-1 inline-block text-[9px] text-cyan-400 hover:underline">Ver todas as habilidades deste mascote</Link>
    </div>
  );
}
