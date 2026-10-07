import Link from "next/link";
import { ExternalLink, Lock, Search } from "lucide-react";
import { getStaticSpriteUrl } from "@/lib/mascot-data";
import {
  ABILITY_CATEGORIES, ABILITY_CATEGORY_LIMIT, ABILITY_REDUCED_FACTOR, ABILITY_STAT_CAP, describeAbility,
  type AbilityInfo,
} from "@/lib/abilities";
import { ABILITY_CATEGORY_STYLE } from "@/lib/abilities/style";
import { abilityTmItemName, getAbilityTmDef } from "@/lib/abilities/tm";
import { allTriggers, getAbilityHolders, getSpeciesHit, listSpeciesNames, searchAbilities, searchSpecies, type SpeciesHit } from "@/lib/abilities/catalog";
import { getDisabledSpeciesIds } from "@/lib/ability-tm-shop";
import { getPokedexLink } from "@/lib/pokedex-link";
import { getPokemonName } from "@/lib/mascot-data";

export const metadata = { title: "Habilidades | Liga Zikachu" };

type Props = { searchParams: Promise<{ tab?: string; q?: string; cat?: string; gat?: string; mascote?: string }> };

const TABS = [
  ["mascote", "Por mascote"],
  ["habilidade", "Por habilidade"],
  ["regras", "Como funciona"],
] as const;

function CategoryChip({ category }: { category: AbilityInfo["category"] }) {
  if (!category) return <span className="rounded border border-slate-600/50 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">Sem efeito</span>;
  return <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${ABILITY_CATEGORY_STYLE[category]}`}>{category}</span>;
}

function AbilityBlock({ info, badge }: { info: AbilityInfo; badge?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-sm text-white">{info.name}</b>
        <CategoryChip category={info.category} />
        {badge}
        {info.effectName && <span className="text-[10px] text-slate-500">Efeito: {info.effectName}</span>}
      </div>
      {info.dex && <p className="mt-1.5 text-[10px] text-slate-500">Na Pokédex: {info.dex}</p>}
      <p className="mt-1 leading-relaxed text-slate-300">{info.hasEffect ? "No combate: " : ""}{describeAbility(info)}</p>
      {info.hasEffect && (
        <p className="mt-1 text-[10px] text-slate-500">
          Gatilho: <b className="text-slate-400">{info.trigger}</b>
          {" · "}{info.activations > 0 ? `${info.activations} ativações por luta` : "passiva (não consome ativações)"}
          {info.scale && <> · cresce com <b className="text-slate-400">{({ force: "Força", agility: "Agilidade", charisma: "Carisma", instinct: "Instinto", vitality: "Vitalidade" } as const)[info.scale]}</b> até {ABILITY_STAT_CAP}</>}
        </p>
      )}
    </div>
  );
}

function SpeciesCard({ hit }: { hit: SpeciesHit }) {
  const link = getPokedexLink(hit.id);
  const tm = hit.hidden ? getAbilityTmDef(hit.hidden.slug) : null;
  return (
    <article className="rounded-2xl border border-border bg-slate-900/60 p-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getStaticSpriteUrl(hit.id)} alt="" className="h-14 w-14 object-contain [image-rendering:pixelated]" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-white">{hit.name}</h3>
          <p className="text-[10px] text-slate-500">#{hit.id}</p>
        </div>
        {link.url ? (
          <a href={link.url} target="_blank" rel="noreferrer" title={link.note ?? "Ver na Pokédex oficial"}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-slate-400 hover:text-cyan-300">
            Pokédex oficial <ExternalLink size={11} />
          </a>
        ) : <span className="text-[10px] text-slate-600" title={link.note ?? undefined}>Forma exclusiva do jogo</span>}
      </div>
      {link.note && link.url && <p className="mt-1 text-[10px] text-slate-600">{link.note}</p>}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {hit.normal.map((info) => <AbilityBlock key={info.slug} info={info} badge={<span className="text-[9px] text-slate-500">comum</span>} />)}
        {hit.hidden && (
          <AbilityBlock
            info={hit.hidden}
            badge={<span className="inline-flex items-center gap-1 rounded border border-violet-400/40 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-300"><Lock size={9} /> oculta</span>}
          />
        )}
      </div>
      {tm && (
        <p className="mt-2 text-[10px] text-violet-200/80">
          A oculta de {hit.name} é liberada com o item <b>{abilityTmItemName(tm.abilityKey)}</b> (ZikaShop ou Bazar) e só vale no modo Padrão. No modo Customizado do Arena Draft ela já é livre.
        </p>
      )}
      {hit.normal.length > 1 && <p className="mt-1 text-[10px] text-slate-500">Este mascote escolhe uma das habilidades; nunca duas ao mesmo tempo.</p>}
    </article>
  );
}

function SearchBox({ tab, q, placeholder, extra, listId }: { tab: string; q: string; placeholder: string; extra?: React.ReactNode; listId?: string }) {
  return (
    <form className="flex flex-wrap items-center gap-2" action="/habilidades">
      <input type="hidden" name="tab" value={tab} />
      <div className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-border bg-slate-900 px-3 py-2">
        <Search size={14} className="text-slate-500" />
        <input name="q" defaultValue={q} placeholder={placeholder} list={listId} autoComplete="off" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
      </div>
      {extra}
      <button className="rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E]">Buscar</button>
    </form>
  );
}

export default async function HabilidadesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = (TABS.some(([id]) => id === params.tab) ? params.tab : params.mascote ? "mascote" : "mascote") as (typeof TABS)[number][0];
  const q = (params.q ?? "").trim();
  // Mascotes desligados no painel de admin ficam fora (com suas habilidades e TMs).
  const disabled = await getDisabledSpeciesIds();
  const direct = params.mascote && /^\d+$/.test(params.mascote) ? getSpeciesHit(Number(params.mascote), disabled) : null;
  const speciesHits = tab === "mascote" ? (direct ? [direct] : searchSpecies(q, 30, disabled)) : [];
  const speciesNames = tab === "mascote" ? listSpeciesNames(disabled) : [];
  const category = ABILITY_CATEGORIES.includes(params.cat as never) ? params.cat : "";
  const triggers = allTriggers();
  const trigger = triggers.includes(params.gat ?? "") ? params.gat : "";
  const abilityHits = tab === "habilidade" ? searchAbilities({ q, category, trigger, disabled }) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05]">Habilidades</h1>
        <p className="mt-1 text-sm text-slate-400">
          Cada mascote tem as habilidades da Pokédex adaptadas ao combate. Hoje elas valem no <b className="text-slate-300">Arena Draft</b>.
          Consulte qualquer mascote, mesmo um que você ainda não tem, ou procure uma habilidade para ver o efeito e quando ela ativa.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1.5">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/habilidades?tab=${id}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === id ? "bg-[#FFCB05] text-[#1A1A2E]" : "border border-border text-slate-400 hover:text-white"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "mascote" && (
        <section className="space-y-4">
          <SearchBox tab="mascote" q={q} listId="mascot-names" placeholder="Nome ou número do mascote (ex.: Gyarados, Mega, 130)…" />
          <datalist id="mascot-names">
            {speciesNames.map((name) => <option key={name} value={name} />)}
          </datalist>
          {direct && <p className="text-xs text-slate-500">Mostrando as habilidades de {direct.name}. <Link className="text-cyan-400 hover:underline" href="/habilidades?tab=mascote">Buscar outro</Link></p>}
          {!q && !direct && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-slate-500">Digite o nome de um mascote para ver as habilidades dele.</p>}
          {q && speciesHits.length === 0 && <p className="text-sm text-slate-500">Nenhum mascote encontrado para “{q}”.</p>}
          <div className="space-y-3">{speciesHits.map((hit) => <SpeciesCard key={hit.id} hit={hit} />)}</div>
        </section>
      )}

      {tab === "habilidade" && (
        <section className="space-y-4">
          <SearchBox tab="habilidade" q={q} placeholder="Nome da habilidade ou do efeito (ex.: Intimidate, Espinhos)…"
            extra={(
              <>
                <select name="cat" defaultValue={category} className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300">
                  <option value="">Todas as categorias</option>
                  {ABILITY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select name="gat" defaultValue={trigger} className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300">
                  <option value="">Todos os gatilhos</option>
                  {triggers.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            )} />
          <p className="text-xs text-slate-500">{abilityHits.length} habilidade{abilityHits.length === 1 ? "" : "s"} · mostrando até 40</p>
          <div className="grid gap-3 md:grid-cols-2">
            {abilityHits.slice(0, 40).map((info) => {
              const h = getAbilityHolders(info.slug, disabled);
              const names = (ids: number[]) => ids.slice(0, 8).map((id) => getPokemonName(id)).join(", ") + (ids.length > 8 ? ` e mais ${ids.length - 8}` : "");
              return (
                <div key={info.slug} className="space-y-1.5">
                  <AbilityBlock info={info} />
                  <p className="px-1 text-[10px] text-slate-500">
                    {h.normal.length > 0 && <>Comum em {h.normal.length}: {names(h.normal)}. </>}
                    {h.hidden.length > 0 && <>Oculta em {h.hidden.length}: {names(h.hidden)}. </>}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "regras" && (
        <section className="space-y-4 text-sm leading-relaxed text-slate-300">
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <h2 className="font-bold text-white">Como as habilidades funcionam</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-400">
              <li>Cada habilidade tem uma <b className="text-slate-300">categoria</b>, um <b className="text-slate-300">gatilho</b> (quando ativa) e um número fixo de <b className="text-slate-300">ativações por luta</b>. O card e o log mostram quantas já foram usadas.</li>
              <li>Nenhum efeito passa de <b className="text-slate-300">20%</b>. O efeito cresce com um atributo do mascote e chega ao máximo quando esse atributo chega a {ABILITY_STAT_CAP}, então continuar evoluindo sempre compensa.</li>
              <li>Cada mascote usa <b className="text-slate-300">uma habilidade por vez</b>. Quem tem mais de uma escolhe qual usar.</li>
              <li>A <b className="text-slate-300">habilidade oculta</b> do modo Padrão é liberada com o TM dela (ZikaShop e Bazar). No modo Customizado do Draft ela é livre.</li>
              <li>Megas usam a habilidade própria da Pokédex. Só se a forma não tiver uma, vale a da forma anterior à mega.</li>
              <li>Debuffs duram a luta toda e <b className="text-slate-300">não se somam</b>: em cada atributo vale o maior valor. Habilidades de Defesa e Suporte podem reduzir ou remover debuffs.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <h2 className="font-bold text-white">Limite por categoria no time</h2>
            <p className="mt-1 text-xs text-slate-400">
              Para evitar times só de dano, a ordem dos slots em campo decide: o 1º mascote da categoria usa 100% do efeito, o 2º usa {Math.round(ABILITY_REDUCED_FACTOR * 100)}% (se o limite for 2) e do 3º em diante a habilidade fica desligada.
              Você pode mudar a posição dos mascotes para escolher quem fica ligado. O estado é recalculado a cada janela estratégica e não muda se alguém cair no meio do trecho.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-slate-500"><tr><th className="py-1.5">Categoria</th><th>1º do time</th><th>2º do time</th><th>3º em diante</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {ABILITY_CATEGORIES.map((c) => {
                    const limit = ABILITY_CATEGORY_LIMIT[c];
                    return (
                      <tr key={c}>
                        <td className="py-1.5"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${ABILITY_CATEGORY_STYLE[c]}`}>{c}</span></td>
                        <td className="text-emerald-300">100%</td>
                        <td className={limit >= 2 ? "text-amber-300" : "text-rose-300"}>{limit >= 2 ? `${Math.round(ABILITY_REDUCED_FACTOR * 100)}%` : "desligado"}</td>
                        <td className="text-rose-300">desligado</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
