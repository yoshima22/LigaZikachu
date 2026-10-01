using System.Diagnostics;
using System.Reflection;

namespace LigaZikachu.Transmissor;

/// <summary>
/// Executa a captura WASAPI com escopo no processo deste aplicativo e na sua
/// árvore de processos. A ferramenta não usa a Área de Trabalho e nunca pede
/// ao Windows para capturar o som global.
/// </summary>
internal static class NativeProcessAudioProbe
{
    public static async Task<ProbeResult> CaptureTenSecondsAsync(CancellationToken cancellationToken = default)
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "ZikaTV", "AudioTests");
        Directory.CreateDirectory(folder);
        var helper = Path.Combine(folder, "ZikaProcessAudioCapture.exe");
        await ExtractHelperAsync(helper, cancellationToken);
        var wav = Path.Combine(folder, $"audio-{DateTime.UtcNow:yyyyMMdd-HHmmss}.wav");
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = helper,
            Arguments = $"{Environment.ProcessId} includetree \"{wav}\"",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        }) ?? throw new InvalidOperationException("Não foi possível iniciar a captura de áudio nativa.");
        await process.WaitForExitAsync(cancellationToken);
        return new ProbeResult(process.ExitCode == 0 && File.Exists(wav), wav, await process.StandardOutput.ReadToEndAsync(cancellationToken), await process.StandardError.ReadToEndAsync(cancellationToken));
    }

    private static async Task ExtractHelperAsync(string path, CancellationToken cancellationToken)
    {
        const string resource = "LigaZikachu.Native.ZikaProcessAudioCapture.exe";
        await using var input = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource)
            ?? throw new InvalidOperationException("O componente de áudio nativo não foi encontrado no aplicativo.");
        await using var output = File.Create(path);
        await input.CopyToAsync(output, cancellationToken);
    }

    internal sealed record ProbeResult(bool Success, string FilePath, string Output, string Error);
}
