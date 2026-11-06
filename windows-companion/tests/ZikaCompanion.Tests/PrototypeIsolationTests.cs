using System.Xml.Linq;
using Xunit;

namespace ZikaCompanion.Tests;

public sealed class PrototypeIsolationTests
{
    [Fact]
    public void AppTargetsNet8Windows()
    {
        var project = LoadAppProject();

        Assert.Equal("net8.0-windows", project.Root!.Element("PropertyGroup")!.Element("TargetFramework")!.Value);
    }

    [Fact]
    public void AppHasNoProjectReferences()
    {
        var project = LoadAppProject();

        Assert.Empty(project.Descendants("ProjectReference"));
    }

    [Fact]
    public void AppHasNoHttpClientPackage()
    {
        var project = LoadAppProject();

        Assert.DoesNotContain(project.Descendants("PackageReference"), package =>
        {
            var name = (string?)package.Attribute("Include") ?? (string?)package.Attribute("Update") ?? "";
            return name.Contains("HttpClient", StringComparison.OrdinalIgnoreCase)
                || name.Equals("System.Net.Http", StringComparison.OrdinalIgnoreCase)
                || name.Equals("Microsoft.Net.Http", StringComparison.OrdinalIgnoreCase);
        });
    }

    private static XDocument LoadAppProject()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && directory.Name != "windows-companion")
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        var path = Path.Combine(directory.FullName, "src", "ZikaCompanion.App", "ZikaCompanion.App.csproj");
        Assert.True(File.Exists(path), $"App project must exist at {path}");
        return XDocument.Load(path);
    }
}
