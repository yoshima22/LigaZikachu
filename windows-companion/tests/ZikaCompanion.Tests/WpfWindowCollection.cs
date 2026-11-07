using Xunit;

namespace ZikaCompanion.Tests;

// WPF window construction touches shared caches across STA threads.
[CollectionDefinition(Name)]
public sealed class WpfWindowCollection
{
    public const string Name = "WPF windows";
}
