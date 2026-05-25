export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/jogadores/:path*", "/perfil/:path*", "/temporadas/:path*", "/admin/:path*"]
};
