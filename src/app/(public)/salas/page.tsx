import type { Metadata } from "next";
import { CreateRoomForm } from "./create-room-form";

export const metadata: Metadata = {
  title: "Sala rápida",
  description: "Crie uma sala com chat, voz e compartilhamento de tela, sem cadastro.",
};

export default function QuickRoomHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <div className="w-full space-y-5 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#FFCB05]">Liga Zikachu</p>
          <h1 className="text-2xl font-bold text-white">Sua tela, ao vivo.</h1>
          <p className="text-sm text-slate-400">
            Crie uma sala e compartilhe o link. Chat, voz e tela, sem cadastro. A sala some quando todo mundo sai.
          </p>
        </div>
        <CreateRoomForm />
        <p className="text-xs text-slate-500">Até 6 pessoas por sala. Quem tiver o link (e a senha, se houver) entra.</p>
      </div>
    </main>
  );
}
