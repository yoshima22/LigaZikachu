"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Edit3, Gift, Loader2, Newspaper, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";
import { claimNewsReward, markNewsPostsRead, updateNewsPost } from "../actions";
import type { CosmeticRewardOption } from "./news-composer";

export type NewsPostView = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  imageUrl: string | null;
  publishedAt: string;
  rewardEnabled: boolean;
  rewardTitle: string | null;
  rewardSummary: string | null;
  rewardForm: { rewardKind: string; rewardAmount: number; rewardType: string };
  rewardClaimed: boolean;
  unread: boolean;
};

const rewardKinds = [
  { value: "NONE", label: "Sem recompensa" },
  { value: "ZIKA_COINS", label: "ZikaCoins" },
  { value: "MASCOT_EGG", label: "Ovo de mascote" },
  { value: "MASCOT_FOOD", label: "Comida/Doce" },
  { value: "MASCOT_BUFF", label: "Item da loja" },
  { value: "SHOP_ITEM", label: "Cosmético da ZikaShop" },
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

function inlineParts(text: string) {
  const parts: Array<{ type: "text" | "bold" | "link"; value: string; href?: string }> = [];
  const regex = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    if (match[2]) parts.push({ type: "bold", value: match[2] });
    if (match[4] && match[5]) parts.push({ type: "link", value: match[4], href: match[5] });
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

function InlineText({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, index) => {
        if (part.type === "bold") return <strong key={index} className="font-bold text-white">{part.value}</strong>;
        if (part.type === "link") {
          return (
            <a key={index} href={part.href} target="_blank" rel="noreferrer" className="font-semibold text-[#FFCB05] underline-offset-4 hover:underline">
              {part.value}
            </a>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </>
  );
}

function NewsBody({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return <h3 key={index} className="pt-1 text-base font-bold text-[#FFCB05]"><InlineText text={block.slice(3)} /></h3>;
        }
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line, lineIndex) => <li key={lineIndex}><InlineText text={line.slice(2)} /></li>)}
            </ul>
          );
        }
        return <p key={index}><InlineText text={block} /></p>;
      })}
    </div>
  );
}

export function NewsList({
  posts,
  admin = false,
  cosmeticOptions = [],
}: {
  posts: NewsPostView[];
  admin?: boolean;
  cosmeticOptions?: CosmeticRewardOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const unreadIds = useMemo(() => posts.filter((post) => post.unread).map((post) => post.id), [posts]);

  useEffect(() => {
    if (unreadIds.length === 0) return;
    void markNewsPostsRead(unreadIds);
  }, [unreadIds]);

  function claim(postId: string) {
    startTransition(async () => {
      const result = await claimNewsReward(postId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Recompensa resgatada.");
    });
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-slate-950/70 p-8 text-center">
        <Newspaper className="mx-auto mb-3 h-8 w-8 text-slate-500" />
        <p className="font-semibold text-slate-200">Nenhuma noticia publicada ainda.</p>
        <p className="mt-1 text-sm text-slate-500">Quando a Liga publicar novidades, elas aparecem aqui.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {posts.map((post) => (
        <article key={post.id} className="overflow-hidden rounded-2xl border border-[#FFCB05]/15 bg-slate-950/75 shadow-lg shadow-black/20">
          {editingId === post.id ? (
            <NewsEditForm post={post} cosmeticOptions={cosmeticOptions} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); router.refresh(); }} />
          ) : (
          <>
          {post.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="" className="max-h-[560px] w-full bg-slate-950 object-contain" loading="lazy" />
          )}
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {post.unread && <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />}
                  <h2 className="text-xl font-black text-white">{post.title}</h2>
                </div>
                {post.subtitle && <p className="mt-1 text-sm text-slate-400">{post.subtitle}</p>}
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                  {new Date(post.publishedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              {!post.unread && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Lida
                </span>
              )}
              {admin && (
                <button
                  type="button"
                  onClick={() => setEditingId(post.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#FFCB05]/25 bg-[#FFCB05]/10 px-2 py-1 text-[11px] font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20"
                >
                  <Edit3 className="h-3 w-3" />
                  Editar
                </button>
              )}
            </div>

            <NewsBody body={post.body} />

            {post.rewardEnabled && (
              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-purple-500/20 bg-purple-950/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-200">
                    <Gift className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-purple-100">{post.rewardTitle ?? "Recompensa da noticia"}</p>
                    <p className="text-xs text-purple-200/80">
                      {post.rewardSummary ? `Conteudo: ${post.rewardSummary}` : "Pode ser resgatada uma vez por jogador."}
                    </p>
                    {post.rewardSummary && <p className="mt-0.5 text-[11px] text-purple-200/60">Pode ser resgatada uma vez por jogador.</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => claim(post.id)}
                  disabled={post.rewardClaimed || isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                  {post.rewardClaimed ? "Ja resgatada" : "Resgatar recompensa"}
                </button>
              </div>
            )}
          </div>
          </>
          )}
        </article>
      ))}
    </section>
  );
}

function NewsEditForm({
  post,
  cosmeticOptions,
  onCancel,
  onSaved,
}: {
  post: NewsPostView;
  cosmeticOptions: CosmeticRewardOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [subtitle, setSubtitle] = useState(post.subtitle ?? "");
  const [body, setBody] = useState(post.body);
  const [imageUrl, setImageUrl] = useState(post.imageUrl ?? "");
  const [rewardKind, setRewardKind] = useState(post.rewardForm.rewardKind || "NONE");
  const [rewardAmount, setRewardAmount] = useState(post.rewardForm.rewardAmount || 1);
  const [rewardType, setRewardType] = useState(post.rewardForm.rewardType || "");
  const [rewardTitle, setRewardTitle] = useState(post.rewardTitle ?? "");
  const [isPending, startTransition] = useTransition();

  const typeOptions = rewardKind === "MASCOT_EGG"
    ? eggTypes.map((value) => ({ value, label: value }))
    : rewardKind === "MASCOT_FOOD"
      ? foodTypes
      : rewardKind === "MASCOT_BUFF"
        ? buffTypes
        : rewardKind === "SHOP_ITEM"
          ? cosmeticOptions.map((item) => ({
              value: item.id,
              label: `${item.type === "TITLE" ? "Título" : item.type === "BANNER" ? "Banner" : "Moldura"} · ${item.name} (${item.rarity})`,
            }))
        : [];

  function save() {
    startTransition(async () => {
      const result = await updateNewsPost(post.id, {
        title,
        subtitle,
        body,
        imageUrl,
        published: true,
        rewardKind: rewardKind as "NONE" | "ZIKA_COINS" | "MASCOT_EGG" | "MASCOT_FOOD" | "MASCOT_BUFF" | "SHOP_ITEM",
        rewardAmount,
        rewardType,
        rewardTitle,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Noticia atualizada.");
      onSaved();
    });
  }

  return (
    <div className="space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">Editar noticia</h3>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border p-2 text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-[#FFCB05]" placeholder="Titulo" />
        <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-[#FFCB05]" placeholder="Subtitulo" />
      </div>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} className="w-full rounded-2xl border border-border bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      <ImageUpload value={imageUrl} onChange={setImageUrl} label="Imagem" compress maxWidth={1400} maxHeight={900} quality={0.82} />

      <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3">
        <p className="mb-2 text-sm font-semibold text-purple-100">Recompensa</p>
        <div className="grid gap-2 md:grid-cols-4">
          <select value={rewardKind} onChange={(event) => { setRewardKind(event.target.value); setRewardType(""); }} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white">
            {rewardKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
          </select>
          {rewardKind !== "NONE" && (
            <>
              <input type="number" min={1} value={rewardAmount} onChange={(event) => setRewardAmount(Number(event.target.value))} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white" />
              {typeOptions.length > 0 && (
                <select value={rewardType} onChange={(event) => setRewardType(event.target.value)} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="">{rewardKind === "SHOP_ITEM" ? "Selecione o cosmético" : "Padrao"}</option>
                  {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
              <input value={rewardTitle} onChange={(event) => setRewardTitle(event.target.value)} className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Nome exibido" />
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5">Cancelar</button>
        <button type="button" onClick={save} disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-wait disabled:opacity-60">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
