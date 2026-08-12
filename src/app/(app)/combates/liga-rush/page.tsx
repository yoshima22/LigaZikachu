import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { getRushDataAction } from "./actions";
import { RushLeagueClient } from "./rush-league-client";

export const dynamic = "force-dynamic";

export default async function RushLeaguePage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const data = await getRushDataAction();
  return <RushLeagueClient initialData={data as never} />;
}
