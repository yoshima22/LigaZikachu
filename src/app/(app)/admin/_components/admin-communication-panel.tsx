"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRing, Coins, Megaphone, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishProfessorAnnouncement, sendAdminPushNotification, sendZikaCoinsToAllPlayers, updateGlobalNotice, updateAckNotice } from "../actions";

export function AdminCommunicationPanel({ initialNotice, initialAck }: {
  initialNotice: string;
  initialAck?: { title: string; content: string; buttonText: string; active: boolean; version: number };
}) {
  const [notice, setNotice] = useState(initialNotice);
  const [ackTitle, setAckTitle] = useState(initialAck?.title ?? "");
  const [ackContent, setAckContent] = useState(initialAck?.content ?? "");
  const [ackButton, setAckButton] = useState(initialAck?.buttonText ?? "Entendi");
  const [pendingAck, startAck] = useTransition();
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

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
        <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
          <input
            value={coins}
            onChange={(e) => setCoins(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Quantidade"
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={160}
            placeholder="Descrição da transação"
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
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
