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

O Pikachu aparece sobre a área de trabalho, acima da barra de tarefas do monitor principal. Ele começa em **Idle**, caminha horizontalmente por quatro segundos após oito segundos de repouso (**Walk**) e vira ao atingir as bordas da área útil do monitor ativo. Após **24 segundos sem interação ou evento local**, adormece no lugar (**Sleep**) com pequenos Zs animados. Mover o mouse sobre o mascote o acorda; um clique curto o acorda e produz uma reação alegre de 1,4 segundo (**Happy**). Cada mascote usa seus GIFs locais de repouso, caminhada nas duas direções e sono. **Arraste o mascote com o botão esquerdo** para movê-lo; **clique com o botão direito no mascote** para abrir Pausar/Retomar, Silenciar/Ativar áudio, Escolher mascote, Restaurar no monitor principal e Sair. O arrasto começa ao ultrapassar o limiar de movimento do Windows, preservando o ponto onde o mascote foi segurado; soltar após arrastar não dispara a reação de clique. **Dragging** suspende o passeio. A caminhada para durante o arrasto ou enquanto esse menu está aberto. **Alert** tem prioridade visual sobre todos os estados, acorda o mascote e exibe o balão ancorado, inclusive durante uma sessão de arrasto; o arrasto continua disponível. A posição respeita a área útil do monitor.

Somente os pixels visíveis do mascote e o balão visível aceitam cliques: o espaço transparente continua deixando clicar nos aplicativos atrás dele, inclusive enquanto há um aviso. O balão fica acima do mascote quando há espaço no monitor e abaixo quando ele está próximo do topo, com uma cauda apontando para ele e espaço para a animação sem cobrir seu rosto. A janela acompanha os pixels visíveis de cada quadro; não reserva um teto transparente para o balão. Assim, o mascote pode alcançar o topo da área de ação sem colocar a janela acima da tela. Abrir ou fechar o balão preserva a posição do mascote. Os avisos ficam visíveis por oito segundos e têm um botão **×** para fechar. Um novo aviso aguarda o anterior terminar. A janela não aparece na barra de tarefas nem toma o foco do aplicativo em uso.

## Usar a bandeja

Clique com o botão direito no ícone de informações da bandeja do Windows (também pode estar na seta de ícones ocultos):

- **Simular expedição concluída / ataque disponível / saída disponível:** gera cada um dos três eventos locais.
- **Pausar / Retomar:** suspende os balões e a caminhada. Os eventos que chegam durante a pausa são reunidos em um único resumo silencioso ao retomar.
- **Silenciar áudio:** mantém os balões e desativa o som de novos avisos.
- **Escolher mascote:** alterna imediatamente entre Pikachu (25), Bulbasaur (1), Charmander (4) e Squirtle (7). Também está disponível no menu do botão direito do mascote. Uma marca indica a escolha atual nos dois menus; a troca mantém posição, estado de comportamento, balões, pausa e áudio. A escolha vale somente nesta sessão: ao reiniciar, volta para Pikachu.
- **Restaurar no monitor principal:** devolve o mascote à área útil do monitor principal; duplo clique no ícone faz o mesmo.
- **Sair:** encerra o aplicativo, o temporizador e o ícone da bandeja.

O simulador também gera um evento a cada 30 segundos, alternando os três tipos. O aviso sonoro é um beep local do Windows. A pausa continua acumulando eventos em memória; sair encerra a simulação. A posição da sessão é limitada à área útil do monitor e reajustada quando a configuração de tela muda. A posição não é persistida entre execuções neste protótipo.

## Comportamento determinístico local

`OverlayViewModel.Behavior` expõe a máquina de estados Idle, Walk, Sleep, Alert, Happy e Dragging. A prioridade é Alert → Dragging → pausa → Happy → Sleep → Walk/Idle. Pausar mantém o mascote parado em Idle e preserva a fila de eventos. Eventos simulados acordam o mascote; enquanto pausado, o aviso só aparece no resumo ao retomar. Interação ou fim do alerta reinicia o intervalo de inatividade. O passeio conserva a altura de referência; os movimentos visuais de respiração e salto também respeitam a área de ação.

`BehaviorTiming` permite configurar `IdleFor`, `WalkFor`, `SleepAfter`, `HappyFor` e `WalkPixelsPerSecond` no construtor do modelo. Os testes injetam um relógio e avançam o tempo sem esperas reais para provar as transições. A configuração é por código neste protótipo. O evento automático a cada 30 segundos também reinicia a inatividade, portanto o sono padrão ocorre entre esses eventos. Tudo continua **somente local e simulado**, sem conexão com o jogo, servidor, contas ou jogadores.

## Arte e som temporários

> **PRIVATE STUDY ONLY / DO NOT DISTRIBUTE — ESTUDO PRIVADO APENAS / NÃO DISTRIBUIR.**

Os GIFs locais são recortes dos sprites de ação do projeto [SpriteCollab](https://github.com/PMDCollab/SpriteCollab), criados a partir dos arquivos abaixo. Os personagens Pokémon e seus direitos pertencem a seus respectivos titulares, incluindo Pokémon / Nintendo / Game Freak / Creatures. A disponibilidade pública dos arquivos não concede licença de distribuição; estes recursos foram autorizados apenas para este protótipo privado de estudo.

Foram extraídas as linhas de direção para Idle, Walk e Sleep; os tempos seguem `AnimData.xml` (60 quadros por segundo), arredondados para a resolução de GIF. Os arquivos originais e metadados usados, fixados no commit `dd47c4644177ca1136513ead54e11ace689733b5`, são:

- Bulbasaur: [AnimData.xml](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0001/AnimData.xml), [Idle-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0001/Idle-Anim.png), [Walk-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0001/Walk-Anim.png), [Sleep-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0001/Sleep-Anim.png).
- Charmander: [AnimData.xml](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0004/AnimData.xml), [Idle-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0004/Idle-Anim.png), [Walk-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0004/Walk-Anim.png), [Sleep-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0004/Sleep-Anim.png).
- Squirtle: [AnimData.xml](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0007/AnimData.xml), [Idle-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0007/Idle-Anim.png), [Walk-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0007/Walk-Anim.png), [Sleep-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0007/Sleep-Anim.png).
- Pikachu: [AnimData.xml](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0025/AnimData.xml), [Idle-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0025/Idle-Anim.png), [Walk-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0025/Walk-Anim.png), [Sleep-Anim.png](https://raw.githubusercontent.com/PMDCollab/SpriteCollab/dd47c4644177ca1136513ead54e11ace689733b5/sprite/0025/Sleep-Anim.png).

Os GIFs são recursos incorporados ao executável; nenhuma imagem é buscada na rede durante a execução. Alert, Happy e Dragging usam Idle. `LocalGifAnimation.cs` decodifica os quadros no WPF. O SVG antigo permanece apenas como referência histórica, sem uso na interface. O som é substituível em `Services/AudioAlertService.cs`.

## Validar

```powershell
dotnet test windows-companion/ZikaCompanion.sln
dotnet build windows-companion/ZikaCompanion.sln -c Release
```

Os testes cobrem transições determinísticas, sono e despertar, prioridade de alertas, reação de clique, arrasto, viradas nas bordas, indicador de sono animado, isolamento, simulação, fila, áudio, duração dos balões, pausa/resumo, cálculo de arrasto e limites de posição, hit testing nativo, menus, seleção e marcas sincronizadas dos quatro mascotes, troca imediata dos pixels dos recursos locais preservando o estado, ancoragem do balão, acesso nativo ao botão de fechar com o balão abaixo, topo real do HWND, posicionamento dos pixels visíveis de cada espécie no topo do monitor, seleção de recursos conforme a direção visual e avanço real dos quadros da imagem. Testes de janela usam STA e precisam de Windows. A aparência, o arrasto e o posicionamento em monitores com escalas diferentes também devem ser conferidos visualmente no ambiente de destino.

### Área de ação e sprites

Em **Definir área de ação**, arraste um retângulo no monitor em que o mascote está. A seleção mínima é 118 × 136 pixels lógicos; uma seleção menor ou Esc cancela. O mascote permanece na área, inclusive durante o arraste, e inverte a caminhada nas bordas laterais. **Tela inteira** remove a seleção e volta a usar o monitor atual. A área é mantida somente durante a sessão, sem gravação em disco. A opção também está no menu da bandeja.

Os GIFs incorporados têm animações distintas de Idle, Walk e Sleep para as quatro espécies. Os nomes dos recursos extraídos de caminhada ficaram invertidos em relação ao desenho: `walk-right.gif` mostra o mascote voltado para a esquerda, e `walk-left.gif` para a direita. O catálogo compensa essa diferença ao selecionar o recurso conforme o movimento. A proveniência e as restrições de estudo privado acima continuam aplicáveis.
