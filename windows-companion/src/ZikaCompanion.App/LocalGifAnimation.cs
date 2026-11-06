using System.Drawing.Imaging;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;

namespace ZikaCompanion.App;

internal static class LocalGifAnimation
{
    public static void Start(Image target)
    {
        // Pack resource only: loading the mascot never opens a network connection.
        using var resource = Application.GetResourceStream(new Uri("/ZikaCompanion.App;component/Assets/pikachu-placeholder.gif", UriKind.Relative)).Stream;
        using var gif = System.Drawing.Image.FromStream(resource);
        var frameCount = gif.GetFrameCount(FrameDimension.Time);
        var delays = gif.GetPropertyItem(0x5100)?.Value;
        var animation = new ObjectAnimationUsingKeyFrames { RepeatBehavior = RepeatBehavior.Forever };
        var elapsed = TimeSpan.Zero;
        for (var index = 0; index < frameCount; index++)
        {
            gif.SelectActiveFrame(FrameDimension.Time, index);
            using var bitmap = new System.Drawing.Bitmap(gif.Width, gif.Height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
            using (var graphics = System.Drawing.Graphics.FromImage(bitmap)) graphics.DrawImage(gif, 0, 0, gif.Width, gif.Height);
            using var png = new MemoryStream();
            bitmap.Save(png, ImageFormat.Png);
            png.Position = 0;
            var frame = new BitmapImage();
            frame.BeginInit();
            frame.CacheOption = BitmapCacheOption.OnLoad;
            frame.StreamSource = png;
            frame.EndInit();
            var pixels = new FormatConvertedBitmap(frame, PixelFormats.Bgra32, null, 0);
            pixels.Freeze();
            animation.KeyFrames.Add(new DiscreteObjectKeyFrame(pixels, KeyTime.FromTimeSpan(elapsed)));
            var delay = delays is not null && delays.Length >= (index + 1) * 4 ? BitConverter.ToInt32(delays, index * 4) : 10;
            elapsed += TimeSpan.FromMilliseconds(Math.Max(2, delay) * 10);
        }
        animation.Duration = elapsed;
        target.BeginAnimation(Image.SourceProperty, animation);
    }
}
