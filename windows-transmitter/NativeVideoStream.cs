using System.Diagnostics;
using System.Buffers.Binary;
using SIPSorceryMedia.Abstractions;
using SIPSorceryMedia.Encoders;

namespace LigaZikachu.Transmissor;

internal sealed class NativeVideoStream : IAsyncDisposable
{
    private readonly CancellationTokenSource _stop = new();
    private readonly VpxVideoEncoder _codec = new();
    private readonly BroadcastQuality _quality;
    private readonly object _encoderLock = new();
    private bool _paused;
    private readonly byte[] _pauseFrame;
    public NativeVideoStream(BroadcastQuality? quality = null)
    {
        _quality = quality ?? new BroadcastQuality(640, 352, 30); // diagnostic legacy dimensions
        _codec.TargetKbps = _quality.BitrateKbps;
        using var bitmap = new Bitmap(_quality.Width, _quality.Height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bitmap))
        {
            g.Clear(Color.FromArgb(10, 16, 39));
            using var font = new Font("Segoe UI", _quality.Height / 22f, FontStyle.Bold);
            using var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString("ZIKA TV\nTransmissão pausada", font, Brushes.White, new RectangleF(0, 0, bitmap.Width, bitmap.Height), format);
        }
        var data = bitmap.LockBits(new Rectangle(0, 0, bitmap.Width, bitmap.Height), System.Drawing.Imaging.ImageLockMode.ReadOnly, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
        _pauseFrame = new byte[_quality.Width * _quality.Height * 4];
        System.Runtime.InteropServices.Marshal.Copy(data.Scan0, _pauseFrame, 0, _pauseFrame.Length);
        bitmap.UnlockBits(data);
    }
    public void SetPaused(bool paused) { lock (_encoderLock) { _paused = paused; _codec.ForceKeyFrame(); } }
    private Process? _process;
    private Task? _reader;
    private Task<string>? _errors;
    public event Action<uint, byte[]>? Frame;
    public event Action<string>? Failed;
    public TaskCompletionSource FirstFrame { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public async Task StartAsync(IntPtr window, IntPtr content, CancellationToken cancellationToken)
    {
        var info = new ProcessStartInfo(await NativeAudioStream.ExtractHelperAsync(cancellationToken))
        {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true,
            RedirectStandardOutput = true, RedirectStandardError = true
        };
        info.ArgumentList.Add("--video"); info.ArgumentList.Add(window.ToInt64().ToString()); info.ArgumentList.Add(content.ToInt64().ToString());
        info.ArgumentList.Add(_quality.Width.ToString()); info.ArgumentList.Add(_quality.Height.ToString()); info.ArgumentList.Add(_quality.Fps.ToString());
        _process = Process.Start(info) ?? throw new IOException("Não foi possível capturar a janela.");
        try
        {
            var ready = await _process.StandardError.ReadLineAsync(cancellationToken).AsTask().WaitAsync(TimeSpan.FromSeconds(12), cancellationToken);
            if (ready != "READY VIDEO") throw new IOException(ready ?? "Captura da janela indisponível.");
            _errors = _process.StandardError.ReadToEndAsync();
            _reader = Task.Run(() => ReadAsync(_stop.Token));
            await FirstFrame.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
        }
        catch { await DisposeAsync(); throw; }
    }

    private async Task ReadAsync(CancellationToken cancellationToken)
    {
        var clock = Stopwatch.StartNew();
        long last = 0;
        try
        {
            var stream = _process!.StandardOutput.BaseStream;
            var header = new byte[12];
            while (!cancellationToken.IsCancellationRequested)
            {
                await stream.ReadExactlyAsync(header, cancellationToken);
                int width = BinaryPrimitives.ReadInt32LittleEndian(header), height = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(4));
                int length = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(8));
                if (width != _quality.Width || height != _quality.Height || length != width * height * 4) throw new IOException("Quadro nativo inválido.");
                var raw = new byte[length];
                await stream.ReadExactlyAsync(raw, cancellationToken);
                lock (_encoderLock)
                {
                    var encoded = _codec.EncodeVideo(width, height, _paused ? _pauseFrame : raw, VideoPixelFormatsEnum.Bgra, VideoCodecsEnum.VP8);
                    var now = clock.ElapsedMilliseconds;
                    if (encoded?.Length > 0) Frame?.Invoke((uint)Math.Clamp((now - last) * 90, 1, 90000), encoded);
                    last = now;
                }
                FirstFrame.TrySetResult();
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception ex) { FirstFrame.TrySetException(ex); if (!cancellationToken.IsCancellationRequested) Failed?.Invoke(ex.Message); }
    }

    public void RequestKeyframe() { lock (_encoderLock) _codec.ForceKeyFrame(); }

    public async ValueTask DisposeAsync()
    {
        _stop.Cancel();
        if (_process is not { } process) return;
        _process = null;
        try
        {
            if (!process.HasExited) process.StandardInput.Close();
            if (_reader != null) await _reader;
            var drain = process.StandardOutput.BaseStream.CopyToAsync(Stream.Null);
            try { await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3)); }
            catch (TimeoutException) { process.Kill(); await process.WaitForExitAsync(); }
            await drain;
            if (_errors != null) await _errors;
        }
        finally { process.Dispose(); _codec.Dispose(); }
    }
}
