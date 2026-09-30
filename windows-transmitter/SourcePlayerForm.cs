using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;

namespace LigaZikachu.Transmissor;

/// <summary>
/// Navegador de reprodução para fontes nas quais o operador possui permissão.
/// O modo de foco só reorganiza os elementos já renderizados pela página: não
/// extrai streams, não remove autenticação e não interfere com DRM.
/// </summary>
internal sealed class SourcePlayerForm : Form
{
    private readonly WebView2 _browser = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.Black };
    private readonly ToolStrip _tools;
    private readonly ToolStripButton _focus = new("Modo de foco") { CheckOnClick = true, Enabled = false };
    private readonly ToolStripButton _fullscreen = new("Tela cheia") { Enabled = false };
    private readonly ToolStripButton _broadcast = new("Transmitir na Zika TV");
    private readonly ToolStripLabel _status = new("Carregando player…");
    private bool _ready;
    private bool _broadcastPresentation;

    public SourcePlayerForm(string url)
    {
        Text = "Zika TV — Player de fonte";
        Width = 1280; Height = 760; MinimumSize = new Size(720, 460); StartPosition = FormStartPosition.CenterScreen; BackColor = Color.Black;
        _tools = new ToolStrip { GripStyle = ToolStripGripStyle.Hidden, BackColor = Color.FromArgb(10, 16, 39), ForeColor = Color.White, Renderer = new PlayerToolStripRenderer() };
        var source = new ToolStripLabel(new Uri(url).Host) { ForeColor = Color.FromArgb(203, 213, 225) };
        _tools.Items.Add(source); _tools.Items.Add(new ToolStripSeparator()); _tools.Items.Add(_focus); _tools.Items.Add(_fullscreen); _tools.Items.Add(new ToolStripSeparator()); _tools.Items.Add(_broadcast); _tools.Items.Add(new ToolStripSeparator()); _tools.Items.Add(_status);
        _focus.CheckedChanged += async (_, _) => await SetFocusAsync(_focus.Checked);
        _fullscreen.Click += (_, _) => ToggleFullscreen();
        _broadcast.Click += (_, _) => StartBroadcast(url);
        _browser.NavigationCompleted += async (_, _) => { _focus.Enabled = _fullscreen.Enabled = _ready; _status.Text = _ready ? "Pronto para compartilhar esta janela" : "Aguardando player…"; if (_focus.Checked) await SetFocusAsync(true); };
        Controls.Add(_browser); Controls.Add(_tools); _tools.Dock = DockStyle.Top;
        Resize += (_, _) => KeepBroadcastWindowVisible();
        KeyPreview = true; KeyDown += (_, e) => { if (e.KeyCode == Keys.F11) { RestoreBroadcastPresentation(); e.Handled = true; } };
        Shown += async (_, _) =>
        {
            await _browser.EnsureCoreWebView2Async(await BrowserProfile.GetAsync());
            _browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _browser.CoreWebView2.NewWindowRequested += (_, e) => { e.Handled = true; _browser.CoreWebView2.Navigate(e.Uri); };
            _ready = true; _browser.Source = new Uri(url);
        };
    }

    private async Task SetFocusAsync(bool enabled)
    {
        if (!_ready) return;
        _status.Text = enabled ? "Localizando o player da página…" : "Exibindo a página normalmente";
        // Seleciona o maior vídeo/iframe já presente no documento e o enquadra.
        // Iframes de outra origem continuam obedecendo às políticas da própria fonte.
        var script = enabled ? """
            (() => {
              const id='zika-source-focus-style'; document.getElementById(id)?.remove();
              const candidates=[...document.querySelectorAll('video, iframe, embed, object')];
              const target=candidates.map(el=>({el, r:el.getBoundingClientRect()})).sort((a,b)=>b.r.width*b.r.height-a.r.width*a.r.height)[0]?.el;
              if (!target) return 'no-player';
              const style=document.createElement('style'); style.id=id;
              style.textContent='html,body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#000!important}body>*{display:none!important}#zika-source-focus-target{display:block!important;position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;border:0!important;z-index:2147483647!important;background:#000!important}';
              target.id='zika-source-focus-target'; document.head.append(style); return 'focused';
            })();
            """ : "(() => { document.getElementById('zika-source-focus-style')?.remove(); document.getElementById('zika-source-focus-target')?.removeAttribute('id'); return 'normal'; })();";
        var result = await _browser.CoreWebView2.ExecuteScriptAsync(script);
        _status.Text = result.Contains("no-player") ? "Nenhum player foi encontrado nesta página" : enabled ? "Modo de foco ativo — compartilhe esta janela" : "Exibindo a página normalmente";
    }

    private void ToggleFullscreen()
    {
        FormBorderStyle = FormBorderStyle == FormBorderStyle.None ? FormBorderStyle.Sizable : FormBorderStyle.None;
        WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
    }

    private void StartBroadcast(string url)
    {
        using var dialog = new LiveTitleDialog($"Fonte: {new Uri(url).Host}");
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        BeginBroadcastPresentation();
        new DesktopLaunchForm("https://liga-zikachu.vercel.app", dialog.Title, this).Show();
    }

    private void BeginBroadcastPresentation()
    {
        if (_broadcastPresentation) return;
        _broadcastPresentation = true;
        _tools.Visible = false;
        FormBorderStyle = FormBorderStyle.None;
        WindowState = FormWindowState.Maximized;
        _status.Text = "Modo de transmissão ativo · F11 restaura os controles";
    }

    private void KeepBroadcastWindowVisible()
    {
        if (!_broadcastPresentation || WindowState != FormWindowState.Minimized || IsDisposed) return;
        BeginInvoke(() => { if (!IsDisposed) WindowState = FormWindowState.Maximized; });
    }

    private void RestoreBroadcastPresentation()
    {
        if (!_broadcastPresentation) return;
        _broadcastPresentation = false;
        FormBorderStyle = FormBorderStyle.Sizable;
        WindowState = FormWindowState.Normal;
        _tools.Visible = true;
        _status.Text = "Controles restaurados";
    }

    private sealed class PlayerToolStripRenderer : ToolStripProfessionalRenderer
    {
        public PlayerToolStripRenderer() : base(new PlayerColors()) { }
        private sealed class PlayerColors : ProfessionalColorTable { public override Color ToolStripGradientBegin => Color.FromArgb(10, 16, 39); public override Color ToolStripGradientEnd => Color.FromArgb(10, 16, 39); }
    }
}

internal sealed class SourcePlayerPanel : Panel
{
    private readonly TextBox _url = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(6, 11, 29), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle, PlaceholderText = "https://sua-fonte.example/episodio" };
    private readonly Label _message = new() { Dock = DockStyle.Fill, ForeColor = Color.FromArgb(148, 163, 184), Font = new Font("Segoe UI", 10), Text = "A fonte é aberta numa janela própria. O modo de foco mantém na tela o maior player ou iframe já disponibilizado pela página.", AutoSize = false };

    public SourcePlayerPanel()
    {
        Dock = DockStyle.Fill; BackColor = Color.FromArgb(10, 16, 39); Padding = new Padding(32);
        var layout = new TableLayoutPanel { Dock = DockStyle.Top, Height = 285, ColumnCount = 1, RowCount = 6 };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 88)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 30)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 20)); layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.Controls.Add(BrandAssets.LogoBox(330, 82), 0, 0);
        layout.Controls.Add(new Label { Text = "Abrir fonte de vídeo", Dock = DockStyle.Fill, ForeColor = Color.White, Font = new Font("Segoe UI", 20, FontStyle.Bold) }, 0, 1);
        layout.Controls.Add(new Label { Text = "Use somente fontes para as quais você tem autorização de reprodução.", Dock = DockStyle.Fill, ForeColor = Color.FromArgb(196, 181, 253), Font = new Font("Segoe UI", 9, FontStyle.Bold) }, 0, 2);
        var row = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 }; row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 145)); row.Controls.Add(_url, 0, 0);
        var open = new Button { Text = "ABRIR PLAYER", Dock = DockStyle.Fill, BackColor = Color.FromArgb(124, 58, 237), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9, FontStyle.Bold) }; open.Click += (_, _) => Open(); row.Controls.Add(open, 1, 0);
        layout.Controls.Add(row, 0, 3); layout.Controls.Add(_message, 0, 5); Controls.Add(layout);
        _url.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { Open(); e.SuppressKeyPress = true; } };
    }

    private void Open()
    {
        if (!Uri.TryCreate(_url.Text.Trim(), UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http")) { _message.Text = "Informe uma URL http ou https válida."; return; }
        new SourcePlayerForm(uri.AbsoluteUri).Show();
    }
}

/// <summary>
/// Ponte entre o player nativo e a Zika TV. A autenticação ocorre no WebView
/// oficial da Liga; quando a página confirma a sessão, ela entrega um token
/// temporário para abrir a central de transmissão, sem pedir senha ao app.
/// </summary>
internal sealed class DesktopLaunchForm : Form
{
    private readonly string _server;
    private readonly string _title;
    private readonly Form _sourcePlayer;
    private readonly WebView2 _browser = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(3, 7, 24) };
    private bool _openedStudio;

    public DesktopLaunchForm(string server, string title, Form sourcePlayer)
    {
        _server = server.TrimEnd('/'); _title = title; _sourcePlayer = sourcePlayer;
        Text = "Zika TV — Entrar e iniciar transmissão"; Width = 680; Height = 520; StartPosition = FormStartPosition.CenterParent; BackColor = Color.FromArgb(3, 7, 24);
        Controls.Add(_browser);
        Shown += async (_, _) =>
        {
            await _browser.EnsureCoreWebView2Async(await BrowserProfile.GetAsync());
            _browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _browser.CoreWebView2.DocumentTitleChanged += (_, _) => TryOpenStudio();
            _browser.Source = new Uri($"{_server}/windows-transmitter/desktop?title={Uri.EscapeDataString(_title)}");
        };
    }

    private void TryOpenStudio()
    {
        if (_openedStudio || _browser.CoreWebView2 is null) return;
        var title = _browser.CoreWebView2.DocumentTitle;
        if (!title.StartsWith("ZIKA_LAUNCH:", StringComparison.Ordinal)) return;
        try
        {
            var encoded = title["ZIKA_LAUNCH:".Length..];
            var json = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
            var launch = JsonSerializer.Deserialize<Launch>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (string.IsNullOrWhiteSpace(launch?.StreamId) || string.IsNullOrWhiteSpace(launch.Token)) throw new InvalidOperationException();
            _openedStudio = true;
            var studio = new BroadcastStudioForm(_server, launch.StreamId, launch.Token, _sourcePlayer);
            studio.FormClosed += (_, _) => { if (!_sourcePlayer.IsDisposed) _sourcePlayer.Show(); };
            studio.Show(); Close();
        }
        catch { Text = "Zika TV — não foi possível abrir a central"; }
    }

    private sealed record Launch(string? StreamId, string? Token);
}

/// <summary>O título é uma decisão do usuário no app, antes da única tela web necessária (login).</summary>
internal sealed class LiveTitleDialog : Form
{
    private readonly TextBox _title = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(6, 11, 29), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle, MaxLength = 80 };
    public string Title => _title.Text.Trim();

    public LiveTitleDialog(string suggestedTitle)
    {
        Text = "Nova transmissão na Zika TV"; Width = 490; Height = 260; StartPosition = FormStartPosition.CenterParent; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; BackColor = Color.FromArgb(10, 16, 39); Padding = new Padding(22);
        _title.Text = suggestedTitle;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4 };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 30)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 36)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
        layout.Controls.Add(new Label { Text = "Qual é o nome desta live?", Dock = DockStyle.Fill, ForeColor = Color.White, Font = new Font("Segoe UI", 14, FontStyle.Bold) }, 0, 0);
        layout.Controls.Add(new Label { Text = "Você entrará na conta da Liga apenas se ainda não houver uma sessão salva.", Dock = DockStyle.Fill, ForeColor = Color.FromArgb(148, 163, 184), Font = new Font("Segoe UI", 8.5f) }, 0, 1);
        layout.Controls.Add(_title, 0, 2);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(0, 10, 0, 0) };
        var create = new Button { Text = "CRIAR E TRANSMITIR", Width = 170, Height = 34, BackColor = Color.FromArgb(124, 58, 237), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, DialogResult = DialogResult.OK, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
        var cancel = new Button { Text = "Cancelar", Width = 90, Height = 34, BackColor = Color.FromArgb(30, 41, 69), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, DialogResult = DialogResult.Cancel };
        buttons.Controls.Add(create); buttons.Controls.Add(cancel); layout.Controls.Add(buttons, 0, 3); Controls.Add(layout); AcceptButton = create; CancelButton = cancel;
        create.Click += (_, _) => { if (Title.Length < 3) { DialogResult = DialogResult.None; MessageBox.Show(this, "Digite um título com pelo menos 3 caracteres.", "Título da live", MessageBoxButtons.OK, MessageBoxIcon.Information); } };
    }
}
