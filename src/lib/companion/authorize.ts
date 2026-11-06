import { prisma } from "@/lib/prisma";
import { authenticateAccess } from "./auth";
import { pilotAllowed } from "./pilot";

/** Validates a bearer token against the live pilot gate, device, and account. */
export async function authorizeCompanion(request: Request) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return null;
  return authenticateAccess(header.slice(7), secret, id => prisma.companionDevice.findUnique({
    where: { id }, select: { id: true, userId: true, revokedAt: true, user: { select: { status: true } } }
  }), pilotAllowed);
}
