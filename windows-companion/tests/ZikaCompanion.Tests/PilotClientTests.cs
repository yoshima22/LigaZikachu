using System.Net;
using System.Net.Http;
using System.Text;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

public class PilotClientTests
{
    [Fact]
    public async Task LinkPollsUntilApprovedAndPersistsRefreshToken()
    {
        var store = new MemoryStore(); var handler = new Handler(
            (HttpStatusCode.OK, "{\"deviceCode\":\"device\",\"userCode\":\"user\",\"verificationUrl\":\"https://example.org/approve\",\"interval\":1,\"expiresIn\":60}"),
            (HttpStatusCode.Accepted, ""),
            (HttpStatusCode.OK, "{\"accessToken\":\"access\",\"refreshToken\":\"refresh\",\"expiresIn\":900}"));
        var client = new PilotClient(new HttpClient(handler) { BaseAddress = new Uri("https://example.org") }, store, (_, _) => Task.CompletedTask);
        string? opened = null;
        await client.LinkAsync((url, code) => { opened = url + " " + code; }, CancellationToken.None);
        Assert.Equal("https://example.org/approve user", opened);
        Assert.Equal("refresh", store.Token);
        Assert.True(client.IsLinked);
    }

    [Fact]
    public async Task UnauthorizedRefreshClearsStoredSession()
    {
        var store = new MemoryStore { Token = "expired" };
        var client = new PilotClient(new HttpClient(new Handler((HttpStatusCode.Unauthorized, ""))) { BaseAddress = new Uri("https://example.org") }, store);
        await client.RestoreAsync(CancellationToken.None);
        Assert.Null(store.Token);
        Assert.False(client.IsLinked);
    }

    [Fact]
    public async Task ActionRequiresConfirmationBeforeSending()
    {
        var store = new MemoryStore { Token = "refresh" };
        var handler = new Handler((HttpStatusCode.OK, "{\"accessToken\":\"access\",\"refreshToken\":\"next\",\"expiresIn\":900}"));
        var client = new PilotClient(new HttpClient(handler) { BaseAddress = new Uri("https://example.org") }, store);
        await client.RestoreAsync(CancellationToken.None);
        Assert.False(await client.ExecuteActionAsync("12", "COLLECT_EXPEDITION", false, CancellationToken.None));
        Assert.Equal(1, handler.Count);
    }

    [Fact]
    public void EventReplayDoesNotDeliverSameEventTwice()
    {
        var adapter = new EventAdapter();
        const string json = "{\"eventId\":\"12\",\"type\":\"EXPEDITION_COMPLETED\",\"title\":\"Pronto\",\"body\":\"Voltou\",\"route\":\"/mascotes\",\"actions\":[\"COLLECT_EXPEDITION\"]}";
        Assert.NotNull(adapter.Accept(json));
        Assert.Null(adapter.Accept(json));
        Assert.Equal("12", adapter.Cursor);
    }

    [Fact]
    public void UnlinkedSessionUsesSimulator() => Assert.True(PilotClient.UseSimulator(false));

    [Fact]
    public void DpapiStoreRoundTripsWithoutPlaintext()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        try { var store = new DpapiSessionStore(path); store.Save("a-secret-refresh-token"); Assert.DoesNotContain("a-secret-refresh-token", File.ReadAllText(path)); Assert.Equal("a-secret-refresh-token", store.Load()); store.Clear(); Assert.Null(store.Load()); }
        finally { if (File.Exists(path)) File.Delete(path); }
    }

    private sealed class MemoryStore : ISessionStore { public string? Token; public string? Load() => Token; public void Save(string token) => Token = token; public void Clear() => Token = null; }
    private sealed class Handler(params (HttpStatusCode status, string body)[] responses) : HttpMessageHandler
    {
        public int Count;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var (status, body) = responses[Count++];
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }
}
