"use client";

import { useState, useTransition } from "react";
import { ImageIcon, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";
import { createNewsPost } from "../actions";

const rewardKinds = [
  { value: "NONE", label: "Sem recompensa" },
  { value: "ZIKA_COINS", label: "ZikaCoins" },
  { value: "MASCOT_EGG", label: "Ovo de mascote" },
  { value: "MASCOT_FOOD", label: "Comida/Doce" },
  { value: "MASCOT_BUFF", label: "Item da loja" },
] as const;

const eggTypes = ["COMMON", "RARE", "SPECIAL", "EVENT", "GEN1", "GEN2", "GEN3", "GEN4", "GEN5", "GEN6", "GEN7", "GEN8", "GEN9"];
const foodTypes = [
  { value: "FOOD", label: "Comida" },
  { value: "SWEET", label: "Doce" },
];
const buffTypes = [
  { value: "MASCOT_BUFF_EXP", label: "Buff de EXP" },
  { value: "MASCOT_BUFF_STAT", label: "Buff de atributo" },
  { value: "MASCOT_BUFF_HAPPY", label: "Buff de felicidade" },
  { value: "MASCOT_BUFF_LUCK", label: "Buff de sorte" },
  { value: "MASCOT_BUFF_MOOD", label: "Buff de humor" },
  { value: "LUCKY_EGG", label: "Lucky Egg" },
  { value: "PICNIC_BASKET", label: "Cesta de Picnic" },
  { value: "XP_SHARE", label: "XP Share" },
];

function insertMarkup(body: string, setBody: (value: string) => void, markup: string) {
  const suffix = body && !body.endsWith("\n") ? "\n" : "";
  setBody(`${body}${suffix}${markup}`);
}

export function NewsComposer() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [rewardKind, setRewardKind] = useState<(typeof rewardKinds)[number]["value"]>("NONE");
  const [rewardAmount, setRewardAmount] = useState(1);
  const [rewardType, setRewardType] = useState("");
  const [rewardTitle, setRewardTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const typeOptions = rewardKind === "MASCOT_EGG"
    ? eggTypes.map((value) => ({ value, label: value }))
    : rewardKind === "MASCOT_FOOD"
      ? foodTypes
      : rewardKind === "MASCOT_BUFF"
        ? buffTypes
        : [];

  function submit() {
    startTransition(async () => {
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
              {typeOptions.length > 0 && (
                <select value={rewardType} onChange={(e) => setRewardType(e.target.value)} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="">Padrao</option>
                  {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
              <input value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Nome exibido da recompensa" />
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
