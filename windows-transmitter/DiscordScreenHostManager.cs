using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
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
    private readonly HttpClient _http = new(PublicDns.CreateHandler()) { Timeout = TimeSpan.FromSeconds(8) };
    private readonly List<string> _logs = [];
    private Process? _launcher;
    private CancellationTokenSource? _startupCancellation;
    private bool _ownsProcess;
    private bool _suppressUnexpectedExit;
    private bool _tunnelRegistered;

    public DiscordHostStatus Status { get; private set; } = DiscordHostStatus.Offline;

    /// <summary>Falso quando o servidor no ar foi aberto por fora deste painel.</summary>
    public bool OwnsProcess => _ownsProcess;
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
        // Procurar servidor de pé antes de escrever qualquer coisa.
        //
        // O PrepareModule copia as credenciais guardadas por cima do .env do
        // módulo, e o PUBLIC_ORIGIN vai junto. Quando alguém já subiu o servidor
        // por fora — pelo PowerShell, ou por outra janela deste programa — o
        // endereço vivo é o que está naquele arquivo, e sobrescrevê-lo trocava
        // por um endereço morto de alguma execução anterior. O servidor
        // continuava no ar, porque leu o env no arranque; quem passava a mentir
        // era o painel, mostrando para colar no portal um Target que não é o
        // dele. Ou seja: exatamente o passo que faz a Activity abrir em branco.
        if (await IsHealthyAsync(LocalUrl))
        {
            AdoptExistingServer(envFile);
            if (PublicUrl is not null && !await IsHealthyAsync(PublicUrl)) WarnAboutUnconfirmedPublicUrl(PublicUrl);
            return;
        }

        // Porta ocupada sem responder ao health check: é servidor subindo agora,
        // ou travado. Nos dois casos, subir outro por cima só produz um processo
        // que morre com "porta em uso" — e o log diria que este host caiu
        // sozinho, escondendo que quem estava lá primeiro continua de pé.
        if (IsLocalPortBusy())
        {
            Fail("A porta 3001 já está ocupada neste computador. O servidor da Activity está subindo agora ou já está aberto por outra janela — não vou iniciar outro por cima. Espere alguns segundos e tente de novo.");
            return;
        }

        if (!DiscordHostConfiguration.PrepareModule(modulePath))
        {
            Fail("Configure o Client ID e o Client Secret da Activity antes de iniciar.");
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
        _tunnelRegistered = false;
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
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        start.ArgumentList.Add(entryPoint);

        _launcher = new Process { StartInfo = start, EnableRaisingEvents = true };
        _launcher.OutputDataReceived += (_, e) => HandleOutput(e.Data);
        _launcher.ErrorDataReceived += (_, e) => HandleOutput(e.Data);
        _launcher.Exited += (_, _) =>
        {
            if (Status == DiscordHostStatus.Stopping || _suppressUnexpectedExit) return;
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

        // Só derruba o que este painel subiu. O servidor de outra janela fica
        // exatamente onde estava — o painel apenas para de acompanhá-lo.
        if (!_ownsProcess)
        {
            AddLog("Este painel não iniciou esse servidor, então deixei ele rodando. Para encerrá-lo, use a janela que o abriu.");
            return;
        }

        SetStatus(DiscordHostStatus.Stopping);
        _startupCancellation?.Cancel();
        await StopOwnedProcessAsync();
        _ownsProcess = false;
        PublicUrl = null;
        LastError = null;
        SetStatus(DiscordHostStatus.Offline);
        AddLog("Servidor encerrado.");
    }

    /// <summary>
    /// Reconhece um servidor que já estava no ar em vez de subir outro por cima.
    /// </summary>
    /// <remarks>
    /// O endereço vem do .env do módulo, e não da configuração guardada: quem
    /// está de pé leu aquele arquivo no arranque, então é ele que diz qual
    /// Target está valendo no portal agora. A configuração guardada é a desta
    /// janela, e a desta janela não subiu nada.
    /// </remarks>
    private void AdoptExistingServer(string envFile)
    {
        _ownsProcess = false;
        PublicUrl = ReadPublicOrigin(envFile) ?? DiscordHostConfiguration.LoadPublicOrigin();
        SetStatus(DiscordHostStatus.Online);
        AddLog("Já havia um servidor no ar na porta 3001 — este painel adotou o que encontrou, sem subir outro.");
        AddLog(PublicUrl is null
            ? "Esse servidor não registrou endereço público no .env do módulo. Confira o Target direto na janela que o abriu."
            : $"Endereço público em uso por ele: {PublicUrl}");
    }

    public async Task RefreshStatusAsync(string modulePath)
    {
        if (Status is DiscordHostStatus.Preparing or DiscordHostStatus.StartingTunnel or DiscordHostStatus.WaitingForHealth or DiscordHostStatus.Stopping) return;
        var localHealthy = await IsHealthyAsync(LocalUrl);

        // Servidor que apareceu sem ser por aqui: alguém o abriu enquanto esta
        // janela estava parada. Mostrar Online é o que impede a pessoa de clicar
        // em iniciar e derrubar — ou tentar derrubar — o de quem chegou antes.
        if (localHealthy && Status is DiscordHostStatus.Offline or DiscordHostStatus.Error)
        {
            AdoptExistingServer(Path.Combine(modulePath, ".env"));
            return;
        }

        PublicUrl ??= ReadPublicOrigin(Path.Combine(modulePath, ".env")) ?? DiscordHostConfiguration.LoadPublicOrigin();
        var publicHealthy = PublicUrl is not null && await IsHealthyAsync(PublicUrl);
        if (localHealthy && publicHealthy && Status != DiscordHostStatus.Online) SetStatus(DiscordHostStatus.Online);
        if (!localHealthy && Status == DiscordHostStatus.Online && !_ownsProcess) { PublicUrl = null; SetStatus(DiscordHostStatus.Offline); }
    }

    /// <summary>
    /// Alguém escutando na 3001, mesmo que ainda não responda ao health check.
    /// </summary>
    private static bool IsLocalPortBusy()
    {
        try
        {
            return System.Net.NetworkInformation.IPGlobalProperties.GetIPGlobalProperties()
                .GetActiveTcpListeners()
                .Any(listener => listener.Port == 3001);
        }
        catch { return false; }
    }

    private async Task WaitForHealthAsync(CancellationToken cancellation)
    {
        SetStatus(DiscordHostStatus.WaitingForHealth);
        var deadline = DateTimeOffset.UtcNow.AddSeconds(70);
        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellation.ThrowIfCancellationRequested();
            if (_launcher?.HasExited == true) throw new InvalidOperationException("O launcher encerrou antes do health check.");
            if (!await IsHealthyAsync(LocalUrl))
            {
                await Task.Delay(900, cancellation);
                continue;
            }

            // O endereço público sai na saída do launcher alguns segundos depois
            // do servidor local. Quando o túnel falha, o start-fast sobe o
            // servidor assim mesmo e o endereço nunca aparece — por isso esperar
            // o prazo inteiro antes de concluir que este host só vale local.
            if (PublicUrl is null)
            {
                await Task.Delay(900, cancellation);
                continue;
            }

            await ConfirmPublicUrlAsync(PublicUrl, cancellation);
            SetStatus(DiscordHostStatus.Online);
            return;
        }

        // Servidor de pé e nenhum endereço público em 70 segundos: quem não subiu
        // foi o túnel. Fora do Discord tudo funciona, então isto é aviso, não erro.
        if (await IsHealthyAsync(LocalUrl))
        {
            SetStatus(DiscordHostStatus.Online);
            AddLog($"Aviso: o túnel não anunciou nenhum endereço público. O servidor responde em {LocalUrl}, mas o Discord não alcança este computador enquanto for assim.");
            AddLog("Encerre e inicie de novo para tentar outro túnel.");
            return;
        }

        throw new TimeoutException("O servidor não ficou disponível em até 70 segundos.");
    }

    /// <summary>
    /// Confirma, deste computador, que o endereço público responde — e nunca
    /// derruba o arranque quando não consegue.
    /// </summary>
    /// <remarks>
    /// O endereço de um túnel rápido nasce na hora, e o registro de DNS dele leva
    /// alguns segundos para aparecer. Perguntar antes da hora ensina o resolvedor
    /// da rede local a responder "não existe", e muito roteador doméstico guarda
    /// essa negativa por minutos. Era esse o mecanismo por trás do erro "o
    /// endereço público não respondeu após 90 segundos": o túnel estava de pé e o
    /// Discord chegava nele normalmente; só este computador não resolvia o nome.
    ///
    /// Daí as duas defesas: esperar antes da primeira pergunta, para não envenenar
    /// o cache; e resolver por DNS-over-HTTPS quando o resolvedor da casa negar o
    /// nome (ver <see cref="PublicDns"/>). Falhar o arranque por causa disto era
    /// punir o host por um problema que não é dele.
    /// </remarks>
    private async Task ConfirmPublicUrlAsync(string url, CancellationToken cancellation)
    {
        AddLog("Servidor local pronto. Aguardando a propagação do endereço público do Cloudflare…");
        await Task.Delay(TimeSpan.FromSeconds(12), cancellation);

        var deadline = DateTimeOffset.UtcNow.AddSeconds(60);
        while (true)
        {
            if (await IsHealthyAsync(url))
            {
                AddLog("Health check confirmado. Host online.");
                return;
            }
            if (DateTimeOffset.UtcNow >= deadline) break;
            await Task.Delay(2500, cancellation);
        }

        WarnAboutUnconfirmedPublicUrl(url);
    }

    private void WarnAboutUnconfirmedPublicUrl(string url)
    {
        AddLog("Aviso: não consegui confirmar o endereço público a partir deste computador.");
        AddLog(_tunnelRegistered
            ? "O túnel está registrado na Cloudflare, então o Discord alcança este servidor mesmo assim."
            : "O túnel ainda não confirmou o registro na Cloudflare — se a Activity não abrir, encerre e inicie de novo.");
        AddLog($"Quase sempre é o DNS da sua rede guardando a resposta \"não existe\" de quando {url} ainda não tinha nascido. Ele se corrige sozinho em alguns minutos, ou na hora se o DNS deste computador apontar para 1.1.1.1.");
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
        // A única prova de que o túnel está mesmo servindo, e ela vem do
        // cloudflared: ao contrário do health check, não passa pelo DNS daqui.
        if (line.Contains("Registered tunnel connection", StringComparison.OrdinalIgnoreCase)) _tunnelRegistered = true;
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
        _suppressUnexpectedExit = true;
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
        finally
        {
            process.Dispose();
            _suppressUnexpectedExit = false;
        }
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

/// <summary>
/// Resolução de nomes que não depende do resolvedor configurado na máquina.
/// </summary>
/// <remarks>
/// O endereço de um túnel rápido é um nome que passou a existir há segundos.
/// Muito roteador doméstico responde "não existe" para ele e guarda essa resposta
/// por minutos — e nesse intervalo o host fica inalcançável daqui, embora esteja
/// no ar para o resto do mundo. Quando o resolvedor da casa nega o nome, esta
/// classe pergunta de novo por DNS-over-HTTPS, direto para 1.1.1.1 e 8.8.8.8.
///
/// Os dois são IP literal de propósito: um servidor de DNS que precisasse de DNS
/// para ser encontrado não seria saída para este problema. O certificado dos dois
/// cobre o próprio IP, então o TLS continua verificado como em qualquer pedido.
/// </remarks>
internal static class PublicDns
{
    private static readonly string[] Endpoints = ["https://1.1.1.1/dns-query", "https://8.8.8.8/resolve"];
    private static readonly HttpClient Resolver = new() { Timeout = TimeSpan.FromSeconds(5) };
    private static readonly Dictionary<string, (IPAddress[] Addresses, DateTimeOffset Expires)> Cache = new(StringComparer.OrdinalIgnoreCase);

    public static SocketsHttpHandler CreateHandler() => new()
    {
        ConnectTimeout = TimeSpan.FromSeconds(6),
        PooledConnectionLifetime = TimeSpan.FromMinutes(2),
        ConnectCallback = ConnectAsync,
    };

    private static async ValueTask<Stream> ConnectAsync(SocketsHttpConnectionContext context, CancellationToken cancellation)
    {
        var endpoint = context.DnsEndPoint;
        Exception? last = null;
        foreach (var address in await ResolveAsync(endpoint.Host, cancellation))
        {
            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(address, endpoint.Port, cancellation);
                // Sem TLS aqui: quem negocia é o próprio handler, com o nome do
                // pedido no SNI. Trocar o nome pelo IP quebraria a verificação do
                // certificado — e é justamente ela que este caminho preserva.
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch (Exception error)
            {
                socket.Dispose();
                last = error;
            }
        }
        throw last ?? new SocketException((int)SocketError.HostNotFound);
    }

    private static async Task<IReadOnlyList<IPAddress>> ResolveAsync(string host, CancellationToken cancellation)
    {
        if (IPAddress.TryParse(host, out var literal)) return [literal];
        try
        {
            var addresses = await Dns.GetHostAddressesAsync(host, cancellation);
            if (addresses.Length > 0) return addresses;
        }
        catch (SocketException) { }
        return await ResolveOverHttpsAsync(host, cancellation);
    }

    private static async Task<IReadOnlyList<IPAddress>> ResolveOverHttpsAsync(string host, CancellationToken cancellation)
    {
        lock (Cache)
        {
            if (Cache.TryGetValue(host, out var hit) && hit.Expires > DateTimeOffset.UtcNow) return hit.Addresses;
        }

        foreach (var endpoint in Endpoints)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, $"{endpoint}?name={Uri.EscapeDataString(host)}&type=A");
                request.Headers.Accept.ParseAdd("application/dns-json");
                using var response = await Resolver.SendAsync(request, cancellation);
                if (!response.IsSuccessStatusCode) continue;

                using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
                if (!payload.RootElement.TryGetProperty("Answer", out var answers)) continue;

                // type 1 é o registro A; o resto da resposta são os CNAME do
                // caminho, que não dão endereço para conectar.
                var addresses = answers.EnumerateArray()
                    .Where(answer => answer.TryGetProperty("type", out var type) && type.GetInt32() == 1)
                    .Select(answer => answer.TryGetProperty("data", out var data) ? data.GetString() : null)
                    .Select(data => IPAddress.TryParse(data, out var address) ? address : null)
                    .OfType<IPAddress>()
                    .ToArray();
                if (addresses.Length == 0) continue;

                lock (Cache) Cache[host] = (addresses, DateTimeOffset.UtcNow.AddMinutes(5));
                return addresses;
            }
            catch { }
        }
        return [];
    }
}
