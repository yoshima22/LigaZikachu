namespace LigaZikachu.Transmissor;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Contains("--native-self-test"))
        {
            int ReadOption(string name, int fallback) => int.TryParse(args.FirstOrDefault(x => x.StartsWith(name + "="))?.Split('=')[1], out var value) ? value : fallback;
            var height = ReadOption("--test-height", 720);
            var size = BroadcastQuality.Resolutions.First(x => x.Height == height);
            Application.Run(new NativeSelfTestForm(new BroadcastQuality(size.Width, size.Height, ReadOption("--test-fps", 30)))); return;
        }
        Application.Run(new TransmitterForm());
    }
}
