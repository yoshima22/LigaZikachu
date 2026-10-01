using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;
using SIPSorcery.Net;
using SIPSorceryMedia.Abstractions;
using System.Text.Json;
using System.Collections.Concurrent;
using SIPSorceryMedia.Encoders;
using System.Net.Http.Json;

namespace LigaZikachu.Transmissor;

// End-to-end local diagnostic: generated media only, no account or external live.
internal sealed class NativeSelfTestForm : Form
{
    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
    private readonly WebView2 _source = new() { Dock = DockStyle.Fill };
    private readonly WebView2 _other = new() { Dock = DockStyle.Right, Width = 220 };
    private readonly BroadcastQuality _quality;
    public NativeSelfTestForm(BroadcastQuality quality)
    {
        _quality = quality;
        Text = "Zika TV · Teste nativo automático"; Width = 1000; Height = 640;
        Controls.Add(_source); Controls.Add(_other);
        Controls.Add(new Panel { Dock = DockStyle.Top, Height = 60, BackColor = Color.Magenta });
        Shown += async (_, _) => await RunAsync();
    }

    private async Task RunAsync()
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "ZikaTV", "Diagnostics");
        Directory.CreateDirectory(folder);
        var report = new Dictionary<string, object?>();
        try
        {
            ShowWindow(Handle, 5);
            await InitAsync(_source, 440); await InitAsync(_other, 1400);
            await using var audio = new NativeAudioStream();
            report["quality"] = _quality;
            await using var video = new NativeVideoStream(_quality);
            using var sender = new NativeBroadcastPeer();
            using var receiver = new RTCPeerConnection();
            using var decoder = new VpxVideoEncoder();
            receiver.addTrack(new MediaStreamTrack(new List<AudioFormat> { new(111, "opus", 48000, 2, "stereo=1") }, MediaStreamStatusEnum.RecvOnly));
            receiver.addTrack(new MediaStreamTrack(new List<VideoFormat> { new(VideoCodecsEnum.VP8, 96, 90000) }, MediaStreamStatusEnum.RecvOnly));
            int audioPackets = 0, videoFrames = 0, captured = 0;
            var pcm = new ConcurrentQueue<short[]>();
            receiver.OnRtpPacketReceived += (_, kind, _) => { if (kind == SDPMediaTypesEnum.audio) Interlocked.Increment(ref audioPackets); };
            var decoded = new ConcurrentQueue<int>();
            int magenta = 0, receivedWidth = 0, receivedHeight = 0;
            receiver.OnVideoFrameReceived += (_, _, frame, _) =>
            {
                Interlocked.Increment(ref videoFrames);
                foreach (var image in decoder.DecodeVideo(frame, VideoPixelFormatsEnum.Bgr, VideoCodecsEnum.VP8))
                {
                    receivedWidth = (int)image.Width; receivedHeight = (int)image.Height;
                    var hash = new HashCode();
                    for (var i = 0; i < image.Sample.Length; i += 3)
                    {
                        hash.Add(image.Sample[i]);
                        if (image.Sample[i] > 170 && image.Sample[i + 1] < 80 && image.Sample[i + 2] > 170) Interlocked.Increment(ref magenta);
                    }
                    decoded.Enqueue(hash.ToHashCode());
                }
            };
            audio.Samples += samples => { if (pcm.Count < 200) pcm.Enqueue(samples); Interlocked.Increment(ref captured); sender.SendPcm(samples); };
            video.Frame += sender.SendVp8;
            var errors = new ConcurrentQueue<string>(); audio.Failed += errors.Enqueue; video.Failed += errors.Enqueue;
            receiver.setRemoteDescription(new RTCSessionDescriptionInit { type = RTCSdpType.offer, sdp = await sender.CreateOfferAsync(CancellationToken.None) });
            var answer = receiver.createAnswer(); await receiver.setLocalDescription(answer);
            await Task.Delay(1500);
            sender.AcceptAnswer(receiver.localDescription.sdp.ToString());
            await video.StartAsync(Handle, _source.Handle, CancellationToken.None);
            await audio.StartAsync(_source.CoreWebView2.BrowserProcessId, CancellationToken.None);
            await Task.Delay(6500);
            var beforePark = videoFrames;
            Location = new Point(-20000, 0);
            await Task.Delay(3500);
            report["framesWhileParked"] = videoFrames - beforePark;
            report["decodedDistinctFrames"] = decoded.Distinct().Count();
            report["toolbarMagentaPixels"] = magenta;
            var initialMagenta = magenta;
            report["audioPacketsReceived"] = audioPackets; report["videoFramesReceived"] = videoFrames;
            report["receivedWidth"] = receivedWidth; report["receivedHeight"] = receivedHeight;
            var initialReceivedWidth = receivedWidth;
            var initialReceivedHeight = receivedHeight;
            report["measuredFps"] = Math.Round((videoFrames - beforePark) / 3.5, 1);
            report["capturedPcmBlocks"] = captured;
            var samples = pcm.SelectMany(x => x.Where((_, i) => i % 2 == 0)).ToArray();
            double Power(double frequency)
            {
                double re = 0, im = 0;
                for (int i = 0; i < samples.Length; i++) { var phase = 2 * Math.PI * frequency * i / 48000; re += samples[i] * Math.Cos(phase); im += samples[i] * Math.Sin(phase); }
                return Math.Sqrt(re * re + im * im) / Math.Max(1, samples.Length);
            }
            var wanted = Power(440); var excluded = Power(1400);
            report["wantedTone440"] = wanted; report["excludedTone1400"] = excluded;
            report["errors"] = errors.ToArray();
            using var signalling = new SignalHandler();
            await using var session = new NativeBroadcastSession("https://test.invalid", "local", "local", signalling);
            audio.Samples += session.SendAudio; video.Frame += session.SendVideo;
            session.ViewerConnected += video.RequestKeyframe;
            var browserReport = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            _other.CoreWebView2.WebMessageReceived += (_, message) =>
            {
                var data = JsonDocument.Parse(message.WebMessageAsJson).RootElement.Clone();
                if (data.TryGetProperty("answer", out var sdp)) signalling.Answer = sdp.GetString();
                else browserReport.TrySetResult(data);
            };
            var receiverLoaded = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            _other.NavigationCompleted += (_, _) => receiverLoaded.TrySetResult();
            _other.NavigateToString("<html><body><video id='v' autoplay muted playsinline></video><script>window.receive=async(sdp)=>{try {window.pc=new RTCPeerConnection();const remote=new MediaStream();pc.ontrack=e=>{remote.addTrack(e.track);document.getElementById('v').srcObject=remote};await pc.setRemoteDescription({type:'offer',sdp});await pc.setLocalDescription(await pc.createAnswer());await new Promise(r=>{if(pc.iceGatheringState==='complete')return r();pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete')r()};setTimeout(r,3000)});chrome.webview.postMessage({answer:pc.localDescription.sdp});setTimeout(async()=>{let video=0,audio=0,energy=0;for(const s of (await pc.getStats()).values()){if(s.type==='inbound-rtp'){if(s.kind==='video')video=s.framesDecoded||0;if(s.kind==='audio'){audio=s.packetsReceived||0;energy=s.totalAudioEnergy||0}}}chrome.webview.postMessage({video,audio,energy,state:pc.connectionState})},6500)}catch(e){chrome.webview.postMessage({error:String(e)})}}</script></body></html>");
            await receiverLoaded.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await _other.ExecuteScriptAsync("document.getElementById('v').muted=false;document.getElementById('v').volume=0.05;");
            await session.StartAsync(CancellationToken.None, _quality);
            var browserOffer = await signalling.Offer.Task.WaitAsync(TimeSpan.FromSeconds(15));
            await _other.ExecuteScriptAsync("window.receive(" + JsonSerializer.Serialize(browserOffer) + ")");
            var browserStats = await browserReport.Task.WaitAsync(TimeSpan.FromSeconds(20));
            report["browserReceiver"] = browserStats;
            session.SetPaused(true); video.SetPaused(true);
            await Task.Delay(1800);
            var pausedStart = await ProbeBrowserAsync();
            await Task.Delay(2200);
            var pausedEnd = await ProbeBrowserAsync();
            video.SetPaused(false); session.SetPaused(false);
            await Task.Delay(2500);
            var resumed = await ProbeBrowserAsync();
            var pausedEnergy = pausedEnd.GetProperty("energy").GetDouble() - pausedStart.GetProperty("energy").GetDouble();
            var resumedEnergy = resumed.GetProperty("energy").GetDouble() - pausedEnd.GetProperty("energy").GetDouble();
            report["pausedAudioEnergyDelta"] = pausedEnergy;
            report["resumedAudioEnergyDelta"] = resumedEnergy;
            report["pausedDarkPixelsRatio"] = pausedEnd.GetProperty("darkRatio").GetDouble();
            report["resumedDarkPixelsRatio"] = resumed.GetProperty("darkRatio").GetDouble();
            var pausePassed = pausedEnergy < 0.00000001 && resumedEnergy > 0.00000001 && pausedEnd.GetProperty("darkRatio").GetDouble() > .85 && resumed.GetProperty("darkRatio").GetDouble() < .85;
            report["pauseResumePassed"] = pausePassed;
            // Mirror an in-flight quality change: validate a new WGC/VP8 source
            // before detaching the existing one, then prove the receiver sees
            // the new dimensions without renegotiating WebRTC.
            var switchedQuality = _quality.Height >= 720 ? new BroadcastQuality(854, 480, 30) : new BroadcastQuality(1280, 720, 30);
            await using var switchedVideo = new NativeVideoStream(switchedQuality);
            await switchedVideo.StartAsync(Handle, _source.Handle, CancellationToken.None);
            switchedVideo.Frame += sender.SendVp8;
            switchedVideo.Frame += session.SendVideo;
            switchedVideo.Failed += errors.Enqueue;
            switchedVideo.RequestKeyframe();
            session.ViewerConnected -= video.RequestKeyframe;
            session.ViewerConnected += switchedVideo.RequestKeyframe;
            video.Frame -= sender.SendVp8;
            video.Frame -= session.SendVideo;
            await Task.Delay(3000);
            var qualityChanged = await ProbeBrowserAsync();
            var qualityPassed = qualityChanged.GetProperty("videoWidth").GetInt32() == switchedQuality.Width && qualityChanged.GetProperty("videoHeight").GetInt32() == switchedQuality.Height;
            report["qualityChangeTarget"] = switchedQuality;
            report["qualityChangeReceiver"] = qualityChanged;
            report["qualityChangePassed"] = qualityPassed;
            await session.DisposeAsync();
            report["sessionEnded"] = signalling.Ended;
            var checks = new Dictionary<string, bool>
            {
                ["quality"] = qualityPassed, ["pause"] = pausePassed,
                ["initialDimensions"] = initialReceivedWidth == _quality.Width && initialReceivedHeight == _quality.Height,
                ["audio"] = audioPackets > 50, ["video"] = videoFrames > 10,
                ["toneIsolation"] = wanted > 20 && excluded < wanted * .05,
                ["captureErrors"] = errors.IsEmpty, ["parked"] = videoFrames - beforePark > 5,
                ["movement"] = decoded.Distinct().Count() > 10, ["noToolbar"] = initialMagenta == 0,
                ["browserVideo"] = browserStats.TryGetProperty("video", out var browserFrames) && browserFrames.GetInt32() > 5,
                ["browserAudio"] = browserStats.GetProperty("energy").GetDouble() > 0,
                ["ended"] = signalling.Ended,
            };
            report["checks"] = checks;
            report["errorsFinal"] = errors.ToArray();
            report["passed"] = checks.Values.All(value => value);
        }
        catch (Exception ex) { report["passed"] = false; report["exception"] = ex.ToString(); }
        await File.WriteAllTextAsync(Path.Combine(folder, "native-self-test.json"), JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        Close();
    }

    private async Task<JsonElement> ProbeBrowserAsync()
    {
        var result = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            var data = JsonDocument.Parse(e.WebMessageAsJson).RootElement.Clone();
            if (data.TryGetProperty("probe", out _)) result.TrySetResult(data);
        }
        _other.CoreWebView2.WebMessageReceived += OnMessage;
        try
        {
            await _other.ExecuteScriptAsync("(async()=>{let energy=0;for(const s of (await pc.getStats()).values())if(s.type==='inbound-rtp'&&s.kind==='audio')energy=s.totalAudioEnergy||0;let v=document.getElementById('v'),c=document.createElement('canvas');c.width=160;c.height=90;let x=c.getContext('2d');x.drawImage(v,0,0,160,90);let p=x.getImageData(0,0,160,90).data,dark=0;for(let i=0;i<p.length;i+=4)if(p[i]<55&&p[i+1]<55&&p[i+2]<65)dark++;chrome.webview.postMessage({probe:true,energy,darkRatio:dark/(160*90),videoWidth:v.videoWidth,videoHeight:v.videoHeight})})()");
            return await result.Task.WaitAsync(TimeSpan.FromSeconds(5));
        }
        finally { _other.CoreWebView2.WebMessageReceived -= OnMessage; }
    }

    private sealed class SignalHandler : HttpMessageHandler
    {
        public TaskCompletionSource<string> Offer { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public string? Answer;
        public bool Ended;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = await request.Content!.ReadFromJsonAsync<JsonElement>(cancellationToken);
            var action = body.GetProperty("action").GetString();
            object response = new { ok = true, status = "LIVE" };
            if (action == "signal") Offer.TrySetResult(body.GetProperty("payload").GetProperty("sdp").GetString()!);
            if (action == "end") Ended = true;
            if (action == "poll")
            {
                var cursor = body.GetProperty("cursor").GetInt64();
                var signals = new List<object>();
                if (cursor == 0) signals.Add(new { seq = 1, kind = "JOIN", fromUserId = "browser", payload = new { } });
                if (cursor < 2 && Answer != null) signals.Add(new { seq = 2, kind = "ANSWER", fromUserId = "browser", payload = new { sdp = Answer } });
                response = new { ok = true, cursor, signals };
            }
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = JsonContent.Create(response) };
        }
    }

    private static async Task InitAsync(WebView2 browser, int tone)
    {
        var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LigaZikachu", "ZikaTV", "Diagnostics", "Browser-" + tone);
        // Exercise the same software-rendered source-browser configuration used
        // by an actual player, while retaining autoplay only for this diagnostic.
        var env = await CoreWebView2Environment.CreateAsync(userDataFolder: path, options: new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required " + BrowserProfile.PlayerBrowserArguments));
        await browser.EnsureCoreWebView2Async(env);
        var loaded = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        browser.NavigationCompleted += (_, _) => loaded.TrySetResult();
        browser.NavigateToString("<html><body style='margin:0;background:#0044aa'><canvas id='c'></canvas><script>let a=new AudioContext(),o=a.createOscillator(),g=a.createGain();o.frequency.value=" + tone + ";g.gain.value=.08;o.connect(g).connect(a.destination);o.start();a.resume();let c=document.getElementById('c');c.width=640;c.height=352;let x=c.getContext('2d'),t=0;setInterval(()=>{x.fillStyle='#0044aa';x.fillRect(0,0,640,352);x.fillStyle='lime';x.fillRect((t++*12)%600,60,40,220)},16);</script></body></html>");
        await loaded.Task.WaitAsync(TimeSpan.FromSeconds(15));
    }
}
