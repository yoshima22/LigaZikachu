import { redirect } from "next/navigation";
import { Role, UserStatus } from "@prisma/client";
import { getAppSession } from "@/lib/session";

export function isAdmin(role: Role) {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export function isApproved(status: UserStatus) {
  return status === UserStatus.ACTIVE;
}

export async function getSessionUser() {
  // Verifica NextAuth E lz_session (fallback manual)
  const session = await getAppSession();
  if (!session?.user) return null;
  return session.user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) redirect("/dashboard");
  return user;
}

export async function requireRole(roles: Role[]) {
  const user = await getSessionUser();
  if (!user || !roles.includes(user.role as Role)) redirect("/dashboard");
  return user;
}
