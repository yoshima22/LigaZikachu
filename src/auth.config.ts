import type { NextAuthConfig } from "next-auth";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login"
  },
  providers: [],
  callbacks: {
    // Propaga role/status do JWT para session.user no Edge runtime
    session({ session, token }) {
      if (session.user && token) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any;
        u.id     = token.sub ?? "";
        u.role   = (token.role as string)   ?? "PLAYER";
        u.status = (token.status as string) ?? "PENDING_APPROVAL";
      }
      return session;
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = auth?.user as any;
      const role: string | undefined = u?.role ?? undefined;

      const isAdminRoute = nextUrl.pathname.startsWith("/admin");
      const isProtectedRoute =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/jogadores") ||
        nextUrl.pathname.startsWith("/perfil") ||
        nextUrl.pathname.startsWith("/temporadas") ||
        nextUrl.pathname.startsWith("/torneios") ||
        isAdminRoute;

      if (isAdminRoute) {
        // Não logado → vai para login
        if (!isLoggedIn) return false;
        // Logado sem role admin → vai para dashboard (NÃO faz logout)
        // Evita desconexões involuntárias quando role não está no JWT ainda
        if (!role || !adminRoles.has(role)) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (isProtectedRoute) return isLoggedIn;

      return true;
    }
  }
} satisfies NextAuthConfig;

export default authConfig;
