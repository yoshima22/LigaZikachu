import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getAppSession();
    if (session?.user) {
      return NextResponse.json({ ok: true }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
