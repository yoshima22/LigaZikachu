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
    private readonly BehaviorTiming _timing;
    private DateTimeOffset _lastActivity;
    private DateTimeOffset? _happyUntil;
    private bool _dragging;
    public int WalkDirection { get; private set; } = -1;
    private DateTimeOffset? _balloonUntil;
    private CompanionAlert? _activeAlert;
    private CompanionAlert? _interruptedAlert;

    public OverlayViewModel(AlertQueue queue, Func<DateTimeOffset>? clock = null, BehaviorTiming? timing = null)
    {
        _queue = queue;
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
        _startedAt = _clock();
        _lastActivity = _startedAt;
        _timing = timing ?? new BehaviorTiming();
        _timing.Validate();
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    public MascotOption SelectedMascot { get; private set; } = MascotCatalog.All[0];

    public void SelectMascot(int number)
    {
        SelectedMascot = MascotCatalog.All.Single(mascot => mascot.Number == number);
        Notify(nameof(SelectedMascot));
    }

    public bool HasBalloon => _balloonUntil is not null;
    public bool IsPaused => _queue.IsPaused;
    public bool IsMuted => _queue.IsMuted;
    // Explicit priority: Alert > Dragging > pause > Happy > Sleep > Walk/Idle.
    public CompanionBehavior Behavior { get; private set; } = CompanionBehavior.Idle;
    public bool IsSleeping => Behavior == CompanionBehavior.Sleep;
    public bool IsHappy => Behavior == CompanionBehavior.Happy;
    public bool IsIdle => Behavior == CompanionBehavior.Idle;
    public bool IsWalking => Behavior == CompanionBehavior.Walk;

    public void Wake()
    {
        _lastActivity = _clock();
        NotifyState();
    }

    public void Play()
    {
        _lastActivity = _clock();
        if (!HasBalloon && !_dragging && !IsPaused) _happyUntil = _clock() + _timing.HappyFor;
        NotifyState();
    }

    public void BeginDrag()
    {
        _dragging = true;
        _happyUntil = null;
        Wake();
    }

    public void EndDrag(bool wasClick)
    {
        _dragging = false;
        if (wasClick) Play();
        else Wake();
    }

    public Point WalkPosition(Point current, Size size, Rect workArea, TimeSpan elapsed)
    {
        if (!IsWalking) return current;
        var next = current.X + WalkDirection * _timing.WalkPixelsPerSecond * Math.Max(0, elapsed.TotalSeconds);
        var right = Math.Max(workArea.Left, workArea.Right - size.Width);
        if (next <= workArea.Left) WalkDirection = 1;
        else if (next >= right) WalkDirection = -1;
        return ClampPosition(new Point(next, current.Y), size, workArea);
    }

    private void ResolveBehavior()
    {
        var now = _clock();
        Behavior = HasBalloon ? CompanionBehavior.Alert
            : _dragging ? CompanionBehavior.Dragging
            : IsPaused ? CompanionBehavior.Idle
            : _happyUntil is { } happy && now < happy ? CompanionBehavior.Happy
            : now - _lastActivity >= _timing.SleepAfter ? CompanionBehavior.Sleep
            : (now - _lastActivity).Ticks % (_timing.IdleFor + _timing.WalkFor).Ticks >= _timing.IdleFor.Ticks
                ? CompanionBehavior.Walk : CompanionBehavior.Idle;
    }

    public string BalloonTitle { get; private set; } = "";
    public string BalloonMessage { get; private set; } = "";
    public CompanionEvent? ActionEvent => _activeAlert is { IsSummary: false, Events.Count: 1 } alert &&
        alert.Events[0].Actions?.Contains("COLLECT_EXPEDITION") == true ? alert.Events[0] : null;
    public bool HasAction => ActionEvent is not null;
    public CompanionEvent? RouteEvent => _activeAlert is { IsSummary: false, Events.Count: 1 } alert && !string.IsNullOrEmpty(alert.Events[0].Route) ? alert.Events[0] : null;
    public bool HasRoute => RouteEvent is not null;

    public void AcceptEvent(CompanionEvent item)
    {
        _lastActivity = _clock();
        _queue.Enqueue(item);
        ShowNext();
        NotifyState();
    }

    public void Advance()
    {
        if (_balloonUntil is { } until && _clock() >= until) DismissBalloon();
        else ShowNext();
        NotifyState();
    }

    public void DismissBalloon()
    {
        _activeAlert = null;
        _balloonUntil = null;
        _lastActivity = _clock();
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

    private Rect? _actionArea;
    public void SetActionArea(Rect area)
    {
        if (area.IsEmpty || area.Width <= 0 || area.Height <= 0) throw new ArgumentOutOfRangeException(nameof(area));
        _actionArea = area;
    }
    public void ResetActionArea() => _actionArea = null;
    public Rect ActionAreaOr(Rect monitor) => _actionArea ?? monitor;

    public static Point ClampVisualPosition(Point requested, Rect visual, Rect area) => new(
        Math.Clamp(requested.X, area.Left - visual.Left, Math.Max(area.Left - visual.Left, area.Right - visual.Right)),
        Math.Clamp(requested.Y, area.Top - visual.Top, Math.Max(area.Top - visual.Top, area.Bottom - visual.Bottom)));

    public Point WalkVisualPosition(Point current, Rect visual, Rect area, TimeSpan elapsed)
    {
        if (!IsWalking) return current;
        var next = current.X + WalkDirection * _timing.WalkPixelsPerSecond * Math.Max(0, elapsed.TotalSeconds);
        if (next <= area.Left - visual.Left) WalkDirection = 1;
        else if (next >= area.Right - visual.Right) WalkDirection = -1;
        return ClampVisualPosition(new Point(next, current.Y), visual, area);
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
        _happyUntil = null;
        _lastActivity = _clock();
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
        ResolveBehavior();
        Notify(nameof(Behavior));
        Notify(nameof(IsSleeping));
        Notify(nameof(IsHappy));
        Notify(nameof(HasBalloon));
        Notify(nameof(IsPaused));
        Notify(nameof(IsWalking));
        Notify(nameof(IsIdle));
        Notify(nameof(BalloonTitle));
        Notify(nameof(BalloonMessage));
        Notify(nameof(HasAction));
        Notify(nameof(HasRoute));
    }

    private void Notify([CallerMemberName] string? property = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(property));
}
