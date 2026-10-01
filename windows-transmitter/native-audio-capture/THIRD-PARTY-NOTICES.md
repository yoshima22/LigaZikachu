# Aviso de terceiros

Os arquivos `ApplicationLoopback.cpp`, `LoopbackCapture.cpp`,
`LoopbackCapture.h` e `Common.h` derivam do exemplo **Application Loopback
Audio Capture** da Microsoft, usado aqui para a captura WASAPI por processo.

Fonte: https://github.com/microsoft/Windows-classic-samples/tree/main/Samples/ApplicationLoopback

Adaptações: saída PCM contínua, silêncio WASAPI, captura WGC e encerramento
por pipe de controle. A licença MIT está no arquivo LICENSE deste diretório.
Nenhum arquivo temporário ou gravação de teste é salvo na Área de Trabalho.
