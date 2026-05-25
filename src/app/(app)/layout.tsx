import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Trophy, Calendar, ShieldCheck, LogOut } from "lucide-react";
import { Toaster } from "sonner";

const navLinks = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard, adminOnly: false },
  { href: "/torneios",   label: "Torneios",   icon: Trophy,           adminOnly: false },
  { href: "/jogadores",  label: "Jogadores",  icon: Users,            adminOnly: false },
  { href: "/temporadas", label: "Temporadas", icon: Calendar,         adminOnly: true  },
  { href: "/admin",      label: "Admin",      icon: ShieldCheck,      adminOnly: true  }
];

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
      <div className="min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border/50 bg-[#1A1A2E]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFCB05] shadow-[0_0_12px_rgba(255,203,5,0.3)]">
                <span className="font-pixel text-[9px] font-bold text-[#1A1A2E] leading-none">LZ</span>
              </div>
              <span className="font-pixel text-xs text-[#FFCB05] hidden sm:block leading-tight">
                Liga Zikachu
              </span>
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
                      className="text-xs text-slate-400 hover:text-slate-100 hover:bg-white/5"
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
                <p className="text-[10px] text-slate-500">{session.user.role}</p>
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
                    className="text-xs text-slate-400 whitespace-nowrap shrink-0 hover:text-slate-100"
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
