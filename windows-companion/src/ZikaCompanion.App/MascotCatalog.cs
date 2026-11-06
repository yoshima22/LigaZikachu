namespace ZikaCompanion.App;

public sealed record MascotOption(int Number, string Name, string AssetPath);

public static class MascotCatalog
{
    public static string AssetFor(MascotOption mascot, CompanionBehavior behavior, int direction) => mascot.AssetPath;

    public static IReadOnlyList<MascotOption> All { get; } = Array.AsReadOnly(new[]
    {
        new MascotOption(25, "Pikachu", "Assets/pikachu-placeholder.gif"),
        new MascotOption(1, "Bulbasaur", "Assets/bulbasaur-placeholder.gif"),
        new MascotOption(4, "Charmander", "Assets/charmander-placeholder.gif"),
        new MascotOption(7, "Squirtle", "Assets/squirtle-placeholder.gif")
    });
}
