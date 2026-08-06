import { requireAdmin } from "@/lib/auth/permissions";
import { AdminMascotRegistry } from "./registry-client";

export default async function AdminMascotsPage() {
  await requireAdmin();
  return <AdminMascotRegistry />;
}
