using ZikaCompanion.App.Domain;

namespace ZikaCompanion.App.Services;

public sealed class SimulatedEventService : IDisposable
{
    private readonly object _gate = new();
    private readonly TimeSpan _interval;
    private Timer? _timer;
    private int _nextType;
    private bool _disposed;

    public SimulatedEventService(TimeSpan? interval = null)
    {
        _interval = interval ?? TimeSpan.FromSeconds(30);
        if (_interval <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(interval));
    }

    // Timer notifications run on a worker thread. WPF consumers dispatch to their UI thread.
    public event Action<CompanionEvent>? EventGenerated;

    public void Start()
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            _timer ??= new Timer(OnTick, null, _interval, _interval);
        }
    }

    public void Stop()
    {
        lock (_gate)
        {
            _timer?.Dispose();
            _timer = null;
        }
    }

    // Also used by tray menu test-event commands; no timer or external state is required.
    public void Trigger(CompanionEventType type)
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            Emit(type);
        }
    }

    private void OnTick(object? state)
    {
        lock (_gate)
        {
            if (_disposed || _timer is null) return;
            var type = (CompanionEventType)_nextType;
            _nextType = (_nextType + 1) % 3;
            Emit(type);
        }
    }

    private void Emit(CompanionEventType type)
    {
        var (title, message) = type switch
        {
            CompanionEventType.EXPEDITION_COMPLETED =>
                ("Expedição concluída", "Sua expedição simulada terminou!"),
            CompanionEventType.ARENA_ATTACK_AVAILABLE =>
                ("Ataque disponível", "Sua equipe simulada já pode atacar na Arena Z!"),
            CompanionEventType.ARENA_EXIT_AVAILABLE =>
                ("Saída disponível", "Sua equipe simulada já pode sair da Arena Z!"),
            _ => throw new ArgumentOutOfRangeException(nameof(type))
        };
        EventGenerated?.Invoke(new CompanionEvent(
            Guid.NewGuid().ToString("N"), type, DateTimeOffset.UtcNow, title, message));
    }

    public void Dispose()
    {
        lock (_gate)
        {
            _disposed = true;
            _timer?.Dispose();
            _timer = null;
        }
    }
}
