"use server";

import { getAppSession } from "@/lib/session";
import { getRefugeHistoryPage, getRefugeReport } from "@/lib/refuge-history";
import { z } from "zod";

const inputSchema = z.object({
  location: z.enum(["GARDEN", "TRAINING", "REST", "YARD"]),
  page: z.number().int().min(1).max(50), query: z.string().max(120),
  kind: z.enum(["ALL", "SOCIAL", "CONFLICT"]),
});

export async function getRefugeHistoryAction(input: z.infer<typeof inputSchema>) {
  if (!(await getAppSession())?.user) throw new Error("Sessão expirada.");
  const { location, page, query, kind } = inputSchema.parse(input);
  const [history, report] = await Promise.all([getRefugeHistoryPage(location, page, query, kind), getRefugeReport(location)]);
  return { ...history, report };
}
