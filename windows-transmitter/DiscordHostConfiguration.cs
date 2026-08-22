using System.Security.Cryptography;

namespace LigaZikachu.Transmissor;

internal sealed record DiscordHostSettings(string ClientId, string ClientSecret, string BotToken, string AdminId)
{
    public bool IsConfigured => ClientId.Length is >= 15 and <= 21 && ClientId.All(char.IsDigit) && ClientSecret.Length >= 20;
}

internal static class DiscordHostConfiguration
{
    private static readonly string Folder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "LigaZikachu", "DiscordScreen");
    private static readonly string PersistentEnv = Path.Combine(Folder, "host.env");

    public static DiscordHostSettings Load()
    {
        var values = Read(PersistentEnv);
        return new(
            values.GetValueOrDefault("DISCORD_CLIENT_ID", ""),
            values.GetValueOrDefault("DISCORD_CLIENT_SECRET", ""),
            values.GetValueOrDefault("DISCORD_BOT_TOKEN", ""),
            values.GetValueOrDefault("DISCORD_ADMIN_ID", ""));
    }

    public static string? LoadPublicOrigin()
    {
        var value = Read(PersistentEnv).GetValueOrDefault("PUBLIC_ORIGIN");
        return Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps
            ? uri.GetLeftPart(UriPartial.Authority)
            : null;
    }

    public static void Save(DiscordHostSettings settings)
    {
        Directory.CreateDirectory(Folder);
        var previous = Read(PersistentEnv);
        var session = previous.GetValueOrDefault("SESSION_SECRET");
        if (string.IsNullOrWhiteSpace(session)) session = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        Write(PersistentEnv, settings, session, previous.GetValueOrDefault("PUBLIC_ORIGIN", "http://localhost:3001"));
    }

    public static bool PrepareModule(string modulePath)
    {
        var settings = Load();
        if (!settings.IsConfigured) return false;
        Directory.CreateDirectory(modulePath);
        File.Copy(PersistentEnv, Path.Combine(modulePath, ".env"), true);
        return true;
    }

    public static void CaptureModuleState(string modulePath)
    {
        var moduleEnv = Path.Combine(modulePath, ".env");
        if (!File.Exists(moduleEnv)) return;
        Directory.CreateDirectory(Folder);
        File.Copy(moduleEnv, PersistentEnv, true);
    }

    private static Dictionary<string, string> Read(string path)
    {
        if (!File.Exists(path)) return new(StringComparer.OrdinalIgnoreCase);
        return File.ReadLines(path)
            .Select(line => line.Split('=', 2))
            .Where(parts => parts.Length == 2 && !parts[0].TrimStart().StartsWith('#'))
            .ToDictionary(parts => parts[0].Trim(), parts => parts[1].Trim(), StringComparer.OrdinalIgnoreCase);
    }

    private static void Write(string path, DiscordHostSettings settings, string session, string publicOrigin)
    {
        static string Safe(string value) => value.Replace("\r", "").Replace("\n", "").Trim();
        File.WriteAllLines(path,
        [
            $"SESSION_SECRET={Safe(session)}",
            $"DISCORD_CLIENT_ID={Safe(settings.ClientId)}",
            $"DISCORD_CLIENT_SECRET={Safe(settings.ClientSecret)}",
            $"DISCORD_BOT_TOKEN={Safe(settings.BotToken)}",
            $"DISCORD_ADMIN_ID={Safe(settings.AdminId)}",
            $"PUBLIC_ORIGIN={Safe(publicOrigin)}",
            "PORT=3001",
            "NODE_ENV=development",
            "TUNEL_CONFIG=",
            "TURN_URL=",
            "TURN_USER=",
            "TURN_PASS=",
        ]);
    }
}

internal sealed class DiscordHostConfigurationDialog : Form
{
    private readonly TextBox _clientId = Field(false);
    private readonly TextBox _clientSecret = Field(true);
    private readonly TextBox _botToken = Field(true);
    private readonly TextBox _adminId = Field(false);

    public DiscordHostConfigurationDialog()
    {
        Text = "Configurar Activity do Discord";
        Width = 620; Height = 570; MinimumSize = new Size(580, 530);
        StartPosition = FormStartPosition.CenterParent; BackColor = Color.FromArgb(3, 7, 24); ForeColor = Color.White;
        var current = DiscordHostConfiguration.Load();
        _clientId.Text = current.ClientId; _clientSecret.Text = current.ClientSecret;
        _botToken.Text = current.BotToken; _adminId.Text = current.AdminId;

        var root = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(26), RowCount = 8, ColumnCount = 1, BackColor = BackColor };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 78));
        for (var i = 0; i < 4; i++) root.RowStyles.Add(new RowStyle(SizeType.Absolute, 74));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 58)); root.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); root.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        root.Controls.Add(Label("Credenciais da Activity", 20, true, Color.White, "Configure uma vez. Os dados ficam somente neste computador e nunca entram no download."), 0, 0);
        root.Controls.Add(Input("CLIENT ID", _clientId, "Identificador numérico da aplicação no Discord Developer Portal."), 0, 1);
        root.Controls.Add(Input("CLIENT SECRET", _clientSecret, "Segredo OAuth da aplicação. Não compartilhe este valor."), 0, 2);
        root.Controls.Add(Input("BOT TOKEN · OPCIONAL", _botToken, "Só é necessário para recursos que consultam servidor e canal."), 0, 3);
        root.Controls.Add(Input("SEU ID DO DISCORD · OPCIONAL", _adminId, "Libera o painel administrativo interno da Activity para esta conta."), 0, 4);
        root.Controls.Add(Label("O transmissor cria o endereço público e registra o ponto de entrada da Activity automaticamente ao iniciar.", 9, false, Color.FromArgb(148, 163, 184)), 0, 5);
        var save = new Button { Text = "SALVAR CONFIGURAÇÃO", Dock = DockStyle.Fill, BackColor = Color.FromArgb(124, 58, 237), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 10, FontStyle.Bold) };
        save.Click += (_, _) => Save(); root.Controls.Add(save, 0, 7); Controls.Add(root);
    }

    private void Save()
    {
        var settings = new DiscordHostSettings(_clientId.Text.Trim(), _clientSecret.Text.Trim(), _botToken.Text.Trim(), _adminId.Text.Trim());
        if (!settings.IsConfigured) { MessageBox.Show(this, "Informe um Client ID numérico válido e um Client Secret com pelo menos 20 caracteres.", "Configuração incompleta", MessageBoxButtons.OK, MessageBoxIcon.Warning); return; }
        DiscordHostConfiguration.Save(settings); DialogResult = DialogResult.OK; Close();
    }

    private static Control Input(string title, TextBox field, string help)
    {
        var panel = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1 };
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute, 18)); panel.RowStyles.Add(new RowStyle(SizeType.Absolute, 31)); panel.RowStyles.Add(new RowStyle(SizeType.Absolute, 20));
        panel.Controls.Add(Label(title, 8, true, Color.FromArgb(165, 180, 252)), 0, 0); panel.Controls.Add(field, 0, 1); panel.Controls.Add(Label(help, 8, false, Color.FromArgb(100, 116, 139)), 0, 2); return panel;
    }
    private static TextBox Field(bool password) => new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(6, 11, 29), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle, UseSystemPasswordChar = password };
    private static Label Label(string text, float size, bool bold, Color color, string? detail = null) => new() { Text = detail is null ? text : text + Environment.NewLine + detail, Dock = DockStyle.Fill, ForeColor = color, Font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular) };
}
