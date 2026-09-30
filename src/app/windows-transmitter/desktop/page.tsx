import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { DesktopLauncher } from "./desktop-launcher";

export const dynamic = "force-dynamic";

export default async function DesktopLaunchPage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  const session = await getAppSession();
  const { title } = await searchParams;
  const destination = `/windows-transmitter/desktop${title ? `?title=${encodeURIComponent(title)}` : ""}`;
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
  return <DesktopLauncher name={session.user.name || session.user.email || "Jogador"} />;
}
