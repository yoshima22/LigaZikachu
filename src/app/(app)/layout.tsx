import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { LogOut, Zap } from "lucide-react";
import { Toaster } from "sonner";
import { AppNav } from "./_components/app-nav";
import { FcmTokenRegistrar } from "@/components/fcm-token-registrar";
import { AchievementNotifier } from "@/components/achievement-notifier";
import { WelcomeTutorial } from "@/components/tutorial/welcome-tutorial";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const admin = isAdmin(session.user.role);

  // Dados do jogador para o nav
  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, ptcglNick: true, avatarUrl: true }
  });
  const [giftCount, wallet] = await Promise.all([
    player
      ? prisma.playerGift.count({ where: { playerId: player.id, status: "UNCLAIMED" } }).catch((error) => {
          console.error("[AppLayout] gift count failed", { userId: session.user.id, playerId: player.id, error });
          return 0;
        })
      : 0,
    player
      ? prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } }).catch((error) => {
          console.error("[AppLayout] wallet lookup failed", { userId: session.user.id, playerId: player.id, error });
          return null;
        })
      : null,
  ]);

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

            <AppNav admin={admin} variant="desktop" giftCount={giftCount} playerId={player?.id} />

            {/* User + logout */}
            <div className="flex items-center gap-2.5">
              <Link href={player ? `/jogadores/${player.id}` : "/perfil"} className="hidden items-center gap-2.5 hover:opacity-80 transition-opacity sm:flex">
                {/* Texto à esquerda */}
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-200 leading-tight">
                    {session.user.name ?? session.user.email}
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
                      {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </Link>
              {/* Logout — form POST evita prefetch do Next.js (que causava logout automático) */}
              <form action={async () => {
                "use server";
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
            <AppNav admin={admin} variant="mobile" giftCount={giftCount} playerId={player?.id} />
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        <FcmTokenRegistrar />
        <AchievementNotifier />
        {!admin && <WelcomeTutorial />}
      </div>
    </>
  );
}
