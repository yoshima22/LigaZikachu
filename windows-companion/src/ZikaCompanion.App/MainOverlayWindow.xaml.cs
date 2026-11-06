using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Forms = System.Windows.Forms;

namespace ZikaCompanion.App;

public partial class MainOverlayWindow : Window
{
    private const int ExtendedStyle = -20;
    private const int TransparentStyle = 0x20;
    private const int ToolWindowStyle = 0x80;
    private const int NoActivateStyle = 0x08000000;
    private readonly OverlayViewModel _model;
    private readonly DispatcherTimer _timer;
    private IntPtr _handle;
    private double _direction = -1;
    private bool _positioning;
    private Point? _dragWindowStart;
    private Point _dragPointerStart;

    public MainOverlayWindow(OverlayViewModel model)
    {
        InitializeComponent();
        _model = model;
        DataContext = model;
        LocalGifAnimation.Start(Mascot);
        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(33) };
        _timer.Tick += Animate;
        SourceInitialized += InitializeNativeWindow;
        LocationChanged += (_, _) => ClampToCurrentMonitor();
        Closed += OnClosed;
    }

    public void RestoreToPrimaryMonitor()
    {
        var screen = Forms.Screen.PrimaryScreen;
        if (screen is null || _handle == IntPtr.Zero) return;
        var area = ToLogicalArea(screen);
        Place(new Point(area.Right - Width - 24, area.Bottom - Height - 12), area);
    }

    private void InitializeNativeWindow(object? sender, EventArgs args)
    {
        _handle = new WindowInteropHelper(this).Handle;
        // Layered-window alpha and WM_NCHITTEST decide per pixel; never disable the mascot.
        var style = GetWindowLong(_handle, ExtendedStyle) | ToolWindowStyle | NoActivateStyle;
        SetWindowLong(_handle, ExtendedStyle, style & ~TransparentStyle);
        HwndSource.FromHwnd(_handle)?.AddHook(WindowMessages);
        RestoreToPrimaryMonitor();
        _timer.Start();
    }

    private void Animate(object? sender, EventArgs args)
    {
        _model.Advance();
        if (!_model.IsWalking || _dragWindowStart is not null || Mascot.ContextMenu.IsOpen) return;
        var area = ToLogicalArea(Forms.Screen.FromHandle(_handle));
        var next = Left + _direction * 1.3;
        if (next <= area.Left || next >= area.Right - Width) _direction *= -1;
        Place(new Point(next, Top), area);
    }

    private Rect ToLogicalArea(Forms.Screen screen)
    {
        var area = screen.WorkingArea;
        var transform = HwndSource.FromHwnd(_handle)?.CompositionTarget?.TransformFromDevice ?? System.Windows.Media.Matrix.Identity;
        return new Rect(transform.Transform(new Point(area.Left, area.Top)), transform.Transform(new Point(area.Right, area.Bottom)));
    }

    private void ClampToCurrentMonitor()
    {
        if (_handle == IntPtr.Zero || _positioning) return;
        Place(new Point(Left, Top), ToLogicalArea(Forms.Screen.FromHandle(_handle)));
    }

    private void Place(Point requested, Rect area)
    {
        _positioning = true;
        try
        {
            var position = OverlayViewModel.ClampPosition(requested, new Size(Width, Height), area);
            Left = position.X;
            Top = position.Y;
        }
        finally { _positioning = false; }
    }

    private IntPtr WindowMessages(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (message == 0x0084) // WM_NCHITTEST uses physical screen coordinates, including negative monitors.
        {
            var packed = lParam.ToInt64();
            var point = PointFromScreen(new Point((short)(packed & 0xffff), (short)((packed >> 16) & 0xffff)));
            handled = true;
            return new IntPtr(IsInteractiveAt(point) ? 1 : -1); // HTCLIENT / HTTRANSPARENT
        }
        // Re-clamp after work-area, display, and DPI changes; defer until WPF updates its transform.
        if (message is 0x001A or 0x007E or 0x02E0) Dispatcher.BeginInvoke(ClampToCurrentMonitor);
        // A balloon can be clicked without stealing focus from the user's foreground app.
        if (message == 0x0021) { handled = true; return new IntPtr(3); }
        return IntPtr.Zero;
    }

    private bool IsInteractiveAt(Point point)
    {
        var hit = InputHitTest(point) as DependencyObject;
        while (hit is not null)
        {
            if (hit == Mascot) return IsMascotPixelAt(point);
            if (hit == Balloon || hit == BalloonTail) return true;
            hit = VisualTreeHelper.GetParent(hit);
        }
        return false;
    }

    private bool IsMascotPixelAt(Point windowPoint)
    {
        if (Mascot.Source is not BitmapSource frame) return false;
        var point = TranslatePoint(windowPoint, Mascot);
        var scale = Math.Min(Mascot.ActualWidth / frame.PixelWidth, Mascot.ActualHeight / frame.PixelHeight);
        var x = (point.X - (Mascot.ActualWidth - frame.PixelWidth * scale) / 2) / scale;
        var y = (point.Y - (Mascot.ActualHeight - frame.PixelHeight * scale) / 2) / scale;
        if (x < 0 || y < 0 || x >= frame.PixelWidth || y >= frame.PixelHeight) return false;
        var pixel = new byte[4];
        frame.CopyPixels(new Int32Rect((int)x, (int)y, 1, 1), pixel, 4, 0);
        return pixel[3] != 0;
    }

    private Point PointerPosition()
    {
        GetCursorPos(out var position);
        return new Point(position.X, position.Y);
    }

    private void BeginMascotDrag(object sender, MouseButtonEventArgs args)
    {
        if (args.ChangedButton != MouseButton.Left) return;
        _dragWindowStart = new Point(Left, Top);
        _dragPointerStart = PointerPosition();
        if (!Mascot.CaptureMouse()) _dragWindowStart = null;
        args.Handled = true;
    }

    private void MoveMascot(object sender, MouseEventArgs args)
    {
        if (_dragWindowStart is not { } start) return;
        if (args.LeftButton != MouseButtonState.Pressed) { EndMascotDrag(sender, args); return; }
        var pointer = PointerPosition();
        var transform = HwndSource.FromHwnd(_handle)?.CompositionTarget?.TransformFromDevice ?? Matrix.Identity;
        var delta = transform.Transform(pointer - _dragPointerStart);
        var screen = Forms.Screen.FromPoint(new System.Drawing.Point((int)pointer.X, (int)pointer.Y));
        var area = ToLogicalArea(screen);
        var position = OverlayViewModel.DragPosition(start, new Point(), new Point(delta.X, delta.Y), new Size(Width, Height), area);
        Place(position, area);
        args.Handled = true;
    }

    private void EndMascotDrag(object sender, MouseEventArgs args)
    {
        _dragWindowStart = null;
        if (Mascot.IsMouseCaptured) Mascot.ReleaseMouseCapture();
    }

    private void OpenMascotMenu(object sender, RoutedEventArgs args)
    {
        var items = Mascot.ContextMenu.Items.OfType<MenuItem>().ToArray();
        items[0].IsChecked = _model.IsPaused;
        items[1].IsChecked = _model.IsMuted;
    }

    private void TogglePause(object sender, RoutedEventArgs args) => _model.TogglePause();
    private void ToggleMute(object sender, RoutedEventArgs args) => _model.ToggleMute();
    private void RestoreMascot(object sender, RoutedEventArgs args) => RestoreToPrimaryMonitor();
    private void ExitCompanion(object sender, RoutedEventArgs args) => Close();

    private void DismissBalloon(object sender, RoutedEventArgs args) => _model.DismissBalloon();

    private void OnClosed(object? sender, EventArgs args)
    {
        _timer.Stop();
        Mascot.BeginAnimation(Image.SourceProperty, null);
        if (_handle != IntPtr.Zero) HwndSource.FromHwnd(_handle)?.RemoveHook(WindowMessages);
    }

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr handle, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern int SetWindowLong(IntPtr handle, int index, int value);
    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint { public int X; public int Y; }
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPos(out NativePoint point);
}
