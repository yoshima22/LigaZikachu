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
    private CompanionAlert? _activeAlert;
    private CompanionAlert? _interruptedAlert;

    public OverlayViewModel(AlertQueue queue, Func<DateTimeOffset>? clock = null)
    {
        _queue = queue;
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
        _startedAt = _clock();
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    public bool HasBalloon => _balloonUntil is not null;
    public bool IsPaused => _queue.IsPaused;
    public bool IsMuted => _queue.IsMuted;
    public bool IsIdle => !IsWalking && !HasBalloon;
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
        Notify(nameof(IsIdle));
    }

    public void DismissBalloon()
    {
        _activeAlert = null;
        _balloonUntil = null;
        NotifyState();
        ShowNext();
    }

    public void TogglePause()
    {
        _queue.IsPaused = !_queue.IsPaused;
        if (IsPaused)
        {
            _interruptedAlert = _activeAlert;
            _activeAlert = null;
            _balloonUntil = null;
        }
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

    public static Point DragPosition(Point windowStart, Point pointerStart, Point pointerCurrent,
        Size overlaySize, Rect workArea) => ClampPosition(windowStart + (pointerCurrent - pointerStart), overlaySize, workArea);

    private void ShowNext()
    {
        if (HasBalloon || IsPaused) return;
        var alert = _queue.ResumeSummary();
        if (_interruptedAlert is { } interrupted)
        {
            // The active alert has already left the deduplicating queue. Preserve it
            // here and merge it with retained events without delivering audio again.
            alert = new CompanionAlert(interrupted.Events.Concat(alert?.Events ?? []).ToArray(), true);
            _interruptedAlert = null;
        }
        if (alert is null && !_queue.TryDequeue(out alert)) return;
        if (alert is null) return;
        _activeAlert = alert;
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
        Notify(nameof(IsPaused));
        Notify(nameof(IsWalking));
        Notify(nameof(IsIdle));
        Notify(nameof(BalloonTitle));
        Notify(nameof(BalloonMessage));
    }

    private void Notify([CallerMemberName] string? property = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(property));
}
