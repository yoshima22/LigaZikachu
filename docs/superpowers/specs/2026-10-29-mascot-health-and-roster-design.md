# Mascot health alerts and roster controls — design

## Intent

Help a player notice and act on mascot health problems without notification spam, find a permanently equipped XP Share regardless of whether its holder is in the bank, stop an unwanted vacation, and compare the strongest mascots in their collection.

## Goals

- Create at most one disease alert and one at-risk alert per player per disease-processing run.
- Name affected mascots only when a group has one or two members; otherwise use aggregate copy.
- Surface the current XP Share holder with a direct way to locate it in the bank.
- Allow an active vacation to be cancelled without refunding its ticket or granting its rewards.
- Add bank ordering for level, total stats, and each individual stat.

## Non-goals

- Do not change disease probability, treatment, EXP-share rewards, or vacation rewards when they finish normally.
- Do not create a separate collection-ranking page.

## Constraints

- Alerts remain player notifications linked to `/mascotes` and must be idempotent for their relevant processing window.
- Existing bank pagination and server-side filters remain authoritative.
- All cancellation authorization and state checks happen on the server.

## Approaches considered

1. **Chosen: extend the existing bank controls and disease cron.** The cron aggregates candidates before creating notifications; the bank gets additional server-side sort modes; the XP Share holder is included in the bank query/summary. This preserves pagination and needs no duplicate view.
2. A separate collection-ranking screen would offer richer visual comparison but duplicates the roster workflow and was rejected as unnecessary scope.
3. Filtering only featured mascots would be simpler but would not solve comparisons or XP Share location in the bank.

## Behaviour

- A mascot is *at risk* when it meets the existing pre-roll disease criteria: hungry for its companion/bank threshold and emotionally unwell. At-risk and newly-diseased groups are computed before notification creation.
- Newly diseased mascots, including new contagion targets, produce one grouped alert. At-risk mascots produce one grouped alert. One or two names appear in the text; groups of three or more use generic plural copy.
- The XP Share summary shows which mascot holds the permanent `XP_SHARE` or `XP_SHARE_TEAM` buff. When that mascot is banked, the action opens the bank with a targeted lookup/filter; when featured, it is already visibly represented.
- Cancelling an active vacation marks its expedition as cancelled and records an event. It neither refunds the consumed ticket nor applies vacation rewards.
- Bank sort modes are: level descending (then total stats descending), total stats descending (then level descending), and each stat descending (then total stats descending, then level descending). The sort UI labels attributes in Portuguese.

## Decisions left to the builder

- Use the project’s established test mechanism, adding focused TypeScript tests around extracted pure helpers where database-bound code cannot be isolated.
- Keep the notification names and copy consistent with the existing Portuguese UI.
