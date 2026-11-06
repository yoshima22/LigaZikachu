# ZikaCompanion — protótipo local

Aplicativo Windows independente para experimentar um mascote animado e avisos simulados. **Este protótipo não acessa a Liga Zikachu, não usa contas ou dados do jogo e não pode ser visto pelos jogadores.** Nada é enviado ao site, ao backend ou ao transmissor. Não há HTTP, login ou configurações de rede.

## Executar

Requer Windows 10/11 x64 e .NET 8 SDK com suporte ao desktop Windows.

Na raiz deste repositório:

```powershell
dotnet run --project windows-companion/src/ZikaCompanion.App/ZikaCompanion.App.csproj
```

Para compilar e executar a versão Release:

```powershell
dotnet build windows-companion/ZikaCompanion.sln -c Release
.\windows-companion\src\ZikaCompanion.App\bin\Release\net8.0-windows\ZikaCompanion.App.exe
```

O mascote aparece sobre a área de trabalho, acima da barra de tarefas do monitor principal. Ele alterna repouso e caminhada e não bloqueia cliques enquanto está ocioso. Os balões ficam visíveis por oito segundos, aceitam interação e têm um botão **×** para fechar. Um novo aviso aguarda o anterior terminar. A janela não aparece na barra de tarefas nem toma o foco do aplicativo em uso.

## Usar a bandeja

Clique com o botão direito no ícone de informações da bandeja do Windows (também pode estar na seta de ícones ocultos):

- **Simular expedição concluída / ataque disponível / saída disponível:** gera cada um dos três eventos locais.
- **Pausar / Retomar:** suspende os balões e a caminhada. Os eventos que chegam durante a pausa são reunidos em um único resumo silencioso ao retomar.
- **Silenciar áudio:** mantém os balões e desativa o som de novos avisos.
- **Restaurar no monitor principal:** devolve o mascote à área útil do monitor principal; duplo clique no ícone faz o mesmo.
- **Sair:** encerra o aplicativo, o temporizador e o ícone da bandeja.

O simulador também gera um evento a cada 30 segundos, alternando os três tipos. O aviso sonoro é um beep local do Windows. A pausa continua acumulando eventos em memória; sair encerra a simulação. A posição da sessão é limitada à área útil do monitor e reajustada quando a configuração de tela muda. A posição não é persistida entre execuções neste protótipo.

## Arte e som temporários

`src/ZikaCompanion.App/Assets/placeholder-mascot.svg` é o desenho vetorial local de referência. Como WPF não renderiza SVG nativamente, a imagem usada está no recurso `Mascot` (`DrawingImage`) em `MainOverlayWindow.xaml`; ao trocar a arte, atualize esse recurso ou use um arquivo de imagem local. Nenhuma arte é baixada. O som é substituível em `Services/AudioAlertService.cs`.

## Validar

```powershell
dotnet test windows-companion/tests/ZikaCompanion.Tests/ZikaCompanion.Tests.csproj
dotnet build windows-companion/ZikaCompanion.sln -c Release
```

Os testes cobrem isolamento, simulação, fila, áudio, duração dos balões, pausa/resumo, limites de posição e estilos nativos de clique. Testes de janela usam STA e precisam de Windows. A aparência e o posicionamento em monitores com escalas diferentes também devem ser conferidos visualmente no ambiente de destino.
