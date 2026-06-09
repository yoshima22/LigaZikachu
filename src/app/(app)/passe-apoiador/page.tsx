import { getMyPassStatus } from "./actions";
import { PASS_SCHEDULE } from "./schedule";
import { PassPageClient } from "./_components/pass-page-client";
import { getSessionUser } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PasseApoiadorPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const searchParams = await searchParamsPromise;
  const status = await getMyPassStatus(searchParams.passId || undefined);

  return (
    <PassPageClient
      status={status}
      schedule={PASS_SCHEDULE}
    />
  );
}
