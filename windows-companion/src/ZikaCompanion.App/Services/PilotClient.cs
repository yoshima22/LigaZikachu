using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ZikaCompanion.App.Domain;

namespace ZikaCompanion.App.Services;

public sealed class PilotClient
{
    private readonly HttpClient _http;
    private readonly ISessionStore _store;
    private readonly Func<TimeSpan, CancellationToken, Task> _delay;
    private string? _access;
    public bool IsLinked => _access is not null;
    public event Action? SessionChanged;
    public PilotClient(HttpClient http, ISessionStore store, Func<TimeSpan, CancellationToken, Task>? delay = null)
    { _http = http; _store = store; _delay = delay ?? Task.Delay; }
    public static bool UseSimulator(bool linked) => !linked;

    private sealed record Authorization(string DeviceCode, string UserCode, string VerificationUrl, int Interval, int ExpiresIn);
    private sealed record Tokens(string AccessToken, string RefreshToken, int ExpiresIn);
    public async Task LinkAsync(Action<string, string> openBrowser, CancellationToken cancellationToken)
    {
        using var response = await _http.PostAsync("/api/companion/device/authorize", null, cancellationToken);
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<Authorization>(cancellationToken) ?? throw new InvalidDataException("Resposta inválida.");
        var browserUrl = new Uri(auth.VerificationUrl);
        if (browserUrl.Scheme != Uri.UriSchemeHttps || browserUrl.GetLeftPart(UriPartial.Authority) != _http.BaseAddress!.GetLeftPart(UriPartial.Authority)) throw new InvalidDataException("Endereço de autorização inválido.");
        openBrowser(auth.VerificationUrl, auth.UserCode);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(auth.ExpiresIn));
        while (true)
        {
            await _delay(TimeSpan.FromSeconds(Math.Max(1, auth.Interval)), timeout.Token);
            using var exchange = await _http.PostAsJsonAsync("/api/companion/device/exchange", new { grantType = "device_code", token = auth.DeviceCode }, timeout.Token);
            if (exchange.StatusCode == HttpStatusCode.Accepted) continue;
            exchange.EnsureSuccessStatusCode();
            await SaveTokens(exchange, timeout.Token);
            return;
        }
    }
    public async Task RestoreAsync(CancellationToken cancellationToken)
    {
        var token = _store.Load();
        if (token is null) return;
        using var response = await _http.PostAsJsonAsync("/api/companion/device/exchange", new { grantType = "refresh_token", token }, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized) { Disconnect(); return; }
        response.EnsureSuccessStatusCode();
        await SaveTokens(response, cancellationToken);
    }
    private async Task SaveTokens(HttpResponseMessage response, CancellationToken ct)
    {
        var tokens = await response.Content.ReadFromJsonAsync<Tokens>(ct) ?? throw new InvalidDataException("Sessão inválida.");
        if (string.IsNullOrWhiteSpace(tokens.AccessToken) || string.IsNullOrWhiteSpace(tokens.RefreshToken)) throw new InvalidDataException("Sessão inválida.");
        _store.Save(tokens.RefreshToken); _access = tokens.AccessToken; SessionChanged?.Invoke();
    }
    public void Disconnect() { _access = null; _store.Clear(); SessionChanged?.Invoke(); }
    private HttpRequestMessage Request(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _access);
        return request;
    }
    public async Task<bool> ExecuteActionAsync(string eventId, string actionId, bool confirmed, CancellationToken ct)
    {
        if (!confirmed || !IsLinked || actionId != "COLLECT_EXPEDITION") return false;
        using var request = Request(HttpMethod.Post, "/api/companion/actions");
        request.Content = JsonContent.Create(new { eventId, actionId, confirmed = true });
        using var response = await _http.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized) { Disconnect(); return false; }
        if (!response.IsSuccessStatusCode) return false;
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return json.RootElement.TryGetProperty("result", out var result) && result.GetString() == "SUCCESS";
    }
    public async Task ReadEventsAsync(EventAdapter adapter, Action<CompanionEvent> deliver, CancellationToken ct)
    {
        using var request = Request(HttpMethod.Get, "/api/companion/events");
        request.Headers.TryAddWithoutValidation("Last-Event-ID", adapter.Cursor);
        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized) { Disconnect(); return; }
        response.EnsureSuccessStatusCode();
        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream);
        while (await reader.ReadLineAsync(ct) is { } line)
            if (line.StartsWith("data: ", StringComparison.Ordinal) && adapter.Accept(line[6..]) is { } item) deliver(item);
    }
}

public sealed class EventAdapter
{
    private readonly HashSet<string> _seen = new(StringComparer.Ordinal);
    public string Cursor { get; private set; } = "0";
    private sealed record Payload(string EventId, string Type, string Title, string Body, string Route, string[] Actions);
    public CompanionEvent? Accept(string json)
    {
        Payload? payload;
        try { payload = JsonSerializer.Deserialize<Payload>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
        catch (JsonException) { return null; }
        if (payload is null || string.IsNullOrEmpty(payload.EventId) || !_seen.Add(payload.EventId)) return null;
        Cursor = payload.EventId;
        if (!Enum.TryParse<CompanionEventType>(payload.Type, out var type)) return null;
        return new CompanionEvent(payload.EventId, type, DateTimeOffset.UtcNow, payload.Title, payload.Body, payload.Route, payload.Actions ?? []);
    }
}

