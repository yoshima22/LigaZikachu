# ZikaChat Room Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ZikaChat room easier to scan by surfacing noise reduction, room participants, and available live media.

**Architecture:** Keep the existing WebRTC media lifecycle in `QuickRoomClient`. Add a local noise-reduction preference that is applied when a microphone track is acquired (and refreshed on the active track where supported). Reshape the existing room data into visual panels without changing signalling, membership, or watch subscriptions.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, browser MediaDevices/WebRTC.

**Spec:** Direct user request in this chat on 2026-11-05.

## Global Constraints

- Noise reduction is enabled by default and remains an optional browser media constraint.
- Existing microphone, camera, screen-share, chat, and watch behaviour must stay intact.
- The interface remains responsive and keyboard-accessible.

## Review Focus

- A browser that cannot apply a live audio constraint must keep the microphone working.
- Turning noise reduction off must affect the next microphone acquisition.
- A room with no active media must still explain how to begin sharing.
- Participant status must distinguish microphone, camera, and screen availability.
- The mobile layout must preserve access to chat and media controls.

---

### Task 1: Expose the noise-reduction preference

**Files:**
- Modify: `src/components/quick-room/quick-room-client.tsx`
- Test: `scripts/test-quick-room-media.mjs`

- [ ] Write a failing source-level test for a default-on, visible noise-reduction control and its media constraint.
- [ ] Run `node --test scripts/test-quick-room-media.mjs` and verify the test fails.
- [ ] Add the local preference, apply it to acquired microphone tracks, and render an accessible control.
- [ ] Run the targeted test and the full test suite.

### Task 2: Redesign live sources and participant presence

**Files:**
- Modify: `src/components/quick-room/quick-room-client.tsx`
- Test: `scripts/test-quick-room-media.mjs`

- [ ] Write a failing source-level test for the prominent live-sources panel and structured participant list.
- [ ] Run `node --test scripts/test-quick-room-media.mjs` and verify the test fails.
- [ ] Replace the loose room-presence pills with accessible participant cards and a prominent live-sources panel using the existing member and watch state.
- [ ] Run the targeted test, full suite, type check, and production build.
