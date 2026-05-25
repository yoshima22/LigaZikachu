"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createTournament, seedDefaultWeeks } from "../../actions";

export function CreateTournamentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    edition: "",
    description: "",
    startDate: "",
    endDate: "",
    maxPlayers: "",
    registrationOpensAt: "",
    registrationClosesAt: ""
  });

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Auto-gerar slug a partir do nome
    if (name === "name") {
      const slug = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setForm((prev) => ({ ...prev, slug }));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createTournament({
        name: form.name,
        slug: form.slug,
        edition: form.edition || null,
        description: form.description || null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : new Date().toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        maxPlayers: form.maxPlayers ? parseInt(form.maxPlayers, 10) : null,
        registrationOpensAt: form.registrationOpensAt
          ? new Date(form.registrationOpensAt).toISOString()
          : null,
        registrationClosesAt: form.registrationClosesAt
          ? new Date(form.registrationClosesAt).toISOString()
          : null
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.slug && result.id) {
        // Seed as semanas padrão automaticamente usando o ID já retornado
        await seedDefaultWeeks(result.id);
        toast.success("Torneio criado com sucesso!");
        router.push(`/torneios/${result.slug}`);
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-[#FFCB05]/50 focus:outline-none focus:ring-1 focus:ring-[#FFCB05]/30 transition-colors";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelCls}>Nome *</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} required
            placeholder="Ex: 3ª Edição Liga Zikachu" className={inputCls} />
        </div>
        <div>
          <label htmlFor="slug" className={labelCls}>Slug *</label>
          <input id="slug" name="slug" value={form.slug} onChange={handleChange} required
            placeholder="ex-3a-edicao-liga" className={inputCls} />
          <p className="mt-1 text-xs text-slate-500">Auto-preenchido. Usado na URL.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="edition" className={labelCls}>Edição</label>
          <input id="edition" name="edition" value={form.edition} onChange={handleChange}
            placeholder="Ex: 3ª edição" className={inputCls} />
        </div>
        <div>
          <label htmlFor="maxPlayers" className={labelCls}>Máximo de jogadores</label>
          <input id="maxPlayers" name="maxPlayers" type="number" min="2" max="256"
            value={form.maxPlayers} onChange={handleChange} placeholder="Ex: 8" className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>Descrição</label>
        <textarea id="description" name="description" value={form.description}
          onChange={handleChange} rows={3} placeholder="Descrição do torneio..."
          className={inputCls + " resize-none"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className={labelCls}>Data de início *</label>
          <input id="startDate" name="startDate" type="datetime-local" value={form.startDate}
            onChange={handleChange} required className={inputCls} />
        </div>
        <div>
          <label htmlFor="endDate" className={labelCls}>Data de fim</label>
          <input id="endDate" name="endDate" type="datetime-local" value={form.endDate}
            onChange={handleChange} className={inputCls} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="registrationOpensAt" className={labelCls}>Inscrições abertas em</label>
          <input id="registrationOpensAt" name="registrationOpensAt" type="datetime-local"
            value={form.registrationOpensAt} onChange={handleChange} className={inputCls} />
        </div>
        <div>
          <label htmlFor="registrationClosesAt" className={labelCls}>Inscrições encerram em</label>
          <input id="registrationClosesAt" name="registrationClosesAt" type="datetime-local"
            value={form.registrationClosesAt} onChange={handleChange} className={inputCls} />
        </div>
      </div>

      <p className="text-xs text-slate-500 bg-slate-900/40 rounded-lg px-3 py-2 border border-border">
        As 8 semanas com modos do regulamento serão geradas automaticamente após criar o torneio.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Criando..." : "Criar Torneio"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
