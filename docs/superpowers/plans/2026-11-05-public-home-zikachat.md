# Public Home and ZikaChat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Deliver a premium public Liga landing page and a separate anonymous ZikaChat lobby with code entry, public live discovery, server-authoritative room capacity/presence, optional microphone and camera, host controls, and reporting.

**Architecture:** Keep QuickRoom as the anonymous media system and add a server-side room-session layer: durable room metadata, short-lived participant leases, and a privacy-safe public listing projection. The public home reads that projection for a compact activity strip; \`/salas\` owns creation, code entry and discovery. WebRTC remains P2P with on-demand video subscriptions so cameras do not fan out to all thirteen participants.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Supabase Realtime, WebRTC, Tailwind CSS 3, Lucide, Node test runner/tsx scripts.

**Spec:** \`docs/superpowers/specs/2026-11-05-public-home-and-zikachat-design.md\`

## Global Constraints

- Keep \`/\` as the public Liga presentation and \`/salas\` as the separate public ZikaChat destination.
- Preserve anonymous access, direct room links, ten-character secret room codes, optional passwords, 13-person maximum and 30-minute room expiry.
- Public cards must never reveal a room code, password, Realtime topic, chat contents or media thumbnail.
- A visitor enters a public room as a full participant; microphone and camera default off and remain optional.
- Reuse existing project assets only; create original visual language and do not add new official Pokémon/TCG assets.
- Respect keyboard navigation, AA contrast and \`prefers-reduced-motion\`.
- Do not alter Zika TV/SPEC authorization or apply a database migration during local work.
- Preserve unrelated dirty worktree changes.

## Review Focus

1. Concurrent anonymous joins never exceed \`maxParticipants\` (Task 2).
2. Unlisted rooms never leak through the home, lobby or list API (Task 2).
3. Code input with spaces, hyphens or uppercase resolves only to its canonical code (Task 1).
4. Denied/unavailable microphone or camera leaves the visitor in chat and presence (Task 4).
5. Camera is sent only after a viewer selects it; it never auto-fans-out to every peer (Task 4).

---

## File structure

| Path | Responsibility |
| --- | --- |
| \`prisma/schema.prisma\` | Public room metadata, participant lease, host key hash and report records. |
| \`prisma/migrations-manual/054_quick_room_public_lobby.sql\` | Additive idempotent production migration. |
| \`src/lib/quick-room-code.ts\` | Canonical code validation, input normalization and display formatting. |
| \`src/lib/quick-room-public.ts\` | Pure visibility, lease expiry and safe listing policy. |
| \`src/lib/quick-room.ts\` | Room create/join/heartbeat/leave/host/listing service layer. |
| \`src/app/api/salas/**\` | Public create, lookup, list, join, heartbeat, leave, host and report contracts. |
| \`src/app/(public)/salas/**\` | Lobby, code entry and safe public-room cards. |
| \`src/components/quick-room/**\` | Media-source tiles, presence, camera and room controls. |
| \`src/app/page.tsx\`, \`src/components/home/**\` | Liga-first home, TCG Championship and activity strip. |
| \`scripts/test-quick-room-public.mjs\`, \`scripts/test-quick-room-media.mjs\`, \`scripts/test-public-experience.mjs\` | Database-free policy, route and UI contracts. |

## Tasks

### Task 1: Define the public-room data and code contract

**Files:**
- Modify: \`prisma/schema.prisma:5411-5422\`
- Create: \`prisma/migrations-manual/054_quick_room_public_lobby.sql\`
- Modify: \`src/lib/quick-room-code.ts\`
- Create: \`src/lib/quick-room-public.ts\`
- Test: \`scripts/test-quick-room-public.mjs\`

**Interfaces:**
- Produces \`normalizeRoomCodeInput(input: string): string\`, \`formatRoomCode(code: string): string\`, and \`isPublicLiveEligible(room, now): boolean\`.
- Produces \`QuickRoomVisibility\`, safe public metadata, short-lived participant leases, host-key hash and report record schema.

- [ ] **Step 1: Write failing policy tests**

\`\`\`js
assert.equal(normalizeRoomCodeInput('ABCD-EFGH-JK'), 'abcdefghjk');
assert.equal(formatRoomCode('abcdefghjk'), 'abcd-efgh-jk');
assert.equal(isPublicLiveEligible({ visibility: 'PUBLIC', activeParticipants: 2, activeMedia: 1, publicLastSeenAt: now }, now), true);
assert.equal(isPublicLiveEligible({ visibility: 'UNLISTED', activeParticipants: 2, activeMedia: 1, publicLastSeenAt: now }, now), false);
\`\`\`

- [ ] **Step 2: Run the policy test to verify it fails**

Run: \`node scripts/test-quick-room-public.mjs\`  
Expected: FAIL because the policy helpers do not exist.

- [ ] **Step 3: Add the additive Prisma schema and migration**

Use \`QuickRoomVisibility\` with \`UNLISTED\` default and \`PUBLIC\` option. Store only safe public metadata on \`QuickRoom\`; use leases for display name, media flags, host flag and \`lastSeenAt\`. The migration must be idempotent and must not execute locally.

- [ ] **Step 4: Implement code normalization and public policy helpers**

Input normalization lower-cases and strips only visual separators before existing validation. Formatting groups, but never shortens or changes, the ten-character secret as \`abcd-efgh-jk\`.

- [ ] **Step 5: Verify the contract**

Run: \`node scripts/test-quick-room-public.mjs && npm run db:validate\`  
Expected: PASS.

- [ ] **Step 6: Commit**

\`\`\`bash
git add prisma/schema.prisma prisma/migrations-manual/054_quick_room_public_lobby.sql src/lib/quick-room-code.ts src/lib/quick-room-public.ts scripts/test-quick-room-public.mjs
git commit -m "feat: add public quick room data contract"
\`\`\`

### Task 2: Make entry, capacity and public activity server-authoritative

**Files:**
- Modify: \`src/lib/quick-room.ts\`
- Modify: \`src/app/api/salas/route.ts\`, \`src/app/api/salas/[code]/join/route.ts\`, \`src/app/api/salas/[code]/heartbeat/route.ts\`
- Create: \`src/app/api/salas/lookup/route.ts\`, \`src/app/api/salas/public/route.ts\`, \`src/app/api/salas/[code]/leave/route.ts\`, \`src/app/api/salas/[code]/host/route.ts\`, \`src/app/api/salas/[code]/report/route.ts\`
- Test: \`scripts/test-quick-room-public.mjs\`

**Interfaces:**
- Consumes Task 1 types/helpers.
- Produces \`createQuickRoom\`, \`joinQuickRoom\`, \`refreshQuickRoomLease\`, \`leaveQuickRoom\`, \`listPublicQuickRooms\`, \`manageQuickRoomAsHost\` and \`reportQuickRoom\`.
- Join returns \`{ participantId, participantToken, isHost, room: SafeRoomJoinView }\` only.

- [ ] **Step 1: Add failing privacy/capacity route tests**

\`\`\`js
const [first, second] = await Promise.all([joinRoom(), joinRoom()]);
assert.deepEqual([first.status, second.status].sort(), [200, 409]);
assert.equal((await publicRooms()).some(room => room.visibility === 'UNLISTED'), false);
assert.equal(Object.hasOwn((await publicRooms())[0], 'topicSecret'), false);
assert.equal((await lookup('ABCD-EFGH-JK')).status, 200);
\`\`\`

- [ ] **Step 2: Run the route tests to verify they fail**

Run: \`node scripts/test-quick-room-public.mjs\`  
Expected: FAIL because leases and public routes are absent.

- [ ] **Step 3: Implement transactional room creation and join**

Creation makes a cryptographically random creator token, saves only its hash and returns the raw token once. Join deletes stale leases inside a transaction, validates password, checks capacity and issues an expiring participant token. Preserve direct-link joining and current rate limits.

- [ ] **Step 4: Implement lookup, listing, heartbeat and leave**

Lookup returns only a canonical route/generic failure. Listing is bounded and ordered by active media then recency. Heartbeat refreshes the matching lease plus safe media flags; leave removes only the matching lease/token. All expiry checks use the same window.

- [ ] **Step 5: Implement host management and reporting**

Host token can hide a public room immediately or end it by revoking leases. Reporting accepts a fixed reason and bounded note, persists an audit record and rate-limits per IP/room; public responses expose neither report count nor reporter data.

- [ ] **Step 6: Verify**

Run: \`node scripts/test-quick-room-public.mjs && npm run typecheck\`  
Expected: PASS.

- [ ] **Step 7: Commit**

\`\`\`bash
git add src/lib/quick-room.ts src/app/api/salas scripts/test-quick-room-public.mjs
git commit -m "feat: add public quick room lobby APIs"
\`\`\`

### Task 3: Build the ZikaChat public lobby and code entry

**Files:**
- Modify: \`src/app/(public)/salas/page.tsx\`, \`src/app/(public)/salas/create-room-form.tsx\`, \`src/app/(public)/salas/[code]/page.tsx\`
- Create: \`src/app/(public)/salas/room-code-entry.tsx\`, \`src/app/(public)/salas/public-room-grid.tsx\`
- Modify: \`src/components/quick-room/quick-room-client.tsx\`
- Test: \`scripts/test-public-experience.mjs\`

**Interfaces:**
- Consumes the Task 2 API contract.
- Stores participant/host tokens only in browser session storage.

- [ ] **Step 1: Write failing public UI contracts**

\`\`\`js
assert.match(lobbySource, /Entrar com código/);
assert.match(lobbySource, /Ao vivo agora/);
assert.match(homeSource, /sem conta/i);
assert.doesNotMatch(publicCardSource, /topicSecret|passwordHash|participantToken|hostToken/);
\`\`\`

- [ ] **Step 2: Run the UI contract tests to verify they fail**

Run: \`node scripts/test-public-experience.mjs\`  
Expected: FAIL because the lobby currently only creates a room.

- [ ] **Step 3: Implement lobby and creation**

Build a responsive lobby-of-the-table shell with parallel create/enter cards, optional public title, visibility, password and code confirmation/copy/share. Create cards never display a raw host token.

- [ ] **Step 4: Implement code entry and live grid**

Format code input while retaining canonical state, resolve it by API and display accessible errors. Poll/revalidate the safe public projection at a measured interval. Cards show title, participant count and media chips only.

- [ ] **Step 5: Refresh direct-entry room UI**

Preserve nickname/password and add microphone choice with off default, formatted code, and host controls only for the local creator token.

- [ ] **Step 6: Verify and commit**

Run: \`node scripts/test-public-experience.mjs && npm run typecheck\`  
Expected: PASS.  
Manual: 390 px and desktop lobby; a listed active room appears and an unlisted one does not.

\`\`\`bash
git add src/app/'(public)'/salas src/components/quick-room/quick-room-client.tsx scripts/test-public-experience.mjs
git commit -m "feat: redesign public ZikaChat lobby"
\`\`\`

### Task 4: Add optional microphone-on-entry and on-demand camera

**Files:**
- Modify: \`src/components/quick-room/quick-room-client.tsx\`
- Create: \`src/components/quick-room/media-source-tile.tsx\`, \`src/components/quick-room/member-presence-list.tsx\`
- Test: \`scripts/test-quick-room-media.mjs\`

**Interfaces:**
- Produces \`MediaKind = "screen" | "camera"\`, member flags \`mic\`, \`camera\`, \`screen\`, and explicit subscription messages per remote source.

- [ ] **Step 1: Write failing media-state tests**

\`\`\`js
assert.equal(initialMediaState.mic, false);
assert.equal(initialMediaState.camera, false);
assert.deepEqual(nextSubscriptions({ camera: true }, []), ['member-1:camera']);
assert.equal(nextSubscriptions({ camera: true }, ['member-1:camera']).length, 1);
\`\`\`

- [ ] **Step 2: Run the media tests to verify they fail**

Run: \`node scripts/test-quick-room-media.mjs\`  
Expected: FAIL because camera and typed subscriptions do not exist.

- [ ] **Step 3: Refactor tracks by media kind**

Replace screen-only senders/watch state with typed source IDs and one subscription mechanism. Preserve screen bitrate/TURN behavior. Camera tracks are added only after a remote viewer selects that source.

- [ ] **Step 4: Implement media controls and presence**

If mic-on was selected, request audio only after a successful room join; denial is recoverable. Add optional camera capture, cleanup, renegotiation and lease/presence updates. Show accessible member states and selectable source tiles; never auto-open every camera.

- [ ] **Step 5: Verify and commit**

Run: \`node scripts/test-quick-room-media.mjs && npm run typecheck\`  
Expected: PASS.  
Manual: two contexts for muted entry, mic-on, denied camera, camera/screen selection, leave cleanup and 390 px layout.

\`\`\`bash
git add src/components/quick-room scripts/test-quick-room-media.mjs
git commit -m "feat: add ZikaChat camera and media selection"
\`\`\`

### Task 5: Redesign the public Liga home

**Files:**
- Modify: \`src/app/page.tsx\`
- Create: \`src/components/home/public-live-strip.tsx\`
- Modify: \`src/components/home/reveal.tsx\` only if needed
- Modify: \`scripts/test-public-experience.mjs\`

**Interfaces:**
- Consumes \`listPublicQuickRooms(3)\`.
- Produces Liga-first CTAs, a Campeonato TCG section, an explicit no-login ZikaChat CTA and safe optional live strip.

- [ ] **Step 1: Extend failing home contracts**

\`\`\`js
assert.match(homeSource, /Campeonato TCG/i);
assert.match(homeSource, /ZikaChat/);
assert.match(homeSource, /sem conta/i);
assert.match(homeSource, /prefers-reduced-motion/);
\`\`\`

- [ ] **Step 2: Run home contracts to verify they fail**

Run: \`node scripts/test-public-experience.mjs\`  
Expected: FAIL because the home lacks the TCG and live-strip contracts.

- [ ] **Step 3: Implement the Liga-first composition**

Retain unauthenticated redirects/navigation. Rework the generic cards into an arena/card-game composition with existing sprites/assets, original CSS shapes and layered light. Keep the ZikaChat CTA in header, hero and footer.

- [ ] **Step 4: Add TCG, ZikaChat and live strip**

Add stable Championship TCG content linking to the current tournament route without inventing standings. Add the no-login ZikaChat module. Server-render up to three safe public projections; use a premium empty state and omit the strip if the query fails.

- [ ] **Step 5: Verify and commit**

Run: \`node scripts/test-public-experience.mjs && npm run typecheck\`  
Expected: PASS.  
Manual: desktop/390 px captures, CTA targets, focus, contrast and reduced motion.

\`\`\`bash
git add src/app/page.tsx src/components/home scripts/test-public-experience.mjs
git commit -m "feat: modernize public Liga landing page"
\`\`\`

### Task 6: Integrate and verify

**Files:**
- Modify only verified feature files needed for final failures.
- Test: all three focused scripts.

- [ ] **Step 1: Run focused tests**

Run: \`node scripts/test-quick-room-public.mjs && node scripts/test-quick-room-media.mjs && node scripts/test-public-experience.mjs\`  
Expected: PASS.

- [ ] **Step 2: Run project validation**

Run: \`npm run db:validate && npm run typecheck && npm run build\`  
Expected: each exits 0.

- [ ] **Step 3: Complete browser QA**

Verify desktop/mobile home and lobby, public/unlisted privacy, two-person formatted-code join, password/capacity errors, mic/camera permissions, source selection, host hide/end and reporting.

- [ ] **Step 4: Review handoff**

Run: \`git diff --check && git diff --stat\`  
Expected: no whitespace errors and only feature files. State that the manual Prisma migration is deployed only through the production migration workflow.

## Self-review

- **Spec coverage:** Task 5 covers the Liga-first home, TCG and no-login CTA; Tasks 1–3 cover codes and safe discovery; Task 4 covers full media participation; Task 2 covers capacity, privacy, host action and reporting; Task 6 verifies the result.
- **Type consistency:** visibility, public projection, normalized code, participant lease/token and media kind are defined before their consumers.
- **Review Focus:** capacity/privacy/code tests belong to Tasks 1–2; media permission and no-fan-out tests belong to Task 4.
- **Proportion:** data/API, lobby, media, home and verification are independently reviewable; implementation details stay in code.

## Execution handoff

The implementation touches database schema, anonymous public APIs, realtime media behavior and two visual surfaces. It should run in an isolated worktree with task-by-task review to avoid disturbing the existing dirty checkout.



