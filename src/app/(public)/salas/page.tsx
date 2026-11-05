import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/permissions";
import { CreateRoomForm } from "./create-room-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ZikaChat",
  description: "Crie uma sala com chat, voz e compartilhamento de tela, sem cadastro.",
};

export default async function QuickRoomHomePage() {
  const user = await getSessionUser().catch(() => null);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-8">
      <div>
        <Link
          href={user ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:border-[#FFCB05]/60 hover:text-[#FFCB05]"
        >
          <ArrowLeft size={16} /> {user ? "Voltar à Liga" : "Página inicial"}
        </Link>
      </div>
      <div className="w-full space-y-5 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#FFCB05]">Liga Zikachu</p>
          <h1 className="text-2xl font-bold text-white">ZikaChat</h1>
          <p className="text-sm text-slate-400">
            Crie uma sala e compartilhe o link. Chat, voz e compartilhamento de tela, sem cadastro. A sala some quando todo mundo sai.
          </p>
        </div>
        <CreateRoomForm />
        <p className="text-xs text-slate-500">Até 13 pessoas por sala (a tela fica mais leve quanto mais gente assiste). Quem tiver o link (e a senha, se houver) entra.</p>
      </div>
    </main>
  );
}
