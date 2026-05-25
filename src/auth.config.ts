import type { NextAuthConfig } from "next-auth";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login"
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isAdminRoute = nextUrl.pathname.startsWith("/admin");
      const isProtectedRoute =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/jogadores") ||
        nextUrl.pathname.startsWith("/perfil") ||
        nextUrl.pathname.startsWith("/temporadas") ||
        nextUrl.pathname.startsWith("/torneios") ||
        isAdminRoute;

      if (isAdminRoute) {
        return Boolean(auth?.user?.role && adminRoles.has(auth.user.role));
      }

      if (isProtectedRoute) {
        return isLoggedIn;
      }

      return true;
    }
  }
} satisfies NextAuthConfig;

export default authConfig;