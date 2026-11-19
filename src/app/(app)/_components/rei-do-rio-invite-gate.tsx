"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { REI_ASSETS } from "@/lib/rei-do-rio/assets";
import { InviteModal } from "../amigo-oculto/_components/invite-modal";

// Convite do Rei do Rio: aparece uma vez por edição (por aparelho) enquanto as inscrições estão abertas. Clicar na imagem abre a página do evento.
export function ReiDoRioInviteGate({ editionId }: { editionId: string }) {
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
  return <InviteModal onClose={close} href="/combates/rei-do-rio" image={REI_ASSETS.invite} alt="Convite: Rei do Rio — Trono de Natal. Jotapê convida você para disputar o Trono." label="Conhecer o Rei do Rio — Trono de Natal" />;
}
