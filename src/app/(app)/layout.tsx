import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { signOut } from "@/auth";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getManualSessionUser, MANUAL_SESSION_COOKIE } from "@/lib/manual-session";
import { Button } from "@/components/ui/button";
import { LogOut, Zap } from "lucide-react";
import { Toaster } from "sonner";
import { AppNav } from "./_components/app-nav";
import { FcmTokenRegistrar } from "@/components/fcm-token-registrar";
import { AchievementNotifier } from "@/components/achievement-notifier";
import { WelcomeTutorial } from "@/components/tutorial/welcome-tutorial";

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
      if (!player) return { player: null, giftCount: 0, wallet: null, unreadDms: 0 };
      const [giftCount, wallet, unreadDms] = await Promise.all([
        prisma.playerGift.count({ where: { playerId: player.id, status: "UNCLAIMED" } }).catch(() => 0),
        prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } }).catch(() => null),
        prisma.directMessage.count({ where: { receiverId: player.id, readAt: null } }).catch(() => 0),
      ]);
      return { player, giftCount, wallet, unreadDms };
    },
    [`nav-data-${userId}`],
    { revalidate: 30, tags: [`nav-${userId}`] },
  )();

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getAppSession().catch(() => null);
  const user = session?.user ?? await getManualSessionUser();
  if (!user) redirect("/login");

  const admin = isAdmin(user.role);

  const { player, giftCount, wallet, unreadDms } = await getNavData(user.id);

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

            <AppNav admin={admin} variant="desktop" giftCount={giftCount} unreadDms={unreadDms} playerId={player?.id} />

            {/* User + logout */}
            <div className="flex items-center gap-2.5">
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
              <form action={async () => {
                "use server";
                const { cookies } = await import("next/headers");
                const cookieStore = await cookies();
                const manualToken = cookieStore.get(MANUAL_SESSION_COOKIE)?.value;
                if (manualToken) {
                  await prisma.session.deleteMany({ where: { sessionToken: manualToken } }).catch(() => {});
                }
                cookieStore.delete(MANUAL_SESSION_COOKIE);
                await signOut({ redirectTo: "/login" });
              }}>
                <Button type="submit" variant="ghost" size="sm"
                  className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                  <LogOut size={14} />
                </Button>
              </form>
            </div>
          </div>

          <div className="mx-auto max-w-7xl">
            <AppNav admin={admin} variant="mobile" giftCount={giftCount} unreadDms={unreadDms} playerId={player?.id} />
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">{children}</main>
        <FcmTokenRegistrar />
        <AchievementNotifier />
        {!admin && <WelcomeTutorial />}
      </div>
    </>
  );
}
