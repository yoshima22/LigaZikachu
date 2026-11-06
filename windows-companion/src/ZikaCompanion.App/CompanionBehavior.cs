namespace ZikaCompanion.App;

public enum CompanionBehavior { Idle, Walk, Sleep, Alert, Happy, Dragging }

/// <summary>Local deterministic timings; no random source or network is needed.</summary>
public sealed record BehaviorTiming
{
    public TimeSpan IdleFor { get; init; } = TimeSpan.FromSeconds(8);
    public TimeSpan WalkFor { get; init; } = TimeSpan.FromSeconds(4);
    public TimeSpan SleepAfter { get; init; } = TimeSpan.FromSeconds(24);
    public TimeSpan HappyFor { get; init; } = TimeSpan.FromSeconds(1.4);
    public double WalkPixelsPerSecond { get; init; } = 39;

    internal void Validate()
    {
        if (IdleFor <= TimeSpan.Zero || WalkFor <= TimeSpan.Zero || SleepAfter <= TimeSpan.Zero ||
            HappyFor <= TimeSpan.Zero || !double.IsFinite(WalkPixelsPerSecond) || WalkPixelsPerSecond <= 0)
            throw new ArgumentOutOfRangeException(nameof(BehaviorTiming), "Intervals and walking speed must be positive.");
    }
}
