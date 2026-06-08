"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSiteSettings } from "../actions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Power, PowerOff, AlertTriangle, Check } from "lucide-react";

const KNOWN_PAGES = [
  { slug: "album", label: "Album de figurinhas", icon: "Book" },
  { slug: "arena-z", label: "Arena Z", icon: "Swords" },
  { slug: "bazar", label: "Bazar", icon: "Store" },
  { slug: "caixa-de-presentes", label: "Caixa de presentes", icon: "Gift" },
  { slug: "carteira", label: "Carteira", icon: "Coins" },
  { slug: "codigos", label: "Codigos", icon: "Package" },
  { slug: "conquistas", label: "Conquistas", icon: "Trophy" },
  { slug: "dashboard", label: "Dashboard", icon: "Layout" },
  { slug: "inventario", label: "Inventario", icon: "Package" },
  { slug: "mascotes", label: "Mascotes", icon: "Paw" },
  { slug: "perfil", label: "Perfil", icon: "User" },
  { slug: "pokedex", label: "Pokedex", icon: "Book" },
  { slug: "ranking", label: "Ranking", icon: "BarChart" },
  { slug: "shop", label: "Shop", icon: "ShoppingBag" },
  { slug: "temporadas", label: "Temporadas", icon: "Calendar" },
  { slug: "top-do-dia", label: "Top do dia", icon: "Star" },
  { slug: "torneios", label: "Torneios", icon: "Trophy" },
  { slug: "zikabet", label: "Zikabet", icon: "Dices" },
  { slug: "zikaloot", label: "Zikaloot", icon: "Treasure" },
];

interface Props {
  initial: {
    id: string;
    maintenanceMode: boolean;
    maintenanceMessage: string | null;
    disabledPages: string[];
  };
}

export function SiteSettingsPanel({ initial }: Props) {
  const [maintenanceMode, setMaintenanceMode] = useState(initial.maintenanceMode);
  const [maintenanceMessage, setMaintenanceMessage] = useState(initial.maintenanceMessage ?? "");
  const [disabledPages, setDisabledPages] = useState(new Set(initial.disabledPages));
  const [pending, startTransition] = useTransition();

  const togglePage = (slug: string) => {
    const next = new Set(disabledPages);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setDisabledPages(next);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateSiteSettings(initial.id || null, {
        maintenanceMode,
        maintenanceMessage: maintenanceMessage || null,
        disabledPages: [...disabledPages],
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Configuracoes salvas!");
      }
    });
  };

  return (
    <Card className="space-y-4 p-4">
      <div>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" />
          Controle de Paginas
        </CardTitle>
        <CardDescription className="mt-1">
          Desligue paginas para usuarios comuns. Admins continuam acessando normalmente.
        </CardDescription>
      </div>

      {/* Maintenance Mode */}
      <div className="rounded-xl border border-border bg-slate-950/60 p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-white">Modo de Manutencao</p>
            <p className="text-xs text-slate-500">
              Quando ativado, todos os usuarios sao redirecionados para a pagina de manutencao. Admins continuam acessando normalmente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMaintenanceMode((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold transition-colors ${
              maintenanceMode
                ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            {maintenanceMode ? <PowerOff size={14} /> : <Power size={14} />}
            {maintenanceMode ? "DESLIGADO" : "LIGADO"}
          </button>
        </div>
        {maintenanceMode && (
          <label className="block mt-2">
            <span className="text-xs text-slate-400">Mensagem de manutencao</span>
            <input
              type="text"
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              placeholder="Estamos em manutencao. Voltamos ja!"
              className="mt-1 w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
            />
          </label>
        )}
      </div>

      {/* Pages toggle */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {KNOWN_PAGES.map((page) => {
          const isOff = disabledPages.has(page.slug);
          return (
            <div
              key={page.slug}
              onClick={() => togglePage(page.slug)}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                isOff
                  ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                  : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">{page.label}</span>
                {isOff ? (
                  <PowerOff size={14} className="text-red-400" />
                ) : (
                  <Power size={14} className="text-emerald-400" />
                )}
              </div>
              <p className="mt-1 text-[10px] text-slate-500">/{page.slug}</p>
            </div>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={pending} className="w-full bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
        {pending ? "Salvando..." : "Salvar configuracoes"}
      </Button>
    </Card>
  );
}
