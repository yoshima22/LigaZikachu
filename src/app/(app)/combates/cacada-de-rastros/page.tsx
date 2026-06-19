import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getTracePageDataAction } from "./actions";
import { TraceClient } from "./_components/trace-client";

export const dynamic = "force-dynamic";

export default async function CacadaDeRastrosPage() {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) {
    redirect("/dashboard");
  }

  const data = await getTracePageDataAction();
  if ("error" in data) {
    return (
      <div className="py-20 text-center text-sm text-red-400">
        {data.error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TraceClient initialData={data as any} />
    </div>
  );
}
