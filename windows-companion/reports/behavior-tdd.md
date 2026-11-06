# ZikaCompanion local behavior TDD report — 2026-11-06

Scope: windows-companion/ only. No download, runtime network, game/account integration, backend, Prisma or Next.js changes.

## Cycle 1 — inactivity regression

Test written against the existing public model API before production edits: `InactivityStopsWalkingEvenAtTheNextWalkPhase`. At 32 seconds without activity the previous modulo-only implementation incorrectly kept walking. RED: 1 test failed, `Assert.False`, actual `True`. Evidence: `behavior-red.log`.

Minimal production change introduced sleep after 24 seconds and excluded sleep from idle/walk. GREEN: 1 passed, 0 failed. Evidence: `behavior-first-green.log`.

## Cycle 2 — explicit transitions and UI

Added deterministic tests before the corresponding implementation: injected timing for idle/walk/sleep, mouse/click wake and short happy duration, alert priority over sleep/play/drag, preserving drag through alerts, click versus drag release, both horizontal edges on a negative-coordinate monitor, and pause retention.

The first API RED was a compilation failure because BehaviorTiming and the behavior API did not exist (`transitions-api-red.log`); this is an API absence check, not a runtime assertion failure. A subsequent run exposed and corrected a test fixture typo (`Id` instead of existing `EventId`). The initial sleep regression above supplies the runtime behavior RED evidence.

Added a real STA WPF integration test before UI changes: sleep Z visibility, noninteractive floating animation, stationary window during sleep, hover wake, and alert bubble visibility. Existing tests retain native transparent hit testing, tray-independent menu exit, GIF frame advancement, bubble anchoring, pause/mute and alert queue coverage.

Final results and limits are recorded below after verification.

## Verification results

- UI RED before implementation: `SleepIndicatorFloatsAndMouseMovementWakesMascot` failed because `SleepIndicator` was null. Evidence: `transitions-and-ui-red.log`. That run had 5 passed and 2 failed; the second failure was a floating-point test-clock boundary (1.39 + .01 seconds rounded below 1.4 seconds), corrected by advancing the injected clock in integer milliseconds.
- Final full solution GREEN: `dotnet test windows-companion/ZikaCompanion.sln --no-restore --logger 'console;verbosity=normal'` — **38 passed, 0 failed, 0 skipped**, 35.7475 s. Evidence: `behavior-full-green.log`.
- Release: `dotnet build windows-companion/ZikaCompanion.sln -c Release --no-restore` — **succeeded, 0 warnings, 0 errors**, 31.48 s. Evidence: `behavior-release-build.log`.
- `git diff --check -- windows-companion` passed.

## Implementation and known limits

Explicit priority is Alert > Dragging > pause > Happy > Sleep > Walk/Idle. Local events and input reset inactivity; active alerts interrupt happy and wake sleep. Drag capture remains independent from visual alert priority. Real window input distinguishes click release from movement using the Windows drag threshold; a lost capture cancels without playing. Walking uses elapsed frame time and reverses direction at both work-area boundaries. The overlay and anchored bubble share the same clamped window position.

Only the existing bundled animated Pikachu GIF is used. Sleep is conveyed with dimming and compact animated Zs; Happy is a short bounce. There are no new downloaded assets or state-specific GIF poses. Timing is configured in code, position is session-only, and mixed-DPI physical drag behavior still needs manual confirmation on the destination setup. Automated coverage exercises the state machine, position calculations and live WPF visual/input bindings; a complete physical mouse drag is not synthesized by this suite. The app remains entirely local and simulated, with no game/player/backend connection.
