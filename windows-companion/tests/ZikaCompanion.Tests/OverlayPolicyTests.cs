using System.Diagnostics;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using System.Windows;
using ZikaCompanion.App;
using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

public sealed class OverlayPolicyTests
{
    [Fact]
    public void WindowStaysAboveDesktopWithoutTaskbarOrActivation()
    {
        OnSta(() =>
        {
            var window = new MainOverlayWindow(new OverlayViewModel(SilentQueue()));
            Assert.True(window.Topmost);
            Assert.False(window.ShowInTaskbar);
            Assert.False(window.ShowActivated);
            Assert.Equal(WindowStyle.None, window.WindowStyle);
            Assert.True(window.AllowsTransparency);
            window.Close();
        });
    }

    [Fact]
    public void IdlePassesClicksThroughAndLiveBalloonCanBeDismissed()
    {
        var model = new OverlayViewModel(SilentQueue());
        Assert.True(model.IsClickThrough);
        model.AcceptEvent(Event("one"));
        Assert.False(model.IsClickThrough);
        Assert.True(model.HasBalloon);
        Assert.Equal("Teste local", model.BalloonTitle);
        model.DismissBalloon();
        Assert.False(model.HasBalloon);
        Assert.True(model.IsClickThrough);
    }

    [Fact]
    public void BalloonLastsEightSecondsAndThenDisplaysNextQueuedEvent()
    {
        var now = DateTimeOffset.Parse("2026-11-06T16:00:00Z");
        var model = new OverlayViewModel(SilentQueue(), () => now);
        model.AcceptEvent(Event("one"));
        model.AcceptEvent(Event("two") with { Title = "Segundo" });
        now = now.AddMilliseconds(7999);
        model.Advance();
        Assert.Equal("Teste local", model.BalloonTitle);
        now = now.AddMilliseconds(1);
        model.Advance();
        Assert.Equal("Segundo", model.BalloonTitle);
        now = now.AddSeconds(8);
        model.Advance();
        Assert.False(model.HasBalloon);
    }

    [Theory]
    [InlineData(-2000, 900, 0, 0, 1920, 1040, 0, 780)]
    [InlineData(1000, -1000, -1920, -120, 1920, 1080, -340, -120)]
    [InlineData(80, 80, 0, 0, 200, 100, 0, 0)]
    public void PositionIsClampedToMonitorWorkArea(double x, double y, double left, double top,
        double width, double height, double expectedX, double expectedY)
    {
        var result = OverlayViewModel.ClampPosition(new Point(x, y), new Size(340, 260),
            new Rect(left, top, width, height));
        Assert.Equal(new Point(expectedX, expectedY), result);
    }

    [Fact]
    public void PausedEventsResumeAsOneSilentSummaryWithoutReplay()
    {
        var sounds = 0;
        var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => sounds++)));
        model.TogglePause();
        model.AcceptEvent(Event("one"));
        model.AcceptEvent(Event("two"));
        Assert.False(model.HasBalloon);
        Assert.True(model.IsClickThrough);
        model.TogglePause();
        Assert.True(model.HasBalloon);
        Assert.Contains("2", model.BalloonTitle);
        Assert.Contains("Teste local", model.BalloonMessage);
        Assert.Equal(0, sounds);
        model.DismissBalloon();
        model.Advance();
        Assert.False(model.HasBalloon);
        model.AcceptEvent(Event("three"));
        Assert.Equal(1, sounds);
    }

    [Fact]
    public void MuteSuppressesLiveAudioWhileKeepingBalloonInteractive()
    {
        var sounds = 0;
        var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => sounds++)));
        model.ToggleMute();
        model.AcceptEvent(Event("one"));
        Assert.True(model.IsMuted);
        Assert.True(model.HasBalloon);
        Assert.False(model.IsClickThrough);
        Assert.Equal(0, sounds);
    }

    [Fact]
    public void WalkingAlternatesWithIdleAndStopsWhilePausedOrAlerting()
    {
        var now = DateTimeOffset.Parse("2026-11-06T16:00:00Z");
        var model = new OverlayViewModel(SilentQueue(), () => now);
        Assert.False(model.IsWalking);
        now = now.AddSeconds(8);
        model.Advance();
        Assert.True(model.IsWalking);
        model.TogglePause();
        Assert.False(model.IsWalking);
        model.TogglePause();
        Assert.True(model.IsWalking);
        model.AcceptEvent(Event("one"));
        Assert.False(model.IsWalking);
        model.DismissBalloon();
        now = now.AddSeconds(4);
        model.Advance();
        Assert.False(model.IsWalking);
    }

    [Fact]
    public void NativeWindowPassesIdleClicksAndCloseButtonReturnsItToClickThrough()
    {
        OnSta(() =>
        {
            var model = new OverlayViewModel(SilentQueue());
            var window = new MainOverlayWindow(model);
            window.Show();
            window.UpdateLayout();
            var handle = new WindowInteropHelper(window).Handle;
            Assert.NotEqual(0, GetWindowLong(handle, -20) & 0x20);
            Assert.NotEqual(0, GetWindowLong(handle, -20) & 0x08000000);
            Assert.NotEqual(0, GetWindowLong(handle, -20) & 0x80);
            model.AcceptEvent(Event("native"));
            window.Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.Render);
            window.UpdateLayout();
            Assert.Equal(0, GetWindowLong(handle, -20) & 0x20);
            var balloon = (Border)window.FindName("Balloon");
            var content = (Grid)balloon.Child;
            content.Children.OfType<Button>().Single().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Assert.False(model.HasBalloon);
            Assert.NotEqual(0, GetWindowLong(handle, -20) & 0x20);
            window.Close();
        });
    }

    [Theory]
    [InlineData(false, "1 eventos durante a pausa")]
    [InlineData(true, "2 eventos durante a pausa")]
    public void PausingVisibleAlertRetainsItInOneSilentResumeSummary(bool hasPending, string expectedTitle)
    {
        var sounds = 0;
        var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => sounds++)));
        model.AcceptEvent(Event("visible") with { Title = "Alerta interrompido" });
        if (hasPending) model.AcceptEvent(Event("pending") with { Title = "Alerta pendente" });
        Assert.Equal(1, sounds);

        model.TogglePause();
        Assert.False(model.HasBalloon);
        model.TogglePause();
        Assert.True(model.HasBalloon);
        Assert.Equal(expectedTitle, model.BalloonTitle);
        Assert.Contains("1 × Alerta interrompido", model.BalloonMessage);
        if (hasPending) Assert.Contains("1 × Alerta pendente", model.BalloonMessage);
        Assert.Equal(1, sounds);

        // Pausing a summary retains its members without counting them twice.
        model.TogglePause();
        model.TogglePause();
        Assert.Equal(expectedTitle, model.BalloonTitle);
        Assert.Equal(1, sounds);
        model.DismissBalloon();
        model.Advance();
        Assert.False(model.HasBalloon);
        model.AcceptEvent(Event("visible"));
        Assert.False(model.HasBalloon);
        model.AcceptEvent(Event("new"));
        Assert.Equal(2, sounds);
    }

    [Fact]
    public void IdleBreathingRestartsAfterAlertIsDismissed()
    {
        OnSta(() =>
        {
            var model = new OverlayViewModel(SilentQueue(), () => DateTimeOffset.UnixEpoch);
            var window = new MainOverlayWindow(model);
            try
            {
                Assert.True(model.IsIdle);
                window.Show();
                window.UpdateLayout();
                var mascot = ((Grid)window.Content).Children.OfType<Image>().Single();
                window.Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.Render);
                AssertMascotMoves(mascot, alerting: false);
                model.AcceptEvent(Event("animation"));
                Assert.False(model.IsIdle);
                window.Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.Render);
                AssertMascotMoves(mascot, alerting: true);
                model.DismissBalloon();
                Assert.True(model.IsIdle);
                window.Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.Render);
                AssertMascotMoves(mascot, alerting: false);
            }
            finally { window.Close(); }
        });
    }

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr handle, int index);

    private static void AssertMascotMoves(Image mascot, bool alerting)
    {
        var samples = new List<double>();
        var elapsed = Stopwatch.StartNew();
        var frame = new DispatcherFrame();
        var timer = new DispatcherTimer(DispatcherPriority.Render) { Interval = TimeSpan.FromMilliseconds(20) };
        timer.Tick += (_, _) =>
        {
            samples.Add(((TranslateTransform)mascot.RenderTransform).Y);
            if (elapsed.Elapsed >= TimeSpan.FromMilliseconds(350)) frame.Continue = false;
        };
        try
        {
            timer.Start();
            Dispatcher.PushFrame(frame);
        }
        finally { timer.Stop(); }
        Assert.True(samples.Max() - samples.Min() > 0.1, "The mascot must keep moving during each animation phase.");
        if (alerting) Assert.True(samples.Min() < -6, "The alert must use its larger bounce.");
        else Assert.All(samples, value => Assert.InRange(value, -3.01, 0.01));
    }

    private static AlertQueue SilentQueue() => new(new AudioAlertService(() => { }));
    private static CompanionEvent Event(string id) => new(id, CompanionEventType.EXPEDITION_COMPLETED,
        DateTimeOffset.Parse("2026-11-06T16:00:00Z"), "Teste local", "Mensagem simulada.");

    private static void OnSta(Action action)
    {
        Exception? failure = null;
        var thread = new Thread(() => { try { action(); } catch (Exception error) { failure = error; } });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        if (failure is not null) ExceptionDispatchInfo.Capture(failure).Throw();
    }
}
