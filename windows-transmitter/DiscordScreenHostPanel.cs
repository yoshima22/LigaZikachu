using System.Diagnostics;

namespace LigaZikachu.Transmissor;

internal sealed class DiscordScreenHostPanel : Panel
{
    private static readonly Color Bg = Color.FromArgb(10, 16, 39), Muted = Color.FromArgb(148, 163, 184), Cyan = Color.FromArgb(34, 211, 238);
    private readonly DiscordScreenHostManager _manager;
    private readonly TextBox _modulePath = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(6, 11, 29), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
    private readonly Label _state = LabelOf("OFFLINE", 11, Color.FromArgb(248, 113, 113), true);
    private readonly Label _details = LabelOf("Servidor desligado.", 9, Muted);
    private readonly Button _toggle = ButtonOf("INICIAR SERVIDOR", Color.FromArgb(16, 185, 129));
    private readonly Button _open = ButtonOf("ABRIR ENDEREÇO", Color.FromArgb(124, 58, 237));
    private readonly TextBox _logs = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, BackColor = Color.FromArgb(2, 6, 23), ForeColor = Color.FromArgb(203, 213, 225), Font = new Font("Consolas", 8.5f), BorderStyle = BorderStyle.FixedSingle };
    private readonly System.Windows.Forms.Timer _healthTimer = new() { Interval = 10_000 };

    public DiscordScreenHostPanel(DiscordScreenHostManager manager)
    {
        _manager = manager;
        Dock = DockStyle.Fill;
        BackColor = Bg;
        Padding = new Padding(24);
        _modulePath.Text = ResolveDefaultModulePath();

        var root = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 8, ColumnCount = 1, BackColor = Bg };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 39));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 24));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 25));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.Controls.Add(LabelOf("Hospedar pelo Discord", 20, Color.White, true), 0, 0);
        root.Controls.Add(LabelOf("Liga e desliga o Discord Screen sem terminal. O status Online só aparece após o servidor local e o túnel responderem ao health check.", 9, Muted), 0, 1);
        root.Controls.Add(LabelOf("PASTA DO MÓDULO", 8, Color.FromArgb(165, 180, 252), true), 0, 2);
        root.Controls.Add(ModuleRow(), 0, 3);
        root.Controls.Add(StatusRow(), 0, 4);
        root.Controls.Add(ActionRow(), 0, 5);
        root.Controls.Add(LabelOf("LOGS DE DIAGNÓSTICO", 8, Color.FromArgb(165, 180, 252), true), 0, 6);
        root.Controls.Add(_logs, 0, 7);
        Controls.Add(root);

        _toggle.Click += async (_, _) => await ToggleAsync();
        _open.Click += (_, _) => OpenPublicUrl();
        _manager.Changed += UpdateSafe;
        _manager.LogAdded += _ => UpdateLogsSafe();
        _healthTimer.Tick += async (_, _) => await _manager.RefreshStatusAsync();
        _healthTimer.Start();
        UpdateUi();
    }

    private Control ModuleRow()
    {
        var row = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 95));
        var browse = ButtonOf("Procurar…", Color.FromArgb(30, 41, 69));
        browse.Click += (_, _) =>
        {
            using var dialog = new FolderBrowserDialog { Description = "Selecione a pasta discord-screen-main", InitialDirectory = Directory.Exists(_modulePath.Text) ? _modulePath.Text : Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) };
            if (dialog.ShowDialog(this) == DialogResult.OK) _modulePath.Text = dialog.SelectedPath;
        };
        row.Controls.Add(_modulePath, 0, 0); row.Controls.Add(browse, 1, 0);
        return row;
    }

    private Control StatusRow()
    {
        var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(5, 12, 31), Padding = new Padding(12, 6, 12, 6) };
        _state.Dock = DockStyle.Left; _state.Width = 135;
        _details.Dock = DockStyle.Fill; _details.TextAlign = ContentAlignment.MiddleLeft;
        card.Controls.Add(_details); card.Controls.Add(_state);
        return card;
    }

    private Control ActionRow()
    {
        var row = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(0, 5, 0, 5) };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58)); row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42));
        row.Controls.Add(_toggle, 0, 0); row.Controls.Add(_open, 1, 0); return row;
    }

    private async Task ToggleAsync()
    {
        _toggle.Enabled = false;
        if (_manager.Status is DiscordHostStatus.Online or DiscordHostStatus.Preparing or DiscordHostStatus.StartingTunnel or DiscordHostStatus.WaitingForHealth)
            await _manager.StopAsync();
        else
            await _manager.StartAsync(_modulePath.Text);
        _toggle.Enabled = true;
    }

    private void UpdateSafe() { if (IsDisposed) return; if (InvokeRequired) BeginInvoke(UpdateUi); else UpdateUi(); }
    private void UpdateLogsSafe() { if (IsDisposed) return; if (InvokeRequired) BeginInvoke(UpdateLogs); else UpdateLogs(); }

    private void UpdateUi()
    {
        var (label, color, detail) = _manager.Status switch
        {
            DiscordHostStatus.Offline => ("● OFFLINE", Color.FromArgb(248, 113, 113), "Servidor desligado."),
            DiscordHostStatus.Preparing => ("● PREPARANDO", Color.FromArgb(250, 204, 21), "Verificando arquivos e runtime…"),
            DiscordHostStatus.StartingTunnel => ("● TÚNEL", Color.FromArgb(250, 204, 21), "Criando endereço público seguro…"),
            DiscordHostStatus.WaitingForHealth => ("● VERIFICANDO", Cyan, "Aguardando servidor local e acesso público…"),
            DiscordHostStatus.Online => ("● ONLINE", Color.FromArgb(110, 231, 183), _manager.PublicUrl ?? _manager.LocalUrl),
            DiscordHostStatus.Stopping => ("● ENCERRANDO", Color.FromArgb(250, 204, 21), "Finalizando somente os processos deste host…"),
            _ => ("● ERRO", Color.FromArgb(251, 113, 133), _manager.LastError ?? "Falha desconhecida."),
        };
        _state.Text = label; _state.ForeColor = color; _details.Text = detail;
        var busy = _manager.Status is DiscordHostStatus.Preparing or DiscordHostStatus.StartingTunnel or DiscordHostStatus.WaitingForHealth or DiscordHostStatus.Stopping;
        _modulePath.Enabled = !busy && _manager.Status != DiscordHostStatus.Online;
        _toggle.Text = _manager.Status is DiscordHostStatus.Online or DiscordHostStatus.Preparing or DiscordHostStatus.StartingTunnel or DiscordHostStatus.WaitingForHealth ? "ENCERRAR SERVIDOR" : _manager.Status == DiscordHostStatus.Error ? "TENTAR NOVAMENTE" : "INICIAR SERVIDOR";
        _toggle.BackColor = _manager.Status == DiscordHostStatus.Online ? Color.FromArgb(190, 24, 93) : Color.FromArgb(16, 185, 129);
        _open.Enabled = _manager.Status == DiscordHostStatus.Online && _manager.PublicUrl is not null;
        UpdateLogs();
    }

    private void UpdateLogs()
    {
        var text = string.Join(Environment.NewLine, _manager.Logs);
        if (_logs.Text == text) return;
        _logs.Text = text;
        _logs.SelectionStart = _logs.TextLength;
        _logs.ScrollToCaret();
    }

    private void OpenPublicUrl()
    {
        if (_manager.PublicUrl is not string url) return;
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private static string ResolveDefaultModulePath()
    {
        var configured = Environment.GetEnvironmentVariable("LIGA_DISCORD_SCREEN_PATH");
        if (!string.IsNullOrWhiteSpace(configured)) return configured;
        var bundled = Path.Combine(AppContext.BaseDirectory, "Modules", "DiscordScreen");
        if (Directory.Exists(bundled)) return bundled;
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads", "discord-screen-main");
    }

    private static Label LabelOf(string text, float size, Color color, bool bold = false) => new() { Text = text, Dock = DockStyle.Fill, ForeColor = color, Font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular), AutoEllipsis = true };
    private static Button ButtonOf(string text, Color color) => new() { Text = text, Dock = DockStyle.Fill, BackColor = color, ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9, FontStyle.Bold), Cursor = Cursors.Hand, Margin = new Padding(3) };

    protected override void Dispose(bool disposing)
    {
        if (disposing) { _healthTimer.Stop(); _healthTimer.Dispose(); }
        base.Dispose(disposing);
    }
}
