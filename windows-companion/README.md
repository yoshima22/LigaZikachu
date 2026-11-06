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

O Pikachu aparece sobre a área de trabalho, acima da barra de tarefas do monitor principal. Ele começa em **Idle**, caminha horizontalmente por quatro segundos após oito segundos de repouso (**Walk**) e vira ao atingir as bordas da área útil do monitor ativo. Após **24 segundos sem interação ou evento local**, adormece no lugar (**Sleep**) com pequenos Zs animados. Mover o mouse sobre o mascote o acorda; um clique curto o acorda e produz uma reação alegre de 1,4 segundo (**Happy**). O mesmo GIF local continua animado em todos os estados; não há novos sprites de sono ou caminhada. **Arraste o mascote com o botão esquerdo** para movê-lo; **clique com o botão direito no mascote** para abrir Pausar/Retomar, Silenciar/Ativar áudio, Escolher mascote, Restaurar no monitor principal e Sair. O arrasto começa ao ultrapassar o limiar de movimento do Windows, preservando o ponto onde o mascote foi segurado; soltar após arrastar não dispara a reação de clique. **Dragging** suspende o passeio. A caminhada para durante o arrasto ou enquanto esse menu está aberto. **Alert** tem prioridade visual sobre todos os estados, acorda o mascote e exibe o balão ancorado, inclusive durante uma sessão de arrasto; o arrasto continua disponível. A posição respeita a área útil do monitor.

Somente os pixels visíveis do mascote e o balão visível aceitam cliques: o espaço transparente continua deixando clicar nos aplicativos atrás dele, inclusive enquanto há um aviso. O balão fica acima do mascote, com uma cauda apontando para ele e espaço para a animação sem cobrir seu rosto. Os avisos ficam visíveis por oito segundos e têm um botão **×** para fechar. Um novo aviso aguarda o anterior terminar. A janela não aparece na barra de tarefas nem toma o foco do aplicativo em uso.

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

`OverlayViewModel.Behavior` expõe a máquina de estados Idle, Walk, Sleep, Alert, Happy e Dragging. A prioridade é Alert → Dragging → pausa → Happy → Sleep → Walk/Idle. Pausar mantém o mascote parado em Idle e preserva a fila de eventos. Eventos simulados acordam o mascote; enquanto pausado, o aviso só aparece no resumo ao retomar. Interação ou fim do alerta reinicia o intervalo de inatividade. A movimentação vertical só ocorre no arrasto; o passeio conserva a altura.

`BehaviorTiming` permite configurar `IdleFor`, `WalkFor`, `SleepAfter`, `HappyFor` e `WalkPixelsPerSecond` no construtor do modelo. Os testes injetam um relógio e avançam o tempo sem esperas reais para provar as transições. A configuração é por código neste protótipo. O evento automático a cada 30 segundos também reinicia a inatividade, portanto o sono padrão ocorre entre esses eventos. Tudo continua **somente local e simulado**, sem conexão com o jogo, servidor, contas ou jogadores.

## Arte e som temporários

Os arquivos `src/ZikaCompanion.App/Assets/*-placeholder.gif` são **placeholders somente para testes locais**, obtidos do repositório PokeAPI/sprites, sprites animados de Pokémon Black/White (Geração V):

- [Pikachu — 25](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/25.gif): `pikachu-placeholder.gif`.
- [Bulbasaur — 1](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/1.gif): `bulbasaur-placeholder.gif`.
- [Charmander — 4](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/4.gif): `charmander-placeholder.gif`.
- [Squirtle — 7](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/7.gif): `squirtle-placeholder.gif`.

Créditos dos sprites e personagens: Pokémon / Nintendo / Game Freak / Creatures; distribuição de referência: PokeAPI/sprites. Os GIFs foram baixados durante o desenvolvimento e são incluídos como recursos no executável; não são buscados na internet durante a execução. Este uso temporário não concede licença para distribuição comercial.

`LocalGifAnimation.cs` decodifica os quadros e seus tempos usando os recursos desktop do .NET 8 e os anima no WPF, sem pacote adicional. O SVG antigo permanece apenas como referência histórica, sem uso na interface. O som é substituível em `Services/AudioAlertService.cs`.

## Validar

```powershell
dotnet test windows-companion/ZikaCompanion.sln
dotnet build windows-companion/ZikaCompanion.sln -c Release
```

Os testes cobrem transições determinísticas, sono e despertar, prioridade de alertas, reação de clique, arrasto, viradas nas bordas, indicador de sono animado, isolamento, simulação, fila, áudio, duração dos balões, pausa/resumo, cálculo de arrasto e limites de posição, hit testing nativo, menus, seleção e marcas sincronizadas dos quatro mascotes, troca imediata dos pixels dos recursos locais preservando o estado, ancoragem do balão e avanço real dos quadros da imagem. Testes de janela usam STA e precisam de Windows. A aparência, o arrasto e o posicionamento em monitores com escalas diferentes também devem ser conferidos visualmente no ambiente de destino.

### Área de ação e sprites

Em **Definir área de ação**, arraste um retângulo no monitor em que o mascote está. A seleção mínima é 118 × 136 pixels lógicos; uma seleção menor ou Esc cancela. O mascote permanece na área, inclusive durante o arraste, e inverte a caminhada nas bordas laterais. **Tela inteira** remove a seleção e volta a usar o monitor atual. A área é mantida somente durante a sessão, sem gravação em disco. A opção também está no menu da bandeja.

Os quatro GIFs locais existentes continuam sendo usados para idle, caminhada e sono. Os movimentos de interface diferenciam visualmente os estados, mas esses GIFs não são quadros overworld reais e não mostram uma direção de caminhada. Não há download em execução. Foram avaliadas as animações do [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab): os arquivos de créditos de [Bulbasaur](https://github.com/PMDCollab/SpriteCollab/blob/master/sprite/0001/credits.txt), [Charmander](https://github.com/PMDCollab/SpriteCollab/blob/master/sprite/0004/credits.txt), [Squirtle](https://github.com/PMDCollab/SpriteCollab/blob/master/sprite/0007/credits.txt) e [Pikachu](https://github.com/PMDCollab/SpriteCollab/blob/master/sprite/0025/credits.txt) atribuem Walk, Idle e Sleep à CHUNSOFT e indicam licença **Unspecified**. A política CC BY-NC do repositório cobre submissões, mas não esclarece os direitos desses arquivos oficiais; portanto eles não foram incluídos. O [PokeWilds](https://github.com/SheerSt/pokewilds) também foi considerado, sem licença verificável para esses assets. Os GIFs existentes mantêm sua proveniência e limitações descritas anteriormente neste README; sua presença não representa uma nova licença para redistribuição. Para substituir cada ação, é necessário obter arquivos com licença e atribuição verificáveis.
