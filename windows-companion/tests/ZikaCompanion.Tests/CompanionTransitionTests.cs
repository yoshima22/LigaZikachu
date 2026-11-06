using System.Windows;
using ZikaCompanion.App;
using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

public sealed class CompanionTransitionTests
{
    private DateTimeOffset _now = DateTimeOffset.UnixEpoch;
    private OverlayViewModel Model(BehaviorTiming? timing = null) => new(
        new AlertQueue(new AudioAlertService(() => { })), () => _now, timing);
    private void Step(OverlayViewModel model, double seconds) { _now = _now.AddMilliseconds(Math.Round(seconds * 1000)); model.Advance(); }
    private static CompanionEvent Event() => new("wake", CompanionEventType.EXPEDITION_COMPLETED,
        DateTimeOffset.UnixEpoch, "Local", "Simulado");

    [Fact]
    public void IdleWalkAndConfigurableSleepUseInjectedTime()
    {
        var model = Model(new BehaviorTiming { SleepAfter = TimeSpan.FromSeconds(15) });
        Assert.Equal(CompanionBehavior.Idle, model.Behavior);
        Step(model, 8);
        Assert.Equal(CompanionBehavior.Walk, model.Behavior);
        Step(model, 4);
        Assert.Equal(CompanionBehavior.Idle, model.Behavior);
        Step(model, 3);
        Assert.Equal(CompanionBehavior.Sleep, model.Behavior);
        Step(model, 100);
        Assert.True(model.IsSleeping);
        model.Wake();
        Assert.Equal(CompanionBehavior.Idle, model.Behavior);
        Step(model, 14.9);
        Assert.False(model.IsSleeping);
    }

    [Fact]
    public void ClickWakesAndPlaysBrieflyThenReturnsToIdle()
    {
        var model = Model();
        Step(model, 24);
        Assert.True(model.IsSleeping);
        model.Play();
        Assert.Equal(CompanionBehavior.Happy, model.Behavior);
        Step(model, 1.39);
        Assert.True(model.IsHappy);
        Step(model, .01);
        Assert.Equal(CompanionBehavior.Idle, model.Behavior);
    }

    [Fact]
    public void AlertInterruptsSleepPlayAndDragWithoutLosingDragSession()
    {
        var model = Model();
        Step(model, 24);
        model.AcceptEvent(Event());
        Assert.Equal(CompanionBehavior.Alert, model.Behavior);
        Assert.False(model.IsSleeping);
        model.Play();
        model.BeginDrag();
        Assert.Equal(CompanionBehavior.Alert, model.Behavior);
        model.DismissBalloon();
        Assert.Equal(CompanionBehavior.Dragging, model.Behavior);
        model.EndDrag(wasClick: false);
        Assert.Equal(CompanionBehavior.Idle, model.Behavior);
        model.Play();
        model.AcceptEvent(Event() with { EventId = "play-interrupt" });
        Assert.Equal(CompanionBehavior.Alert, model.Behavior);
        Step(model, 8);
        Assert.Equal(CompanionBehavior.Idle, model.Behavior);
    }

    [Fact]
    public void DragReleaseDoesNotPlayButClickReleaseDoes()
    {
        var model = Model();
        model.BeginDrag();
        Step(model, 60);
        Assert.Equal(CompanionBehavior.Dragging, model.Behavior);
        model.EndDrag(wasClick: false);
        Assert.Equal(CompanionBehavior.Idle, model.Behavior);
        model.BeginDrag();
        model.EndDrag(wasClick: true);
        Assert.True(model.IsHappy);
    }

    [Fact]
    public void WalkingTurnsAtBothEdgesAndKeepsVerticalPositionOnNegativeMonitor()
    {
        var model = Model();
        Step(model, 8);
        var area = new Rect(-1920, -100, 1920, 1080);
        var size = new Size(340, 300);
        var left = model.WalkPosition(new Point(-1919, 400), size, area, TimeSpan.FromSeconds(1));
        Assert.Equal(new Point(-1920, 400), left);
        Assert.Equal(1, model.WalkDirection);
        var right = model.WalkPosition(new Point(-341, 400), size, area, TimeSpan.FromSeconds(1));
        Assert.Equal(new Point(-340, 400), right);
        Assert.Equal(-1, model.WalkDirection);
        model.BeginDrag();
        Assert.Equal(right, model.WalkPosition(right, size, area, TimeSpan.FromSeconds(1)));
        model.EndDrag(false);
        Step(model, 24);
        Assert.Equal(right, model.WalkPosition(right, size, area, TimeSpan.FromSeconds(1)));
    }

    [Fact]
    public void PauseStopsAutonomousActivityAndRetainsLocalEvents()
    {
        var model = Model();
        model.TogglePause();
        Step(model, 60);
        Assert.Equal(CompanionBehavior.Idle, model.Behavior);
        model.AcceptEvent(Event());
        Assert.False(model.HasBalloon);
        model.TogglePause();
        Assert.Equal(CompanionBehavior.Alert, model.Behavior);
        model.DismissBalloon();
        Assert.False(model.IsSleeping);
    }
}
