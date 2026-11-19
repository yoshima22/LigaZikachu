"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { REI_ASSETS } from "@/lib/rei-do-rio/assets";

// Convite do Rei do Rio: aparece uma vez por edição (por aparelho) enquanto as inscrições estão abertas.
export function ReiDoRioInviteGate({ editionId, name, closesAt }: { editionId: string; name: string; closesAt: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const key = `rdr-invite-seen-${editionId}`;
  useEffect(() => {
    if (pathname.startsWith("/combates/rei-do-rio")) return;
    try { if (localStorage.getItem(key)) return; } catch { /* sem storage: mostra */ }
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [pathname, key]);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(key, "1"); } catch { /* ignora */ } setShow(false); };
  const until = new Date(closesAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={close} role="dialog" aria-label="Convite Rei do Rio">
      <style>{`@keyframes rdr-pop{0%{opacity:0;transform:translateY(40px) scale(.9)}100%{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.rdr-pop{animation:none!important}}`}</style>
      <div className="rdr-pop w-full max-w-2xl overflow-hidden rounded-3xl border border-amber-300/50 bg-[#0a1330] shadow-[0_0_60px_rgba(251,191,36,.35)]" style={{ animation: "rdr-pop .6s cubic-bezier(.2,.9,.3,1.2) both" }} onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={REI_ASSETS.banner} alt="Rei do Rio — Trono de Natal" className="block h-auto w-full" />
        <div className="space-y-3 p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-300">Inscrições abertas</p>
          <h2 className="font-serif text-2xl font-black text-white">👑 {name}</h2>
          <p className="text-sm leading-relaxed text-slate-300">Monte 18 mascotes, dispute o Trono de terça a sexta e troque seus pontos por <b className="text-white">caixas de prêmios</b> com Mega, TMs e Ovos de Laboratório. As lutas rodam sozinhas — você só precisa se inscrever até <b className="text-white">{until}</b>.</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <button onClick={() => { close(); router.push("/combates/rei-do-rio"); }} className="rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-black text-slate-900 hover:bg-amber-300">Quero participar</button>
            <button onClick={close} className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white">Agora não</button>
          </div>
        </div>
      </div>
    </div>
  );
}
