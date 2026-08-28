import { getInboxAction } from "./actions";
import { InboxWithSearch } from "./_components/inbox-with-search";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default async function MensagensPage() {
  const result = await getInboxAction();
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-8 text-center">
        <h1 className="font-semibold text-white">Não foi possível carregar as mensagens</h1>
        <p className="mt-1 text-sm text-slate-400">{result.error}</p>
        <Link href={`/mensagens?retry=${Date.now()}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E]">
          <RefreshCw size={14} /> Tentar novamente
        </Link>
      </div>
    );
  }

  return (
    <InboxWithSearch conversations={result.conversations} />
  );
}
