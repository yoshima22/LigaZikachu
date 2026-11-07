using System.ComponentModel;
using System.Drawing;
using System.Diagnostics;
using System.Net.Http;
using System.IO;
using System.Windows.Threading;
using ZikaCompanion.App.Domain;
using ZikaCompanion.App.Services;
using Forms = System.Windows.Forms;

namespace ZikaCompanion.App;

public sealed class TrayHost : IDisposable
{
    private readonly Forms.NotifyIcon _icon;
    private readonly OverlayViewModel _model;
    private readonly SimulatedEventService _simulator;
    private readonly MainOverlayWindow _window;
    private readonly Dispatcher _dispatcher;
    private readonly Forms.ToolStripMenuItem _pause;
    private readonly Forms.ToolStripMenuItem _mute;
    private readonly Dictionary<int, Forms.ToolStripMenuItem> _mascotChoices = new();
    private bool _disposed;
    private readonly PilotClient? _pilot;
    private readonly Forms.ToolStripMenuItem _link;
    private readonly Forms.ToolStripMenuItem _disconnect;
    private CancellationTokenSource _connection = new();
    private EventAdapter _adapter = new();

    public TrayHost(MainOverlayWindow window, OverlayViewModel model, SimulatedEventService simulator)
    {
        _window = window;
        _model = model;
        _simulator = simulator;
        _dispatcher = window.Dispatcher;
        var menu = new Forms.ContextMenuStrip();
        var baseUrl = Environment.GetEnvironmentVariable("ZIKACOMPANION_BASE_URL");
        if (Uri.TryCreate(baseUrl, UriKind.Absolute, out var address) && address.Scheme == Uri.UriSchemeHttps)
        {
            var http = new HttpClient { BaseAddress = address, Timeout = Timeout.InfiniteTimeSpan };
            var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZikaCompanion", "session.dat");
            _pilot = new PilotClient(http, new DpapiSessionStore(path));
            _pilot.SessionChanged += SessionChanged;
        }
        _link = AddCommand(menu, "Vincular conta", () => _ = LinkAsync());
        _disconnect = AddCommand(menu, "Desconectar conta", Disconnect);
        _disconnect.Enabled = false;
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add("ZikaCompanion").Enabled = false;
        AddCommand(menu, "Simular expedição concluída", () => simulator.Trigger(CompanionEventType.EXPEDITION_COMPLETED));
        AddCommand(menu, "Simular ataque disponível", () => simulator.Trigger(CompanionEventType.ARENA_ATTACK_AVAILABLE));
        AddCommand(menu, "Simular saída disponível", () => simulator.Trigger(CompanionEventType.ARENA_EXIT_AVAILABLE));
        menu.Items.Add(new Forms.ToolStripSeparator());
        _pause = AddCommand(menu, "Pausar", model.TogglePause);
        _mute = AddCommand(menu, "Silenciar áudio", model.ToggleMute);
        var mascots = new Forms.ToolStripMenuItem("Escolher mascote");
        foreach (var mascot in MascotCatalog.All)
        {
            var choice = new Forms.ToolStripMenuItem(mascot.Name) { Checked = mascot.Number == model.SelectedMascot.Number };
            choice.Click += (_, _) => _dispatcher.Invoke(() => model.SelectMascot(mascot.Number));
            _mascotChoices.Add(mascot.Number, choice);
            mascots.DropDownItems.Add(choice);
        }
        menu.Items.Add(mascots);
        AddCommand(menu, "Definir área de ação", window.DefineActionArea);
        AddCommand(menu, "Tela inteira", window.ResetActionArea);
        AddCommand(menu, "Restaurar no monitor principal", window.RestoreToPrimaryMonitor);
        menu.Items.Add(new Forms.ToolStripSeparator());
        AddCommand(menu, "Sair", () => System.Windows.Application.Current.Shutdown());
        _icon = new Forms.NotifyIcon
        {
            Icon = SystemIcons.Information,
            Text = "ZikaCompanion • simulação local",
            ContextMenuStrip = menu,
            Visible = true
        };
        _icon.DoubleClick += Restore;
        _model.PropertyChanged += ModelChanged;
        _simulator.EventGenerated += Deliver;
        _window.ActionConfirmed += ExecuteAction;
        _window.RouteRequested += OpenRoute;
        _simulator.Start();
        if (_pilot is not null) { _link.Enabled = false; _ = RestoreAndRunAsync(_connection.Token); }
    }

    private Forms.ToolStripMenuItem AddCommand(Forms.ContextMenuStrip menu, string text, Action action)
    {
        var item = new Forms.ToolStripMenuItem(text);
        item.Click += (_, _) => _dispatcher.Invoke(action);
        menu.Items.Add(item);
        return item;
    }

    private void Restore(object? sender, EventArgs args) => _dispatcher.Invoke(_window.RestoreToPrimaryMonitor);

    private void Deliver(CompanionEvent item)
    {
        // BeginInvoke avoids a lock inversion with simulator.Dispose() during UI shutdown.
        if (!_disposed && PilotClient.UseSimulator(_pilot?.IsLinked == true) && !_dispatcher.HasShutdownStarted)
            _dispatcher.BeginInvoke(() => { if (!_disposed && PilotClient.UseSimulator(_pilot?.IsLinked == true)) _model.AcceptEvent(item); });
    }

    private void SessionChanged()
    {
        if (_disposed || _dispatcher.HasShutdownStarted) return;
        _dispatcher.BeginInvoke(() => {
            if (_disposed) return;
            var linked = _pilot?.IsLinked == true;
            _link.Enabled = !linked;
            _disconnect.Enabled = linked;
            _icon.Text = linked ? "ZikaCompanion • conectado" : "ZikaCompanion • simulação local";
            if (linked) _simulator.Stop(); else _simulator.Start();
        });
    }

    private async Task LinkAsync()
    {
        if (_pilot is null)
        {
            System.Windows.MessageBox.Show("Configure ZIKACOMPANION_BASE_URL com a URL HTTPS do piloto e reinicie o aplicativo.");
            return;
        }
        _link.Enabled = false;
        try
        {
            await _pilot.LinkAsync((url, code) => {
                System.Windows.Clipboard.SetText(code);
                System.Windows.MessageBox.Show("Código copiado para a área de transferência. Cole-o na página de autorização: " + code, "Vincular conta");
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }, _connection.Token);
            _ = RunEventsAsync(_connection.Token);
        }
        catch (OperationCanceledException) { }
        catch (Exception) { System.Windows.MessageBox.Show("Não foi possível vincular a conta. Tente novamente."); }
        finally { if (!_disposed) _link.Enabled = !_pilot.IsLinked; }
    }

    private async Task RestoreAndRunAsync(CancellationToken ct)
    {
        try { await _pilot!.RestoreAsync(ct); if (!_disposed) _link.Enabled = !_pilot.IsLinked; if (_pilot.IsLinked) await RunEventsAsync(ct); }
        catch (OperationCanceledException) { }
        catch (Exception) { if (!_disposed) _link.Enabled = true; /* Keep the encrypted session for a later retry. */ }
    }

    private async Task RunEventsAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && _pilot?.IsLinked == true)
        {
            try
            {
                using var renew = CancellationTokenSource.CreateLinkedTokenSource(ct);
                renew.CancelAfter(TimeSpan.FromMinutes(12));
                try { await _pilot.ReadEventsAsync(_adapter, item => _dispatcher.BeginInvoke(() => { if (!_disposed) _model.AcceptEvent(item); }), renew.Token); }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested) { }
                if (!_pilot.IsLinked || ct.IsCancellationRequested) return;
                await _pilot.RestoreAsync(ct);
            }
            catch (OperationCanceledException) { return; }
            catch (HttpRequestException)
            {
                // The server uses 404 for expired credentials and a disabled pilot.
                // Refresh when possible, but keep the saved token if the pilot is unavailable.
                try { await _pilot.RestoreAsync(ct); } catch (OperationCanceledException) { return; } catch (Exception) { }
            }
            catch (Exception) { /* Server may be offline or the pilot disabled. */ }
            try { await Task.Delay(TimeSpan.FromSeconds(10), ct); } catch (OperationCanceledException) { return; }
        }
    }

    private void Disconnect()
    {
        _connection.Cancel(); _connection.Dispose(); _connection = new CancellationTokenSource();
        _pilot?.Disconnect();
        _adapter = new EventAdapter();
    }

    private void OpenRoute(CompanionEvent item)
    {
        if (_pilot?.IsLinked != true || item.Route is not { } route || !route.StartsWith('/') || route.StartsWith("//") || route.Contains('\\')) return;
        var baseUrl = Environment.GetEnvironmentVariable("ZIKACOMPANION_BASE_URL");
        if (Uri.TryCreate(baseUrl, UriKind.Absolute, out var address) && address.Scheme == Uri.UriSchemeHttps)
            Process.Start(new ProcessStartInfo(new Uri(address, route).AbsoluteUri) { UseShellExecute = true });
    }
    private async void ExecuteAction(CompanionEvent item)
    {
        try
        {
            var success = _pilot is not null && await _pilot.ExecuteActionAsync(item.EventId, "COLLECT_EXPEDITION", true, _connection.Token);
            System.Windows.MessageBox.Show(success ? "Expedição coletada." : "A ação não pôde ser concluída. Confira no site.");
        }
        catch (Exception) { System.Windows.MessageBox.Show("A ação não pôde ser concluída. Confira no site."); }
    }

    private void ModelChanged(object? sender, PropertyChangedEventArgs args)
    {
        if (args.PropertyName == nameof(OverlayViewModel.IsPaused))
        {
            _pause.Text = _model.IsPaused ? "Retomar (resumo silencioso)" : "Pausar";
            _pause.Checked = _model.IsPaused;
        }
        if (args.PropertyName == nameof(OverlayViewModel.IsMuted)) _mute.Checked = _model.IsMuted;
        if (args.PropertyName == nameof(OverlayViewModel.SelectedMascot))
            foreach (var (number, item) in _mascotChoices)
                item.Checked = number == _model.SelectedMascot.Number;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _connection.Cancel();
        _connection.Dispose();
        if (_pilot is not null) _pilot.SessionChanged -= SessionChanged;
        _window.ActionConfirmed -= ExecuteAction;
        _window.RouteRequested -= OpenRoute;
        _simulator.EventGenerated -= Deliver;
        _simulator.Dispose();
        _model.PropertyChanged -= ModelChanged;
        _icon.Visible = false;
        _icon.DoubleClick -= Restore;
        _icon.ContextMenuStrip?.Dispose();
        _icon.Dispose();
    }
}
