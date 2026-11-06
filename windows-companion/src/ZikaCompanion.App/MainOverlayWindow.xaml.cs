using System.ComponentModel;
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
    private long _lastFrame = System.Diagnostics.Stopwatch.GetTimestamp();
    private bool _dragMoved;
    private bool _positioning;
    private string? _animationPath;
    private Point? _dragMascotStart;
    private Point _dragPointerStart;
    private Point _mascotPosition;
    private Point _windowPosition;
    private readonly Dictionary<BitmapSource, Rect> _frameBounds = new();
    private readonly DependencyPropertyDescriptor _sourceDescriptor;
    private bool _updatingMascot;

    public MainOverlayWindow(OverlayViewModel model)
    {
        InitializeComponent();
        _model = model;
        DataContext = model;
        foreach (var mascot in MascotCatalog.All)
        {
            var item = new MenuItem { Header = mascot.Name, Tag = mascot.Number, IsCheckable = true };
            item.Click += (_, _) => _model.SelectMascot(mascot.Number);
            MascotChoices.Items.Add(item);
        }
        _model.PropertyChanged += ModelChanged;
        UpdateMascot();
        _sourceDescriptor = DependencyPropertyDescriptor.FromProperty(Image.SourceProperty, typeof(Image));
        _sourceDescriptor.AddValueChanged(Mascot, FrameChanged);
        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(33) };
        _timer.Tick += Animate;
        SourceInitialized += InitializeNativeWindow;
        LocationChanged += (_, _) =>
        {
            if (_handle == IntPtr.Zero || _positioning) return;
            Place(_mascotPosition + (new Point(Left, Top) - _windowPosition), CurrentArea());
        };
        Closed += OnClosed;
    }

    public void RestoreToPrimaryMonitor()
    {
        var screen = Forms.Screen.PrimaryScreen;
        if (screen is null || _handle == IntPtr.Zero) return;
        var area = ToLogicalArea(screen);
        var size = FrameBounds().Size;
        Place(new Point(area.Right - size.Width - 24, area.Bottom - size.Height - 12), _model.ActionAreaOr(area));
    }

    private void ModelChanged(object? sender, PropertyChangedEventArgs args)
    {
        if (args.PropertyName is nameof(OverlayViewModel.SelectedMascot) or nameof(OverlayViewModel.Behavior)) UpdateMascot();
        if (_handle != IntPtr.Zero && args.PropertyName == nameof(OverlayViewModel.HasBalloon)) ClampToCurrentMonitor();
    }

    private void UpdateMascot()
    {
        var path = MascotCatalog.AssetFor(_model.SelectedMascot, _model.Behavior, _model.WalkDirection);
        if (_animationPath != path)
        {
            _updatingMascot = true;
            try
            {
                LocalGifAnimation.Start(Mascot, path);
                _animationPath = path;
                _frameBounds.Clear();
                if (Mascot.Source is BitmapSource frame)
                {
                    var scale = Math.Min(118d / frame.PixelWidth, 136d / frame.PixelHeight);
                    Mascot.Width = frame.PixelWidth * scale;
                    Mascot.Height = frame.PixelHeight * scale;
                }
            }
            finally { _updatingMascot = false; }
            if (_handle != IntPtr.Zero) ClampToCurrentMonitor();
        }
        foreach (var item in MascotChoices.Items.OfType<MenuItem>())
            item.IsChecked = (int)item.Tag == _model.SelectedMascot.Number;
    }

    private void FrameChanged(object? sender, EventArgs args)
    {
        if (!_updatingMascot) ClampToCurrentMonitor();
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
        var stamp = System.Diagnostics.Stopwatch.GetTimestamp();
        var elapsed = System.Diagnostics.Stopwatch.GetElapsedTime(_lastFrame, stamp);
        _lastFrame = stamp;
        _model.Advance();
        var area = CurrentArea();
        if (_model.IsWalking && _dragMascotStart is null && !Mascot.ContextMenu.IsOpen)
            _mascotPosition = _model.WalkVisualPosition(_mascotPosition, new Rect(new Point(), FrameBounds().Size), area,
                TimeSpan.FromSeconds(Math.Min(.1, elapsed.TotalSeconds)));
        UpdateMascot();
        Place(_mascotPosition, area);
    }

    private Rect ToLogicalArea(Forms.Screen screen)
    {
        var area = screen.Bounds;
        var transform = HwndSource.FromHwnd(_handle)?.CompositionTarget?.TransformFromDevice ?? System.Windows.Media.Matrix.Identity;
        return new Rect(transform.Transform(new Point(area.Left, area.Top)), transform.Transform(new Point(area.Right, area.Bottom)));
    }

    private void ClampToCurrentMonitor()
    {
        if (_handle == IntPtr.Zero || _positioning) return;
        Place(_mascotPosition, CurrentArea());
    }

    private void Place(Point requested, Rect area)
    {
        _positioning = true;
        try
        {
            var frame = FrameBounds();
            var visual = new Rect(new Point(), frame.Size);
            _mascotPosition = OverlayViewModel.ClampVisualPosition(requested, visual, area);
            // Keep the native window on-screen too. The bounce moves the compact window;
            // its opposite image offset avoids clipping the sprite's animated pixels.
            var position = OverlayViewModel.ClampVisualPosition(_mascotPosition + new Vector(0, Bob.Y), visual, area);
            var toDevice = HwndSource.FromHwnd(_handle)?.CompositionTarget?.TransformToDevice ?? Matrix.Identity;
            var physicalPosition = toDevice.Transform(position);
            var monitor = ToLogicalArea(Forms.Screen.FromPoint(new System.Drawing.Point(
                (int)physicalPosition.X, (int)physicalPosition.Y)));
            var above = _model.HasBalloon && position.Y - monitor.Top >= 150;
            var windowLeft = _model.HasBalloon
                ? Math.Clamp(position.X + frame.Width - 340, monitor.Left, Math.Max(monitor.Left, monitor.Right - 340))
                : position.X;
            var windowTop = above ? position.Y - 150 : position.Y;
            var mascotX = position.X - windowLeft;
            var mascotY = position.Y - windowTop;
            Width = _model.HasBalloon ? 340 : frame.Width;
            Height = frame.Height + (_model.HasBalloon ? 150 : 0);
            Mascot.Margin = new Thickness(mascotX - frame.X, mascotY - frame.Y - Bob.Y, 0, 0);
            Balloon.Margin = new Thickness(8, above ? 8 : frame.Height + 12, 0, 0);
            BalloonTail.Margin = new Thickness(Math.Clamp(mascotX + frame.Width / 2 - 12, 12, 304),
                above ? 130 : frame.Height, 0, 0);
            BalloonTail.RenderTransform = new RotateTransform(above ? 0 : 180);
            SleepIndicator.Margin = new Thickness(0, mascotY + 7, 0, 0);
            _windowPosition = new Point(windowLeft, windowTop);
            Left = windowLeft;
            Top = windowTop;
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
        _dragMoved = false;
        _dragMascotStart = _mascotPosition;
        _dragPointerStart = PointerPosition();
        if (Mascot.CaptureMouse()) _model.BeginDrag();
        else _dragMascotStart = null;
        args.Handled = true;
    }

    private void MoveMascot(object sender, MouseEventArgs args)
    {
        if (_dragMascotStart is not { } start)
        {
            if (_model.IsSleeping) _model.Wake();
            return;
        }
        if (args.LeftButton != MouseButtonState.Pressed) { EndMascotDrag(sender, args); return; }
        var pointer = PointerPosition();
        var transform = HwndSource.FromHwnd(_handle)?.CompositionTarget?.TransformFromDevice ?? Matrix.Identity;
        var delta = transform.Transform(pointer - _dragPointerStart);
        _dragMoved |= Math.Abs(delta.X) >= SystemParameters.MinimumHorizontalDragDistance ||
            Math.Abs(delta.Y) >= SystemParameters.MinimumVerticalDragDistance;
        if (!_dragMoved) return;
        var screen = Forms.Screen.FromPoint(new System.Drawing.Point((int)pointer.X, (int)pointer.Y));
        var area = ToLogicalArea(screen);
        Place(start + delta, _model.ActionAreaOr(area));
        args.Handled = true;
    }

    private void EndMascotDrag(object sender, MouseEventArgs args)
    {
        if (_dragMascotStart is null) return;
        var wasClick = !_dragMoved && args is MouseButtonEventArgs { ChangedButton: MouseButton.Left };
        _dragMascotStart = null;
        if (Mascot.IsMouseCaptured) Mascot.ReleaseMouseCapture();
        _model.EndDrag(wasClick);
    }

    private void OpenMascotMenu(object sender, RoutedEventArgs args)
    {
        _model.Wake();
        var items = Mascot.ContextMenu.Items.OfType<MenuItem>().ToArray();
        items[0].IsChecked = _model.IsPaused;
        items[1].IsChecked = _model.IsMuted;
    }

    private Rect CurrentArea() => _model.ActionAreaOr(ToLogicalArea(Forms.Screen.FromHandle(_handle)));

    // Measure the opaque frame in the fixed image box, independently of the window.
    // Layout subtracts this offset so reaching an edge never requires an off-screen HWND.
    private Rect FrameBounds()
    {
        if (Mascot.Source is not BitmapSource frame) return new Rect(0, 0, Mascot.Width, Mascot.Height);
        if (_frameBounds.TryGetValue(frame, out var cached)) return cached;
        var pixels = new byte[frame.PixelWidth * frame.PixelHeight * 4];
        frame.CopyPixels(pixels, frame.PixelWidth * 4, 0);
        var left = frame.PixelWidth; var top = frame.PixelHeight; var right = -1; var bottom = -1;
        for (var y = 0; y < frame.PixelHeight; y++)
        for (var x = 0; x < frame.PixelWidth; x++)
            if (pixels[(y * frame.PixelWidth + x) * 4 + 3] != 0)
            { left = Math.Min(left, x); top = Math.Min(top, y); right = Math.Max(right, x); bottom = Math.Max(bottom, y); }
        if (right < left) return new Rect(0, 0, Mascot.Width, Mascot.Height);
        var scale = Math.Min(Mascot.Width / frame.PixelWidth, Mascot.Height / frame.PixelHeight);
        var result = new Rect((Mascot.Width - frame.PixelWidth * scale) / 2 + left * scale,
            (Mascot.Height - frame.PixelHeight * scale) / 2 + top * scale,
            (right - left + 1) * scale, (bottom - top + 1) * scale);
        _frameBounds.Add(frame, result);
        return result;
    }

    public void DefineActionArea()
    {
        if (_handle == IntPtr.Zero) return;
        var selector = new AreaSelector(ToLogicalArea(Forms.Screen.FromHandle(_handle)));
        selector.ShowDialog();
        if (selector.SelectedArea is { } area) { _model.SetActionArea(area); Place(_mascotPosition, area); }
    }
    public void ResetActionArea() { _model.ResetActionArea(); ClampToCurrentMonitor(); }
    private void DefineArea(object sender, RoutedEventArgs args) => DefineActionArea();
    private void ResetArea(object sender, RoutedEventArgs args) => ResetActionArea();
    private void TogglePause(object sender, RoutedEventArgs args) => _model.TogglePause();
    private void ToggleMute(object sender, RoutedEventArgs args) => _model.ToggleMute();
    private void RestoreMascot(object sender, RoutedEventArgs args) => RestoreToPrimaryMonitor();
    private void ExitCompanion(object sender, RoutedEventArgs args) => Close();

    private void DismissBalloon(object sender, RoutedEventArgs args) => _model.DismissBalloon();

    private void OnClosed(object? sender, EventArgs args)
    {
        _timer.Stop();
        _model.PropertyChanged -= ModelChanged;
        _sourceDescriptor.RemoveValueChanged(Mascot, FrameChanged);
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
