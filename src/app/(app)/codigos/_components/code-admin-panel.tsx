"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { DistributionReason, SeasonStatus } from "@prisma/client";
import { Download, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  importBoosterCodesAction,
  reserveCodesForPlayerAction
} from "../actions";

interface SeasonOption {
  id: string;
  name: string;
  status: SeasonStatus;
}

interface PlayerOption {
  id: string;
  displayName: string;
}

interface CodeAdminPanelProps {
  seasons: SeasonOption[];
  players: PlayerOption[];
  defaultSeasonId: string;
  availableCount: number;
}

const inputClass =
  "w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30";

const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500";

const reasonLabels: Record<DistributionReason, string> = {
  TOP_OF_DAY: "Top do Dia",
  PARTICIPATION: "Participacao",
  WEEKLY_WINNER: "Vencedor semanal",
  SEASON_REWARD: "Premio da temporada",
  MANUAL_ADJUSTMENT: "Ajuste manual"
};

export function CodeAdminPanel({
  seasons,
  players,
  defaultSeasonId,
  availableCount
}: CodeAdminPanelProps) {
  const [rawCodes, setRawCodes] = useState("");
  const [sourceBatch, setSourceBatch] = useState("");
  const [rewardLabel, setRewardLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [importSeasonId, setImportSeasonId] = useState(defaultSeasonId);
  const [distributionSeasonId, setDistributionSeasonId] = useState(defaultSeasonId);
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<DistributionReason>(DistributionReason.MANUAL_ADJUSTMENT);
  const [reasonDetail, setReasonDetail] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);

  const parsedPreview = useMemo(() => {
    return rawCodes
      .trim()
      .split(/\r?\n/)
      .map((line) => line.replace(/;+\s*$/, "").trim())
      .filter(Boolean)
      .join("\n")
      .split(/[\r?\n,;\s]+/)
      .map((code) => code.trim())
      .filter((code) => code.length > 0)
      .slice(0, 4);
  }, [rawCodes]);

  const parsedCount = useMemo(() => {
    return rawCodes
      .trim()
      .split(/\r?\n/)
      .map((line) => line.replace(/;+\s*$/, "").trim())
      .filter(Boolean)
      .join("\n")
      .split(/[\r?\n,;\s]+/)
      .map((code) => code.trim())
      .filter((code) => code.length > 0).length;
  }, [rawCodes]);

  async function handleImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rawCodes.trim()) {
      toast.error("Informe ao menos um codigo.");
      return;
    }
    setIsImporting(true);
    try {
      const result = await importBoosterCodesAction({
        rawCodes,
        seasonId: importSeasonId || null,
        sourceBatch: sourceBatch || null,
        rewardLabel: rewardLabel || null,
        expiresAt: expiresAt || null,
        notes: notes || null
      });

      if (result?.error) {
        if (result.skipped?.length) {
          toast.warning(`${result.skipped.length} codigo(s) ja estavam cadastrados e foram removidos da importacao.`);
          setRawCodes("");
          return;
        }

        toast.error(result.error);
        return;
      }

      const msg = result?.imported
        ? `${result.imported} codigo(s) valido(s) importado(s).`
        : "";
      const skippedMsg = result?.skipped?.length
        ? `${result.skipped.length} codigo(s) ja existiam e foram ignorados.`
        : "";

      if (result?.skipped?.length) {
        toast.warning([msg, skippedMsg].filter(Boolean).join(" "));
      } else {
        toast.success(msg || "Codigos importados.");
      }
      setRawCodes("");
      setSourceBatch("");
      setRewardLabel("");
      setExpiresAt("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar codigos");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDistribution(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = Number.parseInt(quantity, 10);
    setIsDistributing(true);
    try {
      const result = await reserveCodesForPlayerAction({
        playerId,
        seasonId: distributionSeasonId || null,
        quantity: Number.isFinite(amount) ? amount : 1,
        reason,
        reasonDetail: reasonDetail || null
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${result?.distributed ?? 0} codigo(s) enviado(s) para a caixa de presentes do jogador.`);
      setQuantity("1");
      setReasonDetail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao distribuir codigos");
    } finally {
      setIsDistributing(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Importar codigos</h2>
            <p className="mt-1 text-xs text-slate-400">
              Cole uma lista separada por quebra de linha, virgula, ponto-e-virgula ou espaco.
            </p>
          </div>
          <Upload className="mt-0.5 text-slate-500" size={18} />
        </div>

        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label htmlFor="rawCodes" className={labelClass}>
              Codigos
            </label>
            <textarea
              id="rawCodes"
              value={rawCodes}
              onChange={(event) => setRawCodes(event.target.value)}
              rows={7}
              required
              placeholder={"LIGA-ZIKA-001\nLIGA-ZIKA-002\nLIGA-ZIKA-003\n\nOu separados por ; ou ,"}
              className={`${inputClass} resize-y font-mono text-xs`}
            />
            {parsedPreview.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Previa: {parsedPreview.join(", ")}
                {parsedCount > 4 ? ` (+${parsedCount - 4} outros)` : ""}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="importSeasonId" className={labelClass}>
                Temporada
              </label>
              <select
                id="importSeasonId"
                value={importSeasonId}
                onChange={(event) => setImportSeasonId(event.target.value)}
                className={inputClass}
              >
                <option value="">Global</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sourceBatch" className={labelClass}>
                Lote
              </label>
              <input
                id="sourceBatch"
                value={sourceBatch}
                onChange={(event) => setSourceBatch(event.target.value)}
                placeholder="Ex: Maio 2026"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rewardLabel" className={labelClass}>
                Recompensa
              </label>
              <input
                id="rewardLabel"
                value={rewardLabel}
                onChange={(event) => setRewardLabel(event.target.value)}
                placeholder="Ex: Booster semanal"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="expiresAt" className={labelClass}>
                Expira em
              </label>
              <input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className={labelClass}>
              Notas
            </label>
            <input
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observacao interna opcional"
              className={inputClass}
            />
          </div>

          <Button type="submit" disabled={isImporting}>
            <Download size={16} className="mr-2" />
            {isImporting ? "Importando..." : `Importar ${parsedCount > 0 ? parsedCount : ""} codigo(s)`}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Distribuir para jogador</h2>
            <p className="mt-1 text-xs text-slate-400">
              Reserva os codigos disponiveis mais antigos e registra auditoria.
            </p>
          </div>
          <Send className="mt-0.5 text-slate-500" size={18} />
        </div>

        <form onSubmit={handleDistribution} className="space-y-4">
          <div className="rounded-xl border border-border bg-slate-900/50 px-3 py-2 text-sm">
            <span className="text-slate-400">Disponiveis agora: </span>
            <span className="font-semibold text-white">{availableCount}</span>
          </div>

          <div>
            <label htmlFor="playerId" className={labelClass}>
              Jogador
            </label>
            <select
              id="playerId"
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
              required
              className={inputClass}
            >
              {players.length === 0 ? (
                <option value="">Nenhum jogador ativo</option>
              ) : (
                players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="distributionSeasonId" className={labelClass}>
                Temporada
              </label>
              <select
                id="distributionSeasonId"
                value={distributionSeasonId}
                onChange={(event) => setDistributionSeasonId(event.target.value)}
                className={inputClass}
              >
                <option value="">Global</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="quantity" className={labelClass}>
                Quantidade
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reason" className={labelClass}>
              Motivo
            </label>
            <select
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as DistributionReason)}
              className={inputClass}
            >
              {Object.values(DistributionReason).map((item) => (
                <option key={item} value={item}>
                  {reasonLabels[item]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reasonDetail" className={labelClass}>
              Detalhe
            </label>
            <input
              id="reasonDetail"
              value={reasonDetail}
              onChange={(event) => setReasonDetail(event.target.value)}
              placeholder="Ex: premio Semana 2"
              className={inputClass}
            />
          </div>

          <Button type="submit" disabled={isDistributing || players.length === 0}>
            <Send size={16} className="mr-2" />
            {isDistributing ? "Distribuindo..." : "Distribuir codigos"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
