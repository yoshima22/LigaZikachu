"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Calendar,
  ChevronDown,
  Coins,
  Crown,
  Gift,
  Heart,
  LayoutDashboard,
  Medal,
  MessageSquare,
  Newspaper,
  Package,
  Search,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Swords,
  Ticket,
  Trophy,
  User,
  Users,
  ShoppingCart,
  FlaskConical,
  Footprints,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@supabase/supabase-js";
import {
  markNavAlertViewedAction,
  refreshNavNotificationsAction,
} from "./nav-notification-actions";
import type { NavAlert, NavNotificationSnapshot } from "@/lib/nav-notifications";

const mainLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    adminOnly: false,
    tutorialId: undefined,
  },
  {
    href: "/torneios",
    label: "Torneios",
    icon: Trophy,
    adminOnly: false,
    tutorialId: "nav-torneios",
  },
  {
    href: "/noticias",
    label: "Noticias",
    icon: Newspaper,
    adminOnly: false,
    tutorialId: undefined,
  },
];

const combatLinks = [
  { href: "/arena-z", label: "Arena Z", icon: Swords, adminOnly: false },
  {
    href: "/combates/arena-online",
    label: "Batalha de Terreno",
    icon: Swords,
    adminOnly: false,
    livePvpOnly: true,
    beta: true,
  },
  { href: "/lacos", label: "Laços", icon: Heart, adminOnly: false },
  {
    href: "/desafio-sincronizado",
    label: "Arena Sincronizada",
    icon: Ticket,
    adminOnly: false,
  },
  {
    href: "/combates/cacada-de-rastros",
    label: "Caçada de Rastros",
    icon: Footprints,
    adminOnly: true,
  },
  {
    href: "/combates/liga-semanal",
    label: "Liga Semanal",
    icon: Trophy,
    adminOnly: false,
  },
  {
    href: "/combates/ordem-da-trapaca",
    label: "Ordem da Trapaça",
    icon: ShieldAlert,
    adminOnly: false,
    eventOnly: true,
  },
];

const rankingLinks = [
  {
    href: "/ranking",
    label: "Ranking Geral",
    icon: BarChart3,
    adminOnly: false,
  },
  {
    href: "/mascotes/ranking",
    label: "Ranking Mascotes",
    icon: Trophy,
    adminOnly: false,
  },
  { href: "/top-do-dia", label: "Top do Dia", icon: Crown, adminOnly: false },
  {
    href: "/temporadas",
    label: "Temporadas",
    icon: Calendar,
    adminOnly: false,
  },
];

const colecaoLinks = [
  { href: "/mascotes", label: "Mascotes", icon: Heart, adminOnly: false },
  { href: "/pokedex", label: "Pokedex", icon: Search, adminOnly: false },
  {
    href: "/professor",
    label: "Prof. Enguiça",
    icon: Sparkles,
    adminOnly: false,
  },
  { href: "/album", label: "Álbum", icon: BookOpen, adminOnly: false },
  { href: "/manual", label: "Manual", icon: BookOpen, adminOnly: false },
  { href: "/carteira", label: "Carteira", icon: Coins, adminOnly: false },
  { href: "/inventario", label: "Inventário", icon: Package, adminOnly: false },
];

const mercadoLinks = [
  { href: "/bazar", label: "Bazar", icon: Store, adminOnly: false },
  { href: "/shop", label: "ZikaShop", icon: ShoppingBag, adminOnly: false },
  { href: "/zikabet", label: "ZikaBet", icon: Swords, adminOnly: false },
  { href: "/zikaloot", label: "ZikaLoot", icon: Ticket, adminOnly: false },
  {
    href: "/laboratorio",
    label: "Laboratório",
    icon: FlaskConical,
    adminOnly: false,
  },
];

// profileLinks é dinâmico - usa playerId para o link do perfil público
function buildProfileLinks(playerId?: string) {
  return [
    {
      href: playerId ? `/jogadores/${playerId}` : "/perfil",
      label: "Meu Perfil",
      icon: User,
      adminOnly: false,
    },
    {
      href: "/mensagens",
      label: "Mensagens",
      icon: MessageSquare,
      adminOnly: false,
    },
    { href: "/perfil", label: "Configurações", icon: User, adminOnly: false },
    {
      href: "/perfil/meus-decks",
      label: "Meus Decks",
      icon: BookOpen,
      adminOnly: false,
    },
    {
      href: "/conquistas",
      label: "Conquistas",
      icon: Trophy,
      adminOnly: false,
    },
    { href: "/insignias", label: "Insignias", icon: Medal, adminOnly: false },
    {
      href: "/caixa-de-presentes",
      label: "Presentes",
      icon: Gift,
      adminOnly: false,
    },
    { href: "/codigos", label: "Codigos", icon: Package, adminOnly: false },
    {
      href: "/passe-apoiador",
      label: "Passe Apoiador",
      icon: Star,
      adminOnly: false,
    },
    { href: "/jogadores", label: "Jogadores", icon: Users, adminOnly: false },
  ];
}

const adminLinks = [
  { href: "/admin", label: "Painel Admin", icon: ShieldCheck, adminOnly: true },
  { href: "/admin/logs", label: "Logs e Auditoria", icon: ScrollText, adminOnly: true },
];

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly: boolean;
  tutorialId?: string;
  eventOnly?: boolean;
  livePvpOnly?: boolean;
  beta?: boolean;
};

export function AppNav({
  admin,
  variant = "desktop",
  giftCount = 0,
  initialNotifications,
  unreadNews = 0,
  playerId,
  orderEventVisible = false,
  livePvpVisible = false,
}: {
  admin: boolean;
  variant?: "desktop" | "mobile";
  giftCount?: number;
  initialNotifications: NavNotificationSnapshot;
  unreadNews?: number;
  playerId?: string;
  orderEventVisible?: boolean;
  livePvpVisible?: boolean;
}) {
  const profileLinks = buildProfileLinks(playerId);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const refreshInFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(Date.now());
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => setNotifications(initialNotifications), [initialNotifications]);

  const refreshNotifications = useCallback(() => {
    if (variant !== "desktop" || document.visibilityState !== "visible") return;
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    startTransition(async () => {
      try {
        const next = await refreshNavNotificationsAction().catch(() => null);
        if (next) {
          lastRefreshAtRef.current = Date.now();
          setNotifications(next);
          window.dispatchEvent(new CustomEvent("nav-notifications-updated", { detail: next }));
        }
      } finally {
        refreshInFlightRef.current = false;
      }
    });
  }, [variant]);

  const scheduleNotificationRefresh = useCallback(() => {
    if (variant !== "desktop" || document.visibilityState !== "visible") return;
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      refreshNotifications();
    }, 500);
  }, [refreshNotifications, variant]);

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<NavNotificationSnapshot>).detail;
      if (detail) setNotifications(detail);
    };
    window.addEventListener("nav-notifications-updated", receive);
    return () => window.removeEventListener("nav-notifications-updated", receive);
  }, []);

  useEffect(() => {
    const viewed = (event: Event) => {
      const detail = (event as CustomEvent<{ category: "MESSAGE" | "BAZAR"; entityId: string }>).detail;
      if (!detail) return;
      setNotifications((current) => {
        if (detail.category === "MESSAGE") {
          const removed = current.messageAlerts.find((item) => item.entityId === detail.entityId);
          return {
            ...current,
            messageCount: Math.max(0, current.messageCount - (removed?.unreadCount ?? 0)),
            messageAlerts: current.messageAlerts.filter((item) => item.entityId !== detail.entityId),
          };
        }
        const removed = current.bazarAlerts.filter((item) => item.entityId === detail.entityId);
        return {
          ...current,
          bazarCount: Math.max(0, current.bazarCount - removed.length),
          bazarAlerts: current.bazarAlerts.filter((item) => item.entityId !== detail.entityId),
        };
      });
    };
    window.addEventListener("nav-alert-viewed", viewed);
    return () => window.removeEventListener("nav-alert-viewed", viewed);
  }, []);

  useEffect(() => {
    if (variant !== "desktop") return;
    const refreshIfStale = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAtRef.current >= 60_000) {
        refreshNotifications();
      }
    };
    const interval = window.setInterval(refreshNotifications, 5 * 60_000);
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.clearInterval(interval);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [refreshNotifications, variant]);

  useEffect(() => {
    if (variant !== "desktop" || !playerId) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const channel = supabase
      .channel(`nav-alerts-${playerId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${playerId}`,
      }, scheduleNotificationRefresh)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "player_notifications", filter: `playerId=eq.${playerId}`,
      }, scheduleNotificationRefresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [playerId, scheduleNotificationRefresh, variant]);

  const dismissAlert = useCallback((alert: NavAlert) => {
    setNotifications((current) => {
      if (alert.category === "MESSAGE") {
        const removed = current.messageAlerts.find((item) => item.entityId === alert.entityId);
        const next = {
          ...current,
          messageCount: Math.max(0, current.messageCount - (removed?.unreadCount ?? 0)),
          messageAlerts: current.messageAlerts.filter((item) => item.entityId !== alert.entityId),
        };
        window.dispatchEvent(new CustomEvent("nav-notifications-updated", { detail: next }));
        return next;
      }
      const next = {
        ...current,
        bazarCount: Math.max(0, current.bazarCount - 1),
        bazarAlerts: current.bazarAlerts.filter((item) => item.id !== alert.id),
      };
      window.dispatchEvent(new CustomEvent("nav-notifications-updated", { detail: next }));
      return next;
    });
    setOpenMenu(null);
    startTransition(() => { void markNavAlertViewedAction(alert); });
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div
      ref={rootRef}
      data-mobile-nav-root={variant === "mobile" ? "true" : undefined}
      className={variant === "desktop" ? "relative ml-auto min-w-0" : "relative min-w-0"}
    >
      {variant === "desktop" && (
        <nav className="hidden items-center gap-1 min-[1450px]:flex">
          {mainLinks
            .filter((link) => !link.adminOnly || admin)
            .map(({ href, label, icon: Icon, tutorialId }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={() => setOpenMenu(null)}
                {...(tutorialId ? { "data-tutorial": tutorialId } : {})}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative text-xs text-slate-400 transition-colors hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]"
                >
                  <Icon size={14} className="mr-1.5" />
                  {label}
                  {href === "/noticias" && unreadNews > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                  )}
                </Button>
              </Link>
            ))}
          <NavDropdown
            id="combates"
            label="Combates"
            icon={Swords}
            links={combatLinks}
            admin={admin}
            orderEventVisible={orderEventVisible}
            livePvpVisible={livePvpVisible}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />
          <NavDropdown
            id="ranking"
            label="Ranking"
            icon={BarChart3}
            links={rankingLinks}
            admin={admin}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />
          <NavDropdown
            id="mercado"
            label="Mercado"
            icon={ShoppingCart}
            links={mercadoLinks}
            admin={admin}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            badgeHrefs={{ "/bazar": notifications.bazarCount }}
            alerts={notifications.bazarAlerts}
            onAlertClick={dismissAlert}
          />
          <NavDropdown
            id="colecao"
            label="Coleção"
            icon={ShoppingBag}
            links={colecaoLinks}
            admin={admin}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />
          <NavDropdown
            id="perfil"
            label="Perfil"
            icon={User}
            links={profileLinks}
            admin={admin}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            badgeHrefs={{
              "/caixa-de-presentes": giftCount,
              "/mensagens": notifications.messageCount,
            }}
            alerts={notifications.messageAlerts}
            onAlertClick={dismissAlert}
            tutorialId="nav-perfil"
          />
          {admin && (
            <NavDropdown
              id="admin"
              label="Admin"
              icon={ShieldCheck}
              links={adminLinks}
              admin={admin}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            />
          )}
        </nav>
      )}

      {variant === "mobile" && (
        <div className="px-3 pb-2.5 min-[1450px]:hidden">
          <div className={`grid grid-cols-4 gap-1.5 md:gap-2 ${admin ? "md:grid-cols-9" : "md:grid-cols-8"}`}>
            {mainLinks
              .filter((link) => !link.adminOnly || admin)
              .map(({ href, label, icon: Icon, tutorialId }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  onClick={() => setOpenMenu(null)}
                  {...(tutorialId ? { "data-tutorial": tutorialId } : {})}
                  className="min-w-0"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative flex h-11 w-full min-w-0 flex-col gap-0.5 rounded-xl border border-white/5 bg-slate-950/25 px-1 text-[9px] font-semibold text-slate-400 hover:border-[#FFCB05]/20 hover:bg-[#FFCB05]/10 hover:text-[#FFCB05] md:h-9 md:flex-row md:gap-1 md:text-[10px]"
                  >
                    <Icon size={14} />
                    <span className="max-w-full truncate">{label}</span>
                    {href === "/noticias" && unreadNews > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                    )}
                  </Button>
                </Link>
              ))}
            <MobileNavGroup
              id="mobile-combates"
              label="Combates"
              icon={Swords}
              links={combatLinks}
              admin={admin}
              orderEventVisible={orderEventVisible}
              livePvpVisible={livePvpVisible}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            />
            <MobileNavGroup
              id="mobile-ranking"
              label="Ranking"
              icon={BarChart3}
              links={rankingLinks}
              admin={admin}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            />
            <MobileNavGroup
              id="mobile-mercado"
              label="Mercado"
              icon={ShoppingCart}
              links={mercadoLinks}
              admin={admin}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              badgeHrefs={{ "/bazar": notifications.bazarCount }}
              alerts={notifications.bazarAlerts}
              onAlertClick={dismissAlert}
            />
            <MobileNavGroup
              id="mobile-colecao"
              label="Coleção"
              icon={ShoppingBag}
              links={colecaoLinks}
              admin={admin}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            />
            <MobileNavGroup
              id="mobile-perfil"
              label="Perfil"
              icon={User}
              links={profileLinks}
              admin={admin}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              badgeHrefs={{ "/caixa-de-presentes": giftCount, "/mensagens": notifications.messageCount }}
              alerts={notifications.messageAlerts}
              onAlertClick={dismissAlert}
            />
            {admin && (
              <MobileNavGroup
                id="mobile-admin"
                label="Admin"
                icon={ShieldCheck}
                links={adminLinks}
                admin={admin}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NavDropdown({
  id,
  label,
  icon: Icon,
  links,
  admin,
  orderEventVisible = false,
  livePvpVisible = false,
  openMenu,
  setOpenMenu,
  badgeHrefs = {},
  alerts = [],
  onAlertClick,
  tutorialId,
}: {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  links: NavLink[];
  admin: boolean;
  orderEventVisible?: boolean;
  livePvpVisible?: boolean;
  openMenu: string | null;
  setOpenMenu: (v: string | null) => void;
  badgeHrefs?: Record<string, number>;
  alerts?: NavAlert[];
  onAlertClick?: (alert: NavAlert) => void;
  tutorialId?: string;
}) {
  const visibleLinks = links.filter(
    (link) =>
      (!link.adminOnly || admin) &&
      (!link.eventOnly || admin || orderEventVisible) &&
      (!link.livePvpOnly || admin || livePvpVisible),
  );
  if (visibleLinks.length === 0) return null;
  const open = openMenu === id;
  const totalBadge = Object.values(badgeHrefs).reduce((s, v) => s + v, 0);

  return (
    <div
      className="relative"
      {...(tutorialId ? { "data-tutorial": tutorialId } : {})}
    >
      <button
        type="button"
        onClick={() => setOpenMenu(open ? null : id)}
        className="flex h-8 items-center rounded-xl px-3 text-xs font-semibold text-slate-400 transition-colors hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]"
      >
        <Icon size={14} className="mr-1.5" />
        {label}
        {totalBadge > 0 && (
          <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {totalBadge}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`ml-1 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className={`absolute right-0 top-10 z-50 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-slate-950/95 p-1.5 shadow-2xl ${alerts.length > 0 ? "w-80" : "w-56"}`}>
          {alerts.length > 0 && (
            <div className="mb-2 space-y-1 border-b border-white/10 pb-2">
              <p className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#FFCB05]">Novidades</p>
              {alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href}
                  prefetch={false}
                  onClick={() => onAlertClick?.(alert)}
                  className="block rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 hover:bg-cyan-400/10"
                >
                  <span className="block text-xs font-bold text-cyan-200">{alert.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[10px] leading-relaxed text-slate-300">{alert.body}</span>
                </Link>
              ))}
            </div>
          )}
          {visibleLinks.map(
            ({ href, label: itemLabel, icon: ItemIcon, beta }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={() => setOpenMenu(null)}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/5 hover:text-[#FFCB05]"
              >
                <span className="flex items-center gap-2">
                  <ItemIcon size={14} />
                  {itemLabel}
                  {beta && (
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[8px] font-black text-purple-200">
                      BETA
                    </span>
                  )}
                </span>
                {badgeHrefs[href] > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {badgeHrefs[href]}
                  </span>
                )}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function MobileNavGroup({
  id,
  label,
  icon: Icon,
  links,
  admin,
  orderEventVisible = false,
  livePvpVisible = false,
  openMenu,
  setOpenMenu,
  badgeHrefs = {},
  alerts = [],
  onAlertClick,
}: {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  links: NavLink[];
  admin: boolean;
  orderEventVisible?: boolean;
  livePvpVisible?: boolean;
  openMenu: string | null;
  setOpenMenu: (v: string | null) => void;
  badgeHrefs?: Record<string, number>;
  alerts?: NavAlert[];
  onAlertClick?: (alert: NavAlert) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popupGeometry, setPopupGeometry] = useState({ left: 12, width: 240 });
  const visibleLinks = links.filter(
    (link) =>
      (!link.adminOnly || admin) &&
      (!link.eventOnly || admin || orderEventVisible) &&
      (!link.livePvpOnly || admin || livePvpVisible),
  );
  if (visibleLinks.length === 0) return null;
  const open = openMenu === id;
  const totalBadge = Object.values(badgeHrefs).reduce((s, v) => s + v, 0);

  const toggleMenu = () => {
    if (open) {
      setOpenMenu(null);
      return;
    }
    const button = buttonRef.current;
    const root = button?.closest<HTMLElement>("[data-mobile-nav-root='true']");
    if (button && root) {
      const buttonRect = button.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const width = Math.min(alerts.length > 0 ? 320 : 240, Math.max(240, rootRect.width - 24));
      const centered = buttonRect.left - rootRect.left + (buttonRect.width - width) / 2;
      const left = Math.max(12, Math.min(centered, rootRect.width - width - 12));
      setPopupGeometry({ left, width });
    }
    setOpenMenu(id);
  };

  return (
    <div className="static min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className={`relative flex h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-[9px] font-semibold transition-colors md:h-9 md:flex-row md:gap-1 md:text-[10px] ${open ? "border-[#FFCB05]/35 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-white/5 bg-slate-950/25 text-slate-400 hover:border-[#FFCB05]/20 hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]"}`}
      >
        <Icon size={14} />
        <span className="max-w-full truncate">{label}</span>
        {totalBadge > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
            {totalBadge}
          </span>
        )}
        <ChevronDown
          size={10}
          className={`absolute bottom-1.5 right-1.5 transition md:static ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="absolute top-full z-[60] mt-1 max-h-[62vh] overflow-y-auto rounded-2xl border border-[#FFCB05]/25 bg-[#050914] p-2 shadow-2xl shadow-black/70"
          style={{ left: popupGeometry.left, width: popupGeometry.width }}
        >
          {alerts.length > 0 && (
            <div className="mb-1 space-y-1 border-b border-white/10 pb-1">
              <p className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#FFCB05]">Novidades</p>
              {alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href}
                  prefetch={false}
                  onClick={() => onAlertClick?.(alert)}
                  className="block rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2 py-2"
                >
                  <span className="block text-xs font-bold text-cyan-200">{alert.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[10px] text-slate-300">{alert.body}</span>
                </Link>
              ))}
            </div>
          )}
          {visibleLinks.map(
            ({ href, label: itemLabel, icon: ItemIcon, beta }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={() => setOpenMenu(null)}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-300 hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]"
              >
                <span className="flex items-center gap-2">
                  <ItemIcon size={13} />
                  {itemLabel}
                  {beta && (
                    <span className="rounded bg-purple-500/20 px-1 py-0.5 text-[7px] font-black text-purple-200">
                      BETA
                    </span>
                  )}
                </span>
                {badgeHrefs[href] > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {badgeHrefs[href]}
                  </span>
                )}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
