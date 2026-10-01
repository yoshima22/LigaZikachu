namespace LigaZikachu.Transmissor;

internal sealed record BroadcastQuality(int Width, int Height, int Fps)
{
    public static BroadcastQuality Default { get; } = new(1280, 720, 30);
    public static readonly (int Width, int Height)[] Resolutions = [(640, 360), (854, 480), (1280, 720), (1920, 1080)];
    public uint BitrateKbps => (uint)((Height >= 1080 ? 6000 : Height >= 720 ? 3000 : Height >= 480 ? 1500 : 800) * (Fps == 60 ? 1.5 : 1));
    public override string ToString() => $"{Height}p · {Fps} fps";
}
