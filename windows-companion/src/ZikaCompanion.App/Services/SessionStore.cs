using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace ZikaCompanion.App.Services;

public interface ISessionStore
{
    string? Load();
    void Save(string token);
    void Clear();
}

public sealed class DpapiSessionStore(string path) : ISessionStore
{
    public string? Load()
    {
        if (!File.Exists(path)) return null;
        try { return Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.CurrentUser)); }
        catch (CryptographicException) { Clear(); return null; }
    }
    public void Save(string token)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(token), null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(path, encrypted);
    }
    public void Clear() { if (File.Exists(path)) File.Delete(path); }
}

