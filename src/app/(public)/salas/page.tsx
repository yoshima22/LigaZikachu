import type { Metadata } from "next";
import Link from "next/link";
import { CreateRoomForm } from "./create-room-form";

export const metadata: Metadata = {
  title: "ZikaChat",
  description: "Crie uma sala com chat, voz e compartilhamento de tela, sem cadastro.",
};

export default function QuickRoomHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <div className="w-full space-y-5 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#FFCB05]">Liga Zikachu</p>
          <h1 className="text-2xl font-bold text-white">ZikaChat</h1>
          <p className="text-sm text-slate-400">
            Crie uma sala e compartilhe o link. Chat, voz e compartilhamento de tela, sem cadastro. A sala some quando todo mundo sai.
          </p>
        </div>
        <CreateRoomForm />
        <Link href="/" className="block text-xs text-slate-500 hover:text-slate-300">← Voltar para a Liga Zikachu</Link>
        <p className="text-xs text-slate-500">Até 13 pessoas por sala (a tela fica mais leve quanto mais gente assiste). Quem tiver o link (e a senha, se houver) entra.</p>
      </div>
    </main>
  );
}
