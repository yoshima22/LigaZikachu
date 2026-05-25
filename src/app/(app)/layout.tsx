import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const admin = isAdmin(session.user.role);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">Liga Zikachu</p>
            <p className="text-sm text-slate-300">
              {session.user.name ?? session.user.email} · {session.user.role}
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-sm">Dashboard</Button>
            </Link>
            <Link href="/jogadores">
              <Button variant="ghost" className="text-sm">Jogadores</Button>
            </Link>
            {admin && (
              <>
                <Link href="/temporadas">
                  <Button variant="ghost" className="text-sm">Temporadas</Button>
                </Link>
                <Link href="/admin">
                  <Button variant="ghost" className="text-sm">Admin</Button>
                </Link>
              </>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="outline" className="text-sm">
                Sair
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
