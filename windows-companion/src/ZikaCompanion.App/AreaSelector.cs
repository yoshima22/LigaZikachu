using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;

namespace ZikaCompanion.App;

internal sealed class AreaSelector : Window
{
    private readonly System.Windows.Controls.Canvas _canvas = new();
    private readonly Rectangle _selection = new() { Stroke = Brushes.White, StrokeThickness = 2, Fill = new SolidColorBrush(Color.FromArgb(70, 80, 160, 255)) };
    private Point? _start;
    public Rect? SelectedArea { get; private set; }

    public AreaSelector(Rect monitor)
    {
        Left = monitor.Left; Top = monitor.Top; Width = monitor.Width; Height = monitor.Height;
        WindowStyle = WindowStyle.None; ResizeMode = ResizeMode.NoResize; AllowsTransparency = true;
        Background = new SolidColorBrush(Color.FromArgb(85, 0, 0, 0));
        Topmost = true; ShowInTaskbar = false; Cursor = Cursors.Cross;
        Content = _canvas; _canvas.Children.Add(_selection);
        MouseLeftButtonDown += (_, e) => { _start = e.GetPosition(this); CaptureMouse(); };
        MouseMove += (_, e) => { if (_start is { } start) Draw(new Rect(start, e.GetPosition(this))); };
        MouseLeftButtonUp += (_, e) =>
        {
            if (_start is not { } start) return;
            var selection = new Rect(start, e.GetPosition(this));
            ReleaseMouseCapture();
            if (selection.Width >= 118 && selection.Height >= 136)
                SelectedArea = new Rect(selection.X + Left, selection.Y + Top, selection.Width, selection.Height);
            Close();
        };
        KeyDown += (_, e) => { if (e.Key == Key.Escape) Close(); };
    }

    private void Draw(Rect rectangle)
    {
        System.Windows.Controls.Canvas.SetLeft(_selection, rectangle.Left);
        System.Windows.Controls.Canvas.SetTop(_selection, rectangle.Top);
        _selection.Width = rectangle.Width; _selection.Height = rectangle.Height;
    }
}
