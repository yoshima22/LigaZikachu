"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { TutorialOverlay } from "./tutorial-overlay";
import { TUTORIALS, getTutorialIdForPath } from "@/lib/tutorial-config";
import { completeTutorial, resetTutorial } from "@/app/(app)/tutorial/actions";

export function RouteTutorialHelpButton() {
  const pathname = usePathname();
  const pageId = getTutorialIdForPath(pathname);
  const tutorial = pageId ? TUTORIALS[pageId] : null;
  const [show, setShow] = useState(false);

  if (!pageId || !tutorial) return null;

  const openTutorial = async () => {
    await resetTutorial(pageId);
    setShow(true);
  };

  const closeTutorial = async () => {
    setShow(false);
    await completeTutorial(pageId);
  };

  return (
    <>
      <button
        type="button"
        onClick={openTutorial}
        title="Mostrar tutorial desta pagina"
        className="flex h-8 items-center gap-1.5 rounded-xl border border-[#FFCB05]/25 bg-[#FFCB05]/10 px-2.5 text-xs font-semibold text-[#FFCB05] transition-colors hover:border-[#FFCB05]/60 hover:bg-[#FFCB05]/15"
      >
        <HelpCircle size={14} />
        <span className="hidden sm:inline">Dicas</span>
      </button>
      {show && (
        <TutorialOverlay
          steps={tutorial.steps}
          onComplete={closeTutorial}
          onSkip={closeTutorial}
        />
      )}
    </>
  );
}
