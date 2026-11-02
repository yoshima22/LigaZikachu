# World Mode — Plano de Geração dos 3 Kits de Avatar

## 1. Objetivo

Este documento especifica os assets de personagem do **World Mode da Liga Zikachu**. Serão produzidos três kits visuais independentes:

1. **Chibi moderno**;
2. **Game Boy retrô**;
3. **3DS estilizado**.

O jogador poderá escolher um estilo e combinar:

- um corpo completo já vestido;
- uma expressão facial;
- um cabelo;
- cores de pele e cabelo aplicadas pelo site.

Não construiremos mais roupas superiores, calças e calçados como peças separadas. Cada roupa será um **corpo completo vestido**, pois isso elimina frestas, ombros expostos, pernas desalinhadas e diferenças anatômicas entre arquivos gerados separadamente.

## 2. Regra mais importante: um arquivo por imagem

Cada asset deve ser entregue como um arquivo PNG individual e com fundo verdadeiramente transparente.

**É proibido entregar:**

- spritesheet;
- mosaico ou grade contendo várias opções;
- imagem com três personagens lado a lado;
- arquivo com vários cabelos, rostos ou roupas juntos;
- fundo branco, preto ou quadriculado desenhado;
- texto, título, número, legenda ou nome dentro da imagem;
- cenário, moldura, partículas ou interface;
- personagem cortado nas bordas;
- uma montagem que precise ser recortada posteriormente.

Exemplo correto:

```text
body-outfit-starter.png
body-outfit-explorer.png
face-happy.png
face-focused.png
hair-short-back.png
hair-short-front.png
```

Cada linha representa um PNG diferente.

## 3. Arquitetura visual definitiva

O personagem será montado nesta ordem, de trás para frente:

1. `hair-back`: parte do cabelo que passa atrás da cabeça;
2. `body-outfit`: corpo completo, roupa completa, mãos e calçados;
3. `face`: olhos, sobrancelhas e boca;
4. `hair-front`: franja e partes que passam diante da cabeça;
5. acessórios futuros.

### Corpo vestido

Cada `body-outfit` deve conter:

- cabeça-base sem cabelo;
- orelhas e pescoço;
- corpo inteiro;
- braços e mãos;
- roupa superior completa;
- roupa inferior completa;
- calçados completos;
- pose neutra oficial.

O rosto deve ficar neutro ou vazio nas áreas variáveis. Olhos, sobrancelhas e boca serão fornecidos separadamente.

### Cabelo

Cada modelo de cabelo deve ser dividido em dois PNGs:

- `hair-back`: apenas o que aparece atrás da cabeça;
- `hair-front`: franja, mechas dianteiras e contorno frontal.

Mesmo um cabelo curto deve respeitar essa divisão. Se ele não possuir parte traseira visível, ainda deverá ser entregue um PNG `hair-back` transparente nas dimensões oficiais.

### Expressões

Cada expressão deve conter somente:

- olhos;
- sobrancelhas;
- boca;
- pequenos detalhes indispensáveis da expressão.

Não incluir cabeça, pele, cabelo, orelhas ou fundo na expressão.

## 4. Canvas e alinhamento compartilhados

Todos os arquivos finais dos três kits devem possuir:

- dimensão: **1024 × 1536 px**;
- proporção: **2:3 vertical**;
- formato: **PNG-32 com canal alfa**;
- espaço de cor: **sRGB**;
- fundo: **100% transparente**;
- personagem inteiro, sem cortes;
- centro corporal: `x = 512`;
- linha dos pés: `y = 1450`;
- margem inferior: aproximadamente `86 px`;
- margem superior mínima: `70 px`;
- mesma posição de cabeça, olhos, ombros, mãos, cintura e pés dentro de cada kit.

Não recortar automaticamente o canvas ao redor do conteúdo. Uma boca pequena continuará sendo entregue em um PNG de `1024 × 1536`, posicionada exatamente onde deve aparecer.

As três linguagens visuais podem ter proporções diferentes entre si, mas todos os assets pertencentes ao mesmo kit devem usar exatamente o mesmo corpo, pose e pontos de ancoragem.

## 5. Recoloração pelo site

Não é necessário gerar um personagem completo para cada cor de pele ou cabelo, desde que sejam entregues máscaras adequadas.

### Máscara de pele por roupa

Cada corpo vestido precisa de um PNG adicional chamado `skin-mask`. Ele deve conter:

- branco puro nas áreas recoloríveis da pele;
- transparência total em todo o restante;
- ausência de sombras, roupa, contorno ou fundo.

Como cada roupa pode expor quantidades diferentes de pele, cada `body-outfit` terá sua própria máscara.

Exemplo:

```text
body-outfit-starter.png
body-outfit-starter-skin-mask.png
```

### Cabelo recolorível

O cabelo deve usar uma base neutra que preserve luz e sombra. Entregar também máscaras individuais para frente e trás:

```text
hair-short-back.png
hair-short-back-color-mask.png
hair-short-front.png
hair-short-front-color-mask.png
```

O site aplicará a cor apenas dentro dessas máscaras. Não usar filtros globais sobre o personagem inteiro.

### Cores fixas das roupas

No primeiro pacote, cada roupa pode ter uma paleta fixa. Se quisermos recolorir uniformes futuramente, cada roupa deverá possuir máscaras separadas:

- cor primária;
- cor secundária;
- detalhes.

## 6. Kit 1 — Chibi moderno

### Direção artística

- Personagem chibi original, simpático e aventureiro.
- Cabeça grande, corpo pequeno, mãos e pés estilizados.
- Aproximadamente 3 a 3,5 cabeças de altura.
- Contornos limpos e consistentes.
- Pixel art moderna ou ilustração raster nítida com aparência de jogo.
- Sombras simples, sem iluminação externa dramática.
- Leitura clara quando reduzido para aproximadamente 240 × 360 px.
- Não reproduzir treinador oficial existente.

### Três corpos vestidos obrigatórios

#### A. Treinador iniciante

- Jaqueta leve ou camiseta esportiva.
- Calça confortável de viagem.
- Tênis simples.
- Silhueta leve e amigável.
- Poucos detalhes para representar o início da jornada.

#### B. Explorador regional

- Casaco ou colete de exploração.
- Calça cargo completa.
- Botas ou tênis de trilha.
- Cinto, bolsos e detalhes utilitários incorporados à roupa.
- Aparência de quem viaja entre cidades e florestas.

#### C. Treinador veterano

- Uniforme competitivo original.
- Casaco estruturado ou jaqueta de alto nível.
- Calça e calçado mais sofisticados.
- Silhueta confiante, mantendo exatamente a mesma pose-base.
- Mais acabamento, sem adicionar capa ou objeto que altere o enquadramento.

### Cabelos iniciais do kit Chibi

Gerar no mínimo seis modelos, sempre em arquivos `back` e `front` separados:

1. curto espetado;
2. curto ondulado;
3. médio repartido;
4. médio bagunçado;
5. longo liso;
6. rabo de cavalo.

O cabelo não pode cobrir os dois olhos. Franjas podem cobrir parcialmente uma sobrancelha, mas as expressões precisam continuar legíveis.

## 7. Kit 2 — Game Boy retrô

### Direção artística

- Inspirado na leitura visual de RPGs portáteis monocromáticos, sem copiar sprites oficiais.
- Pixel art rígida e intencional.
- Paleta visual padrão com quatro tons principais.
- Sem antialiasing, blur, glow ou pixels semitransparentes nas bordas.
- Silhueta extremamente legível.
- Mesmo canvas final de `1024 × 1536`, preservando pixels duros.
- Aparência de pixel ampliado por `nearest-neighbor`, nunca borrado.

### Grade de trabalho recomendada

O desenho pode ser criado originalmente em `256 × 384 px` e ampliado exatamente quatro vezes para `1024 × 1536 px` usando `nearest-neighbor`.

Mesmo nesse processo, cada item continuará sendo entregue como um PNG individual de `1024 × 1536`. Não entregar a grade de trabalho como spritesheet.

### Três corpos vestidos obrigatórios

#### A. Aventureiro clássico

- Camiseta ou jaqueta curta.
- Calça simples.
- Tênis de viagem.
- Poucos blocos de sombra.

#### B. Explorador de rota

- Casaco curto ou colete.
- Calça utilitária.
- Botas claramente identificáveis pela silhueta.
- Bolsos representados sem excesso de ruído visual.

#### C. Campeão portátil

- Uniforme mais marcante.
- Contraste forte entre tronco, pernas e calçados.
- Detalhes suficientes para parecer raro, mantendo legibilidade retrô.

### Recoloração no Game Boy

Além das máscaras normais, fornecer uma versão neutra em quatro tons. O site poderá substituir a paleta inteira sem alterar os índices visuais:

- tom 0: transparente;
- tom 1: luz;
- tom 2: meio-tom;
- tom 3: sombra;
- tom 4: contorno mais escuro, quando necessário.

Não usar degradês.

## 8. Kit 3 — 3DS estilizado

### Direção artística

- Aparência inspirada em RPG portátil tridimensional estilizado.
- Personagem 2D renderizado com sensação de modelo 3D suave.
- Proporção estilizada entre chibi e anime: aproximadamente 4 a 4,5 cabeças de altura.
- Volumes bem definidos, materiais suaves e sombras consistentes.
- Luz frontal neutra.
- Sem cenário, chão ou sombra projetada.
- Bordas transparentes limpas.
- Não usar realismo fotográfico.

### Três corpos vestidos obrigatórios

#### A. Treinador urbano

- Jaqueta ou camiseta moderna.
- Calça casual.
- Tênis de aparência tridimensional.
- Materiais diferentes claramente legíveis.

#### B. Pesquisador de campo

- Colete ou casaco funcional.
- Calça de exploração.
- Botas de campo.
- Detalhes utilitários discretos.

#### C. Competidor veterano

- Uniforme original de competição.
- Jaqueta estruturada.
- Calçado esportivo avançado.
- Acabamento visual mais raro e sofisticado.

### Regras especiais do kit 3DS

- Todos os corpos devem parecer renderizados pela mesma câmera.
- Distância focal, pose e perspectiva não podem variar.
- A direção da luz deve ser idêntica.
- O cabelo traseiro deve encaixar atrás do crânio sem aumentar ou diminuir a cabeça.
- Expressões não podem alterar formato, tamanho ou posição dos olhos.

## 9. Expressões obrigatórias em cada kit

Cada um dos três kits deve receber as mesmas seis expressões:

1. neutro amigável;
2. feliz;
3. determinado;
4. concentrado;
5. surpreso;
6. preocupado.

Cada expressão é um PNG individual. Não colocar todas as expressões em uma única imagem.

## 10. Quantidade inicial por kit

Cada estilo deve entregar, no mínimo:

- 3 corpos completos vestidos;
- 3 máscaras de pele, uma por corpo vestido;
- 6 expressões;
- 6 cabelos traseiros;
- 6 máscaras de cor dos cabelos traseiros;
- 6 cabelos frontais;
- 6 máscaras de cor dos cabelos frontais;
- 1 guia de alinhamento;
- 1 composição de conferência opcional, sem substituir os arquivos individuais.

Total mínimo: **37 PNGs individuais por kit**, além da prévia opcional.

Para os três estilos, o pacote inicial terá pelo menos **111 PNGs individuais**.

## 11. Nomenclatura

Usar apenas letras minúsculas, números e hífens. Não usar espaços ou acentos.

Formato:

```text
wm-avatar-[estilo]-[categoria]-[nome].png
```

Exemplos:

```text
wm-avatar-chibi-body-outfit-starter.png
wm-avatar-chibi-body-outfit-starter-skin-mask.png
wm-avatar-chibi-face-focused.png
wm-avatar-chibi-hair-short-back.png
wm-avatar-chibi-hair-short-back-color-mask.png
wm-avatar-chibi-hair-short-front.png
wm-avatar-gameboy-body-outfit-explorer.png
wm-avatar-gameboy-face-happy.png
wm-avatar-3ds-body-outfit-veteran.png
wm-avatar-3ds-hair-ponytail-front.png
```

## 12. Estrutura de pastas

```text
world-mode-avatar-kits/
  chibi/
    body-outfits/
    skin-masks/
    faces/
    hair-back/
    hair-front/
    hair-color-masks/
    guides/
  gameboy/
    body-outfits/
    skin-masks/
    faces/
    hair-back/
    hair-front/
    hair-color-masks/
    guides/
  3ds/
    body-outfits/
    skin-masks/
    faces/
    hair-back/
    hair-front/
    hair-color-masks/
    guides/
```

Não colocar ZIPs dentro do ZIP principal.

## 13. Fluxo obrigatório de geração

Para cada estilo:

1. Gerar somente um corpo vestido inicial.
2. Aprovar pose, canvas, anatomia e escala.
3. Bloquear esse arquivo como referência-mestre.
4. Criar as outras roupas como edições da mesma referência, sem redesenhar o personagem do zero.
5. Criar um cabelo e dividi-lo em frente e trás.
6. Criar duas expressões.
7. Sobrepor os arquivos e validar o encaixe.
8. Somente depois da aprovação, gerar o restante do kit.

**Não gerar arquivos do mesmo kit em prompts independentes sem usar a imagem-mestre como referência de edição.** Isso altera cabeça, ombros, mãos e proporções, tornando as camadas incompatíveis.

## 14. Texto-base para solicitar cada asset

Usar esta estrutura e substituir somente o tipo de asset solicitado:

```text
Crie UM ÚNICO asset individual para o kit de avatar [CHIBI / GAME BOY / 3DS] do World Mode.

Use a imagem-mestre fornecida como referência obrigatória e preserve exatamente:
- canvas 1024 × 1536;
- posição e tamanho da cabeça;
- posição dos olhos;
- pose corporal;
- ombros, mãos, cintura e pés;
- perspectiva e iluminação;
- estilo visual e escala.

Asset solicitado: [DESCREVER APENAS UMA ROUPA, EXPRESSÃO OU CAMADA DE CABELO].

Entregue somente essa imagem individual, em PNG com fundo realmente transparente.
Não criar spritesheet, grade, montagem, comparação, cenário, texto, legenda ou múltiplas opções.
Não incluir nenhuma peça que não pertença à camada solicitada.
Não mover, redimensionar ou redesenhar o corpo de referência.
```

## 15. Checklist de aprovação

Cada PNG será recusado se qualquer item abaixo falhar:

- [ ] possui exatamente `1024 × 1536 px`;
- [ ] é uma única imagem individual;
- [ ] contém somente um asset;
- [ ] possui transparência alfa real;
- [ ] não possui fundo, cenário, texto ou moldura;
- [ ] não é spritesheet;
- [ ] mantém a pose e o alinhamento do kit;
- [ ] não altera cabeça, ombros, cintura, mãos ou pés;
- [ ] roupas não possuem frestas com pele indevida;
- [ ] corpo vestido já contém roupa inferior e calçados compatíveis;
- [ ] expressão contém somente componentes faciais;
- [ ] cabelo foi separado em frente e trás;
- [ ] cabelo não encobre os dois olhos;
- [ ] máscara possui branco puro e transparência total;
- [ ] não há halo preto ou branco nas bordas;
- [ ] não há blur ou ampliação artificial;
- [ ] o resultado funciona reduzido para 240 × 360 px.

## 16. Primeiro lote para validação

Antes de produzir os 111 arquivos, entregar somente os seguintes arquivos de cada estilo:

1. um corpo vestido iniciante;
2. sua máscara de pele;
3. uma expressão neutra;
4. uma expressão feliz;
5. um cabelo traseiro;
6. sua máscara de cor;
7. o mesmo cabelo frontal;
8. sua máscara de cor.

Esse primeiro lote terá oito PNGs por estilo, totalizando 24 imagens individuais. Depois que as três montagens forem aprovadas no site, o restante poderá ser produzido sem risco de repetir os problemas de encaixe anteriores.
