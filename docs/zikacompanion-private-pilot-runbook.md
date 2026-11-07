# ZikaCompanion private pilot runbook

The pilot ships disabled. Start with one consenting tester and one Windows device. Keep the installer and approval link private; the pilot does not add public navigation, a download page, or an enrollment flow.

## Local verification without an admin account

From the repository root, with the web dependencies and generated Prisma client installed:

```powershell
node scripts/smoke-zikacompanion.mjs
npm test
```

The smoke command starts a child process with fixture credentials and an unreachable loopback database URL. It uses in-memory stores and local request objects to check the default deny gate, one-time linking, refresh rotation and revocation, profile and device-scoped SSE replay, stream closure, and action ownership and idempotency. It sends no notification and collects no real expedition. It needs no server, admin account, or migration. The ordinary project test currently covers Bazar offers.

Before rollout, also run `npx prisma validate` and `npm run build` in a clean checkout with local or staging configuration. On Windows with the .NET 8 Desktop runtime, run:

```powershell
dotnet test windows-companion/ZikaCompanion.sln
dotnet build windows-companion/ZikaCompanion.sln -c Release
```

The Windows pilot fixtures use fake HTTP responses and local session stores. They do not prove the deployed browser origin, PostgreSQL policies and concurrent writes, or proxy behavior. Verify those on an isolated staging deployment with synthetic accounts and data before enabling production. Check migrations against a representative database using the deployed application's database role, including row-level security on the companion tables. Check that the edge forwards `Last-Event-ID`, preserves the HTTPS origin for approval, and streams rather than buffers 30-second SSE heartbeats. A host can impose its own stream duration; check reconnection with the cursor before rollout.

## Configuration and rollout

| Scope | Setting | Pilot value |
| --- | --- | --- |
| Server runtime | `ZIKACOMPANION_PILOT_ENABLED` | Literal `true` to enable. Defaults to off. |
| Server runtime | `ZIKACOMPANION_PILOT_USER_IDS` | The tester's internal `User.id` (no email, handle, or player ID). The parser accepts comma-separated values; begin with exactly one. |
| Server secret store | `AUTH_SECRET` | Existing application signing secret, consistent across replicas. The companion falls back to `NEXTAUTH_SECRET` if `AUTH_SECRET` is unset. |
| Tester Windows process | `ZIKACOMPANION_BASE_URL` | HTTPS origin of the pilot deployment, with no API path. Restart the companion after changing it. |

1. With the gate disabled, prepare the deployment and apply the reviewed migrations through the project's normal migration process, in order: `20261106120000_companion_pilot`, `20261106130000_companion_events`, and `20261106140000_companion_action_audit`. Confirm all replicas serve the intended release. Before enabling, verify that correctly addressed companion routes return 404 while disabled.
2. Deploy the server gate with the single tester's ID. Have the tester sign in to Liga Zikachu in the system browser before choosing **Vincular conta** from the tray. Paste the clipboard code only into the opened same-origin HTTPS approval page. Approval requires an eligible app session (`ACTIVE` or `PENDING_APPROVAL`); no password is submitted to the desktop. Treat the clipboard code as a credential and clear it after use.
3. Verify that a browser without an allowlisted eligible session sees 404 on the approval page. Device initiation and polling are pre-authentication endpoints: when enabled, initiation is reachable by unauthenticated callers and rate-limited; an unapproved, expired or used code polls as 202. Only an approved, eligible, allowlisted account can link. Profile, events and actions return 404 without a valid eligible device.
4. Observe the tester's own natural event traffic if available. Do not trigger production events, push jobs, or collection to prove the rollout; exercise those paths in fixtures. Compare existing notification behavior for ordinary users, and check for stream, authorization and database errors. Stop the rollout if account isolation, revocation, logging or replay checks fail.

## Current contract

- Device codes are single-use and expire after 10 minutes. Access tokens expire after 15 minutes. Refresh tokens rotate on use and expire after 30 days; the server stores hashes, and the desktop protects the current refresh token with Windows DPAPI in `%LOCALAPPDATA%\ZikaCompanion\session.dat`.
- Live event sources are expedition completion (`EXPEDITION_COMPLETED`), recorded Arena-Z attacks (`ARENA_ATTACKED`), and weekly ticker publication (`LEAGUE_EVENT_UPDATE`). Arena availability, Rush and pushup events are not wired. Weekly ticker delivery defaults on per device. Arena and ticker delivery failures have no durable retry. See [event integrations](zikacompanion-event-integrations.md) for preferences and retry details.
- Only `COLLECT_EXPEDITION` is implemented, for an owned, completed, unclaimed ordinary expedition. Vacation and training are excluded. The desktop asks for confirmation; the API also requires `confirmed: true` and an eligible event for that device. Weekly league is a deep link; there is no desktop confirmation action for it. Action audit is keyed by device, event and action. A stuck `PENDING` entry is not retried automatically; inspect the underlying expedition state before any intervention.
- The profile endpoint exists; the desktop currently uses the link and event APIs without presenting the server profile. SSE revalidates the gate, account and device at each poll. The desktop holds the replay cursor and deduplication in memory for the current session, so restarting can replay older device events.

## Revocation and rollback

**One lost or retired device:** Use restricted database access to set `companion_devices."revokedAt"` for the verified device and account. There is no player-facing revoke endpoint. For example, in an approved maintenance transaction, bind the exact device ID and owner ID as parameters and verify the affected row before commit:

```sql
UPDATE "companion_devices"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL
RETURNING "id", "revokedAt";
```

When enabled for that account, a revoked device's refresh returns 401; protected requests return 404. An open stream on a current replica closes on its next authorization poll, normally within 30 seconds. For suspected account-wide exposure, remove the account from the allowlist, revoke all its linked devices and invalidate its outstanding approved authorizations by setting their `consumedAt` before restoring the allowlist. Changing the allowlist alone is reversible and does not erase credentials.

**Disable the pilot:** Set `ZIKACOMPANION_PILOT_ENABLED=false` and clear `ZIKACOMPANION_PILOT_USER_IDS` across the deployment; restart or redeploy all server replicas as required. Confirm that all companion routes are concealed on fresh requests, old deployment instances no longer serve traffic, and existing streams stop on revalidation or instance shutdown. Keep the tables and audit rows. Revoke devices if they must stay invalid after a future re-enable.

Ask the tester to use **Desconectar conta** to clear the DPAPI session and return to the simulator. Desktop disconnect does not revoke the server device; disabling the server returns 404, which does not automatically clear the desktop session.

## Log review

Check the reverse proxy, application, database diagnostics, and any desktop support capture. Keep request and response body capture off for authorization, approval, exchange, actions and SSE. Do not log the `Authorization` or `Cookie` headers, browser user codes, device codes, access or refresh tokens, token hashes, signing secret or the session file. For verification, inspect logging configuration and use synthetic credential values in staging; do not paste live credentials into a log query or ticket. Record status, latency, route, and redacted identifiers. The action audit contains device, event and action identifiers, timestamps and result status; it should contain no credentials.
