import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { OccurrenceAdmin } from "./occurrence-admin";

export const dynamic = "force-dynamic";

export default async function AdminOccurrencesPage() {
  await requirePlatformAdmin();
  return <OccurrenceAdmin />;
}
