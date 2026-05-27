import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown, Crown, Gift, LayoutDashboard, Medal, Package, User, Users, Trophy, Calendar, ShieldCheck, LogOut, Zap } from "lucide-react";
import { Toaster } from "sonner";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/torneios", label: "Torneios", icon: Trophy, adminOnly: false }
];

const rankingLinks = [
  { href: "/ranking", label: "Ranking Geral", icon: BarChart3, adminOnly: false },
  { href: "/top-do-dia", label: "Top do Dia", icon: Crown, adminOnly: false },
  { href: "/temporadas", label: "Temporadas", icon: Calendar, adminOnly: true }
];

const profileLinks = [
  { href: "/perfil", label: "Meu Perfil", icon: User, adminOnly: false },
  { href: "/insignias", label: "Insignias", icon: Medal, adminOnly: false },
  { href: "/caixa-de-presentes", label: "Presentes", icon: Gift, adminOnly: false },
  { href: "/codigos", label: "Codigos", icon: Package, adminOnly: false },
  { href: "/jogadores", label: "Jogadores", icon: Users, adminOnly: false }
];

const adminLinks = [
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true }
];

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const admin = isAdmin(session.user.role);

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
        <header className="sticky top-0 z-40 border-b border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#1e1e3a] to-[#1A1A2E] backdrop-blur-md">
          {/* Top bar with glow effect */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#FFCB05] to-transparent opacity-60"></div>
          
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
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

            <nav className="hidden md:flex items-center gap-1">
              {mainLinks
                .filter((l) => !l.adminOnly || admin)
                .map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-400 hover:text-[#FFCB05] hover:bg-[#FFCB05]/10 transition-colors"
                    >
                      <Icon size={14} className="mr-1.5" />
                      {label}
                    </Button>
                  </Link>
                ))}
              <NavDropdown label="Ranking" icon={BarChart3} links={rankingLinks} admin={admin} />
              <NavDropdown label="Perfil" icon={User} links={profileLinks} admin={admin} />
              {adminLinks
                .filter((l) => !l.adminOnly || admin)
                .map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-400 hover:text-[#FFCB05] hover:bg-[#FFCB05]/10 transition-colors"
                    >
                      <Icon size={14} className="mr-1.5" />
                      {label}
                    </Button>
                  </Link>
                ))}
            </nav>

            {/* User + logout */}
            <div className="flex items-center gap-3">
              <Link href="/perfil" className="hidden text-right hover:text-[#FFCB05] sm:block">
                <p className="text-xs font-medium text-slate-200 leading-tight">
                  {session.user.name ?? session.user.email}
                </p>
                <p className="text-[10px] text-[#FFCB05]/70">{session.user.role}</p>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <Button type="submit" variant="ghost" size="sm"
                  className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                  <LogOut size={14} />
                </Button>
              </form>
            </div>
          </div>

          {/* Nav mobile */}
          <div className="grid gap-2 px-4 pb-3 md:hidden">
            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {mainLinks
                .filter((l) => !l.adminOnly || admin)
                .map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 whitespace-nowrap text-xs text-slate-400 hover:text-[#FFCB05]"
                    >
                      <Icon size={13} className="mr-1" />
                      {label}
                    </Button>
                  </Link>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MobileNavGroup label="Ranking" links={rankingLinks} admin={admin} />
              <MobileNavGroup label="Perfil" links={profileLinks} admin={admin} />
            </div>
            {admin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-slate-400 hover:text-[#FFCB05]">
                  <ShieldCheck size={13} className="mr-1" />
                  Admin
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </>
  );
}

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly: boolean;
};

function NavDropdown({
  label,
  icon: Icon,
  links,
  admin
}: {
  label: string;
  icon: typeof LayoutDashboard;
  links: NavLink[];
  admin: boolean;
}) {
  const visibleLinks = links.filter((link) => !link.adminOnly || admin);
  if (visibleLinks.length === 0) return null;

  return (
    <details className="group relative">
      <summary className="flex h-8 cursor-pointer list-none items-center rounded-xl px-3 text-xs font-semibold text-slate-400 transition-colors hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]">
        <Icon size={14} className="mr-1.5" />
        {label}
        <ChevronDown size={13} className="ml-1 transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-10 z-50 min-w-48 rounded-2xl border border-border bg-slate-950/95 p-2 shadow-2xl">
        {visibleLinks.map(({ href, label: itemLabel, icon: ItemIcon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-[#FFCB05]"
          >
            <ItemIcon size={14} />
            {itemLabel}
          </Link>
        ))}
      </div>
    </details>
  );
}

function MobileNavGroup({ label, links, admin }: { label: string; links: NavLink[]; admin: boolean }) {
  const visibleLinks = links.filter((link) => !link.adminOnly || admin);
  if (visibleLinks.length === 0) return null;

  return (
    <details className="rounded-xl border border-border bg-slate-950/40">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-slate-300">
        {label}
        <ChevronDown size={13} />
      </summary>
      <div className="border-t border-border p-1">
        {visibleLinks.map(({ href, label: itemLabel, icon: ItemIcon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-[#FFCB05]"
          >
            <ItemIcon size={13} />
            {itemLabel}
          </Link>
        ))}
      </div>
    </details>
  );
}
