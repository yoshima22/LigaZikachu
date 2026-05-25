import { redirect } from "next/navigation";
import { Role, UserStatus } from "@prisma/client";
import { auth } from "@/auth";

export function isAdmin(role: Role) {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export function isApproved(status: UserStatus) {
  return status === UserStatus.ACTIVE;
}

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!isAdmin(user.role)) redirect("/dashboard");
  return user;
}

export async function requireRole(roles: Role[]) {
  const user = await getSessionUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
