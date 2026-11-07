using System.Reflection;
using System.Runtime.ExceptionServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using ZikaCompanion.App;
using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;
using Xunit;
using Forms = System.Windows.Forms;

namespace ZikaCompanion.Tests;

[Collection(WpfWindowCollection.Name)]
public sealed class MascotSelectionTests
{
    [Fact]
    public void RightClickMenuStartsWithOnlyPikachuCheckedAndItsBundledImage()
    {
        OnSta(() =>
        {
            var model = Model();
            var window = new MainOverlayWindow(model);
            try
            {
                var image = (Image)window.FindName("Mascot");
                var choices = Choices(image);
                Assert.Equal(new[] { "Pikachu", "Bulbasaur", "Charmander", "Squirtle" }, choices.Select(item => (string)item.Header));
                Assert.Equal(new[] { "Pikachu" }, choices.Where(item => item.IsChecked).Select(item => (string)item.Header));
                Assert.Equal(25, model.SelectedMascot.Number);
                AssertBundledFrame(image, "0025-idle.gif");
            }
            finally { window.Close(); }
        });
    }

    [Theory]
    [InlineData("Bulbasaur", 1, "0001-idle.gif")]
    [InlineData("Charmander", 4, "0004-idle.gif")]
    [InlineData("Squirtle", 7, "0007-idle.gif")]
    public void ChoosingMascotImmediatelyReplacesBundledFramesAndPreservesLocalState(string name, int number, string asset)
    {
        OnSta(() =>
        {
            var model = Model();
            model.AcceptEvent(new CompanionEvent("selection", CompanionEventType.EXPEDITION_COMPLETED,
                DateTimeOffset.UnixEpoch, "Aviso local", "Preservar este balão"));
            model.ToggleMute();
            var window = new MainOverlayWindow(model) { Left = 120, Top = 150 };
            try
            {
                var image = (Image)window.FindName("Mascot");
                var choices = Choices(image);
                choices.Single(item => (string)item.Header == name).RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
                Assert.Equal(number, model.SelectedMascot.Number);
                AssertBundledFrame(image, asset);
                Assert.Equal(new[] { name }, choices.Where(item => item.IsChecked).Select(item => (string)item.Header));
                Assert.Equal(120, window.Left);
                Assert.Equal(150, window.Top);
                Assert.Equal(CompanionBehavior.Alert, model.Behavior);
                Assert.True(model.IsMuted);
                Assert.True(model.HasBalloon);
                Assert.Equal("Preservar este balão", model.BalloonMessage);
                choices.Single(item => (string)item.Header == "Pikachu").RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
                AssertBundledFrame(image, "0025-idle.gif");
                Assert.Equal(25, model.SelectedMascot.Number);
                Assert.Equal(new[] { "Pikachu" }, choices.Where(item => item.IsChecked).Select(item => (string)item.Header));
            }
            finally { window.Close(); }
        });
    }

    [Fact]
    public void TrayAndRightClickMenusShareSelectionAndCheckMarks()
    {
        OnSta(() =>
        {
            var model = Model();
            var window = new MainOverlayWindow(model);
            using var simulator = new SimulatedEventService(TimeSpan.FromHours(1));
            try
            {
                using var tray = new TrayHost(window, model, simulator);
                var icon = (Forms.NotifyIcon)typeof(TrayHost).GetField("_icon", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(tray)!;
                var submenu = icon.ContextMenuStrip!.Items.OfType<Forms.ToolStripMenuItem>().SingleOrDefault(item => item.Text == "Escolher mascote");
                Assert.NotNull(submenu);
                var trayChoices = submenu.DropDownItems.OfType<Forms.ToolStripMenuItem>().ToArray();
                Assert.Equal(new[] { "Pikachu", "Bulbasaur", "Charmander", "Squirtle" }, trayChoices.Select(item => item.Text));
                Assert.Equal(new[] { "Pikachu" }, trayChoices.Where(item => item.Checked).Select(item => item.Text));
                model.TogglePause();
                trayChoices.Single(item => item.Text == "Squirtle").PerformClick();
                var image = (Image)window.FindName("Mascot");
                AssertBundledFrame(image, "0007-idle.gif");
                Assert.True(model.IsPaused);
                Assert.Equal(new[] { "Squirtle" }, Choices(image).Where(item => item.IsChecked).Select(item => (string)item.Header));
                Assert.Equal(new[] { "Squirtle" }, trayChoices.Where(item => item.Checked).Select(item => item.Text));
                Choices(image).Single(item => (string)item.Header == "Charmander").RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
                Assert.Equal(new[] { "Charmander" }, trayChoices.Where(item => item.Checked).Select(item => item.Text));
            }
            finally { window.Close(); }
        });
    }

    [Fact]
    public void BehaviorAndSelectionImmediatelyReplaceDisplayedFrame()
    {
        OnSta(() =>
        {
            var now = DateTimeOffset.UnixEpoch;
            var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => { })), () => now);
            var window = new MainOverlayWindow(model);
            try
            {
                var image = (Image)window.FindName("Mascot");
                AssertBundledFrame(image, "0025-idle.gif");
                now = now.AddSeconds(8); model.Advance();
                AssertBundledFrame(image, "0025-walk-right.gif");
                model.SelectMascot(7);
                AssertBundledFrame(image, "0007-walk-right.gif");
                now = now.AddSeconds(16); model.Advance();
                AssertBundledFrame(image, "0007-sleep.gif");
                model.SelectMascot(4);
                AssertBundledFrame(image, "0004-sleep.gif");
                model.Wake();
                AssertBundledFrame(image, "0004-idle.gif");
            }
            finally { window.Close(); }
        });
    }

    [Fact]
    public void BehaviorMapsToDistinctLocalAnimationsForEveryMascot()
    {
        foreach (var mascot in MascotCatalog.All)
        {
            var idle = MascotCatalog.AssetFor(mascot, CompanionBehavior.Idle, -1);
            var walk = MascotCatalog.AssetFor(mascot, CompanionBehavior.Walk, -1);
            var sleep = MascotCatalog.AssetFor(mascot, CompanionBehavior.Sleep, -1);
            Assert.Equal($"Assets/{mascot.Number:D4}-idle.gif", idle);
            Assert.Equal($"Assets/{mascot.Number:D4}-walk-right.gif", walk);
            Assert.Equal($"Assets/{mascot.Number:D4}-walk-left.gif", MascotCatalog.AssetFor(mascot, CompanionBehavior.Walk, 1));
            Assert.Equal($"Assets/{mascot.Number:D4}-sleep.gif", sleep);
        }
    }

    private static MenuItem[] Choices(Image image)
    {
        var submenu = image.ContextMenu.Items.OfType<MenuItem>().SingleOrDefault(item => (string)item.Header == "Escolher mascote");
        Assert.NotNull(submenu);
        return submenu.Items.OfType<MenuItem>().ToArray();
    }

    private static void AssertBundledFrame(Image image, string asset)
    {
        using var stream = Application.GetResourceStream(new Uri($"/ZikaCompanion.App;component/Assets/{asset}", UriKind.Relative)).Stream;
        using var gif = System.Drawing.Image.FromStream(stream);
        using var expected = new System.Drawing.Bitmap(gif);
        var actual = Assert.IsAssignableFrom<BitmapSource>(image.Source);
        Assert.Equal(expected.Width, actual.PixelWidth);
        Assert.Equal(expected.Height, actual.PixelHeight);
        var pixels = new byte[actual.PixelWidth * actual.PixelHeight * 4];
        actual.CopyPixels(pixels, actual.PixelWidth * 4, 0);
        for (var y = 0; y < expected.Height; y++)
        for (var x = 0; x < expected.Width; x++)
        {
            var color = expected.GetPixel(x, y);
            var offset = (y * expected.Width + x) * 4;
            Assert.Equal(color.A, pixels[offset + 3]);
            if (color.A == 0) continue;
            Assert.Equal(color.B, pixels[offset]);
            Assert.Equal(color.G, pixels[offset + 1]);
            Assert.Equal(color.R, pixels[offset + 2]);
        }
    }

    private static OverlayViewModel Model() => new(new AlertQueue(new AudioAlertService(() => { })), () => DateTimeOffset.UnixEpoch);

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
