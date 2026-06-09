import { getMyPassStatus, PASS_SCHEDULE } from "./actions";
import { PassPageClient } from "./_components/pass-page-client";
import { getSessionUser } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PasseApoiadorPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const status = await getMyPassStatus();

  return (
    <PassPageClient
      status={status}
      schedule={PASS_SCHEDULE}
    />
  );
}
