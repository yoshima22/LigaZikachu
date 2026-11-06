using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
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

    public MainOverlayWindow(OverlayViewModel model)
    {
        InitializeComponent();
        _model = model;
        DataContext = model;
        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(33) };
        _timer.Tick += Animate;
        SourceInitialized += InitializeNativeWindow;
        LocationChanged += (_, _) => ClampToCurrentMonitor();
        Closed += OnClosed;
        _model.PropertyChanged += ModelChanged;
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
        UpdateClickThrough();
        HwndSource.FromHwnd(_handle)?.AddHook(WindowMessages);
        RestoreToPrimaryMonitor();
        _timer.Start();
    }

    private void ModelChanged(object? sender, PropertyChangedEventArgs args)
    {
        if (args.PropertyName == nameof(OverlayViewModel.IsClickThrough)) UpdateClickThrough();
    }

    private void UpdateClickThrough()
    {
        if (_handle == IntPtr.Zero) return;
        var style = GetWindowLong(_handle, ExtendedStyle) | ToolWindowStyle | NoActivateStyle;
        style = _model.IsClickThrough ? style | TransparentStyle : style & ~TransparentStyle;
        SetWindowLong(_handle, ExtendedStyle, style);
    }

    private void Animate(object? sender, EventArgs args)
    {
        _model.Advance();
        if (!_model.IsWalking) return;
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
        // Re-clamp after work-area, display, and DPI changes; defer until WPF updates its transform.
        if (message is 0x001A or 0x007E or 0x02E0) Dispatcher.BeginInvoke(ClampToCurrentMonitor);
        // A balloon can be clicked without stealing focus from the user's foreground app.
        if (message == 0x0021) { handled = true; return new IntPtr(3); }
        return IntPtr.Zero;
    }

    private void DismissBalloon(object sender, RoutedEventArgs args) => _model.DismissBalloon();

    private void OnClosed(object? sender, EventArgs args)
    {
        _timer.Stop();
        _model.PropertyChanged -= ModelChanged;
        if (_handle != IntPtr.Zero) HwndSource.FromHwnd(_handle)?.RemoveHook(WindowMessages);
    }

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr handle, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern int SetWindowLong(IntPtr handle, int index, int value);
}
