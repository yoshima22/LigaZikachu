using Microsoft.Web.WebView2.Core;

namespace LigaZikachu.Transmissor;

/// <summary>
/// Mantém cookies, cache e arquivos de navegação fora da pasta do executável.
/// Assim o programa pode ser aberto da Área de Trabalho sem poluí-la.
/// </summary>
internal static class BrowserProfile
{
    // This process tree renders source pages in software. It applies only to
    // the isolated player profile; login and the regular Windows browser are
    // not affected. Do not use --disable-software-rasterizer: software
    // compositing is the fallback we intentionally keep.
    internal const string PlayerBrowserArguments = "--disable-gpu --disable-gpu-compositing --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-features=CalculateNativeWinOcclusion";
    private static readonly Lazy<Task<CoreWebView2Environment>> EnvironmentTask = new(() =>
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "ZikaTV", "WebView");
        Directory.CreateDirectory(folder);
        return CoreWebView2Environment.CreateAsync(userDataFolder: folder);
    });

    public static Task<CoreWebView2Environment> GetAsync() => EnvironmentTask.Value;

    // A dedicated browser process tree per player prevents another player or
    // the login/central WebView from entering this player's audio capture.
    public static Task<CoreWebView2Environment> CreatePlayerAsync(string id)
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "ZikaTV", "Players", id);
        Directory.CreateDirectory(folder);
        return CoreWebView2Environment.CreateAsync(userDataFolder: folder, options: new CoreWebView2EnvironmentOptions
        {
            AdditionalBrowserArguments = PlayerBrowserArguments
        });
    }
}
