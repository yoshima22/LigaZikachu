import { Role, UserStatus } from "@prisma/client";

export function isAdmin(role: Role) {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export function isApproved(status: UserStatus) {
  return status === UserStatus.ACTIVE;
}
