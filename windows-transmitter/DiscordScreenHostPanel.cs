using System.Diagnostics;

namespace LigaZikachu.Transmissor;

internal sealed class DiscordScreenHostPanel : Panel
{
    private static readonly Color Bg = Color.FromArgb(10, 16, 39), Muted = Color.FromArgb(148, 163, 184), Cyan = Color.FromArgb(34, 211, 238);
    private readonly DiscordScreenHostManager _manager;
    private readonly string _modulePath = ResolveModulePath();
    private readonly Label _state = LabelOf("OFFLINE", 11, Color.FromArgb(248, 113, 113), true);
    private readonly Label _details = LabelOf("Servidor desligado.", 9, Muted);
    private readonly Button _toggle = ButtonOf("INICIAR SERVIDOR", Color.FromArgb(16, 185, 129));
    private readonly Button _portal = ButtonOf("ABRIR PORTAL DO DISCORD", Color.FromArgb(88, 101, 242));
    private readonly Button _configure = ButtonOf("CONFIGURAR ACTIVITY", Color.FromArgb(30, 41, 69));
    private readonly TextBox _target = AddressField();
    private readonly TextBox _redirect = AddressField();
    private readonly Button _copyTarget = ButtonOf("COPIAR", Color.FromArgb(30, 41, 69));
    private readonly Button _copyRedirect = ButtonOf("COPIAR", Color.FromArgb(30, 41, 69));
    private readonly TextBox _logs = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, BackColor = Color.FromArgb(2, 6, 23), ForeColor = Color.FromArgb(203, 213, 225), Font = new Font("Consolas", 8.5f), BorderStyle = BorderStyle.FixedSingle };
    private readonly System.Windows.Forms.Timer _healthTimer = new() { Interval = 10_000 };

    public DiscordScreenHostPanel(DiscordScreenHostManager manager)
    {
        _manager = manager; Dock = DockStyle.Fill; BackColor = Bg; Padding = new Padding(24);
        var root = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 8, ColumnCount = 1, BackColor = Bg };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 39)); root.RowStyles.Add(new RowStyle(SizeType.Absolute, 76));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 58)); root.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 48)); root.RowStyles.Add(new RowStyle(SizeType.Absolute, 104));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 25)); root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.Controls.Add(LabelOf("Hospedar Activity do Discord", 20, Color.White, true), 0, 0);
        root.Controls.Add(LabelOf("Este computador vira o servidor da Activity. Iniciar faz o mesmo que rodar o projeto pelo terminal: sobe o servidor, abre o endereço público e registra o ponto de entrada. A transmissão e a câmera acontecem dentro do Discord — nada aqui passa pela transmissão da Liga. Desligar encerra somente os processos iniciados aqui.", 9, Muted), 0, 1);
        root.Controls.Add(StatusRow(), 0, 2); root.Controls.Add(ConfigurationRow(), 0, 3); root.Controls.Add(ActionRow(), 0, 4);
        root.Controls.Add(PortalRow(), 0, 5);
        root.Controls.Add(LabelOf("LOGS DE DIAGNÓSTICO", 8, Color.FromArgb(165, 180, 252), true), 0, 6); root.Controls.Add(_logs, 0, 7); Controls.Add(root);

        _toggle.Click += async (_, _) => await ToggleAsync(); _portal.Click += (_, _) => OpenPortal(); _configure.Click += (_, _) => Configure();
        _copyTarget.Click += (_, _) => Copy(_target); _copyRedirect.Click += (_, _) => Copy(_redirect);
        _manager.Changed += UpdateSafe; _manager.LogAdded += _ => UpdateLogsSafe();
        _healthTimer.Tick += async (_, _) => await _manager.RefreshStatusAsync(); _healthTimer.Start(); UpdateUi();
    }

    private Control StatusRow()
    {
        var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(5, 12, 31), Padding = new Padding(12, 6, 12, 6) };
        _state.Dock = DockStyle.Left; _state.Width = 145; _details.Dock = DockStyle.Fill; _details.TextAlign = ContentAlignment.MiddleLeft;
        card.Controls.Add(_details); card.Controls.Add(_state); return card;
    }

    private Control ConfigurationRow()
    {
        var row = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190));
        row.Controls.Add(LabelOf("✓ Módulo e Node incluídos — nenhuma pasta precisa ser selecionada.", 8.5f, Color.FromArgb(110, 231, 183), true), 0, 0);
        row.Controls.Add(_configure, 1, 0); return row;
    }

    private Control ActionRow()
    {
        var row = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(0, 5, 0, 5) };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58)); row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42));
        row.Controls.Add(_toggle, 0, 0); row.Controls.Add(_portal, 1, 0); return row;
    }

    /// <summary>
    /// Os dois valores que o portal do Discord precisa ter para a Activity abrir.
    /// </summary>
    /// <remarks>
    /// O túnel rápido não tem dono, e o endereço dele nasce de novo a cada
    /// arranque. Quando ele muda e o portal continua apontando para o anterior,
    /// o Discord carrega o iframe de um endereço morto: a Activity abre em
    /// branco, sem erro nenhum — nem aqui, nem no console do Discord.
    ///
    /// O comando de terminal sempre imprimiu estes dois valores, e era só isso
    /// que fazia o passo existir na cabeça de quem usa. Dentro de uma janela
    /// eles precisavam de um lugar próprio: no meio do log rolando, o passo
    /// simplesmente não é visto.
    /// </remarks>
    private Control PortalRow()
    {
        var row = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 3, BackColor = Color.FromArgb(5, 12, 31), Padding = new Padding(12, 6, 12, 8) };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 188)); row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92));
        row.RowStyles.Add(new RowStyle(SizeType.Absolute, 26)); row.RowStyles.Add(new RowStyle(SizeType.Absolute, 30)); row.RowStyles.Add(new RowStyle(SizeType.Absolute, 30));
        var aviso = LabelOf("Cole no portal a cada vez que iniciar — o endereço muda sempre.", 8.5f, Color.FromArgb(250, 204, 21), true);
        row.Controls.Add(aviso, 0, 0); row.SetColumnSpan(aviso, 3);
        row.Controls.Add(LabelOf("Activities → URL Mappings", 8.5f, Color.FromArgb(165, 180, 252), true), 0, 1);
        row.Controls.Add(_target, 1, 1); row.Controls.Add(_copyTarget, 2, 1);
        row.Controls.Add(LabelOf("OAuth2 → Redirects", 8.5f, Color.FromArgb(165, 180, 252), true), 0, 2);
        row.Controls.Add(_redirect, 1, 2); row.Controls.Add(_copyRedirect, 2, 2);
        return row;
    }

    private void Configure()
    {
        if (_manager.Status is not (DiscordHostStatus.Offline or DiscordHostStatus.Error)) { MessageBox.Show(this, "Encerre o servidor antes de alterar as credenciais.", "Servidor em execução", MessageBoxButtons.OK, MessageBoxIcon.Information); return; }
        using var dialog = new DiscordHostConfigurationDialog(); if (dialog.ShowDialog(this) == DialogResult.OK) UpdateUi();
    }

    private async Task ToggleAsync()
    {
        _toggle.Enabled = false;
        if (_manager.Status is DiscordHostStatus.Online or DiscordHostStatus.Preparing or DiscordHostStatus.StartingTunnel or DiscordHostStatus.WaitingForHealth) await _manager.StopAsync();
        else if (!DiscordHostConfiguration.Load().IsConfigured) Configure();
        else await _manager.StartAsync(_modulePath);
        _toggle.Enabled = true;
    }

    private void UpdateSafe() { if (IsDisposed) return; if (InvokeRequired) BeginInvoke(UpdateUi); else UpdateUi(); }
    private void UpdateLogsSafe() { if (IsDisposed) return; if (InvokeRequired) BeginInvoke(UpdateLogs); else UpdateLogs(); }
    private void UpdateUi()
    {
        var (label, color, detail) = _manager.Status switch
        {
            DiscordHostStatus.Offline => ("● OFFLINE", Color.FromArgb(248, 113, 113), DiscordHostConfiguration.Load().IsConfigured ? "Pronto para iniciar a Activity." : "Configure a aplicação do Discord antes de iniciar."),
            DiscordHostStatus.Preparing => ("● PREPARANDO", Color.FromArgb(250, 204, 21), "Verificando o módulo e o runtime incluídos…"),
            DiscordHostStatus.StartingTunnel => ("● TÚNEL", Color.FromArgb(250, 204, 21), "Criando endereço público seguro…"),
            DiscordHostStatus.WaitingForHealth => ("● VERIFICANDO", Cyan, "Aguardando servidor local e acesso público…"),
            DiscordHostStatus.Online => ("● ONLINE", Color.FromArgb(110, 231, 183), "Servidor no ar. Confira os dois endereços abaixo no portal do Discord."),
            DiscordHostStatus.Stopping => ("● ENCERRANDO", Color.FromArgb(250, 204, 21), "Finalizando somente os processos deste host…"),
            _ => ("● ERRO", Color.FromArgb(251, 113, 133), _manager.LastError ?? "Falha desconhecida."),
        };
        _state.Text = label; _state.ForeColor = color; _details.Text = detail;

        var url = _manager.PublicUrl;
        _target.Text = url is null ? "" : url.Replace("https://", "").Replace("http://", "");
        _redirect.Text = url is null ? "" : url + "/auth/callback";
        _copyTarget.Enabled = _copyRedirect.Enabled = url is not null;

        var busy = _manager.Status is DiscordHostStatus.Preparing or DiscordHostStatus.StartingTunnel or DiscordHostStatus.WaitingForHealth or DiscordHostStatus.Stopping;
        _configure.Enabled = !busy && _manager.Status != DiscordHostStatus.Online;
        _portal.Enabled = DiscordHostConfiguration.Load().IsConfigured;
        _toggle.Text = _manager.Status is DiscordHostStatus.Online or DiscordHostStatus.Preparing or DiscordHostStatus.StartingTunnel or DiscordHostStatus.WaitingForHealth ? "ENCERRAR SERVIDOR" : _manager.Status == DiscordHostStatus.Error ? "TENTAR NOVAMENTE" : "INICIAR SERVIDOR";
        _toggle.BackColor = _manager.Status == DiscordHostStatus.Online ? Color.FromArgb(190, 24, 93) : Color.FromArgb(16, 185, 129);
        UpdateLogs();
    }

    private void UpdateLogs() { var text = string.Join(Environment.NewLine, _manager.Logs); if (_logs.Text == text) return; _logs.Text = text; _logs.SelectionStart = _logs.TextLength; _logs.ScrollToCaret(); }

    private void Copy(TextBox field)
    {
        if (field.TextLength == 0) return;
        Clipboard.SetText(field.Text);
        var button = field == _target ? _copyTarget : _copyRedirect;
        button.Text = "COPIADO";
        var restore = new System.Windows.Forms.Timer { Interval = 1200 };
        restore.Tick += (_, _) => { button.Text = "COPIAR"; restore.Stop(); restore.Dispose(); };
        restore.Start();
    }

    private void OpenPortal()
    {
        var clientId = DiscordHostConfiguration.Load().ClientId;
        if (clientId.Length == 0) return;
        Process.Start(new ProcessStartInfo($"https://discord.com/developers/applications/{clientId}") { UseShellExecute = true });
    }

    private static string ResolveModulePath() { var configured = Environment.GetEnvironmentVariable("LIGA_DISCORD_SCREEN_PATH"); if (!string.IsNullOrWhiteSpace(configured)) return configured; return Path.Combine(AppContext.BaseDirectory, "Modules", "DiscordScreen"); }
    private static Label LabelOf(string text, float size, Color color, bool bold = false) => new() { Text = text, Dock = DockStyle.Fill, ForeColor = color, Font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular), AutoEllipsis = true };
    private static Button ButtonOf(string text, Color color) => new() { Text = text, Dock = DockStyle.Fill, BackColor = color, ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9, FontStyle.Bold), Cursor = Cursors.Hand, Margin = new Padding(3) };
    private static TextBox AddressField() => new() { Dock = DockStyle.Fill, ReadOnly = true, BackColor = Color.FromArgb(2, 6, 23), ForeColor = Color.FromArgb(110, 231, 183), Font = new Font("Consolas", 9), BorderStyle = BorderStyle.FixedSingle, Margin = new Padding(3, 4, 3, 4) };
    protected override void Dispose(bool disposing) { if (disposing) { _healthTimer.Stop(); _healthTimer.Dispose(); } base.Dispose(disposing); }
}
