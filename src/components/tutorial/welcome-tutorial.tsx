"use client";

import { useState, useEffect } from "react";
import { TutorialOverlay } from "./tutorial-overlay";
import { TUTORIALS } from "@/lib/tutorial-config";
import { getTutorialStatus, completeTutorial } from "@/app/(app)/tutorial/actions";

export function WelcomeTutorial() {
  const [show, setShow] = useState(false);
  const tutorial = TUTORIALS["welcome"];

  useEffect(() => {
    getTutorialStatus("welcome").then(({ completed, isAdmin }) => {
      if (!completed && !isAdmin) setShow(true);
    }).catch(() => {
      // Fail silently
    });
  }, []);

  if (!show || !tutorial) return null;

  const handleDone = async () => {
    setShow(false);
    await completeTutorial("welcome");
  };

  return (
    <TutorialOverlay
      steps={tutorial.steps}
      onComplete={handleDone}
      onSkip={handleDone}
    />
  );
}
