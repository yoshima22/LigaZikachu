using System.Windows;
using ZikaCompanion.App;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

public class ActionAreaTests
{
    [Fact]
    public void UnverifiedActionsUseExistingLocalSpriteForEachSpecies()
    {
        foreach (var mascot in MascotCatalog.All)
        foreach (var action in new[] { CompanionBehavior.Idle, CompanionBehavior.Walk, CompanionBehavior.Sleep, CompanionBehavior.Alert, CompanionBehavior.Dragging })
            Assert.Equal(mascot.AssetPath, MascotCatalog.AssetFor(mascot, action, 1));
    }

    [Fact]
    public void VisualBoundsReachTopAndBottomOfCustomArea()
    {
        var bounds = new Rect(200, 150, 100, 120);
        var area = new Rect(100, 100, 500, 400);
        Assert.Equal(new Point(-100, -50), OverlayViewModel.ClampVisualPosition(new Point(-999, -999), bounds, area));
        Assert.Equal(new Point(300, 230), OverlayViewModel.ClampVisualPosition(new Point(999, 999), bounds, area));
    }

    [Fact]
    public void SelectionUsesCustomAreaAndResetRestoresMonitor()
    {
        var model = Model(() => DateTimeOffset.UnixEpoch);
        var monitor = new Rect(0, 0, 1000, 800);
        var selected = new Rect(100, 100, 300, 200);
        model.SetActionArea(selected);
        Assert.Equal(selected, model.ActionAreaOr(monitor));
        model.ResetActionArea();
        Assert.Equal(monitor, model.ActionAreaOr(monitor));
    }

    [Fact]
    public void WalkingBouncesAtCustomVisualEdgesAndDraggingStopsWalking()
    {
        var now = DateTimeOffset.UnixEpoch;
        var model = Model(() => now);
        var bounds = new Rect(200, 150, 100, 120);
        var area = new Rect(100, 100, 500, 400);
        now = now.AddSeconds(8); model.Advance();
        var left = model.WalkVisualPosition(new Point(-99, 0), bounds, area, TimeSpan.FromSeconds(1));
        Assert.Equal(-100, left.X); Assert.Equal(1, model.WalkDirection);
        var right = model.WalkVisualPosition(new Point(299, 0), bounds, area, TimeSpan.FromSeconds(1));
        Assert.Equal(300, right.X); Assert.Equal(-1, model.WalkDirection);
        model.BeginDrag();
        Assert.Equal(CompanionBehavior.Dragging, model.Behavior);
        Assert.Equal(right, model.WalkVisualPosition(right, bounds, area, TimeSpan.FromSeconds(1)));
    }

    private static OverlayViewModel Model(Func<DateTimeOffset> clock) => new(new AlertQueue(new AudioAlertService(() => { })), clock);
}
