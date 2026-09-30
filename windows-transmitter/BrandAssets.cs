namespace LigaZikachu.Transmissor;

internal static class BrandAssets
{
    private const string LogoResource = "LigaZikachu.Transmissor.Assets.zika-tv-logo.png";

    public static Image Logo()
    {
        using var stream = typeof(BrandAssets).Assembly.GetManifestResourceStream(LogoResource)
            ?? throw new InvalidOperationException("Logo da Zika TV não encontrado.");
        using var source = Image.FromStream(stream);
        return new Bitmap(source);
    }

    public static PictureBox LogoBox(int width, int height) => new()
    {
        Width = width, Height = height, Image = Logo(), SizeMode = PictureBoxSizeMode.Zoom,
        Margin = new Padding(0, 0, 0, 8),
    };
}
