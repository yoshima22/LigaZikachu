"use client";

import { useEffect, useMemo, useTransition } from "react";
import { CheckCircle2, Gift, Loader2, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { claimNewsReward, markNewsPostsRead } from "../actions";

export type NewsPostView = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  imageUrl: string | null;
  publishedAt: string;
  rewardEnabled: boolean;
  rewardTitle: string | null;
  rewardClaimed: boolean;
  unread: boolean;
};

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

export function NewsList({ posts }: { posts: NewsPostView[] }) {
  const [isPending, startTransition] = useTransition();
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
          {post.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="" className="max-h-[360px] w-full object-cover" loading="lazy" />
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
                    <p className="text-xs text-purple-200/70">Pode ser resgatada uma vez por jogador.</p>
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
        </article>
      ))}
    </section>
  );
}
