using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

public sealed class AlertQueueTests
{
    [Fact]
    public void DuplicateIdsAreSuppressedBeforeAndAfterDelivery()
    {
        var queue = new AlertQueue(new AudioAlertService(() => { }));
        var item = Event("same");

        Assert.True(queue.Enqueue(item));
        Assert.False(queue.Enqueue(item with { Message = "Duplicate delivery" }));
        Assert.Equal(1, queue.PendingCount);
        Assert.True(queue.TryDequeue(out var alert));
        Assert.Equal(item, Assert.Single(alert!.Events));
        Assert.False(queue.Enqueue(item));
        Assert.False(queue.TryDequeue(out _));
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public void PauseAndQuietRetainEventsUntilOneSilentSummary(bool paused, bool quiet)
    {
        var sounds = 0;
        var queue = new AlertQueue(new AudioAlertService(() => sounds++))
        {
            IsPaused = paused,
            IsQuiet = quiet
        };
        queue.Enqueue(Event("first"));
        queue.Enqueue(Event("second"));

        Assert.False(queue.TryDequeue(out _));
        Assert.Null(queue.ResumeSummary());
        Assert.Equal(2, queue.PendingCount);
        queue.IsPaused = false;
        if (quiet)
        {
            Assert.Null(queue.ResumeSummary());
        }
        queue.IsQuiet = false;

        var summary = queue.ResumeSummary();
        Assert.NotNull(summary);
        Assert.True(summary.IsSummary);
        Assert.Equal(new[] { "first", "second" }, summary.Events.Select(item => item.EventId));
        Assert.Equal(0, sounds);
        Assert.Equal(0, queue.PendingCount);
        Assert.Null(queue.ResumeSummary());
        Assert.False(queue.TryDequeue(out _));
    }

    [Fact]
    public void LiveAlertsAreFifoAndOnlyUnmutedDeliveryPlaysSound()
    {
        var sounds = 0;
        var queue = new AlertQueue(new AudioAlertService(() => sounds++));
        queue.Enqueue(Event("first"));
        queue.Enqueue(Event("second"));
        Assert.Equal(0, sounds);

        Assert.True(queue.TryDequeue(out var first));
        Assert.False(first!.IsSummary);
        Assert.Equal("first", Assert.Single(first.Events).EventId);
        Assert.Equal(1, sounds);
        queue.IsMuted = true;
        Assert.True(queue.TryDequeue(out var second));
        Assert.Equal("second", Assert.Single(second!.Events).EventId);
        Assert.Equal(1, sounds);
        Assert.Null(queue.ResumeSummary());
        Assert.False(queue.TryDequeue(out _));
    }

    [Fact]
    public void ResumingAllowsNewLiveAlertsWithoutReplayingRetainedEvents()
    {
        var sounds = 0;
        var queue = new AlertQueue(new AudioAlertService(() => sounds++)) { IsPaused = true };
        queue.Enqueue(Event("old"));
        queue.IsPaused = false;
        Assert.NotNull(queue.ResumeSummary());
        queue.Enqueue(Event("new"));
        Assert.True(queue.TryDequeue(out var alert));
        Assert.Equal("new", Assert.Single(alert!.Events).EventId);
        Assert.Equal(1, sounds);
    }

    private static CompanionEvent Event(string id) => new(
        id, CompanionEventType.EXPEDITION_COMPLETED,
        DateTimeOffset.Parse("2026-11-06T16:00:00Z"), "Expedição concluída", "Evento de teste local.");
}
