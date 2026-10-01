using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;

namespace LigaZikachu.Transmissor;

internal sealed class NativeAudioStream : IAsyncDisposable
{
    private Process? _process;
    private readonly CancellationTokenSource _stop = new();
    private Task? _reader;
    private Task<string>? _errors;
    public event Action<short[]>? Samples;
    public event Action<string>? Failed;

    public async Task StartAsync(uint processId, CancellationToken cancellationToken)
    {
        if (_process != null) throw new InvalidOperationException("Captura já iniciada.");
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 20348))
            throw new PlatformNotSupportedException("O áudio por aplicativo requer Windows build 20348 ou posterior.");
        var path = await ExtractHelperAsync(cancellationToken);
        var info = new ProcessStartInfo(path) { UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
        info.ArgumentList.Add(processId.ToString());
        info.ArgumentList.Add("includetree");
        info.ArgumentList.Add("-");
        _process = Process.Start(info) ?? throw new InvalidOperationException("Falha ao iniciar o áudio.");
        try
        {
            var ready = await _process.StandardError.ReadLineAsync(cancellationToken).AsTask().WaitAsync(TimeSpan.FromSeconds(12), cancellationToken);
            if (ready != "READY 48000 2 16") throw new IOException(ready ?? "O capturador encerrou sem iniciar.");
            _errors = _process.StandardError.ReadToEndAsync();
            _reader = ReadAsync(_stop.Token);
        }
        catch { await DisposeAsync(); throw; }
    }

    internal static async Task<string> ExtractHelperAsync(CancellationToken cancellationToken)
    {
        using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("LigaZikachu.Native.ZikaProcessAudioCapture.exe")
            ?? throw new InvalidOperationException("Capturador nativo ausente.");
        using var bytes = new MemoryStream();
        await resource.CopyToAsync(bytes, cancellationToken);
        var data = bytes.ToArray();
        var hash = Convert.ToHexString(SHA256.HashData(data));
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "ZikaTV", "Native", hash);
        Directory.CreateDirectory(folder);
        var path = Path.Combine(folder, "ZikaProcessAudioCapture.exe");
        if (!File.Exists(path)) await File.WriteAllBytesAsync(path, data, cancellationToken);
        return path;
    }

    private async Task ReadAsync(CancellationToken cancellationToken)
    {
        try
        {
            var input = _process!.StandardOutput.BaseStream;
            var bytes = new byte[3840];
            while (!cancellationToken.IsCancellationRequested)
            {
                await input.ReadExactlyAsync(bytes, cancellationToken);
                var pcm = new short[1920];
                Buffer.BlockCopy(bytes, 0, pcm, 0, bytes.Length);
                Samples?.Invoke(pcm);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception ex) { if (!cancellationToken.IsCancellationRequested) Failed?.Invoke(ex.Message); }
    }

    public async ValueTask DisposeAsync()
    {
        _stop.Cancel();
        if (_process is not { } process) return;
        _process = null;
        try
        {
            if (!process.HasExited) process.StandardInput.Close();
            // Drain stdout while the native callback finishes its final packet.
            if (_reader != null) await _reader;
            var drain = process.StandardOutput.BaseStream.CopyToAsync(Stream.Null);
            try { await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3)); }
            catch (TimeoutException) { process.Kill(); await process.WaitForExitAsync(); }
            await drain;
            if (_errors != null) await _errors;
        }
        finally { process.Dispose(); }
    }
}
