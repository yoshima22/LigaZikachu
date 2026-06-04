import type { NextAuthConfig } from "next-auth";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login"
  },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user && token) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any;
        u.id = token.sub ?? "";
        u.role = (token.role as string) ?? "PLAYER";
        u.status = (token.status as string) ?? "PENDING_APPROVAL";
      }
      return session;
    },

    authorized({ auth, request }) {
      const { nextUrl } = request;
      const isLoggedIn = Boolean(auth?.user);
      const hasManualSession = Boolean(request.cookies.get("lz_session")?.value);

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
        if (!isLoggedIn && !hasManualSession) return false;
        if (hasManualSession && !isLoggedIn) return true;
        if (!role || !adminRoles.has(role)) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (isProtectedRoute) return isLoggedIn || hasManualSession;

      return true;
    }
  }
} satisfies NextAuthConfig;

export default authConfig;
