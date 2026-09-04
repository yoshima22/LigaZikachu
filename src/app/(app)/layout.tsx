import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { signOut } from "@/auth";
import { getAppSession } from "@/lib/session";
import { isStaff, isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  getManualSessionUser,
  MANUAL_SESSION_COOKIE,
} from "@/lib/manual-session";
import { getGlobalNotice, getAckNotice, getLigaSupportAnnouncement } from "@/lib/app-settings";
import { AcknowledgeNoticeModal } from "./_components/acknowledge-notice-modal";
import { Button } from "@/components/ui/button";
import { Download, Megaphone, Zap } from "lucide-react";
import { Toaster } from "sonner";
import { AppNav } from "./_components/app-nav";
import { FcmTokenRegistrar } from "@/components/fcm-token-registrar";
import { AchievementNotifier } from "@/components/achievement-notifier";
import { WelcomeScreen } from "@/components/tutorial/welcome-screen";
import { RouteTutorialHelpButton } from "@/components/tutorial/route-tutorial-help-button";
import { MaintenanceVisibilityGuard } from "@/components/maintenance-visibility-guard";
import { SessionPersistenceGuard } from "@/components/session-persistence-guard";
import { MobileTitleTooltips } from "@/components/mobile-title-tooltips";
import { isBirthdayGiftEligible } from "@/lib/birthday";
import { BirthdayRouletteLauncher } from "./_components/birthday-roulette-launcher";
import { LogoutButton } from "@/components/logout-button";
import {
  ORDER_EVENT_SLUG,
  ORDER_STEP_PUBLIC_REWARD_LABELS,
} from "@/lib/raid-event";
import { OrderEventIntroModal } from "./_components/order-event-intro-modal";
import { OrderEventRewardModal } from "./_components/order-event-reward-modal";
import {
  markOrderIntroSeenAction,
  markOrderRewardSeenAction,
} from "./_components/order-event-intro-actions";
import { getPendingLeagueTickerEvents } from "@/lib/league-ticker";
import { LeagueTicker } from "./_components/league-ticker";
import {
  canAccessLivePvp,
  getLivePvpAccessConfig,
} from "@/lib/live-pvp-access";
import { getNavNotificationSnapshot } from "@/lib/nav-notifications";
import { DesktopChatDockLoader } from "./_components/desktop-chat-dock-loader";
import { AndroidUpdateBadge } from "@/components/android-update";
import { SpecMiniPlayer } from "@/components/spec/spec-mini-player";
import { SpecBroadcastControlDock } from "@/components/spec/spec-broadcast-control-dock";

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

      if (!player)
        return {
          player: null,
          giftCount: 0,
          wallet: null,
          ligaWallet: null,
          unreadNews: 0,
        };

      const giftCount = await prisma.playerGift
        .count({ where: { playerId: player.id, status: "UNCLAIMED" } })
        .catch(() => 0);
      const wallet = await prisma.zikaCoinWallet
        .findUnique({
          where: { playerId: player.id },
          select: { balance: true },
        })
        .catch(() => null);
      const ligaWallet = await prisma.ligaCoinWallet
        .findUnique({ where: { playerId: player.id }, select: { balance: true } })
        .catch(() => null);
      const latestNews = await prisma.newsPost
        .findMany({
          where: { published: true },
          orderBy: { publishedAt: "desc" },
          take: 5,
          select: { id: true },
        })
        .catch(() => []);
      const latestNewsIds = latestNews.map((news) => news.id);
      const readNews =
        latestNewsIds.length > 0
          ? await prisma.newsRead
              .count({
                where: { playerId: player.id, postId: { in: latestNewsIds } },
              })
              .catch(() => 0)
          : 0;
      const unreadNews = Math.max(0, latestNewsIds.length - readNews);

      return { player, giftCount, wallet, ligaWallet, unreadNews };
    },
    [`nav-data-v2-${userId}`],
    { revalidate: 60, tags: [`nav-${userId}`] },
  )();

// Um único sinal compartilhado por todos os usuários. O cache curto evita uma
// consulta por navegação e o corte por heartbeat impede que uma live abandonada
// mantenha o selo aceso indefinidamente.
const getZikaTvLiveStatus = unstable_cache(
  async () => Boolean(await prisma.specStream.findFirst({
    where: {
      status: "LIVE",
      lastSeenAt: { gte: new Date(Date.now() - 3 * 60_000) },
    },
    select: { id: true },
  })),
  ["zika-tv-live-nav-v1"],
  { revalidate: 20 },
);

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getAppSession().catch(() => null);
  const user = session?.user ?? (await getManualSessionUser());
  if (!user) redirect("/login");

  const admin = isStaff(user.role);
  const isPlatformAdmin = isAdmin(user.role);
  const towerAccessSetting = !isPlatformAdmin
    ? await prisma.appSetting.findUnique({ where: { key: "tower_rebels_tester_user_ids" }, select: { value: true } }).catch(() => null)
    : null;
  const towerTesterIds = Array.isArray(towerAccessSetting?.value)
    ? towerAccessSetting.value.filter((id): id is string => typeof id === "string")
    : [];
  // Atualmente a Torre é o único item com platformAdminOnly. Para contas de
  // teste, o menu aparece, mas todas as actions administrativas continuam
  // protegidas por requireTowerAdmin no servidor.
  const platformAdmin = isPlatformAdmin || towerTesterIds.includes(user.id);

  // Roleta de aniversário: elegível no dia (ou depois) do aniversário, uma vez por ano.
  const birthdayPlayer = await prisma.player.findUnique({
    where: { userId: user.id },
    select: {
      birthDate: true,
      birthdayGiftYear: true,
      birthdayGiftPendingKit: true,
      birthdayGiftReplayKit: true,
      lastAckedNoticeVersion: true,
    },
  }).catch(() => null);

  // Aviso com confirmação: aparece se houver aviso ativo com versão maior que a
  // última confirmada por este jogador.
  const ackNotice = await getAckNotice().catch(() => null);
  const showAckNotice = Boolean(
    ackNotice?.active && ackNotice.title.trim() &&
    ackNotice.version > (birthdayPlayer?.lastAckedNoticeVersion ?? 0),
  );
  const birthdayPendingKit = birthdayPlayer?.birthdayGiftPendingKit ?? null;
  const birthdayReplayKit = birthdayPlayer?.birthdayGiftReplayKit ?? null;
  const birthdayEligible = Boolean(birthdayPlayer) && (
    isBirthdayGiftEligible(birthdayPlayer!.birthDate, birthdayPlayer!.birthdayGiftYear) ||
    Boolean(birthdayPendingKit) ||
    Boolean(birthdayReplayKit)
  );

  const navData = await getNavData(user.id).catch((error) => {
    console.error("[Layout] nav data failed", { userId: user.id, error });
    return {
      player: null,
      giftCount: 0,
      wallet: null,
      ligaWallet: null,
      unreadNews: 0,
    };
  });
  const [globalNotice, tickerEvents, livePvpConfig, notificationSnapshot, zikaTvLive] = await Promise.all([
    getGlobalNotice(),
    navData.player
      ? getPendingLeagueTickerEvents(navData.player.id).catch(() => [])
      : Promise.resolve([]),
    getLivePvpAccessConfig().catch(() => ({
      enabledGlobally: false,
      allowedPlayerIds: [],
      biomeImages: {},
    })),
    navData.player
      ? getNavNotificationSnapshot(navData.player.id).catch(() => ({
          messageCount: 0,
          bazarCount: 0,
          messageAlerts: [],
          bazarAlerts: [],
        }))
      : Promise.resolve({ messageCount: 0, bazarCount: 0, messageAlerts: [], bazarAlerts: [] }),
    getZikaTvLiveStatus().catch(() => false),
  ]);
  const supportAnnouncement = await getLigaSupportAnnouncement().catch(() => ({ message: "", freshUntil: 0 }));
  const showSupportAnnouncement = Boolean(supportAnnouncement.message) && Date.now() < supportAnnouncement.freshUntil;
  const livePvpVisible = canAccessLivePvp(
    livePvpConfig,
    navData.player?.id,
    admin,
  );
  const orderIntro = await prisma.raidEvent
    .findUnique({
      where: { slug: ORDER_EVENT_SLUG },
      select: {
        active: true,
        phase: true,
        notifications: {
          where: { userId: user.id, notificationType: "ORDER_INTRO" },
          select: { seenAt: true },
          take: 1,
        },
      },
    })
    .catch(() => null);
  const shouldShowOrderIntro = Boolean(
    orderIntro?.active &&
    orderIntro.phase === "INVESTIGATION" &&
    !orderIntro.notifications.some((notification) => notification.seenAt),
  );
  const orderEventVisible = Boolean(
    orderIntro &&
    orderIntro.phase !== "ENDED" &&
    (orderIntro.active || orderIntro.phase === "RAID_DEFEATED"),
  );
  const pendingOrderReward = await prisma.userRaidNotification
    .findFirst({
      where: {
        userId: user.id,
        seenAt: null,
        notificationType: {
          in: [
            "ORDER_REWARD_ZIKALOOT",
            "ORDER_REWARD_BAZAR",
            "ORDER_REWARD_LAB",
            "ORDER_REWARD_LEAGUE",
            "ORDER_REWARD_MASCOTS",
            "RAID_DEFEATED",
          ],
        },
      },
      select: { id: true, notificationType: true },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => null);
  const { player, giftCount, wallet, ligaWallet, unreadNews } = navData;

  return (
    <>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#0f172a",
            border: "1px solid #1e293b",
            color: "#f8fafc",
          },
        }}
      />
      <MaintenanceVisibilityGuard />
      <SessionPersistenceGuard />
      <MobileTitleTooltips />
      {birthdayEligible && (
        <BirthdayRouletteLauncher
          pendingKitId={birthdayPendingKit}
          replayKitId={birthdayReplayKit}
        />
      )}
      {showAckNotice && ackNotice && (
        <AcknowledgeNoticeModal
          version={ackNotice.version}
          title={ackNotice.title}
          content={ackNotice.content}
          buttonText={ackNotice.buttonText}
        />
      )}
      {shouldShowOrderIntro && (
        <OrderEventIntroModal onSeen={markOrderIntroSeenAction} />
      )}
      {pendingOrderReward && (
        <OrderEventRewardModal
          notificationId={pendingOrderReward.id}
          title={
            pendingOrderReward.notificationType === "RAID_DEFEATED"
              ? "Capitao Trambique derrotado"
              : (ORDER_STEP_PUBLIC_REWARD_LABELS[
                  pendingOrderReward.notificationType
                ] ?? "Travessura da Ordem")
          }
          onSeen={markOrderRewardSeenAction}
        />
      )}
      <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#0f0f1a]">
        {/* Header Pokemon Style */}
        <header className="sticky top-0 z-40 border-b border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#1e1e3a] to-[#1A1A2E] pt-[env(safe-area-inset-top)] backdrop-blur-md">
          {/* Top bar with glow effect */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#FFCB05] to-transparent opacity-60"></div>

          <div className="mx-auto flex max-w-[1536px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
            {/* Logo - Pokemon style */}
            <Link href="/dashboard" className="group flex min-w-0 items-center gap-2 sm:gap-3 md:ml-4">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700] shadow-[0_0_20px_#FFCB05]/40 transition-all duration-300 group-hover:shadow-[0_0_30px_#FFCB05]/60 sm:h-10 sm:w-10">
                <Zap className="h-5 w-5 text-[#1A1A2E]" strokeWidth={2.5} />
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[#1A1A2E]"></div>
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="font-pixel text-[11px] leading-tight text-[#FFCB05] drop-shadow-[0_0_8px_#FFCB05]/30 sm:text-sm">
                  Liga Zikachu
                </span>
                <span className="hidden text-[9px] uppercase tracking-widest text-slate-500 sm:block">
                  Live Championship
                </span>
              </div>
            </Link>

            <AppNav
              admin={admin}
              platformAdmin={platformAdmin}
              variant="desktop"
              giftCount={giftCount}
              initialNotifications={notificationSnapshot}
              unreadNews={unreadNews}
              playerId={player?.id}
              orderEventVisible={orderEventVisible}
              livePvpVisible={livePvpVisible}
              zikaTvLive={zikaTvLive}
            />

            {/* User + logout */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link
                href={player ? `/jogadores/${player.id}` : "/perfil"}
                className="hidden min-w-0 max-w-[9.5rem] items-center gap-1.5 transition-opacity hover:opacity-80 sm:flex xl:max-w-[11.5rem]"
              >
                {/* Texto à esquerda */}
                <div className="min-w-0 flex-1 text-right">
                  <p
                    className="truncate text-xs font-medium leading-tight text-slate-200"
                    title={user.name ?? user.email ?? undefined}
                  >
                    {user.name ?? user.email}
                  </p>
                  {wallet != null && (
                    <span className="mt-0.5 flex flex-col items-end gap-0.5 text-[10px] font-semibold leading-tight whitespace-nowrap">
                      <span className="text-[#FFCB05]">🪙 {wallet.balance.toLocaleString("pt-BR")} ZC</span>
                      <span className="text-cyan-300">◉ {ligaWallet?.balance.toLocaleString("pt-BR") ?? "0"} LC</span>
                    </span>
                  )}
                  {player?.ptcglNick && (
                    <span
                      className="block truncate text-[10px] leading-tight text-slate-500"
                      title={`@${player.ptcglNick}`}
                    >
                      @{player.ptcglNick}
                    </span>
                  )}
                </div>
                {/* Avatar à direita */}
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-border bg-slate-800">
                  {player?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.avatarUrl}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
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
                <span className="flex flex-col items-end text-[9px] font-semibold leading-tight whitespace-nowrap sm:hidden">
                  <span className="text-[#FFCB05]">🪙 {wallet.balance.toLocaleString("pt-BR")}</span>
                  <span className="text-cyan-300">◉ {ligaWallet?.balance.toLocaleString("pt-BR") ?? "0"} LC</span>
                </span>
              )}
              <LogoutButton />
              <RouteTutorialHelpButton />
              <Link
                href="/downloads"
                prefetch={false}
                aria-label="Download"
                title="Download"
                className="relative flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 text-[9px] font-bold leading-none text-[#FFCB05] transition-colors hover:bg-[#FFCB05] hover:text-slate-950 sm:text-[10px]"
              >
                <Download size={13} className="shrink-0" />
                <span className="hidden whitespace-nowrap lg:inline">Download</span>
                <AndroidUpdateBadge />
              </Link>
            </div>
          </div>

          <div className="mx-auto max-w-[1536px]">
            <AppNav
              admin={admin}
              platformAdmin={platformAdmin}
              variant="mobile"
              giftCount={giftCount}
              initialNotifications={notificationSnapshot}
              unreadNews={unreadNews}
              playerId={player?.id}
              orderEventVisible={orderEventVisible}
              livePvpVisible={livePvpVisible}
              zikaTvLive={zikaTvLive}
            />
          </div>
          {showSupportAnnouncement && (
            <div className="border-t border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 via-slate-900/40 to-violet-500/10">
              <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs font-semibold text-cyan-100 sm:px-6">
                <span className="shrink-0 text-base">⚡</span>
                <span className="truncate" title={supportAnnouncement.message}>{supportAnnouncement.message}</span>
              </div>
            </div>
          )}
          {globalNotice.message && (
            <details className="group border-t border-[#FFCB05]/15 bg-[#FFCB05]/10">
              <summary className="mx-auto flex max-w-7xl cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs font-semibold text-[#FFCB05] sm:px-6">
                <Megaphone size={14} />
                <span className="truncate">
                  Aviso da Liga: {globalNotice.message}
                </span>
                <span className="ml-auto text-[10px] text-[#FFCB05]/70 group-open:hidden">
                  abrir
                </span>
                <span className="ml-auto hidden text-[10px] text-[#FFCB05]/70 group-open:inline">
                  fechar
                </span>
              </summary>
              <div className="mx-auto max-w-7xl px-4 pb-3 text-sm leading-relaxed text-yellow-50 sm:px-6">
                {globalNotice.message}
              </div>
            </details>
          )}
          <LeagueTicker
            initialEvents={tickerEvents.map((event) => ({
              ...event,
              createdAt: event.createdAt.toISOString(),
            }))}
          />
        </header>

        {/* Main content */}
        <main
          data-tutorial="page-content"
          className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-6 sm:py-8"
        >
          {children}
        </main>
        <FcmTokenRegistrar />
        <AchievementNotifier />
        <SpecMiniPlayer />
        <SpecBroadcastControlDock />
        {player && <DesktopChatDockLoader initialUnreadCount={notificationSnapshot.messageCount} />}
        {!admin && <WelcomeScreen />}
      </div>
    </>
  );
}
