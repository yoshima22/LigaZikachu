# Convite de Johto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the animated Johto invitation, one-time optional Liga Zikachu 3 voting, individual raid access, 08:00 BRT push, and private admin observability.

**Architecture:** A campaign plus recipient and vote records become the authoritative state for the launch experience. A server-only invitation service owns eligibility, idempotent transition and vote rules; thin Server Actions and client components render the letter and admin preview. The existing Johto raid publication flag remains the global gate and is combined with invitation completion for ordinary players.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind CSS, Server Actions, existing FCM push automation, `tsx` scripts.

**Spec:** `docs/superpowers/specs/2026-10-13-convite-johto-design.md`

## Global Constraints

- Schedule the public release for 14/10/2026 08:00 in `America/Sao_Paulo`; all server comparisons use UTC `Date` values.
- The eight existing leaders stay sequential and retain a five-day limit per leader; do not change combat calculations.
- Opening the letter is mandatory for the launch experience; voting is the only skippable section.
- Any opened invitation grants the player access to Johto even after choosing “Continuar para os Ginásios”.
- Voting is secret, optional and immutable: exactly one complete answer set, six answers, no edit or second submission.
- Push copy is exactly title `Ginásios de Johto` and body `Johto em festa com a etapa final da Liga Zikachu TCG`.
- Use only transform/opacity animation, large touch targets and a `prefers-reduced-motion` path.
- Admin preview and admin test push must not change a player invitation state or vote data.

## Review Focus

- Cron runs twice in the 08:00 BRT window: claim markers and recipient state must result in one push per recipient. Covered in Task 4.
- An unauthenticated or non-admin request attempts preview, campaign controls or result reads: no data or mutation is exposed. Covered in Tasks 3 and 7.
- A player submits fewer than six answers, an invalid candidate, or resubmits after a prior vote: no partial/changed votes are persisted. Covered in Task 3.
- A player opens the letter before the campaign launch timestamp or opens the direct raid URL without a completed invitation: access remains denied. Covered in Task 3 and Task 5.
- Mobile/reduced-motion interaction still reaches the two actions and the envelope never traps keyboard focus. Covered in Task 6.

---

## File Structure

- `prisma/schema.prisma` — campaign, recipient and immutable vote models plus relations.
- `prisma/migrations-manual/047_johto_invitation.sql` — idempotent production migration and RLS enablement for the new tables.
- `src/lib/johto-invitation.ts` — server-only campaign state, eligibility, recipient transitions, vote validation, summary and launch/push functions.
- `src/lib/johto-invitation-copy.ts` — stable question keys, approved invitation copy and BRT launch constants shared by UI and service.
- `src/app/(app)/_components/johto-invitation-gate.tsx` — client-side fetch/orchestration of the player modal.
- `src/app/(app)/_components/johto-invitation-letter.tsx` — accessible animated envelope, letter pages and optional voting form.
- `src/app/(app)/_components/johto-invitation-vote-card.tsx` — late-vote card rendered on the raid page.
- `src/app/(app)/combates/raid-johto/invitation-actions.ts` — authenticated player actions for invitation state and voting.
- `src/app/(app)/combates/raid-johto/_components/johto-invitation-admin.tsx` — admin controls, private aggregates and non-persistent preview.
- `src/app/(app)/combates/raid-johto/actions.ts` — combine existing raid authorization with invitation eligibility and add admin campaign commands.
- `src/app/(app)/combates/raid-johto/page.tsx` — pass the player invitation/voting state into the raid UI.
- `src/app/(app)/layout.tsx` — load the gate only for signed-in, non-admin player sessions.
- `src/app/(app)/admin/page.tsx` and `src/app/(app)/combates/raid-johto/_components/johto-admin-controls.tsx` — include the campaign console in the existing Events tab.
- `src/lib/push-automation.ts` — schedule and invoke the idempotent Johto launch push.
- `scripts/test-johto-invitation.ts` — unit/integration coverage for state, voting, visibility and push idempotency.

### Task 1: Define invitation persistence and stable copy

**Files:**
- Modify: `prisma/schema.prisma: Player relations and Johto models`
- Create: `prisma/migrations-manual/047_johto_invitation.sql`
- Create: `src/lib/johto-invitation-copy.ts`
- Test: `scripts/test-johto-invitation.ts`

**Interfaces:**
- Produces `JohtoInvitationCampaign`, `JohtoInvitationRecipient`, `JohtoInvitationVote` Prisma models.
- Produces `JOHTO_INVITATION_LAUNCH_AT`, `JOHTO_INVITATION_COPY`, `JOHTO_VOTE_QUESTIONS` and `JohtoVoteQuestionKey` from `src/lib/johto-invitation-copy.ts`.

- [ ] **Step 1: Write migration/schema assertions in `scripts/test-johto-invitation.ts`**

Assert the six stable question keys and their exact approved Portuguese labels, and assert that the BRT launch constant resolves to `2026-10-14T11:00:00.000Z`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx tsx scripts/test-johto-invitation.ts --unit`

Expected: FAIL because the invitation copy module does not exist.

- [ ] **Step 3: Add the Prisma models and idempotent SQL migration**

Create campaign records keyed by `slug`; recipient records unique on `(campaignId, playerId)` with `availableAt`, `openedAt`, `votingSkippedAt`, `voteSubmittedAt` and `pushSentAt`; vote records unique on `(campaignId, recipientId, questionKey)` with `candidatePlayerId` and `candidateDisplayName`. Use cascades from campaign to recipient/vote, player foreign keys and indexes for launch, recipient and aggregate queries. Enable RLS on all three tables in the manual migration.

- [ ] **Step 4: Implement the stable copy module**

Export the approved invitation sections and exact six voting questions; keep content out of React components so preview, player UI and tests use one source.

- [ ] **Step 5: Generate Prisma client and run the focused test**

Run: `npx prisma generate; npx tsx scripts/test-johto-invitation.ts --unit`

Expected: PASS.

- [ ] **Step 6: Commit the persistence contract**

```powershell
git add prisma/schema.prisma prisma/migrations-manual/047_johto_invitation.sql src/lib/johto-invitation-copy.ts scripts/test-johto-invitation.ts
git commit -m "feat: add johto invitation schema"
```

### Task 2: Build the server-only invitation service

**Files:**
- Create: `src/lib/johto-invitation.ts`
- Modify: `scripts/test-johto-invitation.ts`

**Interfaces:**
- Consumes: models and copy exports from Task 1.
- Produces `getJohtoInvitationForPlayer(playerId: string, now?: Date)`, `openJohtoInvitation(playerId: string)`, `skipJohtoInvitationVote(playerId: string)`, `submitJohtoInvitationVote(playerId: string, answers: Record<JohtoVoteQuestionKey, string>)`, `canPlayerAccessJohtoRaid(playerId: string)`, `getJohtoInvitationAdminSummary()`, and `prepareJohtoInvitationCampaign(input)`.

- [ ] **Step 1: Add failing service tests**

Cover unavailable-before-launch state, first open being idempotent, skipped vote retaining access, complete successful vote, rejection of missing/invalid candidates, and rejection of a second submit without overwriting the first answers.

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `npx tsx scripts/test-johto-invitation.ts --service`

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Implement campaign preparation, eligibility and recipient transitions**

Use the tournament slug for Liga Zikachu 3 (resolve the existing tournament by its known slug/name during campaign preparation rather than hard-coding a database ID). Eligible recipients are approved non-admin players; candidates are that tournament’s accepted registrations, excluding admin roles. Upsert recipients only after the campaign is published and its timestamp has arrived.

- [ ] **Step 4: Implement the atomic voting operation and read models**

Validate all six keys and candidate IDs before opening a transaction. Lock/read the recipient, reject prior `voteSubmittedAt`, insert all six snapshots, then set `voteSubmittedAt`; do not set `votingSkippedAt` when submitting. Return compact player state and an admin-only aggregate that contains delivery/open/skip/vote counts and per-question totals.

- [ ] **Step 5: Run service tests to verify they pass**

Run: `npx tsx scripts/test-johto-invitation.ts --service`

Expected: PASS.

- [ ] **Step 6: Commit the invitation domain service**

```powershell
git add src/lib/johto-invitation.ts scripts/test-johto-invitation.ts
git commit -m "feat: add johto invitation flow"
```

### Task 3: Add authenticated actions and campaign operations

**Files:**
- Create: `src/app/(app)/combates/raid-johto/invitation-actions.ts`
- Modify: `src/app/(app)/combates/raid-johto/actions.ts`
- Modify: `scripts/test-johto-invitation.ts`

**Interfaces:**
- Consumes: Task 2 service functions and existing `getSessionUser`/`isAdmin` guards.
- Produces player actions `getJohtoInvitationAction`, `openJohtoInvitationAction`, `skipJohtoInvitationVoteAction`, `submitJohtoInvitationVoteAction`; admin action commands `prepareInvitation`, `publishInvitation`, `sendInvitationTestPush` and `getInvitationAdminSummary`.

- [ ] **Step 1: Write failing action/authorization tests**

Assert anonymous callers receive no player state, ordinary players cannot invoke campaign/admin reads, preview calls do not write a recipient, and each player action only transitions that session’s player.

- [ ] **Step 2: Run action tests to verify they fail**

Run: `npx tsx scripts/test-johto-invitation.ts --actions`

Expected: FAIL because invitation actions are absent.

- [ ] **Step 3: Implement thin player Server Actions**

Use the session user’s player ID only; never accept a player ID from form data. Revalidate `/combates/raid-johto` and the authenticated layout after state changes. Parse six named question fields into the exact `Record<JohtoVoteQuestionKey, string>` shape before calling the domain service.

- [ ] **Step 4: Extend the existing Johto admin action command union**

Require an admin session for every campaign command. Preserve current raid commands unchanged. The test-push command may address only the caller and must not call campaign publication or recipient open/skip/vote operations.

- [ ] **Step 5: Run action tests to verify they pass**

Run: `npx tsx scripts/test-johto-invitation.ts --actions`

Expected: PASS.

- [ ] **Step 6: Commit the action boundary**

```powershell
git add src/app/(app)/combates/raid-johto/invitation-actions.ts src/app/(app)/combates/raid-johto/actions.ts scripts/test-johto-invitation.ts
git commit -m "feat: add johto invitation actions"
```

### Task 4: Schedule idempotent 08:00 BRT launch notifications

**Files:**
- Modify: `src/lib/johto-invitation.ts`
- Modify: `src/lib/push-automation.ts`
- Modify: `scripts/test-johto-invitation.ts`

**Interfaces:**
- Consumes: Task 2 campaign/recipient functions and existing `sendNotificationToUsers`/`PushNotificationMarker` helper behavior.
- Produces `runJohtoInvitationLaunch(now?: Date): Promise<{ sent: number; recipients: number }>`.

- [ ] **Step 1: Add a failing BRT scheduler test**

At `2026-10-14T10:59:59.999Z` assert no recipient/push; at `2026-10-14T11:00:00.000Z` assert one expected push per eligible user with exact title/body/raid URL; invoke again and assert no additional send.

- [ ] **Step 2: Run the scheduler test to verify it fails**

Run: `npx tsx scripts/test-johto-invitation.ts --push`

Expected: FAIL because the launch function is absent.

- [ ] **Step 3: Implement launch delivery and hook it into `runPushAutomation`**

Use a dedicated marker key scoped to the campaign and recipient for exactly-once delivery. Respect existing `ANUNCIOS` push preferences through `sendNotificationToUsers`; persist only successful/claimed send attempts according to the existing marker convention. A push failure must leave the recipient available for the letter on next login.

- [ ] **Step 4: Run scheduler test to verify it passes**

Run: `npx tsx scripts/test-johto-invitation.ts --push`

Expected: PASS.

- [ ] **Step 5: Commit scheduler integration**

```powershell
git add src/lib/johto-invitation.ts src/lib/push-automation.ts scripts/test-johto-invitation.ts
git commit -m "feat: schedule johto invitation push"
```

### Task 5: Enforce invitation-aware Johto access and add late vote entry point

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(app)/combates/raid-johto/page.tsx`
- Modify: `src/app/(app)/combates/raid-johto/actions.ts`
- Create: `src/app/(app)/combates/raid-johto/_components/johto-invitation-vote-card.tsx`
- Modify: `scripts/test-johto-invitation.ts`

**Interfaces:**
- Consumes: `canPlayerAccessJohtoRaid` and compact invitation state from Tasks 2–3.
- Produces a raid page which redirects incomplete invitations to the dashboard while exposing `JohtoInvitationVoteCard` only after opening and before submission.

- [ ] **Step 1: Write failing visibility tests**

Assert global raid publication alone is insufficient for an ordinary unopened recipient; opening allows menu/page/attack; skipping still allows attack; admins retain operational access; submitted players do not receive the late-vote card.

- [ ] **Step 2: Run visibility tests to verify they fail**

Run: `npx tsx scripts/test-johto-invitation.ts --visibility`

Expected: FAIL because the existing visibility check is global only.

- [ ] **Step 3: Apply the combined access predicate in layout, page and attack action**

Keep `isJohtoRaidVisibleToPlayers()` as the global campaign flag and AND it with `canPlayerAccessJohtoRaid(player.id)` for non-admin users. Do not allow a direct POST attack to bypass the page guard. Render the compact vote card only when `openedAt` exists and `voteSubmittedAt` is null.

- [ ] **Step 4: Implement `JohtoInvitationVoteCard`**

Use the exact question/candidate data supplied by the server. It opens the same vote form action, explains one-time secret voting, and disappears after successful submission/refetch.

- [ ] **Step 5: Run visibility tests to verify they pass**

Run: `npx tsx scripts/test-johto-invitation.ts --visibility`

Expected: PASS.

- [ ] **Step 6: Commit invitation-aware raid access**

```powershell
git add src/app/(app)/layout.tsx src/app/(app)/combates/raid-johto/page.tsx src/app/(app)/combates/raid-johto/actions.ts src/app/(app)/combates/raid-johto/_components/johto-invitation-vote-card.tsx scripts/test-johto-invitation.ts
git commit -m "feat: gate johto raid by invitation"
```

### Task 6: Implement the responsive animated invitation experience

**Files:**
- Create: `src/app/(app)/_components/johto-invitation-gate.tsx`
- Create: `src/app/(app)/_components/johto-invitation-letter.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: Task 3 player actions and the serializable invitation/candidate state from Task 2.
- Produces `<JohtoInvitationGate />` and `<JohtoInvitationLetter mode="player" | "preview" />`.

- [ ] **Step 1: Add a focused component test or deterministic test harness**

Verify the initial envelope has an accessible “Abrir convite de Johto” control; opening calls only `openJohtoInvitationAction` in player mode; preview mode calls no persistent action; the final page exposes “Participar da votação” and “Continuar para os Ginásios”; reduced motion disables positional/keyframe transitions.

- [ ] **Step 2: Run the UI test/harness to verify it fails**

Run: `npx tsx scripts/test-johto-invitation.ts --ui`

Expected: FAIL because the invitation components do not exist.

- [ ] **Step 3: Implement the accessible envelope and letter pages**

Render a full-screen dialog with focus-safe controls, two lateral envelope entry motions, a tactile click transform, seal-break/open sequence and paper-page reveal using CSS transforms/opacity only. Keep copy from Task 1. Make the optional vote form fit a narrow mobile viewport with large radio-label targets and explicit progress.

- [ ] **Step 4: Implement the authenticated layout gate**

Server-render it only for non-admin authenticated players with an available, unopened campaign; client refreshes state after open/skip/submit. Do not mount it for unauthenticated public pages or admin sessions.

- [ ] **Step 5: Run the UI test/harness and typecheck**

Run: `npx tsx scripts/test-johto-invitation.ts --ui; npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the player experience**

```powershell
git add src/app/(app)/_components/johto-invitation-gate.tsx src/app/(app)/_components/johto-invitation-letter.tsx src/app/(app)/layout.tsx src/app/globals.css scripts/test-johto-invitation.ts
git commit -m "feat: add animated johto invitation"
```

### Task 7: Add private admin metrics, preview and controlled test push

**Files:**
- Create: `src/app/(app)/combates/raid-johto/_components/johto-invitation-admin.tsx`
- Modify: `src/app/(app)/combates/raid-johto/_components/johto-admin-controls.tsx`
- Modify: `src/app/(app)/admin/page.tsx`
- Modify: `scripts/test-johto-invitation.ts`

**Interfaces:**
- Consumes: Task 2 `getJohtoInvitationAdminSummary`, Task 3 admin actions and Task 6 letter component in `preview` mode.
- Produces an admin-only `<JohtoInvitationAdmin />` console embedded in the existing Johto controls.

- [ ] **Step 1: Add failing admin summary tests**

Assert summary counts recipients, push sends, opens, skips and complete votes correctly; results group by question/candidate without exposing them in player read state; preview creates no campaign/recipient/vote write; test push targets only the current admin.

- [ ] **Step 2: Run admin tests to verify they fail**

Run: `npx tsx scripts/test-johto-invitation.ts --admin`

Expected: FAIL because the console and summary boundary are absent.

- [ ] **Step 3: Implement the admin console**

Show BRT launch/published state and buttons for campaign preparation/publication, preview and self-only test push. Render metrics and a private results table grouped by the six exact question labels, sorted descending by total. Use the preview letter’s isolated `preview` mode; never invoke player persistence actions from it.

- [ ] **Step 4: Wire the console into both existing admin locations**

Pass the summary from the existing Events tab and from the raid page’s admin box so no second admin surface is invented.

- [ ] **Step 5: Run admin tests and full static checks**

Run: `npx tsx scripts/test-johto-invitation.ts --admin; npm run db:validate; npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the admin experience**

```powershell
git add src/app/(app)/combates/raid-johto/_components/johto-invitation-admin.tsx src/app/(app)/combates/raid-johto/_components/johto-admin-controls.tsx src/app/(app)/admin/page.tsx scripts/test-johto-invitation.ts
git commit -m "feat: add johto invitation admin debug"
```

### Task 8: Final verification and launch readiness

**Files:**
- Modify: `docs/raid-lideres-johto.md`
- Modify: `scripts/test-johto-invitation.ts` only if an uncovered behavior is found during verification.

**Interfaces:**
- Consumes: all prior tasks.
- Produces documented operator instructions for preparation, preview, 08:00 launch and rollback.

- [ ] **Step 1: Update operational documentation**

Document how to prepare/publish the invitation campaign, verify BRT launch state, use preview/self-only push, inspect secret aggregate results and recover from a missed push without resetting player invitation state.

- [ ] **Step 2: Execute the complete targeted suite**

Run: `npx tsx scripts/test-johto-invitation.ts`

Expected: PASS.

- [ ] **Step 3: Execute existing Johto regression tests**

Run: `npx tsx scripts/test-johto-raid.ts --db`

Expected: PASS with existing raid behavior unchanged.

- [ ] **Step 4: Execute schema and type checks**

Run: `npm run db:validate; npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Perform manual launch rehearsal**

Verify in desktop and mobile viewport: envelope arrives from the sides, opens by touch/click, text is readable, vote can be skipped, post-open access works, late vote disappears after send, admin preview is non-persistent, and `prefers-reduced-motion` is usable.

- [ ] **Step 6: Commit documentation and any test-only follow-up**

```powershell
git add docs/raid-lideres-johto.md scripts/test-johto-invitation.ts
git commit -m "docs: add johto invitation launch guide"
```
