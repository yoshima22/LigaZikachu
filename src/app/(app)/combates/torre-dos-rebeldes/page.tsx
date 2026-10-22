import Link from "next/link";
import { redirect } from "next/navigation";
import { TowerLobby } from "./_components/tower-lobby";
import { TowerHero } from "./_components/tower-hero";
import { requireTowerAccess } from "./actions";

export const dynamic = "force-dynamic";

// Guard server-side: apenas admins e contas de teste liberadas explicitamente.
export default async function TorreDosRebeldesPage() {
  const user = await requireTowerAccess();
  if (!user) redirect("/combates");

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <TowerHero />

      <TowerLobby />

      <details className="rounded-2xl border border-purple-400/20 bg-slate-950/70 p-4 text-sm text-slate-300">
        <summary className="cursor-pointer font-black text-purple-200">🎨 Guia para gerar peças modulares do mapa</summary>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">Gere cada peça separadamente em PNG quadrado, vista superior ortográfica, fundo transparente, iluminação violeta gótica e sem personagens. Mantenha exatamente a mesma câmera e escala em todas.</p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><span className="rounded-lg bg-black/30 p-2">Pisos: comum, rachado, rúnico e abismo</span><span className="rounded-lg bg-black/30 p-2">Paredes: reta, canto, junção e pilar</span><span className="rounded-lg bg-black/30 p-2">Portas: selada, fechada, aberta e destruída</span><span className="rounded-lg bg-black/30 p-2">Eventos: armadilha, escada, altar e saída</span></div>
        <p className="mt-3 rounded-lg border border-slate-800 bg-black/30 p-3 text-[11px] text-slate-400"><strong className="text-white">Prompt-base:</strong> “modular gothic haunted tower dungeon tile, orthographic top-down view, dark stone, purple spectral light, ornate black iron and gold details, transparent background, centered, no text, no characters, consistent 1:1 game asset, 512×512”.</p>
      </details>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-[11px] text-slate-500">
        <p>Ambiente restrito para validação do evento. O administrador pode liberar contas específicas para testes multiplayer sem abrir o modo ao restante da Liga.</p>
        <div className="mt-3">
          <Link href="/combates/liga-rush" className="font-bold text-[#FFCB05] hover:underline">← Voltar aos Combates</Link>
        </div>
      </section>
    </main>
  );
}
