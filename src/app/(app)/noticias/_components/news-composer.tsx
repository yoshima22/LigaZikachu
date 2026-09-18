"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";
import { createNewsPost } from "../actions";

const rewardKinds = [
  { value: "NONE", label: "Sem recompensa" },
  { value: "ZIKA_COINS", label: "ZikaCoins" },
  { value: "LIGA_CASH", label: "LigaCash (LC)" },
  { value: "SHOP_ITEM", label: "Item da loja" },
] as const;

export type CosmeticRewardOption = {
  id: string;
  name: string;
  type: string;
  rarity: string;
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  TITLE: "Título",
  BANNER: "Banner",
  FRAME: "Moldura",
};

function itemTypeLabel(type: string) {
  return ITEM_TYPE_LABELS[type] ?? type;
}

/**
 * Campo único: o admin digita o nome do item (com autocomplete nativo via
 * datalist) e o id correspondente é resolvido na hora. Substitui a cascata de
 * selects por categoria, que escondia a maior parte do catálogo da loja.
 */
export function ShopItemPicker({
  options,
  value,
  onChange,
}: {
  options: CosmeticRewardOption[];
  value: string;
  onChange: (itemId: string) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState(() => options.find((item) => item.id === value)?.name ?? "");
  const selected = options.find((item) => item.id === value) ?? null;

  function handleChange(nextQuery: string) {
    setQuery(nextQuery);
    const normalized = nextQuery.trim().toLowerCase();
    const exact = options.find((item) => item.name.toLowerCase() === normalized);
    const partial = normalized.length >= 3
      ? options.filter((item) => item.name.toLowerCase().includes(normalized))
      : [];
    // Nome parcial só resolve quando não houver ambiguidade.
    const match = exact ?? (partial.length === 1 ? partial[0] : null);
    onChange(match?.id ?? "");
  }

  return (
    <div className="md:col-span-2">
      <input
        list={listId}
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Nome do item (ex: Vitamina, Ovo Raro, Amuleto...)"
        className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-[#FFCB05]"
      />
      <datalist id={listId}>
        {options.map((item) => (
          <option key={item.id} value={item.name}>
            {itemTypeLabel(item.type)}
          </option>
        ))}
      </datalist>
      <p className={`mt-1 text-[11px] ${selected ? "text-emerald-400" : query.trim() ? "text-red-400" : "text-slate-500"}`}>
        {selected
          ? `Selecionado: ${selected.name} (${itemTypeLabel(selected.type)})`
          : query.trim()
            ? "Nenhum item da loja com esse nome. Continue digitando ou escolha na lista."
            : `Digite o nome do item — ${options.length} itens disponíveis.`}
      </p>
    </div>
  );
}

function insertMarkup(body: string, setBody: (value: string) => void, markup: string) {
  const suffix = body && !body.endsWith("\n") ? "\n" : "";
  setBody(`${body}${suffix}${markup}`);
}

export function NewsComposer({ cosmeticOptions }: { cosmeticOptions: CosmeticRewardOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [rewardKind, setRewardKind] = useState<(typeof rewardKinds)[number]["value"]>("NONE");
  const [rewardAmount, setRewardAmount] = useState(1);
  const [rewardType, setRewardType] = useState("");
  const [rewardTitle, setRewardTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        if (title.trim().length < 3 || body.trim().length < 10) {
          toast.error("Preencha titulo e texto da noticia.");
          return;
        }
        const result = await createNewsPost({
          title,
          subtitle,
          body,
          imageUrl,
          published: true,
          rewardKind,
          rewardAmount,
          rewardType,
          rewardTitle,
        });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Noticia publicada.");
        setTitle("");
        setSubtitle("");
        setBody("");
        setImageUrl("");
        setRewardKind("NONE");
        setRewardAmount(1);
        setRewardType("");
        setRewardTitle("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao publicar noticia.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[#FFCB05]/20 bg-slate-950/70 p-4 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#FFCB05]" />
        <div>
          <h2 className="text-lg font-bold text-white">Publicar noticia</h2>
          <p className="text-xs text-slate-400">Apenas admins. Imagens locais sao enviadas para o storage e a pagina mostra as 5 noticias mais recentes.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-300">Titulo</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-[#FFCB05]" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-300">Subtitulo</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-[#FFCB05]" />
        </label>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => insertMarkup(body, setBody, "**texto em destaque**")} className="rounded-lg border border-border px-2 py-1 text-xs text-slate-300 hover:border-[#FFCB05]/50 hover:text-[#FFCB05]">Negrito</button>
          <button type="button" onClick={() => insertMarkup(body, setBody, "## Subtitulo da secao")} className="rounded-lg border border-border px-2 py-1 text-xs text-slate-300 hover:border-[#FFCB05]/50 hover:text-[#FFCB05]">Titulo interno</button>
          <button type="button" onClick={() => insertMarkup(body, setBody, "- Item da lista")} className="rounded-lg border border-border px-2 py-1 text-xs text-slate-300 hover:border-[#FFCB05]/50 hover:text-[#FFCB05]">Lista</button>
          <button type="button" onClick={() => insertMarkup(body, setBody, "[texto do link](https://)") } className="rounded-lg border border-border px-2 py-1 text-xs text-slate-300 hover:border-[#FFCB05]/50 hover:text-[#FFCB05]">Link</button>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Escreva a noticia. Suporta titulo interno, listas, links e texto em destaque."
          className="w-full rounded-2xl border border-border bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
        />
      </div>

      <div className="mt-3 rounded-xl border border-border bg-slate-950/70 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ImageIcon className="h-4 w-4 text-[#FFCB05]" />
          Imagem da noticia
        </div>
        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
          label=""
          compress
          maxWidth={1400}
          maxHeight={900}
          quality={0.82}
          hint="Opcional. A imagem sera comprimida e enviada para o storage ao publicar."
        />
      </div>

      <div className="mt-3 rounded-xl border border-purple-500/20 bg-purple-950/20 p-3">
        <p className="mb-2 text-sm font-semibold text-purple-100">Recompensa opcional</p>
        <div className="grid gap-2 md:grid-cols-4">
          <select value={rewardKind} onChange={(e) => { setRewardKind(e.target.value as typeof rewardKind); setRewardType(""); }} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white">
            {rewardKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
          </select>
          {rewardKind !== "NONE" && (
            <>
              <input type="number" min={1} value={rewardAmount} onChange={(e) => setRewardAmount(Number(e.target.value))} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Quantidade" />
              {rewardKind === "SHOP_ITEM" && (
                <ShopItemPicker options={cosmeticOptions} value={rewardType} onChange={setRewardType} />
              )}
              <input value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Nome exibido (opcional)" />
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Publicar
        </button>
      </div>
    </section>
  );
}
