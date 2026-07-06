import { Newspaper } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { NewsComposer } from "./_components/news-composer";
import { NewsList, type NewsPostView } from "./_components/news-list";

export const dynamic = "force-dynamic";

export default async function NoticiasPage() {
  const session = await getAppSession();
  const user = session?.user;
  const admin = user ? isAdmin(user.role) : false;
  const player = user ? await getSessionPlayer(user.id) : null;

  const posts = await prisma.newsPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      subtitle: true,
      body: true,
      imageUrl: true,
      publishedAt: true,
      rewardEnabled: true,
      rewardTitle: true,
      reads: player ? { where: { playerId: player.id }, select: { id: true } } : false,
      rewardClaims: player ? { where: { playerId: player.id }, select: { id: true } } : false,
    },
  });

  const viewPosts: NewsPostView[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    subtitle: post.subtitle,
    body: post.body,
    imageUrl: post.imageUrl,
    publishedAt: post.publishedAt.toISOString(),
    rewardEnabled: post.rewardEnabled,
    rewardTitle: post.rewardTitle,
    rewardClaimed: "rewardClaims" in post && Array.isArray(post.rewardClaims) ? post.rewardClaims.length > 0 : false,
    unread: "reads" in post && Array.isArray(post.reads) ? post.reads.length === 0 : false,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Dashboard / Noticias</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFCB05]/15 text-[#FFCB05]">
              <Newspaper className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-pixel text-2xl text-[#FFCB05] sm:text-3xl">Noticias</h1>
              <p className="mt-1 text-sm text-slate-400">Novidades oficiais da Liga Zikachu, avisos importantes e recompensas especiais.</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
          Ultimas 5 publicacoes
        </div>
      </div>

      {admin && <NewsComposer />}
      <NewsList posts={viewPosts} />
    </div>
  );
}
