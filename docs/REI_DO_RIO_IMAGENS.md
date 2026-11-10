# Rei do Rio — imagens do evento (prompts e especificações)

Tema: **sobrevivência + Natal competitivo** (inverno, trono, coroa, luzes quentes). Sem referência a rio/água.
Paleta da UI (para a arte conversar com a tela): azul-noite `#0b1d3a`, azul-gelo `#d7ecff`, dourado `#f3b91f`, vermelho natalino `#d62839`, verde pinheiro `#14663a`.

Regras para TODAS as imagens: sem texto, letras, logotipos, molduras, ícones de interface ou marca d'água; **sem personagens reconhecíveis de franquias** (use silhuetas genéricas de criaturas, se precisar); sem pessoas com rosto.

Já prontos (vetoriais, feitos à mão): `public/events/rei-do-rio/ornaments/` → `snowflake.svg`, `bauble.svg`, `holly.svg`, `garland.svg` (repete na horizontal), `crown.svg`, `frost-corner.svg` (canto superior esquerdo; espelhar para os outros).

---

## 1. Banner do topo — `public/events/rei-do-rio/banner.webp`
- **Tamanho:** 2400×720 px (proporção ~10:3), WebP, alvo < 400 KB. A página já detecta `banner.webp|png|jpg` e o exibe atrás do título.
- **Composição (importante):** o texto do título fica à **esquerda** e o contador à **direita**. Deixe a metade esquerda calma e escura (neve, céu, silhueta de pinheiros) e concentre o motivo principal no **terço central-direito**. No celular a imagem é cortada pelo centro, então nada essencial nas bordas.
- **Prompt:**
  > Wide cinematic banner, ultra-wide 10:3, snowbound winter night. A majestic throne carved from ice and dark wood stands on a frozen summit, crowned with a glowing golden Christmas crown with a small red velvet band and holly. Warm strings of festive lights hang between snow-covered pine trees and cast soft gold, red and green glows on the snow. Deep navy-to-violet sky with a subtle aurora and gently falling snow, a few tiny silhouettes of generic creatures gathered far below as if surviving a long winter. Left half of the image calm, dark and low-detail (empty negative space for title text), focal point right of center. Painterly game-key-art style, soft volumetric light, rich but moderate contrast, color palette deep navy, ice blue, gold, small accents of festive red and pine green. No text, no letters, no logos, no UI, no frame, no watermark, no recognizable characters, no people.

## 2. Imagem de apresentação (capa do modo) — `public/events/rei-do-rio/cover.webp`
Igual à capa da Torre (`cover.webp`, 1122×1402, retrato): aparece na janela de introdução, com paginação e instruções ao lado/abaixo.
- **Tamanho:** 1122×1402 px (retrato ~4:5), WebP.
- **Composição:** motivo central forte; parte inferior mais escura para o texto/botões poderem sobrepor.
- **Prompt:**
  > Vertical key art poster, 4:5 portrait, a lone ice throne topped with a golden Christmas crown on a snowy mountain peak at night, centered, glowing warmly. Around it, six small lantern-lit camps arranged in a ring on the snow, each marked by a different colored pennant (as if six squads defending their positions), connected by glowing strings of Christmas lights. Falling snow, pine branches with red ribbons and baubles framing the top corners, aurora in a deep navy sky. The bottom third fades to dark snow and shadow, leaving calm space for overlaid text. Painterly game-key-art style, dramatic but cozy, palette deep navy, ice blue, gold, festive red and pine green. No text, no letters, no logos, no UI, no frame, no watermark, no recognizable characters, no people.

## 3. Fundo opcional das páginas — `public/events/rei-do-rio/background.webp`
Como o `background.webp` da Torre: textura discreta atrás dos cartões.
- **Tamanho:** 1536×1024 px, WebP, alvo < 250 KB.
- **Prompt:**
  > Subtle dark winter background texture, 3:2, very low contrast: deep navy night sky with soft out-of-focus snowfall, faint distant pine silhouettes at the bottom, a few tiny warm bokeh lights in gold and red, gentle vignette, large calm empty areas for UI cards on top. No text, no objects in the center, no characters, no logos, no frame.

## 4. (Opcional) Ornamentos em arte pintada — PNG transparente
Se preferir arte pintada no lugar dos SVGs: 6 peças separadas, **512×512, fundo transparente, mesma luz e câmera**: bola de Natal vermelha e dourada, azevinho com frutos, floco de neve de cristal, coroa dourada com veludo vermelho, bastão de doce, estrela dourada.
> Single game UI ornament, [PEÇA], hand-painted style, soft rim light, centered, transparent background, consistent lighting from top left, rich saturated festive colors, no text, no shadow on the ground, 1:1, 512x512.

---

### Depois que as imagens existirem
1. Coloque os arquivos nos caminhos acima (WebP; PNG também funciona para o banner).
2. Próxima etapa: ornamentos na UI (guirlanda no topo do banner, azevinho nos cartões de destaque, floco/coroa nos títulos, cantos de gelo) e a **janela de apresentação** com a capa, paginação e instruções, no padrão do `tower-intro.tsx`.
