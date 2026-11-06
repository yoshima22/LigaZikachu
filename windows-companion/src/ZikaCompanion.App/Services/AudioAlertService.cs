using System.Media;

namespace ZikaCompanion.App.Services;

public sealed class AudioAlertService
{
    private readonly Action _playSound;

    // The local OS sound is the replaceable placeholder; tests replace only this side effect.
    public AudioAlertService(Action? playSound = null)
    {
        _playSound = playSound ?? (() => SystemSounds.Beep.Play());
    }

    public void Play() => _playSound();
}
