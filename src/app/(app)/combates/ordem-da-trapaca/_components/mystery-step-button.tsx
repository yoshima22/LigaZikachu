"use client";

import { useActionState } from "react";
import { resolveOrderMysteryStepAction, type ResolveMysteryStepState } from "../hidden-actions";

type MysteryStepButtonProps = {
  stepKey: string;
  returnPath: string;
  children: React.ReactNode;
  className?: string;
  showOnlySuccess?: boolean;
  hideMessage?: boolean;
  pendingLabel?: string | null;
  title?: string;
};

const initialState: ResolveMysteryStepState = { ok: false };

export function MysteryStepButton({
  stepKey,
  returnPath,
  children,
  className,
  showOnlySuccess = false,
  hideMessage = false,
  pendingLabel = "Investigando...",
  title,
}: MysteryStepButtonProps) {
  const [state, formAction, pending] = useActionState(resolveOrderMysteryStepAction, initialState);
  const shouldShowMessage = !hideMessage && state.message && (!showOnlySuccess || state.ok);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="stepKey" value={stepKey} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <button type="submit" disabled={pending} className={className} title={title}>
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {shouldShowMessage && (
        <p className={`rounded-lg border px-3 py-2 text-xs ${state.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-purple-500/30 bg-purple-500/10 text-purple-200"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
