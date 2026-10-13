"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { JOHTO_INVITATION_COPY, JOHTO_VOTE_QUESTIONS } from "@/lib/johto-invitation-copy";
import {
  openJohtoInvitationAction,
  skipJohtoInvitationVoteAction,
  submitJohtoInvitationVoteAction,
} from "../combates/raid-johto/invitation-actions";

type Candidate = { id: string; displayName: string };
type Stage = "envelope" | "opening" | "reading" | "voting" | "submitted";

function JohtoCrestArtwork() {
  return (
    <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <circle cx="36" cy="36" r="30" fill="none" stroke="#f7d984" strokeWidth="2.4" />
      <circle cx="36" cy="36" r="25.5" fill="none" stroke="#6f4c88" strokeWidth="1.5" />
      <path d="M36 12v6M36 54v6M12 36h6M54 36h6M19 19l4 4M49 49l4 4M53 19l-4 4M23 49l-4 4" stroke="#f8e4a5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 37c8-1 13-5 17-13l4 8-5 13c-5-4-10-6-16-8Zm46 0c-8-1-13-5-17-13l-4 8 5 13c5-4 10-6 16-8Z" fill="#eac575" stroke="#5d3d71" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M21 36c5-2 8-5 10-9M51 36c-5-2-8-5-10-9M19 39c5 0 8 2 11 5M53 39c-5 0-8 2-11 5" fill="none" stroke="#fff0bc" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m36 23 7 12-7 14-7-14 7-12Z" fill="#705186" stroke="#f8df91" strokeWidth="2" strokeLinejoin="round" />
      <path d="m36 27 3.5 8-3.5 8-3.5-8 3.5-8Z" fill="#bda4c9" />
      <path d="M31 50q5 5 10 0" fill="none" stroke="#f7d984" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function JohtoInvitationLetter({
  mode,
  candidates = [],
  displayName,
  voteSubmitted = false,
  onClose,
  onFinish,
}: {
  mode: "player" | "preview" | "review";
  candidates?: Candidate[];
  displayName?: string | null;
  voteSubmitted?: boolean;
  onClose?: () => void;
  onFinish?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("envelope");
  const [page, setPage] = useState(0);
  const [voteIndex, setVoteIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const choices = candidates;
  const totalPages = JOHTO_INVITATION_COPY.pages.length;
  const question = JOHTO_VOTE_QUESTIONS[voteIndex];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (dialogRef.current?.querySelector<HTMLElement>('[aria-label="Abrir convite de Johto"]') ?? dialogRef.current?.querySelector<HTMLElement>("button"))?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (mode !== "player") {
          event.preventDefault();
          onClose?.();
        }
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      returnFocusRef.current?.focus();
    };
  }, [mode, onClose]);

  useEffect(() => {
    if (stage === "reading" || stage === "voting" || stage === "submitted") headingRef.current?.focus();
  }, [stage, page, voteIndex]);

  async function openLetter() {
    if (busy || stage !== "envelope") return;
    setError("");
    setBusy(true);
    if (mode === "player") {
      const result = await openJohtoInvitationAction();
      if (!result.ok) {
        setError(result.message);
        setBusy(false);
        return;
      }
    }
    setStage("opening");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      setStage("reading");
      setBusy(false);
    }, reduced ? 0 : 1050);
  }

  async function continueToJohto() {
    if (busy) return;
    setError("");
    if (mode === "preview") {
      setStage("submitted");
      return;
    }
    setBusy(true);
    const result = await skipJohtoInvitationVoteAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onFinish?.();
  }

  async function submitVote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (mode === "preview") {
      setStage("submitted");
      return;
    }
    const formData = new FormData();
    for (const item of JOHTO_VOTE_QUESTIONS) formData.set(item.key, answers[item.key] ?? "");
    setBusy(true);
    const result = await submitJohtoInvitationVoteAction(formData);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStage("submitted");
  }

  if (!mounted) return null;

  return createPortal(
    <div className="johto-invitation-backdrop" role="presentation">
      <div className="johto-invitation-glow" aria-hidden="true" />
      <div ref={dialogRef} className="johto-invitation-dialog" role="dialog" aria-modal="true" aria-labelledby="johto-invitation-title" aria-describedby="johto-invitation-description" tabIndex={-1}>
        <div className="johto-invitation-topline">
          <span>✦ UMA MENSAGEM DE JOHTO ✦</span>
          {mode !== "player" && <button type="button" className="johto-invitation-preview-close" onClick={onClose}>{mode === "preview" ? "Fechar prévia" : "Fechar carta"} <span aria-hidden="true">×</span></button>}
        </div>

        {(stage === "envelope" || stage === "opening") && (
          <div className="johto-invitation-arrival">
            <p id="johto-invitation-description" className="johto-invitation-kicker">Um convite especial chegou para você.</p>
            <h2 id="johto-invitation-title" className="johto-invitation-arrival-title">Johto chama por você</h2>
            <button type="button" className={`johto-envelope ${stage === "opening" ? "johto-envelope-opening" : ""}`} onClick={openLetter} disabled={busy} aria-label="Abrir convite de Johto">
              <span className="johto-envelope-left" aria-hidden="true" />
              <span className="johto-envelope-right" aria-hidden="true" />
              <span className="johto-envelope-flap" aria-hidden="true" />
              <span className="johto-envelope-paper" aria-hidden="true">JOHTO · LIGA ZIKACHU</span>
              <span className="johto-envelope-seal" aria-hidden="true"><span><JohtoCrestArtwork /></span><span><JohtoCrestArtwork /></span></span>
            </button>
            <p className="johto-invitation-hint">{stage === "opening" ? "Abrindo o convite…" : "Toque no selo para abrir"}</p>
          </div>
        )}

        {(stage === "reading" || stage === "voting" || stage === "submitted") && (
          <div className="johto-letter-shell">
            <div className="johto-letter-header">
              <span className="johto-letter-mark" aria-hidden="true"><JohtoCrestArtwork /></span>
              <div>
                <span className="johto-letter-eyebrow">LIGA ZIKACHU TCG · EDIÇÃO JOHTO</span>
                <h2 id="johto-invitation-title" ref={headingRef} tabIndex={-1}>
                  {stage === "reading" ? ("heading" in JOHTO_INVITATION_COPY.pages[page] ? JOHTO_INVITATION_COPY.pages[page].heading : JOHTO_INVITATION_COPY.title) : stage === "voting" ? JOHTO_INVITATION_COPY.voting.title : mode === "preview" ? "Prévia concluída" : "Voto enviado!"}
                </h2>
              </div>
            </div>
            <p id="johto-invitation-description" className="sr-only">{stage === "reading" ? `Página ${page + 1} de ${totalPages} do convite` : stage === "voting" ? `Pergunta ${voteIndex + 1} de ${JOHTO_VOTE_QUESTIONS.length}` : "Fim da votação"}</p>

            {stage === "reading" && (
              <div className="johto-letter-page" key={page}>
                {page === 0 && <p className="johto-letter-greeting">{JOHTO_INVITATION_COPY.greeting} {displayName?.trim() || "Treinador(a)"}!</p>}
                <div className="johto-letter-body">
                  {JOHTO_INVITATION_COPY.pages[page].paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                <div className="johto-letter-footer">
                  <span>CONVITE PÁGINA {String(page + 1).padStart(2, "0")}</span>
                  <span>{String(page + 1).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}</span>
                </div>
                <div className="johto-letter-progress" role="progressbar" aria-label="Progresso da leitura" aria-valuemin={1} aria-valuemax={totalPages} aria-valuenow={page + 1}>
                  <span style={{ transform: `scaleX(${(page + 1) / totalPages})` }} />
                </div>
                {page < totalPages - 1 ? (
                  <div className="johto-letter-actions">
                    {page > 0 && <button type="button" className="johto-letter-secondary" onClick={() => setPage(page - 1)}>Página anterior</button>}
                    <button type="button" className="johto-letter-primary" onClick={() => setPage(page + 1)}>Próxima página <span aria-hidden="true">→</span></button>
                  </div>
                ) : (
                  <div className="johto-letter-final">
                    {mode === "review" ? (
                      <>
                        <p>{voteSubmitted ? "Sua votação da Liga Zikachu TCG 3ª Edição já foi registrada e não pode ser alterada." : "A votação da Liga Zikachu TCG 3ª Edição é opcional e pode ser acessada pelo convite original."}</p>
                        <button type="button" className="johto-letter-secondary" onClick={() => setPage(page - 1)}>Página anterior</button>
                        <button type="button" className="johto-letter-primary" onClick={onClose}>Fechar carta</button>
                      </>
                    ) : (
                      <>
                        <p>{JOHTO_INVITATION_COPY.voting.description}</p>
                        <button type="button" className="johto-letter-secondary" onClick={() => setPage(page - 1)}>Página anterior</button>
                        <button type="button" className="johto-letter-primary" onClick={() => setStage("voting")} disabled={choices.length === 0}>{JOHTO_INVITATION_COPY.voting.participateLabel}</button>
                        <button type="button" className="johto-letter-secondary johto-letter-continue" onClick={continueToJohto} disabled={busy}>{JOHTO_INVITATION_COPY.voting.continueLabel}</button>
                        {choices.length === 0 && <p className="johto-letter-empty">A votação ainda não tem participantes disponíveis.</p>}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {stage === "voting" && (
              <form className="johto-vote-form" onSubmit={submitVote}>
                <p className="johto-vote-intro">{JOHTO_INVITATION_COPY.voting.description}</p>
                <div className="johto-vote-progress">Pergunta {voteIndex + 1} de {JOHTO_VOTE_QUESTIONS.length}</div>
                <fieldset>
                  <legend>{question.label}</legend>
                  <div className="johto-vote-choices">
                    {choices.map((candidate) => (
                      <label key={candidate.id} className={`johto-vote-choice ${answers[question.key] === candidate.id ? "johto-vote-choice-selected" : ""}`}>
                        <input type="radio" name={question.key} value={candidate.id} checked={answers[question.key] === candidate.id} onChange={() => setAnswers({ ...answers, [question.key]: candidate.id })} />
                        <span>{candidate.displayName}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="johto-letter-actions">
                  <button type="button" className="johto-letter-secondary" onClick={() => voteIndex > 0 ? setVoteIndex(voteIndex - 1) : setStage("reading")} disabled={busy}>Voltar</button>
                  {voteIndex < JOHTO_VOTE_QUESTIONS.length - 1 ? (
                    <button type="button" className="johto-letter-primary" onClick={() => setVoteIndex(voteIndex + 1)} disabled={!answers[question.key]}>Próxima pergunta <span aria-hidden="true">→</span></button>
                  ) : (
                    <button type="submit" className="johto-letter-primary" disabled={busy || JOHTO_VOTE_QUESTIONS.some((item) => !answers[item.key])}>{busy ? "Enviando…" : "Enviar meus seis votos"}</button>
                  )}
                </div>
                <button type="button" className="johto-vote-skip" onClick={continueToJohto} disabled={busy}>{JOHTO_INVITATION_COPY.voting.continueLabel}</button>
              </form>
            )}

            {stage === "submitted" && (
              <div className="johto-letter-submitted">
                <p>{mode === "preview" ? "Prévia concluída. Nenhum voto foi registrado e nenhum dado foi salvo." : "Obrigado por participar. Seus votos foram registrados em segredo."}</p>
                <button type="button" className="johto-letter-primary" onClick={mode === "preview" ? onClose : onFinish}>{JOHTO_INVITATION_COPY.voting.continueLabel}</button>
              </div>
            )}
          </div>
        )}
        {error && <p className="johto-invitation-error" role="alert">{error}</p>}
        {mode === "preview" && <span className="johto-invitation-preview-tag">PRÉVIA · NENHUM DADO SERÁ SALVO</span>}
      </div>
    </div>,
    document.body,
  );
}
