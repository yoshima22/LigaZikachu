using Concentus;
using Concentus.Enums;
using SIPSorcery.Net;
using SIPSorceryMedia.Abstractions;

namespace LigaZikachu.Transmissor;

/// <summary>A send-only peer. Media comes from native capture, never getDisplayMedia.</summary>
internal sealed class NativeBroadcastPeer : IDisposable
{
    private readonly RTCPeerConnection _peer;
    private readonly IOpusEncoder _opus = OpusCodecFactory.CreateEncoder(48000, 2, OpusApplication.OPUS_APPLICATION_AUDIO);
    private readonly object _mediaLock = new();
    private bool _disposed;
    public event Action<string>? StateChanged;

    public NativeBroadcastPeer()
    {
        _opus.Bitrate = 128000;
        _peer = new RTCPeerConnection(new RTCConfiguration
        {
            iceServers = new List<RTCIceServer> { new() { urls = "stun:stun.cloudflare.com:3478" } }
        });
        _peer.addTrack(new MediaStreamTrack(new List<AudioFormat>
        {
            new(111, "opus", 48000, 2, "minptime=10;useinbandfec=1;stereo=1")
        }, MediaStreamStatusEnum.SendOnly));
        _peer.addTrack(new MediaStreamTrack(new List<VideoFormat>
        {
            new(VideoCodecsEnum.VP8, 96, 90000)
        }, MediaStreamStatusEnum.SendOnly));
        _peer.onconnectionstatechange += state => StateChanged?.Invoke(state.ToString());
    }

    public async Task<string> CreateOfferAsync(CancellationToken cancellationToken)
    {
        var gathered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _peer.onicegatheringstatechange += state => { if (state == RTCIceGatheringState.complete) gathered.TrySetResult(); };
        var offer = _peer.createOffer();
        await _peer.setLocalDescription(offer);
        if (_peer.iceGatheringState != RTCIceGatheringState.complete)
        {
            try { await gathered.Task.WaitAsync(TimeSpan.FromSeconds(8), cancellationToken); }
            catch (TimeoutException) { /* Include gathered candidates, as the existing web transmitter does. */ }
        }
        cancellationToken.ThrowIfCancellationRequested();
        return _peer.localDescription.sdp.ToString();
    }

    public void AcceptAnswer(string sdp)
    {
        var result = _peer.setRemoteDescription(new RTCSessionDescriptionInit { type = RTCSdpType.answer, sdp = sdp });
        if (result != SetDescriptionResultEnum.OK) throw new InvalidOperationException("Resposta WebRTC inválida: " + result);
    }

    // Exactly 20 ms, stereo PCM16 at 48 kHz, interleaved: 960 frames / 1920 samples.
    public void SendPcm(short[] pcm)
    {
        if (pcm.Length != 1920) throw new ArgumentException("Expected 20 ms stereo PCM.", nameof(pcm));
        lock (_mediaLock)
        {
            if (_disposed || _peer.connectionState != RTCPeerConnectionState.connected) return;
            var encoded = new byte[4000];
            var length = _opus.Encode(pcm.AsSpan(), 960, encoded.AsSpan(), encoded.Length);
            _peer.SendAudio(960, encoded[..length]);
        }
    }

    public void SendVp8(uint duration90Khz, byte[] encodedFrame)
    {
        lock (_mediaLock)
            if (!_disposed && _peer.connectionState == RTCPeerConnectionState.connected)
                _peer.SendVideo(duration90Khz, encodedFrame);
    }

    public void Dispose()
    {
        lock (_mediaLock)
        {
            if (_disposed) return;
            _disposed = true;
            _peer.Close("Transmissão encerrada");
            _peer.Dispose();
            _opus.Dispose();
        }
    }
}
