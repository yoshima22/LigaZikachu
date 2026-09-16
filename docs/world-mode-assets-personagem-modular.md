# World Mode — Especificação de Assets para Personagens Modulares

## 1. O que estamos criando

Estamos construindo um sistema de personagens modulares para o **World Mode da Liga Zikachu**.

Cada jogador poderá montar um treinador próprio combinando corpo-base, rosto, cabelo, roupas, calçados, mochilas e acessórios. O personagem será mostrado:

- no perfil do World Mode;
- nas cidades, rotas e áreas de exploração;
- sobre o mapa regional, indicando a localização atual do jogador;
- ao lado do nome, equipe ativa e insígnias conquistadas;
- em encontros narrativos, telas de combate e interações futuras entre jogadores.

As imagens não devem ser personagens completos e indivisíveis. Elas precisam funcionar como **camadas transparentes encaixáveis**, semelhantes a um sistema de montagem de avatar. Todas as peças de uma mesma vista devem usar exatamente o mesmo canvas, escala, posição corporal e pontos de encaixe.

O objetivo inicial é receber um conjunto visual consistente com **pelo menos 30 partes diferentes**, preferencialmente 45 ou mais, para permitir alto nível de customização sem que as combinações pareçam personagens desconectados.

---

## 2. Direção artística

- Estilo: anime de aventura, treinador de criaturas, acabamento moderno e detalhado.
- Identidade: colorido, competitivo e aventureiro, coerente com o World Mode e com os cenários já produzidos.
- Proporção: personagem estilizado, mas não chibi. Aproximadamente 6,5 a 7 cabeças de altura.
- Perspectiva principal: corpo inteiro, vista frontal em leve três-quartos.
- Pose: neutra, confiante e simétrica o suficiente para receber roupas e acessórios.
- Expressão-base: amigável e determinada, sem emoção exagerada.
- Iluminação: frontal suave, com luz ambiente neutra.
- Sombras: discretas e coerentes entre todas as peças. Não desenhar sombra projetada no chão.
- Contornos: consistentes, limpos e sem serrilhamento.
- Acabamento: alta resolução real, sem ampliação artificial, borrões ou artefatos de compressão.

Não reproduzir personagens oficiais existentes. O conjunto deve ter identidade visual própria e original.

---

## 3. Canvas mestre obrigatório

### Arquivo principal de cada camada

- Dimensão: **1200 × 1800 px**.
- Proporção: **2:3 vertical**.
- Espaço de cor: **sRGB**.
- Profundidade recomendada durante a criação: 8 bits por canal ou superior.
- Exportação: **PNG-24/32 com canal alfa**.
- Fundo: totalmente transparente.
- Personagem inteiro: da cabeça aos pés, sem cortes.
- Margem mínima: 80 px nas laterais, 70 px no topo e 40 px abaixo dos pés.
- Posição dos pés: idêntica em todos os arquivos.
- Centro corporal: idêntico em todas as peças.
- Não recortar automaticamente o canvas ao redor da peça.

Todos os arquivos precisam continuar com **1200 × 1800 px**, mesmo quando a peça ocupar apenas uma área pequena, como óculos ou um broche. Isso permite sobrepor as imagens sem cálculos manuais de posição.

### Guia de alinhamento

Usar um arquivo-guia com:

- linha vertical central em `x = 600`;
- linha dos olhos aproximadamente em `y = 360`;
- linha dos ombros aproximadamente em `y = 515`;
- linha da cintura aproximadamente em `y = 930`;
- linha dos joelhos aproximadamente em `y = 1280`;
- linha-base dos pés aproximadamente em `y = 1690`.

Esses valores podem receber pequenos ajustes durante a primeira montagem, mas, depois de aprovados, devem permanecer fixos em todas as peças.

---

## 4. Regras de transparência e recorte

- O fundo precisa ter alfa real, não branco, preto ou quadriculado desenhado.
- Não deixar halos claros ou escuros ao redor das peças.
- Não usar sombra retangular, vinheta ou brilho que alcance as bordas do canvas.
- Evitar pixels semitransparentes sujos fora da peça.
- Cabelos, cordões, tecidos e partes finas devem manter bordas suaves.
- Áreas que deveriam ficar escondidas pelo corpo ou por outra roupa precisam respeitar a ordem de camadas definida neste documento.
- Não incluir texto, assinatura, marca-d'água, moldura ou interface.
- Não incluir cenário, chão, partículas ou criaturas nas camadas do avatar.

---

## 5. Variações de visualização

### A. Avatar principal — obrigatório

- `1200 × 1800 px`.
- Corpo inteiro em leve três-quartos frontal.
- Usado em perfil, cidade, narrativa e telas de equipe.

### B. Miniatura de mapa — recomendada

- `512 × 512 px`.
- Vista frontal ou três-quartos, da cintura para cima.
- Fundo transparente.
- Silhueta legível mesmo exibida entre 40 e 72 px.
- As mesmas escolhas de cabelo, roupa e acessório devem existir nesta vista.

Não gerar a miniatura apenas reduzindo automaticamente o corpo inteiro. Ela deve ser uma composição própria, com rosto e acessórios legíveis em tamanho pequeno.

### C. Retrato narrativo — etapa futura

- `900 × 1200 px`.
- Da cintura ou peito para cima.
- Fundo transparente.
- Pode incluir expressões diferentes, mantendo o mesmo personagem montado.

Nesta entrega inicial, priorizar o avatar principal. Miniaturas podem ser entregues depois que o encaixe do primeiro conjunto for aprovado.

---

## 6. Ordem oficial das camadas

As peças serão renderizadas de trás para frente nesta ordem:

1. cabelo traseiro;
2. acessórios traseiros, capas e itens presos às costas;
3. corpo-base e pernas;
4. olhos e detalhes faciais;
5. roupa inferior;
6. calçados;
7. roupa superior;
8. casaco, colete ou camada externa;
9. mochila;
10. cabelo frontal;
11. chapéu ou acessório de cabeça;
12. acessórios faciais;
13. acessórios frontais, luvas e itens de mão;
14. efeitos cosméticos opcionais.

Se uma peça exigir ordem diferente, indicar isso no manifesto de assets.

---

## 7. Kit mínimo solicitado — pelo menos 30 partes

O conjunto abaixo possui mais de 50 possibilidades. É aceitável entregar em lotes, mas o primeiro pacote utilizável deve conter no mínimo 30 peças individuais e encaixáveis.

### 7.1 Corpos-base — mínimo 4

1. corpo-base A, estrutura mais estreita;
2. corpo-base B, estrutura intermediária;
3. corpo-base C, estrutura mais larga;
4. corpo-base D, estrutura atlética.

Os corpos podem variar em apresentação e silhueta, sem obrigar rótulos de gênero. Roupas devem informar com quais corpos são compatíveis. Idealmente, cada roupa deve ter uma versão ajustada para todos os corpos.

### 7.2 Tons de pele — mínimo 6

5. tom de pele 01;
6. tom de pele 02;
7. tom de pele 03;
8. tom de pele 04;
9. tom de pele 05;
10. tom de pele 06.

Preferência técnica: produzir o corpo em base neutra preparada para recoloração por máscara. Se isso não for possível, exportar cada variação separadamente.

### 7.3 Olhos e rostos — mínimo 6

11. olhos determinados;
12. olhos amigáveis;
13. olhos concentrados;
14. olhos confiantes;
15. olhos serenos;
16. olhos intensos.

Nariz, boca e sobrancelhas podem acompanhar a camada dos olhos, desde que continuem alinhados ao corpo-base.

### 7.4 Cabelos — mínimo 10 conjuntos

Cada cabelo deve ser separado em `traseiro` e `frontal` quando houver partes passando atrás e à frente do corpo.

17. curto espetado;
18. curto ondulado;
19. médio repartido;
20. médio bagunçado;
21. longo liso;
22. longo ondulado;
23. rabo de cavalo;
24. tranças;
25. cabelo crespo volumoso;
26. corte lateral/undercut.

Entregar preferencialmente uma base clara ou máscaras que permitam recoloração no jogo. Caso as cores sejam rasterizadas, fornecer pelo menos preto, castanho, loiro, ruivo, azul e roxo para alguns modelos.

### 7.5 Roupas superiores — mínimo 8

27. camiseta de treinador iniciante;
28. camisa esportiva;
29. moletom de viagem;
30. jaqueta leve;
31. uniforme urbano;
32. camisa de explorador;
33. blusa de clima frio;
34. uniforme competitivo veterano.

### 7.6 Roupas inferiores — mínimo 6

35. calça de viagem;
36. calça esportiva;
37. short de exploração;
38. calça cargo;
39. saia ou peça equivalente de aventura;
40. calça de uniforme competitivo.

### 7.7 Calçados — mínimo 5

41. tênis básico;
42. tênis esportivo;
43. botas de trilha;
44. botas urbanas;
45. calçado de clima adverso.

### 7.8 Mochilas — mínimo 4

46. mochila pequena;
47. mochila média;
48. mochila de expedição;
49. bolsa lateral compacta.

As mochilas visuais devem corresponder às categorias mecânicas de capacidade já existentes no World Mode.

### 7.9 Cabeça e rosto — mínimo 8

50. boné clássico original;
51. gorro;
52. chapéu de explorador;
53. viseira esportiva;
54. óculos comuns;
55. óculos escuros;
56. faixa de cabeça;
57. comunicador lateral.

### 7.10 Acessórios — mínimo 8

58. luvas de treinador;
59. pulseira tecnológica;
60. relógio de aventura;
61. cachecol;
62. broche de liga;
63. cinto de cápsulas;
64. cantil;
65. mapa dobrado ou dispositivo de navegação.

### 7.11 Cosméticos raros — opcionais

66. aura ciano discreta;
67. aura magenta discreta;
68. partículas de folhas;
69. partículas elétricas;
70. acabamento de campeão.

Efeitos devem ser exportados separados do personagem e não podem prejudicar a leitura do mapa.

---

## 8. Compatibilidade e encaixe

Cada peça deve informar:

- categoria;
- corpos compatíveis;
- vista;
- posição na ordem de camadas;
- possibilidade de recoloração;
- peças incompatíveis;
- se exige uma versão traseira e uma frontal;
- raridade cosmética sugerida: comum, incomum, rara ou especial.

Nenhuma peça pode alterar a pose, posição da cabeça, altura dos ombros ou local dos pés. Roupas devem acompanhar exatamente a anatomia do corpo compatível.

Itens de mão precisam usar uma mão-base comum. Não modificar a pose do braço para cada item no primeiro lote. Caso sejam desejadas poses alternativas no futuro, elas devem ser tratadas como um conjunto completo e explicitamente incompatível com a pose neutra.

### Regra crítica para gerar roupas

Não gerar cada roupa como uma nova ilustração independente. Mesmo usando o mesmo canvas, isso altera ombros, cintura, pernas e pés e produz peças visualmente maiores ou deslocadas.

O fluxo obrigatório é:

1. manter o corpo-base aprovado como referência bloqueada;
2. desenhar ou gerar a roupa diretamente por cima desse corpo;
3. preservar pose, anatomia, escala e enquadramento do corpo sem qualquer alteração;
4. remover o corpo da saída usando uma máscara, deixando somente a peça de roupa;
5. sobrepor novamente a peça exportada sobre o corpo original;
6. comparar a composição pixel a pixel com a prévia aprovada.

Para calçados, a base dos pés não pode mudar. Para calças, cintura e cavalo precisam coincidir com o corpo. Para camisas, pescoço, ombros e aberturas das mangas precisam seguir a anatomia original. Uma prévia bonita não é suficiente: a própria camada transparente deve ser testada sobre o PNG original do corpo-base.

---

## 9. Nomenclatura dos arquivos

Usar letras minúsculas, números e hífens, sem espaços e sem acentos.

Formato:

`wm-avatar-[vista]-[categoria]-[nome]-[corpo]-[variante].png`

Exemplos:

- `wm-avatar-full-body-base-a-skin-03.png`
- `wm-avatar-full-hair-back-ponytail-all-black.png`
- `wm-avatar-full-hair-front-ponytail-all-black.png`
- `wm-avatar-full-top-explorer-shirt-a-green.png`
- `wm-avatar-full-bottom-cargo-pants-a-khaki.png`
- `wm-avatar-full-shoes-hiking-boots-all-brown.png`
- `wm-avatar-full-backpack-expedition-all-olive.png`
- `wm-avatar-map-hair-front-ponytail-all-black.png`

Usar `all` somente quando a mesma imagem realmente encaixar em todos os corpos.

---

## 10. Estrutura de pastas esperada

```text
world-mode-avatar-assets/
  README.txt
  manifest.json
  guides/
    avatar-alignment-guide.png
    avatar-composite-example.png
  full/
    body/
    face/
    hair-back/
    hair-front/
    tops/
    bottoms/
    outerwear/
    shoes/
    backpacks/
    headwear/
    face-accessories/
    front-accessories/
    effects/
  map/
    body/
    face/
    hair-back/
    hair-front/
    outfits/
    accessories/
  previews/
    combinations/
```

O arquivo ZIP não deve conter outra pasta ZIP dentro dele.

---

## 11. Manifesto recomendado

Entregar um `manifest.json` com uma entrada por arquivo:

```json
{
  "version": 1,
  "canvas": { "width": 1200, "height": 1800 },
  "colorSpace": "sRGB",
  "assets": [
    {
      "id": "hair-ponytail-black",
      "label": "Rabo de cavalo preto",
      "category": "hair",
      "frontFile": "full/hair-front/wm-avatar-full-hair-front-ponytail-all-black.png",
      "backFile": "full/hair-back/wm-avatar-full-hair-back-ponytail-all-black.png",
      "compatibleBodies": ["a", "b", "c", "d"],
      "layer": 10,
      "recolorable": false,
      "rarity": "common",
      "incompatibleWith": []
    }
  ]
}
```

---

## 12. Arquivos de prévia obrigatórios

Além das camadas transparentes, entregar:

- uma montagem com o corpo-base e linhas-guia;
- uma montagem mostrando a ordem das camadas;
- pelo menos 12 combinações completas diferentes;
- pelo menos 4 combinações usando cada corpo-base;
- uma folha exibindo todas as peças por categoria;
- uma prévia em tamanho real de interface, com o avatar reduzido para 320 px de altura;
- uma prévia do marcador de mapa em 64 × 64 px.

As montagens são apenas para conferência. As peças individuais continuam sendo a entrega principal.

---

## 13. Checklist de qualidade

Antes de entregar, confirmar:

- [ ] todos os arquivos principais têm exatamente 1200 × 1800 px;
- [ ] todos usam fundo transparente real;
- [ ] nenhum arquivo foi ampliado artificialmente;
- [ ] pés, cabeça, olhos, cintura e ombros permanecem alinhados;
- [ ] roupas não deixam frestas visíveis sobre os corpos compatíveis;
- [ ] cabelos traseiros e frontais foram separados quando necessário;
- [ ] acessórios não atravessam indevidamente cabelo ou roupa;
- [ ] nomes dos arquivos seguem o padrão;
- [ ] o manifesto lista todos os assets;
- [ ] há pelo menos 30 partes individuais utilizáveis;
- [ ] existem 12 montagens de teste visualmente diferentes;
- [ ] imagens reduzidas continuam legíveis;
- [ ] não há texto, cenário, marca-d'água ou personagem oficial reproduzido;
- [ ] PNGs foram conferidos sobre fundos claro, escuro e colorido.

---

## 14. Processo recomendado de entrega

Para reduzir retrabalho, produzir nesta ordem:

1. um único corpo-base;
2. dois rostos;
3. dois cabelos completos;
4. duas roupas superiores;
5. duas roupas inferiores;
6. dois calçados;
7. uma mochila;
8. uma montagem final de teste.

Depois da aprovação do encaixe, expandir para o kit completo de 30 a 70 partes. Não produzir dezenas de peças antes de validar o canvas mestre, pois uma pequena mudança de alinhamento tornaria todas incompatíveis.

## 15. Entrega final

Entregar um único arquivo ZIP contendo:

- PNGs originais com transparência;
- manifesto JSON;
- guia de alinhamento;
- montagens de conferência;
- relação de peças e compatibilidades;
- arquivos-fonte em PSD, Krita ou formato equivalente, se disponíveis.

Não converter a entrega principal para JPG. WebP poderá ser criado durante a integração e enviado ao Storage do projeto depois da validação dos PNGs mestres.
