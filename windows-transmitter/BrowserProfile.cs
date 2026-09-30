using Microsoft.Web.WebView2.Core;

namespace LigaZikachu.Transmissor;

/// <summary>
/// Mantém cookies, cache e arquivos de navegação fora da pasta do executável.
/// Assim o programa pode ser aberto da Área de Trabalho sem poluí-la.
/// </summary>
internal static class BrowserProfile
{
    private static readonly Lazy<Task<CoreWebView2Environment>> EnvironmentTask = new(() =>
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "ZikaTV", "WebView");
        Directory.CreateDirectory(folder);
        return CoreWebView2Environment.CreateAsync(userDataFolder: folder);
    });

    public static Task<CoreWebView2Environment> GetAsync() => EnvironmentTask.Value;
}
