"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { REI_ASSETS } from "@/lib/rei-do-rio/assets";
import { InviteModal } from "../amigo-oculto/_components/invite-modal";

const seen = (k: string) => { try { return !!localStorage.getItem(k); } catch { return false; } };

// Convite do Rei do Rio: aparece uma vez por edição (por aparelho) enquanto as inscrições estão abertas; clicar na imagem abre o evento.
// `waitForKey`: se outro convite (Amigo Oculto) estiver pendente, espera ele ser fechado para não empilhar dois popups.
export function ReiDoRioInviteGate({ editionId, waitForKey }: { editionId: string; waitForKey?: string }) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const key = `rdr-invite-seen-${editionId}`;
  useEffect(() => {
    if (pathname.startsWith("/combates/rei-do-rio") || seen(key)) return;
    const t = setInterval(() => { if (!waitForKey || seen(waitForKey)) { clearInterval(t); setShow(true); } }, 1500);
    return () => clearInterval(t);
  }, [pathname, key, waitForKey]);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(key, "1"); } catch { /* ignora */ } setShow(false); };
  return <InviteModal onClose={close} href="/combates/rei-do-rio" image={REI_ASSETS.invite} alt="Convite: Rei do Rio — Trono de Natal. Jotapê convida você para disputar o Trono." label="Conhecer o Rei do Rio — Trono de Natal" />;
}
