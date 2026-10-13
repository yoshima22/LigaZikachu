"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { JOHTO_INVITATION_COPY, JOHTO_VOTE_QUESTIONS } from "@/lib/johto-invitation-copy";
import {
  openJohtoInvitationAction,
  skipJohtoInvitationVoteAction,
  submitJohtoInvitationVoteAction,
} from "../combates/raid-johto/invitation-actions";

type Candidate = { id: string; displayName: string };
type Stage = "envelope" | "opening" | "reading" | "voting" | "submitted";

const previewCandidates: Candidate[] = [
  { id: "preview-a", displayName: "Treinador A" },
  { id: "preview-b", displayName: "Treinador B" },
  { id: "preview-c", displayName: "Treinador C" },
];

export function JohtoInvitationLetter({
  mode,
  candidates = [],
  onClose,
  onFinish,
}: {
  mode: "player" | "preview";
  candidates?: Candidate[];
  onClose?: () => void;
  onFinish?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("envelope");
  const [page, setPage] = useState(0);
  const [voteIndex, setVoteIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const choices = mode === "preview" ? previewCandidates : candidates;
  const totalPages = JOHTO_INVITATION_COPY.pages.length;
  const question = JOHTO_VOTE_QUESTIONS[voteIndex];

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (dialogRef.current?.querySelector<HTMLElement>('[aria-label="Abrir convite de Johto"]') ?? dialogRef.current?.querySelector<HTMLElement>("button"))?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (mode === "preview") {
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
      onClose?.();
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

  return (
    <div className="johto-invitation-backdrop" role="presentation">
      <div className="johto-invitation-glow" aria-hidden="true" />
      <div ref={dialogRef} className="johto-invitation-dialog" role="dialog" aria-modal="true" aria-labelledby="johto-invitation-title" aria-describedby="johto-invitation-description" tabIndex={-1}>
        <div className="johto-invitation-topline">
          <span>✦ UMA MENSAGEM DE JOHTO ✦</span>
          {mode === "preview" && <button type="button" className="johto-invitation-preview-close" onClick={onClose}>Fechar prévia <span aria-hidden="true">×</span></button>}
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
              <span className="johto-envelope-seal" aria-hidden="true"><span>J</span><span>J</span></span>
            </button>
            <p className="johto-invitation-hint">{stage === "opening" ? "Abrindo o convite…" : "Toque no selo para abrir"}</p>
          </div>
        )}

        {(stage === "reading" || stage === "voting" || stage === "submitted") && (
          <div className="johto-letter-shell">
            <div className="johto-letter-header">
              <span className="johto-letter-mark" aria-hidden="true">J</span>
              <div>
                <span className="johto-letter-eyebrow">LIGA ZIKACHU TCG · EDIÇÃO JOHTO</span>
                <h2 id="johto-invitation-title" ref={headingRef} tabIndex={-1}>
                  {stage === "reading" ? ("heading" in JOHTO_INVITATION_COPY.pages[page] ? JOHTO_INVITATION_COPY.pages[page].heading : JOHTO_INVITATION_COPY.title) : stage === "voting" ? JOHTO_INVITATION_COPY.voting.title : "Voto enviado!"}
                </h2>
              </div>
            </div>
            <p id="johto-invitation-description" className="sr-only">{stage === "reading" ? `Página ${page + 1} de ${totalPages} do convite` : stage === "voting" ? `Pergunta ${voteIndex + 1} de ${JOHTO_VOTE_QUESTIONS.length}` : "Fim da votação"}</p>

            {stage === "reading" && (
              <div className="johto-letter-page" key={page}>
                {page === 0 && <p className="johto-letter-greeting">{JOHTO_INVITATION_COPY.greeting}</p>}
                <div className="johto-letter-body">
                  {JOHTO_INVITATION_COPY.pages[page].paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                <div className="johto-letter-footer">
                  <span>CONVITE Nº {String(page + 1).padStart(2, "0")}</span>
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
                    <p>{JOHTO_INVITATION_COPY.voting.description}</p>
                    <button type="button" className="johto-letter-primary" onClick={() => setStage("voting")} disabled={choices.length === 0}>{JOHTO_INVITATION_COPY.voting.participateLabel}</button>
                    <button type="button" className="johto-letter-secondary" onClick={continueToJohto} disabled={busy}>{JOHTO_INVITATION_COPY.voting.continueLabel}</button>
                    {choices.length === 0 && <p className="johto-letter-empty">A votação ainda não tem participantes disponíveis.</p>}
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
                <p>Obrigado por participar. Seus votos foram registrados em segredo.</p>
                <button type="button" className="johto-letter-primary" onClick={mode === "preview" ? onClose : onFinish}>{JOHTO_INVITATION_COPY.voting.continueLabel}</button>
              </div>
            )}
          </div>
        )}
        {error && <p className="johto-invitation-error" role="alert">{error}</p>}
        {mode === "preview" && <span className="johto-invitation-preview-tag">PRÉVIA · NENHUM DADO SERÁ SALVO</span>}
      </div>
    </div>
  );
}
