namespace ZikaCompanion.App.Domain;

public enum CompanionEventType
{
    EXPEDITION_COMPLETED,
    ARENA_ATTACK_AVAILABLE,
    ARENA_EXIT_AVAILABLE
}

public sealed record CompanionEvent(
    string EventId,
    CompanionEventType Type,
    DateTimeOffset CreatedAt,
    string Title,
    string Message);

public sealed record CompanionAlert(IReadOnlyList<CompanionEvent> Events, bool IsSummary);
