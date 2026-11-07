using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ZikaCompanion.App;
using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;
using Xunit;
using Forms = System.Windows.Forms;

namespace ZikaCompanion.Tests;

[Collection(WpfWindowCollection.Name)]
public sealed class MascotPlacementTests
{
    // These extracted resources are named opposite their actual visual facing.
    [Theory]
    [InlineData(25, -1, "Assets/0025-walk-right.gif")]
    [InlineData(25, 1, "Assets/0025-walk-left.gif")]
    [InlineData(1, -1, "Assets/0001-walk-right.gif")]
    [InlineData(1, 1, "Assets/0001-walk-left.gif")]
    [InlineData(4, -1, "Assets/0004-walk-right.gif")]
    [InlineData(4, 1, "Assets/0004-walk-left.gif")]
    [InlineData(7, -1, "Assets/0007-walk-right.gif")]
    [InlineData(7, 1, "Assets/0007-walk-left.gif")]
    public void WalkingSelectsAssetThatActuallyFacesMovement(int number, int direction, string expected)
    {
        var mascot = MascotCatalog.All.Single(item => item.Number == number);
        Assert.Equal(expected, MascotCatalog.AssetFor(mascot, CompanionBehavior.Walk, direction));
    }

    [Theory]
    [InlineData(25)]
    [InlineData(1)]
    [InlineData(4)]
    [InlineData(7)]
    public void VisibleMascotReachesMonitorTopWithoutWindowAboveMonitor(int number)
    {
        OnSta(() =>
        {
            var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => { })), () => DateTimeOffset.UnixEpoch);
            model.SelectMascot(number);
            model.BeginDrag(); // No bounce while dragging to the top edge.
            var window = new MainOverlayWindow(model);
            try
            {
                window.Show();
                window.UpdateLayout();
                var image = (Image)window.FindName("Mascot");
                var screen = Forms.Screen.PrimaryScreen!.Bounds;
                var top = window.PointFromScreen(new Point(screen.Left, screen.Top)).Y + window.Top;
                var area = new Rect(100, top, 500, 500);
                model.SetActionArea(area);
                window.Top = top - 1000;
                window.UpdateLayout();

                var visible = VisibleBounds(window, image);
                Assert.True(GetWindowRect(new WindowInteropHelper(window).Handle, out var native));
                Assert.True(native.Top >= screen.Top, "The HWND itself must stay on the monitor.");
                Assert.True(window.Top >= top - .01, $"Window top {window.Top} must stay on the monitor starting at {top}.");
                Assert.True(Math.Abs(top - visible.Top) < .001, $"visible={visible}; window={window.Left},{window.Top},{window.Width},{window.Height}; image={image.ActualWidth},{image.ActualHeight},{image.Margin}; bob={image.RenderTransform}");

                model.AcceptEvent(new CompanionEvent("top", CompanionEventType.EXPEDITION_COMPLETED,
                    DateTimeOffset.UnixEpoch, "Aviso local", "Ainda acessível no topo."));
                window.Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.Render);
                window.UpdateLayout();
                var balloon = (Border)window.FindName("Balloon");
                var balloonTop = window.Top + balloon.TranslatePoint(new Point(), window).Y;
                Assert.True(window.Top >= top - .01);
                Assert.Equal(top, VisibleBounds(window, image).Top, 3);
                Assert.True(balloonTop >= VisibleBounds(window, image).Bottom, "At the monitor top the balloon must open below the mascot.");
                var button = ((Grid)balloon.Child).Children.OfType<Button>().Single();
                var buttonPoint = button.PointToScreen(new Point(button.ActualWidth / 2, button.ActualHeight / 2));
                var packed = (int)(ushort)(short)buttonPoint.X | ((int)(ushort)(short)buttonPoint.Y << 16);
                Assert.Equal(new IntPtr(1), SendMessage(new WindowInteropHelper(window).Handle, 0x0084, IntPtr.Zero, new IntPtr(packed)));
                button.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                window.UpdateLayout();
                Assert.False(model.HasBalloon);
                Assert.Equal(top, VisibleBounds(window, image).Top, 3);
            }
            finally { window.Close(); }
        });
    }

    [Fact]
    public void NewlyDisplayedFrameIsAlignedBeforeTheNextMovementTick()
    {
        OnSta(() =>
        {
            var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => { })), () => DateTimeOffset.UnixEpoch);
            model.BeginDrag();
            var window = new MainOverlayWindow(model);
            try
            {
                window.Show(); window.UpdateLayout();
                var image = (Image)window.FindName("Mascot");
                window.Left = 500; window.Top = 300; window.UpdateLayout();
                var before = image.PointToScreen(new Point());
                // Simulate an animation frame whose opaque pixels occupy another part of the same canvas.
                var pixels = new byte[32 * 32 * 4];
                pixels[(4 * 32 + 3) * 4 + 3] = 255;
                pixels[(20 * 32 + 22) * 4 + 3] = 255;
                var frame = BitmapSource.Create(32, 32, 96, 96, PixelFormats.Bgra32, null, pixels, 32 * 4);
                image.BeginAnimation(Image.SourceProperty, null);
                image.Source = frame;
                window.UpdateLayout();
                var after = image.PointToScreen(new Point());
                Assert.InRange(after.X, before.X - 1, before.X + 1); // HWND positioning rounds fractional DIPs.
                Assert.InRange(after.Y, before.Y - 1, before.Y + 1);
                var visible = VisibleBounds(window, image);
                Assert.True(visible.Left >= window.Left && visible.Top >= window.Top);
                Assert.True(visible.Right <= window.Left + window.Width + .01 && visible.Bottom <= window.Top + window.Height + .01);
            }
            finally { window.Close(); }
        });
    }

    internal static Rect VisibleBounds(Window window, Image image)
    {
        var frame = Assert.IsAssignableFrom<BitmapSource>(image.Source);
        var pixels = new byte[frame.PixelWidth * frame.PixelHeight * 4];
        frame.CopyPixels(pixels, frame.PixelWidth * 4, 0);
        var left = frame.PixelWidth; var top = frame.PixelHeight; var right = -1; var bottom = -1;
        for (var y = 0; y < frame.PixelHeight; y++)
        for (var x = 0; x < frame.PixelWidth; x++)
            if (pixels[(y * frame.PixelWidth + x) * 4 + 3] > 0)
            { left = Math.Min(left, x); top = Math.Min(top, y); right = Math.Max(right, x); bottom = Math.Max(bottom, y); }
        var scale = Math.Min(image.ActualWidth / frame.PixelWidth, image.ActualHeight / frame.PixelHeight);
        var origin = image.TranslatePoint(new Point(), window);
        return new Rect(window.Left + origin.X + (image.ActualWidth - frame.PixelWidth * scale) / 2 + left * scale,
            window.Top + origin.Y + (image.ActualHeight - frame.PixelHeight * scale) / 2 + top * scale,
            (right - left + 1) * scale, (bottom - top + 1) * scale);
    }

    private static void OnSta(Action action)
    {
        Exception? failure = null;
        var thread = new Thread(() => { try { action(); } catch (Exception error) { failure = error; } });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start(); thread.Join();
        if (failure is not null) ExceptionDispatchInfo.Capture(failure).Throw();
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr window, out NativeRect rectangle);
    [DllImport("user32.dll", EntryPoint = "SendMessageW")]
    private static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);
}

