using System.ComponentModel;
using System.Drawing;
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

    public TrayHost(MainOverlayWindow window, OverlayViewModel model, SimulatedEventService simulator)
    {
        _window = window;
        _model = model;
        _simulator = simulator;
        _dispatcher = window.Dispatcher;
        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add("ZikaCompanion • simulação local").Enabled = false;
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
        _simulator.Start();
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
        if (!_disposed && !_dispatcher.HasShutdownStarted)
            _dispatcher.BeginInvoke(() => { if (!_disposed) _model.AcceptEvent(item); });
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
        _simulator.EventGenerated -= Deliver;
        _simulator.Dispose();
        _model.PropertyChanged -= ModelChanged;
        _icon.Visible = false;
        _icon.DoubleClick -= Restore;
        _icon.ContextMenuStrip?.Dispose();
        _icon.Dispose();
    }
}
