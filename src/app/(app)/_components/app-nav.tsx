"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false, tutorialId: undefined },
  { href: "/torneios", label: "Torneios", icon: Trophy, adminOnly: false, tutorialId: "nav-torneios" },
  { href: "/noticias", label: "Noticias", icon: Newspaper, adminOnly: false, tutorialId: undefined }
];

const combatLinks = [
  { href: "/arena-z", label: "Arena Z", icon: Swords, adminOnly: false },
  { href: "/lacos", label: "Laços", icon: Heart, adminOnly: false },
  { href: "/desafio-sincronizado", label: "Arena Sincronizada", icon: Ticket, adminOnly: false },
  { href: "/combates/cacada-de-rastros", label: "Caçada de Rastros", icon: Footprints, adminOnly: true },
  { href: "/combates/liga-semanal", label: "Liga Semanal", icon: Trophy, adminOnly: false },
];

const rankingLinks = [
  { href: "/ranking", label: "Ranking Geral", icon: BarChart3, adminOnly: false },
  { href: "/mascotes/ranking", label: "Ranking Mascotes", icon: Trophy, adminOnly: false },
  { href: "/top-do-dia", label: "Top do Dia", icon: Crown, adminOnly: false },
  { href: "/temporadas", label: "Temporadas", icon: Calendar, adminOnly: false }
];

const colecaoLinks = [
  { href: "/mascotes",  label: "Mascotes",    icon: Heart,        adminOnly: false },
  { href: "/pokedex",   label: "Pokedex",     icon: Search,       adminOnly: false },
  { href: "/professor", label: "Prof. Enguiça", icon: Sparkles,   adminOnly: false },
  { href: "/album",     label: "Álbum",       icon: BookOpen,     adminOnly: false },
  { href: "/manual",    label: "Manual",      icon: BookOpen,     adminOnly: false },
  { href: "/carteira",  label: "Carteira",    icon: Coins,        adminOnly: false },
  { href: "/inventario", label: "Inventário", icon: Package,      adminOnly: false }
];

const mercadoLinks = [
  { href: "/bazar",    label: "Bazar",     icon: Store,       adminOnly: false },
  { href: "/shop",     label: "ZikaShop",  icon: ShoppingBag, adminOnly: false },
  { href: "/zikabet",  label: "ZikaBet",   icon: Swords,      adminOnly: false },
  { href: "/zikaloot",    label: "ZikaLoot",    icon: Ticket,        adminOnly: false },
  { href: "/laboratorio", label: "Laboratório", icon: FlaskConical,  adminOnly: false },
];

// profileLinks é dinâmico — usa playerId para o link do perfil público
function buildProfileLinks(playerId?: string) {
  return [
    { href: playerId ? `/jogadores/${playerId}` : "/perfil", label: "Meu Perfil", icon: User, adminOnly: false },
    { href: "/mensagens", label: "Mensagens", icon: MessageSquare, adminOnly: false },
    { href: "/perfil", label: "Configurações", icon: User, adminOnly: false },
    { href: "/perfil/meus-decks", label: "Meus Decks", icon: BookOpen, adminOnly: false },
    { href: "/conquistas", label: "Conquistas", icon: Trophy, adminOnly: false },
    { href: "/insignias", label: "Insignias", icon: Medal, adminOnly: false },
    { href: "/caixa-de-presentes", label: "Presentes", icon: Gift, adminOnly: false },
    { href: "/codigos", label: "Codigos", icon: Package, adminOnly: false },
    { href: "/passe-apoiador", label: "Passe Apoiador", icon: Star, adminOnly: false },
    { href: "/jogadores", label: "Jogadores", icon: Users, adminOnly: false }
  ];
}

const adminLinks = [
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true }
];

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly: boolean;
  tutorialId?: string;
};

export function AppNav({ admin, variant = "desktop", giftCount = 0, unreadDms = 0, bazarAlerts = 0, unreadNews = 0, playerId }: { admin: boolean; variant?: "desktop" | "mobile"; giftCount?: number; unreadDms?: number; bazarAlerts?: number; unreadNews?: number; playerId?: string }) {
  const profileLinks = buildProfileLinks(playerId);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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
    <div ref={rootRef}>
      {variant === "desktop" && (
      <nav className="hidden items-center gap-1 md:flex">
        {mainLinks
          .filter((link) => !link.adminOnly || admin)
          .map(({ href, label, icon: Icon, tutorialId }) => (
            <Link key={href} href={href} prefetch={false} onClick={() => setOpenMenu(null)} {...(tutorialId ? { "data-tutorial": tutorialId } : {})}>
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
          badgeHrefs={{ "/bazar": bazarAlerts }}
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
          badgeHrefs={{ "/caixa-de-presentes": giftCount, "/mensagens": unreadDms }}
          tutorialId="nav-perfil"
        />
        {adminLinks
          .filter((link) => !link.adminOnly || admin)
          .map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} prefetch={false} onClick={() => setOpenMenu(null)}>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-400 transition-colors hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]"
              >
                <Icon size={14} className="mr-1.5" />
                {label}
              </Button>
            </Link>
          ))}
      </nav>
      )}

      {variant === "mobile" && (
      <div className="md:hidden px-4 pb-3">
        <div className="flex flex-wrap items-center gap-1">
          {mainLinks
            .filter((link) => !link.adminOnly || admin)
            .map(({ href, label, icon: Icon, tutorialId }) => (
              <Link key={href} href={href} prefetch={false} onClick={() => setOpenMenu(null)} {...(tutorialId ? { "data-tutorial": tutorialId } : {})}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative shrink-0 whitespace-nowrap rounded-lg px-2 text-xs text-slate-400 hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]"
                >
                  <Icon size={13} className="mr-1" />
                  {label}
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
            badgeHrefs={{ "/bazar": bazarAlerts }}
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
            badgeHrefs={{ "/caixa-de-presentes": giftCount }}
          />
          {admin && (
            <Link href="/admin" prefetch={false} onClick={() => setOpenMenu(null)}>
              <Button variant="ghost" size="sm" className="shrink-0 whitespace-nowrap rounded-lg px-2 text-xs text-slate-400 hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]">
                <ShieldCheck size={13} className="mr-1" />
                Admin
              </Button>
            </Link>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function NavDropdown({
  id, label, icon: Icon, links, admin, openMenu, setOpenMenu, badgeHrefs = {}, tutorialId
}: {
  id: string; label: string; icon: typeof LayoutDashboard; links: NavLink[];
  admin: boolean; openMenu: string | null; setOpenMenu: (v: string | null) => void;
  badgeHrefs?: Record<string, number>; tutorialId?: string;
}) {
  const visibleLinks = links.filter((link) => !link.adminOnly || admin);
  if (visibleLinks.length === 0) return null;
  const open = openMenu === id;
  const totalBadge = Object.values(badgeHrefs).reduce((s, v) => s + v, 0);

  return (
    <div className="relative" {...(tutorialId ? { "data-tutorial": tutorialId } : {})}>
      <button type="button" onClick={() => setOpenMenu(open ? null : id)}
        className="flex h-8 items-center rounded-xl px-3 text-xs font-semibold text-slate-400 transition-colors hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]">
        <Icon size={14} className="mr-1.5" />
        {label}
        {totalBadge > 0 && (
          <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {totalBadge}
          </span>
        )}
        <ChevronDown size={13} className={`ml-1 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 min-w-48 rounded-2xl border border-border bg-slate-950/95 p-2 shadow-2xl">
          {visibleLinks.map(({ href, label: itemLabel, icon: ItemIcon }) => (
            <Link key={href} href={href} prefetch={false} onClick={() => setOpenMenu(null)}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-[#FFCB05]">
              <span className="flex items-center gap-2"><ItemIcon size={14} />{itemLabel}</span>
              {badgeHrefs[href] > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {badgeHrefs[href]}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileNavGroup({
  id, label, icon: Icon, links, admin, openMenu, setOpenMenu, badgeHrefs = {}
}: {
  id: string; label: string; icon: typeof LayoutDashboard; links: NavLink[];
  admin: boolean; openMenu: string | null; setOpenMenu: (v: string | null) => void;
  badgeHrefs?: Record<string, number>;
}) {
  const visibleLinks = links.filter((link) => !link.adminOnly || admin);
  if (visibleLinks.length === 0) return null;
  const open = openMenu === id;
  const totalBadge = Object.values(badgeHrefs).reduce((s, v) => s + v, 0);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpenMenu(open ? null : id)}
        className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-slate-400 transition-colors hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]">
        <Icon size={13} />
        {label}
        {totalBadge > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {totalBadge}
          </span>
        )}
        <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-[60] min-w-44 max-h-[60vh] overflow-y-auto rounded-xl border border-[#FFCB05]/15 bg-[#0b1020]/95 p-1 shadow-2xl shadow-black/40 backdrop-blur">
          {visibleLinks.map(({ href, label: itemLabel, icon: ItemIcon }) => (
            <Link key={href} href={href} prefetch={false} onClick={() => setOpenMenu(null)}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-300 hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]">
              <span className="flex items-center gap-2"><ItemIcon size={13} />{itemLabel}</span>
              {badgeHrefs[href] > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {badgeHrefs[href]}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
