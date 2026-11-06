using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;

namespace ZikaCompanion.App;

public sealed class OverlayViewModel : INotifyPropertyChanged
{
    private readonly AlertQueue _queue;
    private readonly Func<DateTimeOffset> _clock;
    private readonly DateTimeOffset _startedAt;
    private DateTimeOffset? _balloonUntil;

    public OverlayViewModel(AlertQueue queue, Func<DateTimeOffset>? clock = null)
    {
        _queue = queue;
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
        _startedAt = _clock();
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    public bool HasBalloon => _balloonUntil is not null;
    public bool IsClickThrough => !HasBalloon;
    public bool IsPaused => _queue.IsPaused;
    public bool IsMuted => _queue.IsMuted;
    public bool IsWalking => !IsPaused && !HasBalloon && (_clock() - _startedAt).TotalSeconds % 12 >= 8;
    public string BalloonTitle { get; private set; } = "";
    public string BalloonMessage { get; private set; } = "";

    public void AcceptEvent(CompanionEvent item)
    {
        _queue.Enqueue(item);
        ShowNext();
    }

    public void Advance()
    {
        if (_balloonUntil is { } until && _clock() >= until) DismissBalloon();
        else ShowNext();
        Notify(nameof(IsWalking));
    }

    public void DismissBalloon()
    {
        _balloonUntil = null;
        NotifyState();
        ShowNext();
    }

    public void TogglePause()
    {
        _queue.IsPaused = !_queue.IsPaused;
        if (IsPaused) _balloonUntil = null;
        ShowNext();
        NotifyState();
    }

    public void ToggleMute()
    {
        _queue.IsMuted = !_queue.IsMuted;
        Notify(nameof(IsMuted));
    }

    public static Point ClampPosition(Point requested, Size overlaySize, Rect workArea) => new(
        Math.Clamp(requested.X, workArea.Left, Math.Max(workArea.Left, workArea.Right - overlaySize.Width)),
        Math.Clamp(requested.Y, workArea.Top, Math.Max(workArea.Top, workArea.Bottom - overlaySize.Height)));

    private void ShowNext()
    {
        if (HasBalloon || IsPaused) return;
        var alert = _queue.ResumeSummary();
        if (alert is null && !_queue.TryDequeue(out alert)) return;
        if (alert is null) return;
        BalloonTitle = alert.IsSummary ? $"{alert.Events.Count} eventos durante a pausa" : alert.Events[0].Title;
        BalloonMessage = alert.IsSummary
            ? string.Join("\n", alert.Events.GroupBy(item => item.Title).Select(group => $"{group.Count()} × {group.Key}"))
            : alert.Events[0].Message;
        _balloonUntil = _clock().AddSeconds(8);
        NotifyState();
    }

    private void NotifyState()
    {
        Notify(nameof(HasBalloon));
        Notify(nameof(IsClickThrough));
        Notify(nameof(IsPaused));
        Notify(nameof(IsWalking));
        Notify(nameof(BalloonTitle));
        Notify(nameof(BalloonMessage));
    }

    private void Notify([CallerMemberName] string? property = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(property));
}
