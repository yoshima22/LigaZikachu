"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
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
        title="Dicas desta página"
        aria-label="Dicas desta página"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#FFCB05]/25 bg-[#FFCB05]/10 text-sm font-black text-[#FFCB05] transition-colors hover:border-[#FFCB05]/60 hover:bg-[#FFCB05]/15"
      >
        ?
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
