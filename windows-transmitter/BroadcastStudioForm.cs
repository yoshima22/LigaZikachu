using System.Net.Http.Json;
using Microsoft.Web.WebView2.WinForms;

namespace LigaZikachu.Transmissor;

internal sealed class BroadcastStudioForm : Form
{
    private readonly string _server;
    private readonly string _streamId;
    private readonly string _token;
    private readonly Form _pairingForm;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(8) };
    private bool _closing;

    public BroadcastStudioForm(string server, string streamId, string token, Form pairingForm)
    {
        _server = server; _streamId = streamId; _token = token; _pairingForm = pairingForm;
        Text = "Zika TV — Central da transmissão"; Width = 1240; Height = 820; MinimumSize = new Size(980, 680); StartPosition = FormStartPosition.CenterScreen; BackColor = Color.FromArgb(3, 7, 24);
        var browser = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(3, 7, 24) };
        Controls.Add(browser);
        Shown += async (_, _) => { await browser.EnsureCoreWebView2Async(); browser.CoreWebView2.Settings.AreDevToolsEnabled = false; browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false; browser.Source = new Uri($"{_server}/windows-transmitter#streamId={Uri.EscapeDataString(_streamId)}&token={Uri.EscapeDataString(_token)}"); };
        FormClosing += OnClosing;
    }

    private async void OnClosing(object? sender, FormClosingEventArgs e)
    {
        if (_closing) return;
        _closing = true;
        await _http.PostAsJsonAsync(_server + "/api/spec/windows-transmitter/session", new { streamId = _streamId, token = _token, action = "end" }).catchSilently();
        _pairingForm.Show();
    }
}

internal static class TaskExtensions
{
    public static async Task catchSilently(this Task<HttpResponseMessage> task) { try { using var _ = await task; } catch { } }
}
