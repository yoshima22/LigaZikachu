"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/permissions";
import { saveManualContent } from "@/lib/manual-content";

const saveSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(2000),
});

export async function saveManualText(input: z.infer<typeof saveSchema>) {
  const user = await requireAdmin();
  const { key, value } = saveSchema.parse(input);
  await saveManualContent(key, value.trim(), user.id);
  revalidatePath("/manual");
  return { success: true };
}
