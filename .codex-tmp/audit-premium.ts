import { PrismaClient } from "@prisma/client";
import { addPremiumListingHighlights } from "../src/lib/bazar-premium";

const prisma = new PrismaClient();
async function main() {
const players = await prisma.player.findMany({
  where: { displayName: { contains: "Luiz", mode: "insensitive" } },
  select: {
    id: true,
    displayName: true,
    userId: true,
    wallet: { select: { balance: true } },
    bazarListings: {
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        category: true,
        listingType: true,
        feeCharged: true,
        premiumUntil: true,
        createdAt: true,
        payload: true,
      },
    },
  },
  take: 10,
});
const config = await prisma.miauvadaoConfig.findUnique({
  where: { id: "singleton" },
  select: { vaultBalance: true, premiumTickerNextAt: true, premiumTickerLastListingId: true },
});
const premiumCount = await prisma.bazarListing.count({ where: { status: { in: ["ACTIVE", "RESERVED"] }, premiumUntil: { gt: new Date() } } });
const currentPremium = await prisma.bazarListing.findMany({
  where: { status: "ACTIVE", premiumUntil: { gt: new Date() } },
  select: { id: true, category: true, payload: true, priceCoins: true },
});
const premiumHighlights = await addPremiumListingHighlights(currentPremium);
let advisoryLockResult: unknown = null;
let advisoryLockError: unknown = null;
try {
  advisoryLockResult = await prisma.$transaction(async (tx) => tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext('bazar-premium-listings'))`);
} catch (error) {
  advisoryLockError = error;
}
console.log(JSON.stringify({ players, config, premiumCount, premiumHighlights, advisoryLockResult, advisoryLockError: String(advisoryLockError ?? "") }, null, 2));
await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
