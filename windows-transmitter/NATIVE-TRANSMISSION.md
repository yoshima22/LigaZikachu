# Transmissão nativa 0.7.2

Player de Fonte → Transmitir na Zika TV → título, resolução e FPS → login se necessário.
Após o login, a captura e a live iniciam no player. Pausar/Retomar, Qualidade e Parar transmissão ficam na barra.
Pausar mantém a live conectada, envia tela de pausa e silêncio; não pausa a reprodução local da fonte.
Retomar volta ao player com um novo keyframe. Parar encerra a live e libera os capturadores.
Esses controles também estão disponíveis na bandeja do Windows.
Qualidade troca a captura durante a live e envia um novo keyframe; a conexão dos espectadores permanece ativa.
Minimizar mantém a superfície fora da tela para o Windows continuar renderizando. Clique novamente no item da barra de tarefas ou no ícone da bandeja para restaurar o player.
Minimizar durante uma live mantém a superfície de renderização fora da tela;
o ícone da Zika TV na bandeja permite restaurar ou encerrar.

## Mídia

- Windows Graphics Capture captura a janela; o retângulo do WebView recorta a
  barra e o título. A sessão do Windows desativa a captura do cursor.
- WASAPI process loopback inclui apenas a árvore do BrowserProcessId do player.
  Cada player tem seu próprio ambiente WebView2, separado do login e dos demais.
- O capturador entrega PCM16 estéreo a 48 kHz por pipe, sem arquivos de gravação.
- Concentus codifica Opus; libvpx nativo codifica VP8. Resoluções: 640×360,
  854×480, 1280×720 e 1920×1080. FPS alvo: 30 ou 60, padrão 720p/30.
  A proporção é preservada com barras pretas. O desempenho depende do computador,
  da fonte e da rede. Em P2P, cada espectador exige upload adicional do transmissor.
- SIPSorcery envia mídia via WebRTC e usa o contrato existente de sinalização:
  live, heartbeat, poll/JOIN, signal/OFFER, ANSWER, BYE, end.
- Nenhuma captura global ou microfone é usada na rota nativa. A aba manual
  antiga permanece separada e ainda usa a central web.

## Compilar

PowerShell, a partir da raiz do repositório:

```powershell
./windows-transmitter/build-native.ps1
dotnet publish windows-transmitter/LigaZikachuTransmissor.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o windows-transmitter/single-file-0.7.2
```

Requer o workload C++ do Visual Studio com toolset v143 e Windows SDK.
O capturador é embutido no executável .NET e extraído sob LocalAppData,
com diretório definido pelo SHA256 do binário. Nenhum atalho é criado.

## Verificação automatizada

Executar o EXE com `--native-self-test --test-height=720 --test-fps=60`. O teste abre uma janela temporária,
gera animação e dois tons em árvores de processos distintas, transmite via
WebRTC e decodifica no receptor. Também testa a janela fora da tela, exclusão
da barra magenta, negociação com um receptor Chromium, dimensões recebidas, pausa,
silêncio medido no receptor, retomada e end.
As requisições de sinalização usam um handler local com o contrato da API:
nenhuma transmissão de teste é criada no servidor de produção.

Relatório: `%LOCALAPPDATA%\LigaZikachu\ZikaTV\Diagnostics\native-self-test.json`.
`passed: true` exige áudio isolado, vídeo decodificado e movimento, frames fora
da tela, barra ausente, áudio/vídeo recebidos no navegador, pausa/retomada e sessão encerrada.
`measuredFps` informa a taxa observada, não uma garantia de desempenho.
`node --test scripts/test-windows-transmitter-session.mjs` valida início idempotente,
anúncio do Professor Enguiça, opções de qualidade, autenticação e encerramento com mocks.

## Download e publicação

Distribuir somente `ZikaTV-0.7.2.exe`. Os DLLs e o capturador são internos ao pacote;
o runtime extrai suas dependências no cache do usuário, nunca ao lado do EXE.
A página `/downloads` aponta para o asset versionado `transmitter-v0.7.2` no GitHub.
Não substituir esse asset por outro build sem alterar a versão. Conferir o SHA-256
do arquivo publicado contra o executável testado antes de atualizar a página.
O endpoint de início publica `spec_live` no ticker apenas na transição PREPARING → LIVE.

O teste não valida a conta do usuário, permissões de fontes, redes remotas ou
DRM. O login de produção redireciona corretamente para a página de autenticação;
a criação de uma live autenticada no site deve ser conferida pelo usuário.
