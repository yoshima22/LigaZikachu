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
    public void LiveBalloonCanBeDismissed()
    {
        var model = new OverlayViewModel(SilentQueue());
        model.AcceptEvent(Event("one"));
        Assert.True(model.HasBalloon);
        Assert.Equal("Teste local", model.BalloonTitle);
        model.DismissBalloon();
        Assert.False(model.HasBalloon);
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

    [Theory]
    [InlineData(370, 350, 120, 150)]
    [InlineData(-500, -500, 0, 0)]
    [InlineData(3000, 3000, 1580, 780)]
    public void DragPreservesGrabOffsetAndClampsAtWorkArea(double pointerX, double pointerY, double expectedX, double expectedY)
    {
        var result = OverlayViewModel.DragPosition(new Point(100, 200), new Point(350, 400),
            new Point(pointerX, pointerY), new Size(340, 260), new Rect(0, 0, 1920, 1040));
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
    public void NativeHitTestKeepsMascotInteractiveAndPassesTransparentSpaceThrough()
    {
        OnSta(() =>
        {
            var model = new OverlayViewModel(SilentQueue());
            var window = new MainOverlayWindow(model);
            window.Show();
            window.UpdateLayout();
            var handle = new WindowInteropHelper(window).Handle;
            Assert.Equal(0, GetWindowLong(handle, -20) & 0x20);
            Assert.NotEqual(0, GetWindowLong(handle, -20) & 0x08000000);
            Assert.NotEqual(0, GetWindowLong(handle, -20) & 0x80);
            var mascot = ((Grid)window.Content).Children.OfType<Image>().Single();
            Assert.True(mascot.IsHitTestVisible);
            Assert.Equal(1, HitTest(window, handle, mascot.TranslatePoint(new Point(mascot.ActualWidth / 2, mascot.ActualHeight / 2), window)));
            Assert.Equal(-1, HitTest(window, handle, mascot.TranslatePoint(new Point(1, 1), window)));
            Assert.Equal(-1, HitTest(window, handle, new Point(2, window.Height - 2)));
            model.AcceptEvent(Event("native"));
            window.Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.Render);
            window.UpdateLayout();
            Assert.Equal(0, GetWindowLong(handle, -20) & 0x20);
            var balloon = (Border)window.FindName("Balloon");
            Assert.Equal(1, HitTest(window, handle, balloon.TranslatePoint(new Point(30, 30), window)));
            var content = (Grid)balloon.Child;
            content.Children.OfType<Button>().Single().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Assert.False(model.HasBalloon);
            Assert.Equal(0, GetWindowLong(handle, -20) & 0x20);
            Assert.Equal(-1, HitTest(window, handle, new Point(30, 30)));
            window.Close();
        });
    }

    [Fact]
    public void MascotMenuProvidesPauseMuteRestoreAndExitWithoutTray()
    {
        OnSta(() =>
        {
            var model = new OverlayViewModel(SilentQueue());
            var window = new MainOverlayWindow(model);
            var closed = false;
            window.Closed += (_, _) => closed = true;
            var mascot = ((Grid)window.Content).Children.OfType<Image>().Single();
            var menu = mascot.ContextMenu;
            Assert.NotNull(menu);
            var items = menu.Items.OfType<MenuItem>().ToArray();
            items.Single(item => (string)item.Header == "Pausar / Retomar").RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
            Assert.True(model.IsPaused);
            items.Single(item => (string)item.Header == "Silenciar / Ativar áudio").RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
            Assert.True(model.IsMuted);
            Assert.Contains(items, item => (string)item.Header == "Restaurar no monitor principal");
            items.Single(item => (string)item.Header == "Sair").RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
            Assert.True(closed);
            Assert.False(window.IsVisible);
            window.Close();
        });
    }

    [Fact]
    public void SpeechBubbleTailPointsToMascotAndBodyClearsItsLargestBounce()
    {
        OnSta(() =>
        {
            var model = new OverlayViewModel(SilentQueue());
            model.AcceptEvent(Event("anchor"));
            var window = new MainOverlayWindow(model);
            try
            {
                window.Show();
                window.UpdateLayout();
                var mascot = ((Grid)window.Content).Children.OfType<Image>().Single();
                var balloon = (Border)window.FindName("Balloon");
                var tail = Assert.IsType<System.Windows.Shapes.Polygon>(window.FindName("BalloonTail"));
                var bodyBottom = balloon.TranslatePoint(new Point(0, balloon.ActualHeight), window).Y;
                var visible = MascotPlacementTests.VisibleBounds(window, mascot);
                var mascotTop = visible.Top - window.Top;
                Assert.True(bodyBottom <= mascotTop - 10, "Bubble must clear the visible mascot during its alert bounce.");
                var tip = tail.TranslatePoint(tail.Points.OrderBy(point => point.Y).Last(), window);
                var mascotLeft = visible.Left - window.Left;
                Assert.InRange(tip.X, mascotLeft, mascotLeft + visible.Width);
                Assert.True(tip.Y > bodyBottom, "Speech tail must point down toward the mascot.");
                Assert.True(tip.Y <= mascotTop, "Tail must stop above the mascot.");
            }
            finally { window.Close(); }
        });
    }

    [Fact]
    public void SleepIndicatorFloatsAndMouseMovementWakesMascot()
    {
        OnSta(() =>
        {
            var now = DateTimeOffset.UnixEpoch;
            var model = new OverlayViewModel(SilentQueue(), () => now);
            var window = new MainOverlayWindow(model);
            try
            {
                window.Show();
                now = now.AddSeconds(24);
                model.Advance();
                window.Dispatcher.Invoke(() => { }, DispatcherPriority.Render);
                var indicator = Assert.IsType<TextBlock>(window.FindName("SleepIndicator"));
                Assert.Equal(Visibility.Visible, indicator.Visibility);
                Assert.False(indicator.IsHitTestVisible);
                var start = window.Left;
                var frame = new DispatcherFrame();
                var samples = new List<double>();
                var indicatorTops = new List<double>();
                var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(40) };
                timer.Tick += (_, _) => {
                    samples.Add(((TranslateTransform)indicator.RenderTransform).Y);
                    indicatorTops.Add(indicator.TranslatePoint(new Point(), window).Y);
                    if (samples.Count >= 8) frame.Continue = false;
                };
                try { timer.Start(); Dispatcher.PushFrame(frame); }
                finally { timer.Stop(); }
                Assert.True(samples.Max() - samples.Min() > .1);
                Assert.All(indicatorTops, value => Assert.True(value >= 0, "Sleep Zs must stay inside the compact native window."));
                Assert.InRange(window.Left, start - 1, start + 1); // Native HWND coordinates round fractional DIPs.
                var mascot = (Image)window.FindName("Mascot");
                mascot.RaiseEvent(new System.Windows.Input.MouseEventArgs(System.Windows.Input.Mouse.PrimaryDevice, 0)
                    { RoutedEvent = UIElement.MouseMoveEvent });
                Assert.Equal(CompanionBehavior.Idle, model.Behavior);
                window.Dispatcher.Invoke(() => { }, DispatcherPriority.Render);
                Assert.Equal(Visibility.Collapsed, indicator.Visibility);
                model.Play();
                Assert.True(model.IsHappy);
                model.AcceptEvent(Event("sleep-alert"));
                Assert.Equal(CompanionBehavior.Alert, model.Behavior);
                window.Dispatcher.Invoke(() => { }, DispatcherPriority.Render);
                Assert.Equal(Visibility.Collapsed, indicator.Visibility);
                Assert.Equal(Visibility.Visible, ((Border)window.FindName("Balloon")).Visibility);
            }
            finally { window.Close(); }
        });
    }

    private static long HitTest(Window window, IntPtr handle, Point logicalPoint)
    {
        var point = window.PointToScreen(logicalPoint);
        var packed = (int)(ushort)(short)point.X | ((int)(ushort)(short)point.Y << 16);
        return SendMessage(handle, 0x0084, IntPtr.Zero, new IntPtr(packed)).ToInt64();
    }

    [DllImport("user32.dll", EntryPoint = "SendMessageW")]
    private static extern IntPtr SendMessage(IntPtr handle, int message, IntPtr wParam, IntPtr lParam);

    [Fact]
    public void MascotUsesLocallyDecodedAnimatedBitmapFrames()
    {
        OnSta(() =>
        {
            var window = new MainOverlayWindow(new OverlayViewModel(SilentQueue()));
            try
            {
                window.Show();
                window.UpdateLayout();
                var mascot = ((Grid)window.Content).Children.OfType<Image>().Single();
                Assert.IsAssignableFrom<System.Windows.Media.Imaging.BitmapSource>(mascot.Source);
                var frames = new HashSet<ImageSource>();
                var frame = new DispatcherFrame();
                var timer = new DispatcherTimer(DispatcherPriority.Render) { Interval = TimeSpan.FromMilliseconds(30) };
                var elapsed = Stopwatch.StartNew();
                timer.Tick += (_, _) =>
                {
                    frames.Add(mascot.Source);
                    if (elapsed.ElapsedMilliseconds >= 1000) frame.Continue = false;
                };
                try { timer.Start(); Dispatcher.PushFrame(frame); }
                finally { timer.Stop(); }
                Assert.True(frames.Count > 1, "Bundled GIF must advance through multiple bitmap frames.");
            }
            finally { window.Close(); }
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

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr handle, int index);

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
