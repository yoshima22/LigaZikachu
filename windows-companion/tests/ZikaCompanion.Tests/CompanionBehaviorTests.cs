using ZikaCompanion.App;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

public sealed class CompanionBehaviorTests
{
    [Fact]
    public void InactivityStopsWalkingEvenAtTheNextWalkPhase()
    {
        var now = DateTimeOffset.UnixEpoch;
        var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => { })), () => now);
        now = now.AddSeconds(32);
        model.Advance();
        Assert.False(model.IsWalking);
        Assert.False(model.IsIdle); // Sleep is a distinct state, not idle breathing.
    }
}
