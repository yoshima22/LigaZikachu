import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { signOut } from "@/auth";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getManualSessionUser, MANUAL_SESSION_COOKIE } from "@/lib/manual-session";
import { getGlobalNotice } from "@/lib/app-settings";
import { Button } from "@/components/ui/button";
import { LogOut, Megaphone, Zap } from "lucide-react";
import { Toaster } from "sonner";
import { AppNav } from "./_components/app-nav";
import { FcmTokenRegistrar } from "@/components/fcm-token-registrar";
import { AchievementNotifier } from "@/components/achievement-notifier";
import { WelcomeTutorial } from "@/components/tutorial/welcome-tutorial";
import { RouteTutorialHelpButton } from "@/components/tutorial/route-tutorial-help-button";
import { MaintenanceVisibilityGuard } from "@/components/maintenance-visibility-guard";
import { SessionPersistenceGuard } from "@/components/session-persistence-guard";
import { LogoutButton } from "@/components/logout-button";

// Cache por usuário — TTL 30s. Revalidado por tag "nav-{userId}" nas actions
// que alteram gift count, saldo ou DMs. Pior caso: 30s de dado levemente desatualizado
// no nav, o que é aceitável para evitar 4 queries a cada navegação de página.
const getNavData = (userId: string) =>
  unstable_cache(
    async () => {
      const player = await prisma.player.findUnique({
        where: { userId },
        select: { id: true, ptcglNick: true, avatarUrl: true },
      });

      if (!player) return { player: null, giftCount: 0, wallet: null, unreadDms: 0, bazarAlerts: 0, unreadNews: 0 };

      const giftCount = await prisma.playerGift.count({ where: { playerId: player.id, status: "UNCLAIMED" } }).catch(() => 0);
      const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } }).catch(() => null);
      const unreadDms = await prisma.directMessage.count({ where: { receiverId: player.id, readAt: null } }).catch(() => 0);
      const bazarAlerts = await prisma.bazarProposal.count({
        where: {
          OR: [
            { listing: { playerId: player.id, status: "ACTIVE", expiresAt: { gt: new Date() } }, status: "PENDING" },
            { proposerId: player.id, status: { in: ["ACCEPTED", "REJECTED"] }, viewedByProposerAt: null },
          ],
        },
      }).catch(() => 0);
      const latestNews = await prisma.newsPost.findMany({
        where: { published: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: { id: true },
      }).catch(() => []);
      const latestNewsIds = latestNews.map((news) => news.id);
      const readNews = latestNewsIds.length > 0
        ? await prisma.newsRead.count({ where: { playerId: player.id, postId: { in: latestNewsIds } } }).catch(() => 0)
        : 0;
      const unreadNews = Math.max(0, latestNewsIds.length - readNews);

      return { player, giftCount, wallet, unreadDms, bazarAlerts, unreadNews };
    },
    [`nav-data-v2-${userId}`],
    { revalidate: 60, tags: [`nav-${userId}`] },
  )();

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getAppSession().catch(() => null);
  const user = session?.user ?? await getManualSessionUser();
  if (!user) redirect("/login");

  const admin = isAdmin(user.role);

  const navData = await getNavData(user.id).catch((error) => {
    console.error("[Layout] nav data failed", { userId: user.id, error });
    return { player: null, giftCount: 0, wallet: null, unreadDms: 0, bazarAlerts: 0, unreadNews: 0 };
  });
  const globalNotice = await getGlobalNotice();
  const { player, giftCount, wallet, unreadDms, bazarAlerts, unreadNews } = navData;

  return (
    <>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#0f172a",
            border: "1px solid #1e293b",
            color: "#f8fafc"
          }
        }}
      />
      <MaintenanceVisibilityGuard />
      <SessionPersistenceGuard />
      <div className="min-h-screen bg-[#0f0f1a]">
        {/* Header Pokemon Style */}
        <header className="sticky top-0 z-40 border-b border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#1e1e3a] to-[#1A1A2E] pt-[env(safe-area-inset-top)] backdrop-blur-md">
          {/* Top bar with glow effect */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#FFCB05] to-transparent opacity-60"></div>
          
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            {/* Logo - Pokemon style */}
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700] shadow-[0_0_20px_#FFCB05]/40 group-hover:shadow-[0_0_30px_#FFCB05]/60 transition-all duration-300">
                <Zap className="h-5 w-5 text-[#1A1A2E]" strokeWidth={2.5} />
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[#1A1A2E]"></div>
              </div>
              <div className="flex flex-col">
                <span className="font-pixel text-sm text-[#FFCB05] leading-tight drop-shadow-[0_0_8px_#FFCB05]/30">
                  Liga Zikachu
                </span>
                <span className="text-[9px] text-slate-500 tracking-widest uppercase">
                  Live Championship
                </span>
              </div>
            </Link>

            <AppNav admin={admin} variant="desktop" giftCount={giftCount} unreadDms={unreadDms} bazarAlerts={bazarAlerts} unreadNews={unreadNews} playerId={player?.id} />

            {/* User + logout */}
            <div className="flex items-center gap-2.5">
              <RouteTutorialHelpButton />
              <Link href={player ? `/jogadores/${player.id}` : "/perfil"} className="hidden items-center gap-2.5 hover:opacity-80 transition-opacity sm:flex">
                {/* Texto à esquerda */}
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-200 leading-tight">
                    {user.name ?? user.email}
                  </p>
                  {wallet != null && (
                    <span className="flex items-center justify-end gap-0.5 mt-0.5 text-[10px] font-semibold text-[#FFCB05]">
                      🪙 {wallet.balance.toLocaleString("pt-BR")} ZC
                    </span>
                  )}
                  {player?.ptcglNick && (
                    <span className="block text-[10px] text-slate-500 leading-tight">@{player.ptcglNick}</span>
                  )}
                </div>
                {/* Avatar à direita */}
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-border bg-slate-800">
                  {player?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                      {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </Link>
              {/* Logout — form POST evita prefetch do Next.js (que causava logout automático) */}
              {/* ZikaCoins — visible on mobile only (desktop shows in user card) */}
              {wallet != null && (
                <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#FFCB05] sm:hidden">
                  🪙 {wallet.balance.toLocaleString("pt-BR")}
                </span>
              )}
              <LogoutButton />
            </div>
          </div>

          <div className="mx-auto max-w-7xl">
            <AppNav admin={admin} variant="mobile" giftCount={giftCount} unreadDms={unreadDms} bazarAlerts={bazarAlerts} unreadNews={unreadNews} playerId={player?.id} />
          </div>
          {globalNotice.message && (
            <details className="group border-t border-[#FFCB05]/15 bg-[#FFCB05]/10">
              <summary className="mx-auto flex max-w-7xl cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs font-semibold text-[#FFCB05] sm:px-6">
                <Megaphone size={14} />
                <span className="truncate">Aviso da Liga: {globalNotice.message}</span>
                <span className="ml-auto text-[10px] text-[#FFCB05]/70 group-open:hidden">abrir</span>
                <span className="ml-auto hidden text-[10px] text-[#FFCB05]/70 group-open:inline">fechar</span>
              </summary>
              <div className="mx-auto max-w-7xl px-4 pb-3 text-sm leading-relaxed text-yellow-50 sm:px-6">
                {globalNotice.message}
              </div>
            </details>
          )}
        </header>

        {/* Main content */}
        <main data-tutorial="page-content" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">{children}</main>
        <FcmTokenRegistrar />
        <AchievementNotifier />
        {!admin && <WelcomeTutorial />}
      </div>
    </>
  );
}
