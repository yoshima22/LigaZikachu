import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { DesktopLauncher } from "./desktop-launcher";

export const dynamic = "force-dynamic";

export default async function DesktopLaunchPage() {
  const session = await getAppSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/windows-transmitter/desktop");
  return <DesktopLauncher name={session.user.name || session.user.email || "Jogador"} />;
}
