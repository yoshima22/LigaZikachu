# Private companion event integrations

The private pilot emits events for completed expeditions, recorded Arena-Z PvP attacks, and published weekly-league ticker updates. Arena attacks use `ARENA_ATTACKED`; an attack does not establish that the defender can attack or leave, so availability events are not synthesized.

Weekly ticker delivery is enabled by default per linked device. `CompanionDevice.weeklyTickerEnabled` can be set to `false` for a pilot device to opt out. Expedition and Arena events honor the existing Mascotes and Arena push category settings and push cooldown, without advancing the player's push cooldown themselves.

Rush and pushup events remain unconnected: no existing reactive pushup source was identified, and the Rush push automation includes scheduled notices rather than a verified publication transition. Add integrations only when their actual source, intended recipients, and preference policy are established. Similarly, add Arena attack/exit availability events only at verified state transitions. Do not turn scheduled advance reminders into companion events.

The device-event uniqueness constraint and idempotent insertion protect retries; the migration has not been applied or verified against PostgreSQL. Arena and ticker publication failures are isolated from the original game transition and currently have no durable retry. Expedition emission is attempted before the existing push marker is claimed, so a write failure can be retried on the next automation run within its existing lookback window.
