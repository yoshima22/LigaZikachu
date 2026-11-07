using ZikaCompanion.App.Domain;

namespace ZikaCompanion.App.Services;

public sealed class AlertQueue
{
    private readonly object _gate = new();
    private readonly Queue<CompanionEvent> _pending = new();
    private readonly HashSet<string> _seen = new(StringComparer.Ordinal);
    private readonly AudioAlertService _audio;
    private bool _isPaused;
    private bool _isQuiet;
    private bool _isMuted;
    private bool _needsSummary;

    public AlertQueue(AudioAlertService? audioService = null)
    {
        _audio = audioService ?? new AudioAlertService();
    }

    public bool IsPaused
    {
        get { lock (_gate) return _isPaused; }
        set
        {
            lock (_gate)
            {
                _isPaused = value;
                if (value && _pending.Count > 0) _needsSummary = true;
            }
        }
    }

    // Quiet retains alerts; mute allows live balloons while disabling their audio.
    public bool IsQuiet
    {
        get { lock (_gate) return _isQuiet; }
        set
        {
            lock (_gate)
            {
                _isQuiet = value;
                if (value && _pending.Count > 0) _needsSummary = true;
            }
        }
    }

    public bool IsMuted
    {
        get { lock (_gate) return _isMuted; }
        set { lock (_gate) _isMuted = value; }
    }

    public int PendingCount
    {
        get { lock (_gate) return _pending.Count; }
    }

    public void ClearPending()
    {
        lock (_gate)
        {
            _pending.Clear();
            _needsSummary = false;
        }
    }

    public bool Enqueue(CompanionEvent item)
    {
        ArgumentNullException.ThrowIfNull(item);
        lock (_gate)
        {
            if (!_seen.Add(item.EventId)) return false;
            _pending.Enqueue(item);
            if (_isPaused || _isQuiet) _needsSummary = true;
            return true;
        }
    }

    // Call when the overlay is ready for its next balloon. Audio occurs at delivery.
    public bool TryDequeue(out CompanionAlert? alert)
    {
        lock (_gate)
        {
            alert = null;
            if (_isPaused || _isQuiet || _needsSummary || _pending.Count == 0) return false;
            alert = new CompanionAlert(Array.AsReadOnly(new[] { _pending.Dequeue() }), false);
            if (!_isMuted) _audio.Play();
            return true;
        }
    }

    // Clear suppression flags first. Repeated calls cannot replay the retained batch.
    public CompanionAlert? ResumeSummary()
    {
        lock (_gate)
        {
            if (_isPaused || _isQuiet || !_needsSummary || _pending.Count == 0) return null;
            var retained = Array.AsReadOnly(_pending.ToArray());
            _pending.Clear();
            _needsSummary = false;
            return new CompanionAlert(retained, true);
        }
    }
}
