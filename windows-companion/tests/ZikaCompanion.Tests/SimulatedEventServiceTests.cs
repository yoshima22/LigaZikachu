using System.Collections.Concurrent;
using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

public sealed class SimulatedEventServiceTests
{
    [Fact]
    public async Task StartedTimerEmitsAllThreeLocalEventTypesWithUniqueIds()
    {
        using var simulator = new SimulatedEventService(TimeSpan.FromMilliseconds(10));
        var events = new ConcurrentQueue<CompanionEvent>();
        var completed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        simulator.EventGenerated += item =>
        {
            events.Enqueue(item);
            if (events.Count >= 3) completed.TrySetResult();
        };

        simulator.Start();
        simulator.Start();
        await completed.Task.WaitAsync(TimeSpan.FromSeconds(5));
        simulator.Stop();

        var firstThree = events.Take(3).ToArray();
        Assert.Equal(new[] {
            CompanionEventType.EXPEDITION_COMPLETED,
            CompanionEventType.ARENA_ATTACK_AVAILABLE,
            CompanionEventType.ARENA_EXIT_AVAILABLE
        }, firstThree.Select(item => item.Type));
        Assert.Equal(3, firstThree.Select(item => item.EventId).Distinct().Count());
        Assert.All(firstThree, item =>
        {
            Assert.False(string.IsNullOrWhiteSpace(item.Title));
            Assert.False(string.IsNullOrWhiteSpace(item.Message));
            Assert.NotEqual(default, item.CreatedAt);
        });
    }

    [Fact]
    public void ManualTriggersProduceFreshEventsWithoutStartingTimer()
    {
        using var simulator = new SimulatedEventService();
        var events = new List<CompanionEvent>();
        simulator.EventGenerated += events.Add;
        simulator.Trigger(CompanionEventType.ARENA_EXIT_AVAILABLE);
        simulator.Trigger(CompanionEventType.ARENA_EXIT_AVAILABLE);

        Assert.Equal(2, events.Count);
        Assert.All(events, item => Assert.Equal(CompanionEventType.ARENA_EXIT_AVAILABLE, item.Type));
        Assert.NotEqual(events[0].EventId, events[1].EventId);
    }
}
