import { Gift } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { RedeemForm } from "./redeem-form";

export const dynamic = "force-dynamic";

export default async function ResgatarPage() {
  const session = await getAppSession();
  if (!session?.user) return null;
  return (
    <div className="mx-auto max-w-lg space-y-4 py-6">
      <div className="flex items-center gap-3">
        <Gift className="text-primary" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Resgatar código</h1>
          <p className="text-sm text-slate-400">Digite um código promocional para receber o prêmio.</p>
        </div>
      </div>
      <RedeemForm />
    </div>
  );
}
