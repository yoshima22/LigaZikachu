"use client";

import { useState, useEffect, useCallback } from "react";
import { TutorialOverlay } from "./tutorial-overlay";
import { TUTORIALS } from "@/lib/tutorial-config";
import { getTutorialStatus, completeTutorial } from "@/app/(app)/tutorial/actions";

interface TutorialManagerProps {
  pageId: string;
  isAdmin?: boolean;
}

export function TutorialManager({ pageId, isAdmin }: TutorialManagerProps) {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  const tutorial = TUTORIALS[pageId];

  const checkAndShow = useCallback(async () => {
    if (!tutorial || isAdmin) { setChecked(true); return; }
    try {
      const { completed } = await getTutorialStatus(pageId);
      if (!completed) setShow(true);
    } catch {
      // Fail silently
    }
    setChecked(true);
  }, [pageId, tutorial, isAdmin]);

  useEffect(() => {
    checkAndShow();
  }, [checkAndShow]);

  const handleComplete = async () => {
    setShow(false);
    await completeTutorial(pageId);
  };

  const handleSkip = async () => {
    setShow(false);
    await completeTutorial(pageId);
  };

  if (!tutorial || !show || !checked) return null;

  return (
    <TutorialOverlay
      steps={tutorial.steps}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}
