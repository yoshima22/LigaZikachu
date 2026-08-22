using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;

namespace LigaZikachu.Transmissor;

internal sealed class TransmitterForm : Form
{
    private static readonly Color Bg = Color.FromArgb(3, 7, 24), Card = Color.FromArgb(10, 16, 39), Muted = Color.FromArgb(148, 163, 184), Yellow = Color.FromArgb(255, 203, 5), Violet = Color.FromArgb(124, 58, 237), Cyan = Color.FromArgb(34, 211, 238);
    private readonly ComboBox _processes = Combo(430), _resolution = Combo(145, ["540p", "720p", "1080p"]), _fps = Combo(145, ["12 fps", "24 fps", "30 fps"]), _quality = Combo(185, ["Nitidez", "Fluidez"]);
    private readonly TextBox _code = new() { Width = 235, CharacterCasing = CharacterCasing.Upper, MaxLength = 11, Font = new Font("Consolas", 17, FontStyle.Bold), BackColor = Color.FromArgb(6, 11, 29), ForeColor = Yellow, BorderStyle = BorderStyle.FixedSingle };
    private readonly TextBox _server = new() { Width = 430, Text = "https://liga-zikachu.vercel.app", BackColor = Color.FromArgb(6, 11, 29), ForeColor = Muted, BorderStyle = BorderStyle.FixedSingle };
    private readonly Label _status = L("", 9, Muted, 485, 60);
    private readonly Button _pair = Button("CONECTAR À ZIKA TV", 235, Violet, Color.White);
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public TransmitterForm()
    {
        Text = "Liga Zikachu — Transmissor Windows"; Width = 1180; Height = 780; MinimumSize = new Size(1080, 720); StartPosition = FormStartPosition.CenterScreen; BackColor = Bg; ForeColor = Color.White; Font = new Font("Segoe UI", 10); DoubleBuffered = true;
        _resolution.SelectedIndex = 1; _fps.SelectedIndex = 2; _quality.SelectedIndex = 0; _pair.Click += async (_, _) => await PairAsync();
        var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(22), BackColor = Bg };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 38)); root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 62)); root.Controls.Add(Intro(), 0, 0); root.Controls.Add(Setup(), 1, 0); Controls.Add(root); LoadProcesses();
    }

    private Control Intro()
    {
        var card = Panel(Color.FromArgb(18, 12, 46));
        var s = Stack(card);
        s.Controls.Add(new LogoBadge()); s.Controls.Add(L("ZIKA TV", 10, Yellow)); s.Controls.Add(L("Transmissor\nWindows", 28, Color.White, 310, 104, FontStyle.Bold));
        s.Controls.Add(L("Áudio do jogo sem levar a conversa do Discord junto.", 11, Color.FromArgb(221, 214, 254), 310, 58)); s.Controls.Add(Gap(8));
        s.Controls.Add(Feature("P2P direto", "Sem egress de vídeo da Liga.")); s.Controls.Add(Feature("Áudio da janela", "Quando o Windows oferecer suporte.")); s.Controls.Add(Feature("Independente do navegador", "Use com Opera, Chrome ou Edge.")); s.Controls.Add(Gap(12));
        s.Controls.Add(L("CENTRAL DA TRANSMISSÃO", 9, Color.FromArgb(196, 181, 253), 310, 24, FontStyle.Bold)); s.Controls.Add(L("Após o pareamento, o programa mantém a live e seus controles ativos enquanto você navega pelo site.", 9, Muted, 310, 65)); return card;
    }

    private Control Setup()
    {
        var card = Panel(Card);
        var s = Stack(card); s.Controls.Add(L("Configure sua transmissão", 21, Color.White, 500, 38, FontStyle.Bold)); s.Controls.Add(L("Abra a Zika TV no site, gere o código e informe aqui.", 10, Muted)); s.Controls.Add(Gap(13));
        s.Controls.Add(Field("1 · JANELA OU JOGO", ProcessRow())); s.Controls.Add(Gap(7)); s.Controls.Add(Field("2 · QUALIDADE P2P", QualityRow()));
        s.Controls.Add(L("Nitidez favorece textos; Fluidez preserva movimento. Qualidade maior exige mais upload e download de cada espectador.", 8, Muted, 500, 40)); s.Controls.Add(Gap(7));
        s.Controls.Add(Field("3 · CÓDIGO DE PAREAMENTO", PairRow())); s.Controls.Add(Gap(9)); s.Controls.Add(_pair); s.Controls.Add(Gap(6)); s.Controls.Add(_status); s.Controls.Add(new AdvancedPanel(_server)); return card;
    }

    private Control ProcessRow() { var r = Row(); r.Controls.Add(_processes); var b = Button("↻ Atualizar", 105, Color.FromArgb(15, 23, 52), Cyan); b.Click += (_, _) => LoadProcesses(); r.Controls.Add(b); return r; }
    private Control QualityRow() { var r = Row(); r.Controls.Add(_resolution); r.Controls.Add(_fps); r.Controls.Add(_quality); return r; }
    private Control PairRow() { var r = Row(); r.Controls.Add(_code); r.Controls.Add(L("Formato: XXXXX-XXXXX\nVálido por 10 minutos", 8, Muted, 180, 44)); return r; }

    private void LoadProcesses()
    {
        var selected = (_processes.SelectedItem as ProcessChoice)?.Id;
        var choices = Process.GetProcesses().Where(p => p.MainWindowHandle != IntPtr.Zero && !string.IsNullOrWhiteSpace(p.MainWindowTitle)).Select(p => new ProcessChoice(p.Id, p.ProcessName, p.MainWindowTitle)).OrderBy(p => p.Title).ToArray();
        _processes.DataSource = choices; if (selected is int id) _processes.SelectedItem = choices.FirstOrDefault(p => p.Id == id); SetStatus($"{choices.Length} janelas encontradas. Discord não é escolhido automaticamente.", Muted);
    }

    private async Task PairAsync()
    {
        if (_processes.SelectedItem is not ProcessChoice process) { SetStatus("⚠ Selecione o jogo.", Color.LightPink); return; }
        var code = new string(_code.Text.Where(Uri.IsHexDigit).ToArray()).ToUpperInvariant(); if (code.Length != 10) { SetStatus("⚠ Digite o código de 10 caracteres mostrado no site.", Color.LightPink); return; }
        _pair.Enabled = false; _pair.Text = "CONECTANDO…"; SetStatus("Validando o código e vinculando o jogo…", Cyan);
        try
        {
            var response = await _http.PostAsJsonAsync(_server.Text.Trim().TrimEnd('/') + "/api/spec/windows-transmitter/pair", new { code, deviceName = Environment.MachineName, processName = process.Name, resolution = _resolution.Text, fps = _fps.Text, quality = _quality.Text });
            var json = await response.Content.ReadAsStringAsync(); if (!response.IsSuccessStatusCode) { SetStatus("⚠ " + (JsonError(json) ?? "Não foi possível parear."), Color.LightPink); return; }
            var result = JsonSerializer.Deserialize<PairResult>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); if (result?.Token is null) { SetStatus("⚠ Resposta inválida.", Color.LightPink); return; }
            CredentialStore.Save(result.StreamId!, result.Token, process.Id, _resolution.Text, _fps.Text, _quality.Text); SetStatus($"✓ PAREADO COM SUCESSO\nAbrindo os controles da transmissão…", Color.FromArgb(110, 231, 183));
            var studio = new BroadcastStudioForm(_server.Text.Trim().TrimEnd('/'), result.StreamId!, result.Token, this);
            studio.Show(); Hide();
        }
        catch (Exception ex) { SetStatus("⚠ Falha de conexão: " + ex.Message, Color.LightPink); }
        finally { _pair.Enabled = true; _pair.Text = "CONECTAR À ZIKA TV"; }
    }

    private void SetStatus(string text, Color color) { _status.Text = text; _status.ForeColor = color; }
    private static string? JsonError(string json) { try { return JsonDocument.Parse(json).RootElement.GetProperty("error").GetString(); } catch { return null; } }
    private static Panel Panel(Color color) => new() { Dock = DockStyle.Fill, Margin = new Padding(8), Padding = new Padding(25), BackColor = color };
    private static FlowLayoutPanel Stack(Control p) { var s = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = false }; p.Controls.Add(s); return s; }
    private static FlowLayoutPanel Row() => new() { AutoSize = true, FlowDirection = FlowDirection.LeftToRight, WrapContents = false };
    private static Control Field(string title, Control child) { var p = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false }; p.Controls.Add(L(title, 8, Color.FromArgb(165, 180, 252), 500, 24, FontStyle.Bold)); p.Controls.Add(child); return p; }
    private static Label L(string text, float size, Color color, int width = 500, int height = 28, FontStyle style = FontStyle.Regular) => new() { Text = text, Width = width, Height = height, Font = new Font("Segoe UI", size, style), ForeColor = color, Margin = new Padding(0, 2, 0, 2) };
    private static Control Gap(int h) => new Panel { Width = 1, Height = h };
    private static ComboBox Combo(int width, string[]? values = null) { var c = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Width = width, BackColor = Color.FromArgb(6, 11, 29), ForeColor = Color.White, FlatStyle = FlatStyle.Flat }; if (values is not null) c.Items.AddRange(values); return c; }
    private static Button Button(string text, int width, Color bg, Color fg) => new() { Text = text, Width = width, Height = 38, BackColor = bg, ForeColor = fg, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9, FontStyle.Bold), Cursor = Cursors.Hand };
    private static Control Feature(string title, string detail) { var p = new Panel { Width = 310, Height = 58, BackColor = Color.FromArgb(27, 20, 60), Margin = new Padding(0, 4, 0, 4) }; p.Controls.Add(new Label { Text = "✓", Left = 12, Top = 12, Width = 22, ForeColor = Yellow, Font = new Font("Segoe UI", 12, FontStyle.Bold) }); p.Controls.Add(new Label { Text = title, Left = 39, Top = 8, Width = 255, ForeColor = Color.White, Font = new Font("Segoe UI", 9, FontStyle.Bold) }); p.Controls.Add(new Label { Text = detail, Left = 39, Top = 30, Width = 255, ForeColor = Muted, Font = new Font("Segoe UI", 8) }); return p; }
    private sealed record ProcessChoice(int Id, string Name, string Title) { public override string ToString() => $"{Title} · {Name}.exe"; }
    private sealed record PairResult(bool Ok, string? StreamId, string? Token);
}

internal sealed class LogoBadge : Control
{
    public LogoBadge() { Width = 68; Height = 68; Margin = new Padding(0, 0, 0, 10); DoubleBuffered = true; }
    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        using var dark = new SolidBrush(Color.FromArgb(2, 6, 23)); using var yellow = new SolidBrush(Color.FromArgb(250, 204, 21)); using var blue = new Pen(Color.FromArgb(96, 165, 250), 4) { StartCap = System.Drawing.Drawing2D.LineCap.Round, EndCap = System.Drawing.Drawing2D.LineCap.Round }; using var line = new Pen(Color.FromArgb(2, 6, 23), 5) { StartCap = System.Drawing.Drawing2D.LineCap.Round, EndCap = System.Drawing.Drawing2D.LineCap.Round };
        e.Graphics.FillRoundedRectangle(dark, new Rectangle(0, 0, 66, 66), 14); e.Graphics.FillEllipse(yellow, 10, 7, 46, 46); e.Graphics.DrawLine(line, 12, 28, 54, 28); e.Graphics.FillEllipse(dark, 26, 20, 16, 16); using var white = new SolidBrush(Color.White); e.Graphics.FillEllipse(white, 31, 25, 6, 6); e.Graphics.DrawArc(blue, 15, 34, 36, 20, 18, 144);
    }
}

internal static class GraphicsExtensions
{
    public static void FillRoundedRectangle(this Graphics graphics, Brush brush, Rectangle bounds, int radius) { using var path = new System.Drawing.Drawing2D.GraphicsPath(); var d = radius * 2; path.AddArc(bounds.X, bounds.Y, d, d, 180, 90); path.AddArc(bounds.Right - d, bounds.Y, d, d, 270, 90); path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90); path.AddArc(bounds.X, bounds.Bottom - d, d, d, 90, 90); path.CloseFigure(); graphics.FillPath(brush, path); }
}

internal sealed class AdvancedPanel : Panel
{
    public AdvancedPanel(Control content) { Width = 500; Height = 34; var b = new Button { Text = "▸ Configuração avançada", Dock = DockStyle.Top, Height = 32, FlatStyle = FlatStyle.Flat, ForeColor = Color.FromArgb(148, 163, 184), TextAlign = ContentAlignment.MiddleLeft }; content.Top = 38; content.Left = 4; content.Visible = false; Controls.Add(content); Controls.Add(b); b.Click += (_, _) => { content.Visible = !content.Visible; Height = content.Visible ? 78 : 34; b.Text = (content.Visible ? "▾ " : "▸ ") + "Configuração avançada"; }; }
}

internal static class CredentialStore
{
    public static void Save(string streamId, string token, int processId, string resolution, string fps, string quality) { var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "Transmissor"); Directory.CreateDirectory(folder); File.WriteAllText(Path.Combine(folder, "session.json"), JsonSerializer.Serialize(new { streamId, token, processId, resolution, fps, quality, savedAt = DateTimeOffset.UtcNow })); }
}
