using System.Drawing.Imaging;
using System.Runtime.ExceptionServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using ZikaCompanion.App;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

[Collection(WpfWindowCollection.Name)]
public sealed class AnimationConsistencyTests
{
    [Theory]
    [InlineData(1)] [InlineData(4)] [InlineData(7)] [InlineData(25)]
    public void AllActionsUseSameCanvasAndBottomCenteredUnion(int number)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && directory.Name != "windows-companion") directory = directory.Parent;
        Assert.NotNull(directory);
        var sizes = new List<(int, int)>();
        foreach (var action in new[] { "idle", "walk-left", "walk-right", "sleep" })
        {
            using var gif = System.Drawing.Image.FromFile(Path.Combine(directory.FullName, "src", "ZikaCompanion.App", "Assets", $"{number:D4}-{action}.gif"));
            sizes.Add((gif.Width, gif.Height));
            int left = gif.Width, right = -1, bottom = -1;
            for (int i = 0; i < gif.GetFrameCount(FrameDimension.Time); i++)
            {
                gif.SelectActiveFrame(FrameDimension.Time, i);
                using var frame = new System.Drawing.Bitmap(gif);
                for (int y = 0; y < frame.Height; y++)
                for (int x = 0; x < frame.Width; x++)
                    if (frame.GetPixel(x, y).A != 0) { left = Math.Min(left, x); right = Math.Max(right, x); bottom = Math.Max(bottom, y); }
            }
            Assert.True(right >= left, $"{action} must contain visible pixels");
            Assert.Equal(gif.Height - 1, bottom);
            Assert.InRange(Math.Abs(left + right - (gif.Width - 1)), 0, 1);
        }
        Assert.All(sizes, size => Assert.Equal(sizes[0], size));
    }

    [Theory]
    [InlineData(1)] [InlineData(4)] [InlineData(7)] [InlineData(25)]
    public void IdleWalkSleepAndAlertKeepImageTransformStationary(int number)
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var now = DateTimeOffset.UnixEpoch;
                var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => { })), () => now);
                model.SelectMascot(number);
                var window = new MainOverlayWindow(model);
                try
                {
                    window.Show(); window.UpdateLayout();
                    var image = (Image)window.FindName("Mascot");
                    window.Left = 500; window.Top = 300; window.UpdateLayout();
                    var origin = image.PointToScreen(new Point());
                    var width = image.Width; var height = image.Height;
                    foreach (var seconds in new[] { 0, 8, 300 })
                    {
                        now = DateTimeOffset.UnixEpoch.AddSeconds(seconds); model.Advance(); window.UpdateLayout();
                        var next = image.PointToScreen(new Point());
                        Assert.InRange(next.X, origin.X - 1, origin.X + 1);
                        Assert.InRange(next.Y, origin.Y - 1, origin.Y + 1);
                        Assert.Equal(width, image.Width); Assert.Equal(height, image.Height);
                        Assert.True(image.RenderTransform.Value.IsIdentity);
                        Assert.False(image.RenderTransform.HasAnimatedProperties);
                    }
                    model.AcceptEvent(new ZikaCompanion.App.Domain.CompanionEvent("x", ZikaCompanion.App.Domain.CompanionEventType.EXPEDITION_COMPLETED, now, "test", "test"));
                    window.UpdateLayout();
                    Assert.True(image.RenderTransform.Value.IsIdentity);
                    Assert.False(image.RenderTransform.HasAnimatedProperties);
                }
                finally { window.Close(); }
            }
            catch (Exception e) { failure = e; }
        });
        thread.SetApartmentState(ApartmentState.STA); thread.Start(); thread.Join();
        if (failure != null) ExceptionDispatchInfo.Capture(failure).Throw();
    }
}
