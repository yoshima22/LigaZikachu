namespace ZikaCompanion.App;

public sealed record MascotOption(int Number, string Name, string AssetPath);

public static class MascotCatalog
{
    public static string AssetFor(MascotOption mascot, CompanionBehavior behavior, int direction)
    {
        var action = behavior switch
        {
            // The extracted overworld resources have their left/right names reversed.
            CompanionBehavior.Walk => direction < 0 ? "walk-right" : "walk-left",
            CompanionBehavior.Sleep => "sleep",
            _ => "idle"
        };
        return $"Assets/{mascot.Number:D4}-{action}.gif";
    }

    public static IReadOnlyList<MascotOption> All { get; } = Array.AsReadOnly(new[]
    {
        new MascotOption(25, "Pikachu", "Assets/0025-idle.gif"),
        new MascotOption(1, "Bulbasaur", "Assets/0001-idle.gif"),
        new MascotOption(4, "Charmander", "Assets/0004-idle.gif"),
        new MascotOption(7, "Squirtle", "Assets/0007-idle.gif")
    });
}
