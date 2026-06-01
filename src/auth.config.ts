import type { NextAuthConfig } from "next-auth";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login"
  },
  providers: [],
  callbacks: {
    // ── session callback roda no Edge também ──────────────────────────────────
    // Propaga role e status do JWT para session.user, necessário para que
    // o middleware authorized() consiga verificar permissões de admin.
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
      const role = (auth?.user as any)?.role as string | undefined;

      const isAdminRoute    = nextUrl.pathname.startsWith("/admin");
      const isProtectedRoute =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/jogadores") ||
        nextUrl.pathname.startsWith("/perfil") ||
        nextUrl.pathname.startsWith("/temporadas") ||
        nextUrl.pathname.startsWith("/torneios") ||
        isAdminRoute;

      if (isAdminRoute) {
        return Boolean(role && adminRoles.has(role));
      }

      if (isProtectedRoute) {
        return isLoggedIn;
      }

      return true;
    }
  }
} satisfies NextAuthConfig;

export default authConfig;
