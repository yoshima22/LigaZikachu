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
    private readonly ToolStripButton _audioTest = new("Testar áudio isolado") { Enabled = false };
    private readonly ToolStripLabel _status = new("Carregando player…");
    private bool _ready;
    private bool _broadcastPresentation;
    private NativeAudioStream? _nativeAudio;
    private NativeVideoStream? _nativeVideo;
    private NativeBroadcastSession? _nativeSession;
    private bool _starting, _closing;
    private readonly ToolStripButton _end = new("Parar transmissão") { Visible = false, Alignment = ToolStripItemAlignment.Right, Overflow = ToolStripItemOverflow.Never };
    private readonly ToolStripButton _pause = new("Pausar") { Visible = false, Alignment = ToolStripItemAlignment.Right, Overflow = ToolStripItemOverflow.Never };
    private readonly ToolStripButton _changeQuality = new("Qualidade") { Visible = false, Alignment = ToolStripItemAlignment.Right, Overflow = ToolStripItemOverflow.Never };
    private BroadcastQuality _quality = BroadcastQuality.Default;
    private bool _paused;
    private readonly CancellationTokenSource _lifetime = new();
    private readonly NotifyIcon _tray = new() { Text = "Zika TV — transmissão ativa", Icon = SystemIcons.Application };
    private Rectangle? _parkedBounds;

    public SourcePlayerForm(string url)
    {
        Text = "Zika TV — Player de fonte";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        if (Icon != null) _tray.Icon = Icon;
        Width = 1280; Height = 760; MinimumSize = new Size(720, 460); StartPosition = FormStartPosition.CenterScreen; BackColor = Color.Black;
        _tools = new ToolStrip { GripStyle = ToolStripGripStyle.Hidden, BackColor = Color.FromArgb(10, 16, 39), ForeColor = Color.White, Renderer = new PlayerToolStripRenderer() };
        var source = new ToolStripLabel(new Uri(url).Host) { ForeColor = Color.FromArgb(203, 213, 225) };
        _tools.Items.Add(source); _tools.Items.Add(new ToolStripSeparator()); _tools.Items.Add(_focus); _tools.Items.Add(_fullscreen); _tools.Items.Add(new ToolStripSeparator()); _tools.Items.Add(_audioTest); _tools.Items.Add(_broadcast); _tools.Items.Add(new ToolStripSeparator()); _tools.Items.Add(_status);
        _focus.CheckedChanged += async (_, _) => await SetFocusAsync(_focus.Checked);
        _fullscreen.Click += (_, _) => ToggleFullscreen();
        _broadcast.Click += (_, _) => StartBroadcast(url);
        _audioTest.Click += async (_, _) => await TestIsolatedAudioAsync();
        _tools.Items.Add(_end);
        _tools.Items.Add(_pause);
        _tools.Items.Add(_changeQuality);
        _pause.Click += (_, _) => TogglePause();
        _changeQuality.Click += async (_, _) => await ChangeQualityAsync();
        _audioTest.Visible = false;
        _tray.DoubleClick += (_, _) => RestoreParkedWindow();
        var trayMenu = new ContextMenuStrip();
        trayMenu.Items.Add("Abrir player", null, (_, _) => RestoreParkedWindow());
        trayMenu.Items.Add("Pausar / retomar transmissão", null, (_, _) => TogglePause());
        trayMenu.Items.Add("Alterar qualidade", null, async (_, _) => await ChangeQualityAsync());
        trayMenu.Items.Add("Encerrar transmissão", null, async (_, _) => { RestoreParkedWindow(); await StopNativeAsync(); });
        _tray.ContextMenuStrip = trayMenu;
        _end.Click += async (_, _) => await StopNativeAsync();
        FormClosing += async (_, e) =>
        {
            if (_closing) return;
            if (_nativeSession == null && !_starting) { _closing = true; _lifetime.Cancel(); _tray.Dispose(); return; }
            e.Cancel = true; _closing = true; _lifetime.Cancel();
            try { await StopNativeAsync(); }
            finally { _tray.Dispose(); BeginInvoke(Close); }
        };
        _browser.NavigationCompleted += async (_, _) => { _focus.Enabled = _fullscreen.Enabled = _audioTest.Enabled = _ready; _status.Text = _ready ? "Pronto para compartilhar esta janela" : "Aguardando player…"; if (_focus.Checked) await SetFocusAsync(true); };
        Controls.Add(_browser); Controls.Add(_tools); _tools.Dock = DockStyle.Top;
        Resize += (_, _) => KeepBroadcastWindowVisible();
        KeyPreview = true; KeyDown += (_, e) => { if (e.KeyCode == Keys.F11) { RestoreBroadcastPresentation(); e.Handled = true; } };
        Shown += async (_, _) =>
        {
            await _browser.EnsureCoreWebView2Async(await BrowserProfile.CreatePlayerAsync(Guid.NewGuid().ToString("N")));
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
              document.querySelectorAll('[data-zika-player],[data-zika-ancestor]').forEach(el=>{el.removeAttribute('data-zika-player');el.removeAttribute('data-zika-ancestor')});
              for(let p=target.parentElement;p;p=p.parentElement)p.setAttribute('data-zika-ancestor','');
              style.textContent='html,body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#000!important}body *{visibility:hidden!important}[data-zika-ancestor]{transform:none!important;filter:none!important;contain:none!important;overflow:visible!important}[data-zika-player],[data-zika-player] *{visibility:visible!important}[data-zika-player]{display:block!important;position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;border:0!important;margin:0!important;z-index:2147483647!important;background:#000!important}';
              target.setAttribute('data-zika-player',''); document.head.append(style); return 'focused';
            })();
            """ : "(() => { document.getElementById('zika-source-focus-style')?.remove(); document.querySelectorAll('[data-zika-player],[data-zika-ancestor]').forEach(el=>{el.removeAttribute('data-zika-player');el.removeAttribute('data-zika-ancestor')}); return 'normal'; })();";
        var result = await _browser.CoreWebView2.ExecuteScriptAsync(script);
        _status.Text = result.Contains("no-player") ? "Nenhum player foi encontrado nesta página" : enabled ? "Modo de foco ativo — compartilhe esta janela" : "Exibindo a página normalmente";
    }

    private void ToggleFullscreen()
    {
        FormBorderStyle = FormBorderStyle == FormBorderStyle.None ? FormBorderStyle.Sizable : FormBorderStyle.None;
        WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
    }

    private async Task TestIsolatedAudioAsync()
    {
        _audioTest.Enabled = false;
        _status.Text = "Teste nativo: reproduza o vídeo agora — capturando só este app por 10 segundos…";
        try
        {
            var result = await NativeProcessAudioProbe.CaptureTenSecondsAsync();
            _status.Text = result.Success
                ? "Teste concluído: o áudio isolado foi capturado internamente."
                : "A captura nativa não concluiu; verifique se o vídeo tinha áudio ativo.";
        }
        catch (Exception ex)
        {
            _status.Text = "Falha ao testar o áudio isolado: " + ex.Message;
        }
        finally { if (!IsDisposed) _audioTest.Enabled = true; }
    }

    private void StartBroadcast(string url)
    {
        using var dialog = new LiveTitleDialog($"Fonte: {new Uri(url).Host}");
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        _quality = dialog.Quality;
        new DesktopLaunchForm("https://liga-zikachu.vercel.app", dialog.Title, this).Show();
    }

    internal async Task StartNativeAsync(string server, string streamId, string token)
    {
        if (_starting || _nativeSession != null) throw new InvalidOperationException("Este player já tem uma transmissão.");
        _starting = true; _broadcast.Enabled = false;
        try
        {
            _status.Text = "Preparando vídeo e áudio do player…";
            _focus.Checked = true;
            await SetFocusAsync(true);
            _nativeSession = new NativeBroadcastSession(server, streamId, token);
            _nativeAudio = new NativeAudioStream();
            _nativeVideo = new NativeVideoStream(_quality);
            _nativeSession.Status += ShowNativeStatus;
            _nativeSession.ViewerConnected += _nativeVideo.RequestKeyframe;
            _nativeAudio.Samples += _nativeSession.SendAudio;
            _nativeVideo.Frame += _nativeSession.SendVideo;
            _nativeAudio.Failed += HandleNativeFailure;
            _nativeVideo.Failed += HandleNativeFailure;
            await _nativeVideo.StartAsync(Handle, _browser.Handle, _lifetime.Token);
            await _nativeAudio.StartAsync(_browser.CoreWebView2.BrowserProcessId, _lifetime.Token);
            await _nativeSession.StartAsync(_lifetime.Token, _quality);
            _paused = false; _pause.Text = "Pausar";
            _end.Visible = _pause.Visible = _changeQuality.Visible = true;
            _status.Text = $"AO VIVO · áudio deste player · {_quality}";
        }
        catch { await StopNativeAsync(); throw; }
        finally { _starting = false; if (!IsDisposed) _broadcast.Enabled = _nativeSession == null; }
    }

    private void TogglePause()
    {
        if (_nativeSession == null || _nativeVideo == null || _starting) return;
        _paused = !_paused;
        // Silence first when pausing; restore audio only after video is ready.
        if (_paused) _nativeSession.SetPaused(true);
        _nativeVideo.SetPaused(_paused);
        if (!_paused) _nativeSession.SetPaused(false);
        _pause.Text = _paused ? "Retomar" : "Pausar";
        _status.Text = _paused ? "PAUSADA · público sem áudio e com tela de pausa" : $"AO VIVO · áudio deste player · {_quality}";
        _tray.Text = _paused ? "Zika TV — transmissão pausada" : "Zika TV — transmissão ativa";
    }

    private async Task ChangeQualityAsync()
    {
        var session = _nativeSession;
        var currentVideo = _nativeVideo;
        if (session == null || currentVideo == null || _starting) return;

        using var dialog = new BroadcastQualityDialog(_quality);
        if (dialog.ShowDialog(this) != DialogResult.OK || dialog.Quality == _quality) return;

        var selected = dialog.Quality;
        _changeQuality.Enabled = false;
        _status.Text = $"Trocando para {selected}…";
        NativeVideoStream? nextVideo = null;
        try
        {
            // Start and validate the replacement before interrupting the current
            // source. Windows Graphics Capture supports independent sessions for
            // the same window, so a failed change leaves the live untouched.
            nextVideo = new NativeVideoStream(selected);
            await nextVideo.StartAsync(Handle, _browser.Handle, _lifetime.Token);
            nextVideo.Frame += session.SendVideo;
            nextVideo.Failed += HandleNativeFailure;
            // StartAsync waits for its first frame. That first frame was encoded
            // before the subscriber above existed, so request a fresh keyframe
            // that receivers can decode after a resolution switch.
            nextVideo.RequestKeyframe();
            session.ViewerConnected -= currentVideo.RequestKeyframe;
            session.ViewerConnected += nextVideo.RequestKeyframe;
            _nativeVideo = nextVideo;
            nextVideo = null;
            currentVideo.Frame -= session.SendVideo;
            currentVideo.Failed -= HandleNativeFailure;
            await currentVideo.DisposeAsync();
            _quality = selected;
            try { await session.UpdateQualityAsync(selected, _lifetime.Token); }
            catch (Exception ex) { ShowNativeStatus($"Qualidade alterada localmente; não foi possível registrar no site: {ex.Message}"); return; }
            _status.Text = _paused ? $"PAUSADA · {selected}" : $"AO VIVO · áudio deste player · {selected}";
        }
        catch (Exception ex)
        {
            if (nextVideo != null) await nextVideo.DisposeAsync();
            _status.Text = "Não foi possível alterar a qualidade: " + ex.Message;
        }
        finally { if (!IsDisposed) _changeQuality.Enabled = _nativeSession != null; }
    }

    private void ShowNativeStatus(string text)
    {
        if (IsDisposed || !IsHandleCreated) return;
        try { BeginInvoke(() => { if (!IsDisposed) _status.Text = text; }); } catch (InvalidOperationException) { }
    }

    private void HandleNativeFailure(string text)
    {
        if (IsDisposed || !IsHandleCreated) return;
        try
        {
            BeginInvoke(async () =>
            {
                await StopNativeAsync();
                if (!IsDisposed) _status.Text = "Live encerrada: " + text;
            });
        }
        catch (InvalidOperationException) { }
    }

    private async Task StopNativeAsync()
    {
        var audio = _nativeAudio; var video = _nativeVideo; var session = _nativeSession;
        _nativeAudio = null; _nativeVideo = null; _nativeSession = null;
        if (audio != null) await audio.DisposeAsync();
        if (video != null) await video.DisposeAsync();
        if (session != null) await session.DisposeAsync();
        if (!IsDisposed) { RestoreParkedWindow(); _tray.Visible = false; _end.Visible = _pause.Visible = _changeQuality.Visible = false; _paused = false; _broadcast.Enabled = true; _status.Text = "Transmissão encerrada"; }
    }

    internal Task ShutdownNativeAsync() { _lifetime.Cancel(); return StopNativeAsync(); }

    protected override void WndProc(ref Message m)
    {
        const int wmSysCommand = 0x112;
        if (m.Msg == wmSysCommand && (m.WParam.ToInt64() & 0xfff0) == 0xf020 && _nativeSession != null)
        {
            // Windows stops producing WGC frames for an iconic window. Keep the
            // render surface alive off-screen and offer restoration in the tray.
            // A taskbar click on a normal window can send SC_MINIMIZE again.
            // Treat that second request as "bring it back", rather than moving
            // an already parked player farther off screen.
            if (_parkedBounds != null) RestoreParkedWindow();
            else
            {
                _parkedBounds = Bounds;
                WindowState = FormWindowState.Normal;
                Location = new Point(-20000, 0);
                _tray.Visible = true;
            }
            return;
        }
        if (m.Msg == wmSysCommand && (m.WParam.ToInt64() & 0xfff0) == 0xf120 && _parkedBounds != null)
        { RestoreParkedWindow(); return; }
        base.WndProc(ref m);
    }

    private void RestoreParkedWindow()
    {
        if (_parkedBounds is not { } bounds) return;
        _parkedBounds = null;
        WindowState = FormWindowState.Normal;
        Bounds = bounds;
        Show(); BringToFront(); Activate();
        _tray.Visible = false;
    }

    protected override void OnActivated(EventArgs e)
    {
        base.OnActivated(e);
        // Clicking the taskbar commonly activates an off-screen normal window
        // without sending SC_RESTORE. Restore on that explicit activation.
        if (_parkedBounds != null && IsHandleCreated)
            BeginInvoke(RestoreParkedWindow);
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

    private async void TryOpenStudio()
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
            if (_sourcePlayer is SourcePlayerForm source)
            {
                await source.StartNativeAsync(_server, launch.StreamId, launch.Token);
                Close();
                return;
            }
            var studio = new BroadcastStudioForm(_server, launch.StreamId, launch.Token, _sourcePlayer);
            studio.FormClosed += (_, _) => { if (!_sourcePlayer.IsDisposed) _sourcePlayer.Show(); };
            studio.Show(); Close();
        }
        catch (Exception ex) { _openedStudio = false; Text = "Zika TV — falha ao iniciar"; MessageBox.Show(this, ex.Message, "Transmissão", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    private sealed record Launch(string? StreamId, string? Token);
}

/// <summary>O título é uma decisão do usuário no app, antes da única tela web necessária (login).</summary>
internal sealed class LiveTitleDialog : Form
{
    private readonly TextBox _title = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(6, 11, 29), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle, MaxLength = 80 };
    private readonly ComboBox _resolution = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 200 };
    private readonly ComboBox _fps = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 150 };
    public string Title => _title.Text.Trim();
    public BroadcastQuality Quality => new(BroadcastQuality.Resolutions[_resolution.SelectedIndex].Width, BroadcastQuality.Resolutions[_resolution.SelectedIndex].Height, _fps.SelectedIndex == 1 ? 60 : 30);

    public LiveTitleDialog(string suggestedTitle)
    {
        Text = "Nova transmissão na Zika TV"; ClientSize = new Size(550, 350); AutoScaleMode = AutoScaleMode.Dpi; StartPosition = FormStartPosition.CenterParent; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; BackColor = Color.FromArgb(10, 16, 39); Padding = new Padding(22);
        _title.Text = suggestedTitle;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 7 };
        foreach (var height in new[] { 40, 34, 36, 24, 40, 64, 58 }) layout.RowStyles.Add(new RowStyle(SizeType.Absolute, height));
        layout.Controls.Add(new Label { Text = "Qual é o nome desta live?", Dock = DockStyle.Fill, ForeColor = Color.White, Font = new Font("Segoe UI", 14, FontStyle.Bold) }, 0, 0);
        layout.Controls.Add(new Label { Text = "Você entrará na conta da Liga apenas se ainda não houver uma sessão salva.", Dock = DockStyle.Fill, ForeColor = Color.FromArgb(148, 163, 184), Font = new Font("Segoe UI", 8.5f) }, 0, 1);
        layout.Controls.Add(_title, 0, 2);
        layout.Controls.Add(new Label { Text = "Resolução                           Quadros por segundo", ForeColor = Color.White, Dock = DockStyle.Fill }, 0, 3);
        foreach (var size in BroadcastQuality.Resolutions) _resolution.Items.Add($"{size.Height}p ({size.Width} × {size.Height})");
        _resolution.SelectedIndex = 2;
        _fps.Items.AddRange(new object[] { "30 fps", "60 fps" }); _fps.SelectedIndex = 0;
        var qualityRow = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
        qualityRow.Controls.Add(_resolution); qualityRow.Controls.Add(_fps); layout.Controls.Add(qualityRow, 0, 4);
        layout.Controls.Add(new Label { Text = "720p / 30 fps é o padrão. 60 fps e resoluções maiores exigem mais do PC e da conexão. A taxa real também depende do vídeo de origem. Você pode pausar ou parar pelo topo do player.", Dock = DockStyle.Fill, ForeColor = Color.FromArgb(148, 163, 184), Font = new Font("Segoe UI", 9) }, 0, 5);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(0, 10, 0, 0) };
        var create = new Button { Text = "CRIAR E TRANSMITIR", Width = 170, Height = 34, BackColor = Color.FromArgb(124, 58, 237), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, DialogResult = DialogResult.OK, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
        var cancel = new Button { Text = "Cancelar", Width = 90, Height = 34, BackColor = Color.FromArgb(30, 41, 69), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, DialogResult = DialogResult.Cancel };
        buttons.Controls.Add(create); buttons.Controls.Add(cancel); layout.Controls.Add(buttons, 0, 6); Controls.Add(layout); AcceptButton = create; CancelButton = cancel;
        create.Click += (_, _) => { if (Title.Length < 3) { DialogResult = DialogResult.None; MessageBox.Show(this, "Digite um título com pelo menos 3 caracteres.", "Título da live", MessageBoxButtons.OK, MessageBoxIcon.Information); } };
    }
}

internal sealed class BroadcastQualityDialog : Form
{
    private readonly ComboBox _resolution = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 230 };
    private readonly ComboBox _fps = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 140 };
    public BroadcastQuality Quality => new(BroadcastQuality.Resolutions[_resolution.SelectedIndex].Width, BroadcastQuality.Resolutions[_resolution.SelectedIndex].Height, _fps.SelectedIndex == 1 ? 60 : 30);

    public BroadcastQualityDialog(BroadcastQuality current)
    {
        Text = "Qualidade da transmissão"; ClientSize = new Size(430, 205); StartPosition = FormStartPosition.CenterParent; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; BackColor = Color.FromArgb(10, 16, 39); Padding = new Padding(20);
        foreach (var size in BroadcastQuality.Resolutions) _resolution.Items.Add($"{size.Height}p ({size.Width} × {size.Height})");
        _resolution.SelectedIndex = Array.FindIndex(BroadcastQuality.Resolutions, size => size.Width == current.Width && size.Height == current.Height);
        if (_resolution.SelectedIndex < 0) _resolution.SelectedIndex = 2;
        _fps.Items.AddRange(new object[] { "30 fps", "60 fps" }); _fps.SelectedIndex = current.Fps == 60 ? 1 : 0;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 5 };
        foreach (var height in new[] { 30, 36, 32, 42, 42 }) layout.RowStyles.Add(new RowStyle(SizeType.Absolute, height));
        layout.Controls.Add(new Label { Text = "Alterar qualidade da live", Dock = DockStyle.Fill, ForeColor = Color.White, Font = new Font("Segoe UI", 13, FontStyle.Bold) }, 0, 0);
        var fields = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false }; fields.Controls.Add(_resolution); fields.Controls.Add(_fps); layout.Controls.Add(fields, 0, 1);
        layout.Controls.Add(new Label { Text = "O player continua aberto. Espectadores recebem um novo quadro assim que a troca termina.", Dock = DockStyle.Fill, ForeColor = Color.FromArgb(148, 163, 184), Font = new Font("Segoe UI", 8.5f) }, 0, 2);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(0, 4, 0, 0) };
        var apply = new Button { Text = "APLICAR", Width = 110, Height = 32, BackColor = Color.FromArgb(124, 58, 237), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancelar", Width = 90, Height = 32, BackColor = Color.FromArgb(30, 41, 69), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, DialogResult = DialogResult.Cancel };
        buttons.Controls.Add(apply); buttons.Controls.Add(cancel); layout.Controls.Add(buttons, 0, 4);
        Controls.Add(layout); AcceptButton = apply; CancelButton = cancel;
    }
}
