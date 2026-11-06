using System.Windows;
using ZikaCompanion.App.Services;

namespace ZikaCompanion.App;

public partial class App : Application
{
    private TrayHost? _tray;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        var model = new OverlayViewModel(new AlertQueue());
        var overlay = new MainOverlayWindow(model);
        MainWindow = overlay;
        overlay.Show();
        _tray = new TrayHost(overlay, model, new SimulatedEventService());
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _tray?.Dispose();
        base.OnExit(e);
    }
}
