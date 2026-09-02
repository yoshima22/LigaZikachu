"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRing, Bold, Coins, Gauge, Italic, List, Megaphone, Send, Sparkles, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishProfessorAnnouncement, sendAdminPushNotification, sendZikaCoinsToAllPlayers, updateGlobalNotice, updateAckNotice, updatePatchNotes, updateServerCostGoal } from "../actions";

export function AdminCommunicationPanel({ initialNotice, initialAck, initialPatchNotes, initialServerCostGoal }: {
  initialNotice: string;
  initialAck?: { title: string; content: string; buttonText: string; active: boolean; version: number };
  initialPatchNotes?: { title: string; content: string }[];
  initialServerCostGoal?: { title: string; percentage: number; active: boolean };
}) {
  const [notice, setNotice] = useState(initialNotice);
  const [ackTitle, setAckTitle] = useState(initialAck?.title ?? "");
  const [ackContent, setAckContent] = useState(initialAck?.content ?? "");
  const [ackButton, setAckButton] = useState(initialAck?.buttonText ?? "Entendi");
  const [pendingAck, startAck] = useTransition();
  // Patch notes: 3 páginas (título + conteúdo). Página 1 = mais recente.
  const [patch, setPatch] = useState<{ title: string; content: string }[]>(() =>
    [0, 1, 2].map((i) => ({ title: initialPatchNotes?.[i]?.title ?? "", content: initialPatchNotes?.[i]?.content ?? "" })),
  );
  const [pendingPatch, startPatch] = useTransition();
  const patchRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Aplica formatação à seleção da nota `i` (envolve com `before`/`after`, ou
  // prefixa linhas no caso de lista). Depois reposiciona o cursor.
  const applyPatchFormat = (i: number, before: string, after: string, linePrefix?: string) => {
    const ta = patchRefs.current[i];
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const value = patch[i].content;
    const sel = value.slice(start, end);
    let next: string;
    let cursor: number;
    if (linePrefix) {
      const block = sel || "";
      const formatted = block.split(/\r?\n/).map((l) => (l.trim() ? `${linePrefix}${l.replace(/^\s*[-•]\s+/, "")}` : l)).join("\n");
      next = value.slice(0, start) + formatted + value.slice(end);
      cursor = start + formatted.length;
    } else {
      next = value.slice(0, start) + before + sel + after + value.slice(end);
      cursor = start + before.length + sel.length + after.length;
    }
    setPatch((p) => p.map((n, j) => (j === i ? { ...n, content: next } : n)));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(cursor, cursor); });
  };
  const [coins, setCoins] = useState("");
  const [description, setDescription] = useState("Presente global da Liga");
  const [professorMessage, setProfessorMessage] = useState("");
  const [pushTitle, setPushTitle] = useState("Liga Zikachu");
  const [pushMessage, setPushMessage] = useState("");
  const [pushUrl, setPushUrl] = useState("/dashboard");
  const [pendingNotice, startNotice] = useTransition();
  const [pendingCoins, startCoins] = useTransition();
  const [pendingProfessor, startProfessor] = useTransition();
  const [pendingPush, startPush] = useTransition();
  const [goalTitle, setGoalTitle] = useState(initialServerCostGoal?.title ?? "Meta de Custos do Server");
  const [goalPercentage, setGoalPercentage] = useState(initialServerCostGoal?.percentage ?? 0);
  const [goalActive, setGoalActive] = useState(initialServerCostGoal?.active ?? false);
  const [pendingGoal, startGoal] = useTransition();

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-slate-950/70 to-emerald-950/20 p-5 lg:col-span-2 xl:col-span-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-emerald-300" />
              <h3 className="font-semibold text-slate-200">Meta de custos do servidor</h3>
            </div>
            <p className="mt-2 text-xs text-slate-500">Controla a barra exibida no topo do site. A porcentagem é atualizada manualmente.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            <input type="checkbox" checked={goalActive} onChange={(event) => setGoalActive(event.target.checked)} className="accent-emerald-400" />
            Exibir no site
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Texto da meta
            <input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} maxLength={80} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-emerald-400/60" placeholder="Meta de Custos do Server - Setembro" />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Progresso
            <div className="relative mt-1.5">
              <input type="number" min={0} max={100} value={goalPercentage} onChange={(event) => setGoalPercentage(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 pr-8 text-sm font-bold text-white outline-none focus:border-emerald-400/60" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
            </div>
          </label>
          <Button type="button" disabled={pendingGoal} onClick={() => startGoal(async () => {
            const result = await updateServerCostGoal({ title: goalTitle, percentage: goalPercentage, active: goalActive });
            if (result.error) toast.error(result.error);
            else if (result.goal) {
              setGoalTitle(result.goal.title);
              setGoalPercentage(result.goal.percentage);
              setGoalActive(result.goal.active);
              toast.success(result.goal.active ? "Meta publicada no topo do site." : "Meta salva e ocultada.");
            }
          })} className="h-[42px] gap-2 bg-emerald-300 text-slate-950 hover:bg-emerald-200">
            <Send size={13} /> {pendingGoal ? "Salvando..." : "Salvar meta"}
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-white/5 bg-slate-950/70 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider">
            <span className="truncate text-slate-300">{goalTitle || "Meta de Custos do Server"}</span>
            <span className="shrink-0 text-emerald-300">{Math.min(100, Math.max(0, goalPercentage || 0))}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-[#FFCB05] transition-[width]" style={{ width: `${Math.min(100, Math.max(0, goalPercentage || 0))}%` }} /></div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-slate-950/50 p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-300" />
          <h3 className="font-semibold text-slate-200">Patch notes (dashboard)</h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Até 3 notas curtas exibidas no dashboard dos jogadores (paginadas). A Página 1 é a mais recente. Deixe o conteúdo vazio para ocultar aquela página.
        </p>
        <div className="mt-3 space-y-3">
          {patch.map((note, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-slate-900/40 p-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300">Página {i + 1}{i === 0 ? " · mais recente" : ""}</p>
              <input
                value={note.title}
                onChange={(e) => setPatch((p) => p.map((n, j) => j === i ? { ...n, title: e.target.value } : n))}
                placeholder="Título (opcional)"
                maxLength={80}
                className="mb-2 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400/50"
              />
              <div className="mb-1.5 flex items-center gap-1">
                <button type="button" title="Negrito (**texto**)" onClick={() => applyPatchFormat(i, "**", "**")} className="rounded border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:text-white"><Bold size={13}/></button>
                <button type="button" title="Itálico (*texto*)" onClick={() => applyPatchFormat(i, "*", "*")} className="rounded border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:text-white"><Italic size={13}/></button>
                <button type="button" title="Sublinhado (__texto__)" onClick={() => applyPatchFormat(i, "__", "__")} className="rounded border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:text-white"><Underline size={13}/></button>
                <button type="button" title="Lista (- item)" onClick={() => applyPatchFormat(i, "", "", "- ")} className="rounded border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:text-white"><List size={13}/></button>
                <span className="ml-1 text-[9px] text-slate-500">selecione o texto e clique</span>
              </div>
              <textarea
                ref={(el) => { patchRefs.current[i] = el; }}
                value={note.content}
                onChange={(e) => setPatch((p) => p.map((n, j) => j === i ? { ...n, content: e.target.value } : n))}
                placeholder="Texto curto do patch note... (use **negrito**, *itálico*, __sublinhado__, - listas)"
                maxLength={600}
                rows={3}
                className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400/50"
              />
            </div>
          ))}
        </div>
        <Button
          disabled={pendingPatch}
          className="mt-3 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          onClick={() => startPatch(async () => {
            const r = await updatePatchNotes({ notes: patch });
            if (r.error) toast.error(r.error); else toast.success("Patch notes atualizados!");
          })}
        >
          Salvar patch notes
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-slate-950/50 p-5">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-[#FFCB05]" />
          <h3 className="font-semibold text-slate-200">Aviso global no menu</h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Escreva um aviso curto para aparecer na barra principal. Deixe vazio para esconder.
        </p>
        <textarea
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          maxLength={1000}
          rows={4}
          className="mt-3 w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
          placeholder="Ex.: Arena em manutenção hoje das 20h às 21h."
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-600">{notice.length}/1000</span>
          <Button
            type="button"
            disabled={pendingNotice}
            onClick={() => {
              startNotice(async () => {
                const result = await updateGlobalNotice(notice);
                if (result.error) toast.error(result.error);
                else {
                  setNotice(result.message ?? "");
                  toast.success(result.message ? "Aviso publicado." : "Aviso removido.");
                }
              });
            }}
            className="gap-2 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
          >
            <Send size={13} />
            {pendingNotice ? "Salvando..." : "Salvar aviso"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-slate-950/70 to-violet-950/20 p-5">
        <div className="flex items-center gap-2">
          <BellRing size={16} className="text-violet-300" />
          <h3 className="font-semibold text-slate-200">Notificação no aplicativo</h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">Envia um push para todos os aparelhos registrados automaticamente.</p>
        <input value={pushTitle} onChange={(event) => setPushTitle(event.target.value)} maxLength={80} className="mt-3 w-full rounded-xl border border-violet-500/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60" placeholder="Título" />
        <textarea value={pushMessage} onChange={(event) => setPushMessage(event.target.value)} maxLength={240} rows={3} className="mt-2 w-full rounded-xl border border-violet-500/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60" placeholder="Mensagem da notificação" />
        <input value={pushUrl} onChange={(event) => setPushUrl(event.target.value)} maxLength={180} className="mt-2 w-full rounded-xl border border-violet-500/20 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-400/60" placeholder="/pagina-de-destino" />
        <Button type="button" disabled={pendingPush || pushMessage.trim().length < 3} onClick={() => {
          if (!confirm("Enviar esta notificação para todos os aparelhos instalados?")) return;
          startPush(async () => {
            const result = await sendAdminPushNotification({ title: pushTitle, message: pushMessage, url: pushUrl });
            if ("error" in result) toast.error(result.error);
            else { toast.success(`${result.sent} aparelho(s) notificado(s).`); setPushMessage(""); }
          });
        }} className="mt-3 gap-2 bg-violet-300 text-slate-950 hover:bg-violet-200 disabled:opacity-40">
          <Send size={13} /> {pendingPush ? "Enviando..." : "Enviar push"}
        </Button>
      </div>

      <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-950/70 to-cyan-950/20 p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-300" />
          <h3 className="font-semibold text-slate-200">Professor Enguiça informa</h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Entra na fila de novidades de todos os jogadores. Cada jogador verá a mensagem uma única vez.
        </p>
        <textarea
          value={professorMessage}
          onChange={(event) => setProfessorMessage(event.target.value)}
          maxLength={320}
          rows={4}
          className="mt-3 w-full rounded-xl border border-cyan-500/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
          placeholder="Ex.: O Professor Enguiça informa que as inscrições da Liga TCG estão abertas!"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-600">{professorMessage.length}/320</span>
          <Button
            type="button"
            disabled={pendingProfessor || professorMessage.trim().length < 3}
            onClick={() => {
              startProfessor(async () => {
                const result = await publishProfessorAnnouncement(professorMessage);
                if (result.error) toast.error(result.error);
                else {
                  setProfessorMessage("");
                  toast.success("Mensagem do Professor Enguiça enviada.");
                }
              });
            }}
            className="gap-2 bg-cyan-300 text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            <Send size={13} />
            {pendingProfessor ? "Publicando..." : "Publicar mensagem"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-950/50 p-5">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-[#FFCB05]" />
          <h3 className="font-semibold text-slate-200">Enviar ZikaCoins para todos</h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Credita ZC na carteira de todos os jogadores ativos e registra transação admin.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[130px_1fr]">
          <input
            value={coins}
            onChange={(e) => setCoins(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Quantidade"
            className="w-full min-w-0 rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={160}
            placeholder="Descrição da transação"
            className="w-full min-w-0 rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
          />
        </div>
        <Button
          type="button"
          disabled={pendingCoins || !coins}
          onClick={() => {
            const amount = Number(coins);
            if (!amount) { toast.error("Informe a quantidade."); return; }
            if (!confirm(`Enviar ${amount.toLocaleString("pt-BR")} ZC para todos os jogadores ativos?`)) return;
            startCoins(async () => {
              const result = await sendZikaCoinsToAllPlayers(amount, description);
              if (result.error) toast.error(result.error);
              else {
                toast.success(`${result.sent} jogador(es) receberam ${amount.toLocaleString("pt-BR")} ZC.`);
                setCoins("");
              }
            });
          }}
          className="mt-3 gap-2 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40"
        >
          <Coins size={13} />
          {pendingCoins ? "Enviando..." : "Enviar ZC para todos"}
        </Button>
      </div>

      {/* Aviso com confirmação — modal único que todos precisam ler e fechar */}
      <div className="rounded-2xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <BellRing size={16} className="text-[#FFCB05]" />
          <h3 className="font-semibold text-slate-200">Aviso com confirmação (modal único)</h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Aparece uma única vez em qualquer página até o jogador ler e apertar o botão. Publicar de novo faz o aviso reaparecer para todos.
          {initialAck ? ` Versão atual: ${initialAck.version}${initialAck.active ? " (ativo)" : " (inativo)"}.` : ""}
        </p>
        <input
          value={ackTitle}
          onChange={(e) => setAckTitle(e.target.value)}
          maxLength={120}
          placeholder="Título (ex.: Regras atualizadas da liga)"
          className="mt-3 w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
        />
        <textarea
          value={ackContent}
          onChange={(e) => setAckContent(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Conteúdo do aviso que todos devem ler."
          className="mt-2 w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
        />
        <input
          value={ackButton}
          onChange={(e) => setAckButton(e.target.value)}
          maxLength={40}
          placeholder='Texto do botão (ex.: "Li e concordo")'
          className="mt-2 w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            disabled={pendingAck}
            onClick={() => startAck(async () => {
              const res = await updateAckNotice({ title: ackTitle, content: ackContent, buttonText: ackButton, active: true });
              if (res.error) toast.error(res.error);
              else toast.success(`Aviso publicado (versão ${res.version}). Aparecerá para todos.`);
            })}
            className="gap-2 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40"
          >
            <Send size={13} />
            {pendingAck ? "Publicando..." : "Publicar aviso (mostra p/ todos)"}
          </Button>
          <Button
            disabled={pendingAck}
            variant="outline"
            onClick={() => startAck(async () => {
              const res = await updateAckNotice({ title: ackTitle, content: ackContent, buttonText: ackButton, active: false });
              if (res.error) toast.error(res.error);
              else toast.success("Aviso desativado.");
            })}
            className="gap-2"
          >
            Desativar
          </Button>
        </div>
      </div>
    </div>
  );
}
