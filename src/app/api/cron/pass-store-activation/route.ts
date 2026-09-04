import { NextResponse } from "next/server";
import { processDuePassStoreActivation } from "@/lib/pass-store-activation";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await processDuePassStoreActivation());
  } catch (error) {
    console.error("[PassStoreActivationCron]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no processamento." }, { status: 500 });
  }
}
