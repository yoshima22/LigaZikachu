import { NextResponse } from "next/server";
import { listPublicQuickRooms } from "@/lib/quick-room";

export async function GET() {
  return NextResponse.json({ rooms: await listPublicQuickRooms(12) });
}
