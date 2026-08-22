using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;

namespace LigaZikachu.Transmissor;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new TransmitterForm());
    }
}

internal sealed class TransmitterForm : Form
{
    private readonly ComboBox _processes = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 430 };
    private readonly TextBox _code = new() { Width = 210, CharacterCasing = CharacterCasing.Upper, MaxLength = 11, Font = new Font("Consolas", 15, FontStyle.Bold) };
    private readonly TextBox _server = new() { Width = 430, Text = "https://liga-zikachu.vercel.app" };
    private readonly Label _status = new() { AutoSize = false, Width = 500, Height = 55, ForeColor = Color.FromArgb(148, 163, 184) };
    private readonly Button _pair = new() { Text = "Parear com a Zika TV", Width = 210, Height = 38, BackColor = Color.FromArgb(124, 58, 237), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public TransmitterForm()
    {
        Text = "Liga Zikachu — Transmissor Windows Beta";
        Width = 570; Height = 470; MinimumSize = new Size(570, 470);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(2, 6, 23); ForeColor = Color.White;
        Font = new Font("Segoe UI", 10);

        var title = new Label { Text = "⚡ TRANSMISSOR WINDOWS", AutoSize = true, Font = new Font("Segoe UI", 17, FontStyle.Bold), ForeColor = Color.FromArgb(255, 203, 5) };
        var beta = new Label { Text = "BETA FECHADO", AutoSize = true, ForeColor = Color.FromArgb(196, 181, 253) };
        var info = new Label { Text = "Selecione o jogo e digite o código exibido na Zika TV.\nNesta etapa validamos o pareamento e a identificação do processo.", AutoSize = true, ForeColor = Color.FromArgb(203, 213, 225) };
        var refresh = new Button { Text = "Atualizar lista", Width = 120, Height = 30, FlatStyle = FlatStyle.Flat, ForeColor = Color.FromArgb(165, 243, 252) };
        refresh.Click += (_, _) => LoadProcesses();
        _pair.Click += async (_, _) => await PairAsync();

        var panel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(24), AutoScroll = true };
        panel.Controls.Add(title); panel.Controls.Add(beta); panel.Controls.Add(Spacer(6)); panel.Controls.Add(info); panel.Controls.Add(Spacer(10));
        panel.Controls.Add(LabelFor("Servidor da Liga")); panel.Controls.Add(_server); panel.Controls.Add(Spacer(6));
        panel.Controls.Add(LabelFor("Aplicativo/jogo a transmitir")); panel.Controls.Add(_processes); panel.Controls.Add(refresh); panel.Controls.Add(Spacer(6));
        panel.Controls.Add(LabelFor("Código de pareamento")); panel.Controls.Add(_code); panel.Controls.Add(_pair); panel.Controls.Add(Spacer(4)); panel.Controls.Add(_status);
        Controls.Add(panel);
        LoadProcesses();
    }

    private static Control Spacer(int height) => new Panel { Width = 1, Height = height };
    private static Label LabelFor(string text) => new() { Text = text, AutoSize = true, Font = new Font("Segoe UI", 9, FontStyle.Bold), ForeColor = Color.FromArgb(148, 163, 184) };

    private void LoadProcesses()
    {
        var selected = (_processes.SelectedItem as ProcessChoice)?.Id;
        var choices = Process.GetProcesses().Where(p => p.MainWindowHandle != IntPtr.Zero && !string.IsNullOrWhiteSpace(p.MainWindowTitle))
            .Select(p => new ProcessChoice(p.Id, p.ProcessName, p.MainWindowTitle)).OrderBy(p => p.Title).ToArray();
        _processes.DataSource = choices;
        if (selected is int id) _processes.SelectedItem = choices.FirstOrDefault(p => p.Id == id);
        _status.Text = $"{choices.Length} janelas encontradas. Discord não é selecionado automaticamente.";
    }

    private async Task PairAsync()
    {
        if (_processes.SelectedItem is not ProcessChoice process) { _status.Text = "Selecione o jogo."; return; }
        var code = new string(_code.Text.Where(Uri.IsHexDigit).ToArray()).ToUpperInvariant();
        if (code.Length != 10) { _status.Text = "Digite o código de 10 caracteres mostrado no site."; return; }
        _pair.Enabled = false; _status.Text = "Conectando com segurança…";
        try
        {
            var endpoint = _server.Text.Trim().TrimEnd('/') + "/api/spec/windows-transmitter/pair";
            var response = await _http.PostAsJsonAsync(endpoint, new { code, deviceName = Environment.MachineName, processName = process.Name });
            var json = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode) { _status.Text = JsonError(json) ?? "Não foi possível parear."; return; }
            var result = JsonSerializer.Deserialize<PairResult>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (result is null || string.IsNullOrWhiteSpace(result.Token)) { _status.Text = "Resposta de pareamento inválida."; return; }
            CredentialStore.Save(result.StreamId!, result.Token, process.Id);
            _status.ForeColor = Color.FromArgb(110, 231, 183);
            _status.Text = $"✓ Pareado com sucesso · {process.Title}\nA captura nativa será habilitada na próxima etapa deste Beta.";
        }
        catch (Exception ex) { _status.Text = "Falha de conexão: " + ex.Message; }
        finally { _pair.Enabled = true; }
    }

    private static string? JsonError(string json) { try { return JsonDocument.Parse(json).RootElement.GetProperty("error").GetString(); } catch { return null; } }
    private sealed record ProcessChoice(int Id, string Name, string Title) { public override string ToString() => $"{Title} · {Name}.exe"; }
    private sealed record PairResult(bool Ok, string? StreamId, string? Token);
}

internal static class CredentialStore
{
    public static void Save(string streamId, string token, int processId)
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "Transmissor");
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, "session.json"), JsonSerializer.Serialize(new { streamId, token, processId, savedAt = DateTimeOffset.UtcNow }));
    }
}
