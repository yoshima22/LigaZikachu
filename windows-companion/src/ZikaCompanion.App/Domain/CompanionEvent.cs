namespace ZikaCompanion.App.Domain;

public enum CompanionEventType
{
    EXPEDITION_COMPLETED,
    ARENA_ATTACK_AVAILABLE,
    ARENA_EXIT_AVAILABLE,
    ARENA_ATTACKED, WEEKLY_LEAGUE_REMINDER, LEAGUE_EVENT_UPDATE, RUSH_UPDATE, PUSHUP_RECEIVED
}

public sealed record CompanionEvent(
    string EventId,
    CompanionEventType Type,
    DateTimeOffset CreatedAt,
    string Title,
    string Message,
    string? Route = null,
    string[]? Actions = null);

public sealed record CompanionAlert(IReadOnlyList<CompanionEvent> Events, bool IsSummary);
