using System.Diagnostics;
using System.Net;
using System.Text.RegularExpressions;

namespace LigaZikachu.Transmissor;

internal enum DiscordHostStatus
{
    Offline,
    Preparing,
    StartingTunnel,
    WaitingForHealth,
    Online,
    Stopping,
    Error,
}

internal sealed class DiscordScreenHostManager : IDisposable
{
    private static readonly Regex PublicUrlPattern = new(@"https://[a-z0-9-]+\.trycloudflare\.com", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex AnsiPattern = new(@"\x1B\[[0-?]*[ -/]*[@-~]", RegexOptions.Compiled);
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(4) };
    private readonly List<string> _logs = [];
    private Process? _launcher;
    private CancellationTokenSource? _startupCancellation;
    private bool _ownsProcess;

    public DiscordHostStatus Status { get; private set; } = DiscordHostStatus.Offline;
    public string? PublicUrl { get; private set; }
    public string LocalUrl => "http://127.0.0.1:3001";
    public string? LastError { get; private set; }
    public IReadOnlyList<string> Logs { get { lock (_logs) return _logs.ToArray(); } }

    public event Action? Changed;
    public event Action<string>? LogAdded;

    public async Task StartAsync(string modulePath)
    {
        if (Status is not (DiscordHostStatus.Offline or DiscordHostStatus.Error)) return;
        modulePath = Path.GetFullPath(Environment.ExpandEnvironmentVariables(modulePath.Trim().Trim('"')));
        var entryPoint = Path.Combine(modulePath, "scripts", "start-fast.mjs");
        var envFile = Path.Combine(modulePath, ".env");
        if (!File.Exists(entryPoint))
        {
            Fail("O módulo Discord Screen não está presente neste pacote. Baixe a versão completa do transmissor.");
            return;
        }
        if (!DiscordHostConfiguration.PrepareModule(modulePath))
        {
            Fail("Configure o Client ID e o Client Secret da Activity antes de iniciar.");
            return;
        }

        if (await IsHealthyAsync(LocalUrl))
        {
            _ownsProcess = false;
            PublicUrl = ReadPublicOrigin(envFile);
            if (PublicUrl is null || !await IsHealthyAsync(PublicUrl))
            {
                Fail("Existe um servidor local na porta 3001, mas o endereço público não está disponível. Encerre o host antigo e tente novamente.");
                return;
            }
            SetStatus(DiscordHostStatus.Online);
            AddLog("Servidor existente encontrado; health check local e público confirmados.");
            return;
        }

        var node = ResolveNode(modulePath);
        if (node is null)
        {
            Fail("Node.js não foi encontrado. Para este protótipo, instale o Node ou adicione Runtime/Node/node.exe ao módulo.");
            return;
        }

        LastError = null;
        PublicUrl = null;
        SetStatus(DiscordHostStatus.Preparing);
        AddLog($"Módulo: {modulePath}");
        AddLog($"Runtime: {node}");
        _startupCancellation = new CancellationTokenSource();

        var start = new ProcessStartInfo
        {
            FileName = node,
            WorkingDirectory = modulePath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
        };
        start.ArgumentList.Add(entryPoint);

        _launcher = new Process { StartInfo = start, EnableRaisingEvents = true };
        _launcher.OutputDataReceived += (_, e) => HandleOutput(e.Data);
        _launcher.ErrorDataReceived += (_, e) => HandleOutput(e.Data);
        _launcher.Exited += (_, _) =>
        {
            if (Status == DiscordHostStatus.Stopping) return;
            var code = SafeExitCode(_launcher);
            Fail($"O host foi encerrado inesperadamente (código {code}).");
        };

        try
        {
            if (!_launcher.Start()) throw new InvalidOperationException("O processo não iniciou.");
            _ownsProcess = true;
            _launcher.StandardInput.Close();
            _launcher.BeginOutputReadLine();
            _launcher.BeginErrorReadLine();
            SetStatus(DiscordHostStatus.StartingTunnel);
            await WaitForHealthAsync(_startupCancellation.Token);
        }
        catch (OperationCanceledException) when (_startupCancellation.IsCancellationRequested) { }
        catch (Exception error)
        {
            await StopOwnedProcessAsync();
            Fail(error.Message);
        }
    }

    public async Task StopAsync()
    {
        if (Status == DiscordHostStatus.Offline) return;
        SetStatus(DiscordHostStatus.Stopping);
        _startupCancellation?.Cancel();
        await StopOwnedProcessAsync();
        _ownsProcess = false;
        PublicUrl = null;
        LastError = null;
        SetStatus(DiscordHostStatus.Offline);
        AddLog("Servidor encerrado.");
    }

    public async Task RefreshStatusAsync()
    {
        if (Status is DiscordHostStatus.Preparing or DiscordHostStatus.StartingTunnel or DiscordHostStatus.WaitingForHealth or DiscordHostStatus.Stopping) return;
        var localHealthy = await IsHealthyAsync(LocalUrl);
        PublicUrl ??= DiscordHostConfiguration.LoadPublicOrigin();
        var publicHealthy = PublicUrl is not null && await IsHealthyAsync(PublicUrl);
        if (localHealthy && publicHealthy && Status != DiscordHostStatus.Online) SetStatus(DiscordHostStatus.Online);
        if ((!localHealthy || !publicHealthy) && Status == DiscordHostStatus.Online && !_ownsProcess) { PublicUrl = null; SetStatus(DiscordHostStatus.Offline); }
    }

    private async Task WaitForHealthAsync(CancellationToken cancellation)
    {
        SetStatus(DiscordHostStatus.WaitingForHealth);
        var deadline = DateTimeOffset.UtcNow.AddSeconds(70);
        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellation.ThrowIfCancellationRequested();
            if (_launcher?.HasExited == true) throw new InvalidOperationException("O launcher encerrou antes do health check.");
            if (await IsHealthyAsync(LocalUrl))
            {
                if (PublicUrl is null)
                {
                    await Task.Delay(900, cancellation);
                    continue;
                }
                else
                {
                    var publicDeadline = DateTimeOffset.UtcNow.AddSeconds(20);
                    while (DateTimeOffset.UtcNow < publicDeadline && !await IsHealthyAsync(PublicUrl))
                    {
                        await Task.Delay(1200, cancellation);
                    }
                    if (!await IsHealthyAsync(PublicUrl)) throw new InvalidOperationException("Servidor local iniciou, mas o túnel público não respondeu.");
                }
                SetStatus(DiscordHostStatus.Online);
                AddLog("Health check confirmado. Host online.");
                return;
            }
            await Task.Delay(900, cancellation);
        }
        throw new TimeoutException("O servidor não ficou disponível em até 70 segundos.");
    }

    private async Task<bool> IsHealthyAsync(string baseUrl)
    {
        try
        {
            using var response = await _http.GetAsync(baseUrl.TrimEnd('/') + "/api/health");
            return response.StatusCode == HttpStatusCode.OK;
        }
        catch { return false; }
    }

    private void HandleOutput(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return;
        var line = Sanitize(raw);
        var match = PublicUrlPattern.Match(line);
        if (match.Success && !match.Value.Contains("discordsays.com", StringComparison.OrdinalIgnoreCase))
        {
            PublicUrl = match.Value.TrimEnd('/');
            if (_launcher?.StartInfo.WorkingDirectory is string modulePath) DiscordHostConfiguration.CaptureModuleState(modulePath);
            Changed?.Invoke();
        }
        AddLog(line);
    }

    private void AddLog(string line)
    {
        lock (_logs)
        {
            _logs.Add($"[{DateTime.Now:HH:mm:ss}] {line}");
            if (_logs.Count > 500) _logs.RemoveRange(0, _logs.Count - 500);
        }
        LogAdded?.Invoke(line);
    }

    private static string Sanitize(string input)
    {
        var clean = AnsiPattern.Replace(input, "");
        clean = Regex.Replace(clean, @"(?i)(CLIENT_SECRET|BOT_TOKEN|SESSION_SECRET)\s*[=:]\s*\S+", "$1=[OCULTO]");
        return clean;
    }

    private static string? ResolveNode(string modulePath)
    {
        var candidates = new[]
        {
            Path.Combine(modulePath, "Runtime", "Node", "node.exe"),
            Path.Combine(AppContext.BaseDirectory, "Runtime", "Node", "node.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"),
        };
        return candidates.FirstOrDefault(File.Exists) ?? FindOnPath("node.exe");
    }

    private static string? ReadPublicOrigin(string envFile)
    {
        try
        {
            var value = File.ReadLines(envFile)
                .LastOrDefault(line => line.TrimStart().StartsWith("PUBLIC_ORIGIN=", StringComparison.OrdinalIgnoreCase))?
                .Split('=', 2)[1]
                .Trim()
                .Trim('"', '\'');
            return Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps
                ? uri.GetLeftPart(UriPartial.Authority)
                : null;
        }
        catch { return null; }
    }

    private static string? FindOnPath(string file)
    {
        foreach (var folder in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            try { var candidate = Path.Combine(folder.Trim(), file); if (File.Exists(candidate)) return candidate; } catch { }
        }
        return null;
    }

    private async Task StopOwnedProcessAsync()
    {
        var process = _launcher;
        _launcher = null;
        if (!_ownsProcess || process is null) return;
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(6));
                await process.WaitForExitAsync(timeout.Token).ConfigureAwait(false);
            }
        }
        catch { try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { } }
        finally { process.Dispose(); }
    }

    private void SetStatus(DiscordHostStatus status) { Status = status; Changed?.Invoke(); }
    private void Fail(string message) { LastError = message; SetStatus(DiscordHostStatus.Error); AddLog("ERRO: " + message); }
    private static int SafeExitCode(Process? process) { try { return process?.ExitCode ?? -1; } catch { return -1; } }

    public void Dispose()
    {
        _startupCancellation?.Cancel();
        try { StopOwnedProcessAsync().GetAwaiter().GetResult(); } catch { }
        _startupCancellation?.Dispose();
        _http.Dispose();
    }
}
