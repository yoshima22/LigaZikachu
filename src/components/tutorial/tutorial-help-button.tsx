"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { TutorialOverlay } from "./tutorial-overlay";
import { TUTORIALS } from "@/lib/tutorial-config";
import { completeTutorial, resetTutorial } from "@/app/(app)/tutorial/actions";

interface TutorialHelpButtonProps {
  pageId: string;
  className?: string;
}

export function TutorialHelpButton({ pageId, className }: TutorialHelpButtonProps) {
  const [show, setShow] = useState(false);
  const tutorial = TUTORIALS[pageId];
  if (!tutorial) return null;

  const handleOpen = async () => {
    await resetTutorial(pageId);
    setShow(true);
  };

  const handleClose = async () => {
    setShow(false);
    await completeTutorial(pageId);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        title="Mostrar dicas"
        className={`flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-400 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] transition-colors ${className ?? ""}`}
      >
        <HelpCircle size={13} />
        Dicas
      </button>
      {show && (
        <TutorialOverlay
          steps={tutorial.steps}
          onComplete={handleClose}
          onSkip={handleClose}
        />
      )}
    </>
  );
}
