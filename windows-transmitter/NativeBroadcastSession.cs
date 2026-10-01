using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;

namespace LigaZikachu.Transmissor;

internal sealed class NativeBroadcastSession : IAsyncDisposable
{
    private readonly HttpClient _http;
    private readonly string _endpoint, _streamId, _token;
    private readonly ConcurrentDictionary<string, NativeBroadcastPeer> _peers = new();
    private readonly CancellationTokenSource _stop = new();
    private Task? _poll;
    private long _cursor;
    private bool _disposed;
    private readonly object _audioLock = new();
    private bool _paused;
    private readonly short[] _silence = new short[1920];
    public void SetPaused(bool paused) { lock (_audioLock) _paused = paused; }
    public event Action<string>? Status;
    public event Action? ViewerConnected;
    public NativeBroadcastSession(string server, string streamId, string token, HttpMessageHandler? handler = null)
    {
        _http = handler == null ? new HttpClient() : new HttpClient(handler);
        _http.Timeout = TimeSpan.FromSeconds(12);
        _endpoint = server.TrimEnd('/') + "/api/spec/windows-transmitter/session";
        _streamId = streamId; _token = token;
    }

    private async Task<JsonElement> ApiAsync(string action, object? extra = null, CancellationToken cancellationToken = default)
    {
        var body = new Dictionary<string, object?> { ["streamId"] = _streamId, ["token"] = _token, ["action"] = action };
        if (extra != null)
            foreach (var property in JsonSerializer.SerializeToElement(extra).EnumerateObject()) body[property.Name] = property.Value;
        using var response = await _http.PostAsJsonAsync(_endpoint, body, cancellationToken);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException(json.TryGetProperty("error", out var error) ? error.GetString() : "Erro na Zika TV.");
        return json;
    }

    public async Task StartAsync(CancellationToken cancellationToken, BroadcastQuality? quality = null)
    {
        if (_poll != null) throw new InvalidOperationException("Sessão já iniciada.");
        await ApiAsync("live", quality == null ? null : new { resolution = $"{quality.Height}p", fps = $"{quality.Fps} fps" }, cancellationToken);
        _poll = PollAsync(_stop.Token);
    }

    // The server keeps the displayed stream settings in the existing pairing
    // record. Reusing the idempotent "live" action changes those settings
    // without creating a second live announcement or resetting startedAt.
    public Task UpdateQualityAsync(BroadcastQuality quality, CancellationToken cancellationToken = default) =>
        ApiAsync("live", new { resolution = $"{quality.Height}p", fps = $"{quality.Fps} fps" }, cancellationToken);

    private async Task PollAsync(CancellationToken cancellationToken)
    {
        var lastHeartbeat = DateTime.MinValue;
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                if (DateTime.UtcNow - lastHeartbeat > TimeSpan.FromSeconds(12))
                {
                    var heartbeat = await ApiAsync("heartbeat", cancellationToken: cancellationToken);
                    if (heartbeat.GetProperty("status").GetString() != "LIVE") { Status?.Invoke("Transmissão encerrada no site."); break; }
                    lastHeartbeat = DateTime.UtcNow;
                }
                var result = await ApiAsync("poll", new { cursor = _cursor }, cancellationToken);
                foreach (var signal in result.GetProperty("signals").EnumerateArray())
                {
                    var id = signal.GetProperty("fromUserId").GetString()!;
                    switch (signal.GetProperty("kind").GetString())
                    {
                        case "JOIN":
                            if (_peers.TryRemove(id, out var old)) old.Dispose();
                            var peer = new NativeBroadcastPeer();
                            peer.StateChanged += state => { if (state == "connected") ViewerConnected?.Invoke(); };
                            _peers[id] = peer;
                            try
                            {
                                var offer = await peer.CreateOfferAsync(cancellationToken);
                                await ApiAsync("signal", new { toUserId = id, kind = "OFFER", payload = new { sdp = offer } }, cancellationToken);
                            }
                            catch { if (_peers.TryRemove(id, out var failed)) failed.Dispose(); throw; }
                            break;
                        case "ANSWER":
                            if (_peers.TryGetValue(id, out var answerPeer)) answerPeer.AcceptAnswer(signal.GetProperty("payload").GetProperty("sdp").GetString()!);
                            break;
                        case "BYE":
                            if (_peers.TryRemove(id, out var departed)) departed.Dispose();
                            break;
                    }
                    _cursor = signal.GetProperty("seq").GetInt64();
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { break; }
            catch (Exception ex) { Status?.Invoke(ex.Message); }
            try { await Task.Delay(1400, cancellationToken); } catch (OperationCanceledException) { break; }
        }
    }

    public void SendAudio(short[] pcm) { lock (_audioLock) foreach (var peer in _peers.Values) peer.SendPcm(_paused ? _silence : pcm); }
    public void SendVideo(uint duration, byte[] frame) { foreach (var peer in _peers.Values) peer.SendVp8(duration, frame); }
    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;
        _stop.Cancel();
        if (_poll != null) await _poll;
        foreach (var peer in _peers.Values) peer.Dispose();
        _peers.Clear();
        try { await ApiAsync("end"); } catch (Exception ex) { Status?.Invoke(ex.Message); }
        _http.Dispose();
    }
}
