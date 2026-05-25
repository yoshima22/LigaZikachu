import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Trophy, Calendar, ShieldCheck, LogOut, Zap } from "lucide-react";
import { Toaster } from "sonner";

const navLinks = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard, adminOnly: false },
  { href: "/torneios",   label: "Torneios",   icon: Trophy,           adminOnly: false },
  { href: "/jogadores",  label: "Jogadores",  icon: Users,            adminOnly: false },
  { href: "/temporadas", label: "Temporadas", icon: Calendar,         adminOnly: true  },
  { href: "/admin",      label: "Admin",      icon: ShieldCheck,      adminOnly: true  }
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

            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks
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
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-slate-200 leading-tight">
                  {session.user.name ?? session.user.email}
                </p>
                <p className="text-[10px] text-[#FFCB05]/70">{session.user.role}</p>
              </div>
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
          <div className="flex md:hidden overflow-x-auto gap-1 px-4 pb-2 scrollbar-none">
            {navLinks
              .filter((l) => !l.adminOnly || admin)
              .map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-400 whitespace-nowrap shrink-0 hover:text-[#FFCB05]"
                  >
                    <Icon size={13} className="mr-1" />
                    {label}
                  </Button>
                </Link>
              ))}
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </>
  );
}
