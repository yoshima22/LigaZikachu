using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Runtime.ExceptionServices;
using System.Text;
using System.Windows;
using System.Windows.Threading;
using ZikaCompanion.App;
using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;
using Xunit;

namespace ZikaCompanion.Tests;

[Collection(WpfWindowCollection.Name)]
public class SessionTransitionTests
{
    [Fact]
    public void LinkingDiscardsLocalAlertsAndKeepsCustomActionArea()
    {
        Exception? failure = null;
        var thread = new Thread(() => {
            try {
                var model = new OverlayViewModel(new AlertQueue(new AudioAlertService(() => { })));
                var area = new Rect(100, 100, 500, 400);
                model.SetActionArea(area);
                var window = new MainOverlayWindow(model);
                using var simulator = new SimulatedEventService(TimeSpan.FromHours(1));
                window.Show();
                try {
                    using var tray = new TrayHost(window, model, simulator);
                    simulator.Trigger(CompanionEventType.EXPEDITION_COMPLETED);
                    simulator.Trigger(CompanionEventType.ARENA_ATTACK_AVAILABLE);
                    Pump(window.Dispatcher);
                    Assert.True(model.HasBalloon);
                    var pilot = new PilotClient(new HttpClient(new TokenHandler()) { BaseAddress = new Uri("https://example.org") }, new Store());
                    typeof(TrayHost).GetField("_pilot", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(tray, pilot);
                    pilot.RestoreAsync(CancellationToken.None).GetAwaiter().GetResult();
                    typeof(TrayHost).GetMethod("SessionChanged", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(tray, null);
                    Pump(window.Dispatcher);
                    Assert.False(model.HasBalloon);
                    model.Advance();
                    Assert.False(model.HasBalloon);
                    Assert.Equal(area, model.ActionAreaOr(new Rect(0, 0, 1000, 800)));
                    simulator.Trigger(CompanionEventType.ARENA_EXIT_AVAILABLE);
                    Pump(window.Dispatcher);
                    Assert.False(model.HasBalloon);
                    pilot.Disconnect();
                    typeof(TrayHost).GetMethod("SessionChanged", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(tray, null);
                    Pump(window.Dispatcher);
                    simulator.Trigger(CompanionEventType.ARENA_EXIT_AVAILABLE);
                    Pump(window.Dispatcher);
                    Assert.True(model.HasBalloon);
                    Assert.Equal(area, model.ActionAreaOr(new Rect(0, 0, 1000, 800)));
                } finally { window.Close(); }
            } catch (Exception error) { failure = error; }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start(); thread.Join();
        if (failure is not null) ExceptionDispatchInfo.Capture(failure).Throw();
    }
    private static void Pump(Dispatcher dispatcher) => dispatcher.Invoke(() => { }, DispatcherPriority.ApplicationIdle);
    private sealed class Store : ISessionStore { public string? Load() => "refresh"; public void Save(string token) { } public void Clear() { } }
    private sealed class TokenHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"accessToken\":\"access\",\"refreshToken\":\"refresh\",\"expiresIn\":900}", Encoding.UTF8, "application/json") });
    }
}
