namespace LigaZikachu.Transmissor;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        WindowsShortcut.CreateIfPossible();
        Application.Run(new TransmitterForm());
    }
}

internal static class WindowsShortcut
{
    /// <summary>Cria um atalho simples para execuções futuras, sem instalação ou privilégio de administrador.</summary>
    public static void CreateIfPossible()
    {
        try
        {
            var executable = Environment.ProcessPath;
            if (string.IsNullOrWhiteSpace(executable) || !File.Exists(executable)) return;
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var shortcut = Path.Combine(desktop, "Zika TV Player.url");
            var target = new Uri(executable).AbsoluteUri;
            File.WriteAllText(shortcut, $"[InternetShortcut]{Environment.NewLine}URL={target}{Environment.NewLine}IconFile={executable}{Environment.NewLine}IconIndex=0{Environment.NewLine}");
        }
        catch { /* O programa continua funcionando mesmo se a área de trabalho estiver indisponível. */ }
    }
}
