# Laços — como o sistema monta as histórias (e o que falta para variedade)

Este documento explica **exatamente** como as frases dos acontecimentos do Refúgio
são geradas hoje, onde ficam no código, quantas combinações existem, por que soam
repetitivas, e **em que formato** você deve trazer o novo banco de frases para eu
plugar de forma modular. A ideia é que a história de **cada mascote seja única** em
relação às outras.

Todo o texto vive em [`src/lib/mascot-bonds-v2.ts`](../src/lib/mascot-bonds-v2.ts).

---

## 1. A anatomia de um acontecimento

Quando um ciclo do Refúgio roda (`simulateRefugeMoment`), o jogo escolhe **2 mascotes**
(um do dono + um visitante de outra conta, quando existe), um **local** e decide se o
momento é **positivo** ou **conflito**. A frase-história é montada por concatenação:

```
[ABERTURA] [Nome1] e [Nome2] [VERBO-DO-LOCAL] quando [REAÇÃO]. [DESFECHO]
```

Exemplo real (Horta, positivo):
> *"Durante uma pausa na rotina, Zigzagoon e Eevee cuidaram da Horta quando a divisão
> da colheita virou assunto. No fim, dividiram a colheita sem precisar contar as partes."*

Cada `[...]` é sorteado de um "banco" (array). O `pick()` é um sorteio uniforme simples.

### Os 4 bancos atuais

| Peça | Fonte no código | Depende de | Quantidade |
|---|---|---|---|
| **ABERTURA** (`OPENINGS`) | genérica, igual para tudo | nada | **9** frases |
| **VERBO-DO-LOCAL** | fixo por local, dentro de `descriptions` | local | 1 por local ("cuidaram da Horta", "treinou com", "dividiu o descanso com", "encontrou … no Pátio") |
| **REAÇÃO** (`REACTIONS`) | por local | local | **7** por local |
| **DESFECHO** (`POSITIVE_ENDINGS` / `CONFLICT_ENDINGS`) | por local + resultado | local, positivo/conflito | **3** por local por resultado |

### Quantas histórias diferentes existem hoje?

Para um dado **local** e **resultado**:

```
9 (abertura) × 7 (reação) × 3 (desfecho) = 189 esqueletos
```

Ou seja: **189 combinações por (local × resultado)** → 4 locais × 2 resultados = 1.512 no total.
Parece muito, mas o problema é **qualidade, não quantidade** (ver seção 3).

---

## 2. Como o resultado (positivo vs. conflito) é decidido

Em `simulateRefugeMoment`:

- `socialDelta(location, personality)` dá a variação-base de relação:
  - **Campo de Treino:** `COMPETITIVE` → −5, senão −2 (sempre tende a conflito)
  - **Descanso:** `SERENE`/`TIMID` → +5, senão +3
  - **Horta:** `GLUTTON` → −2, senão +4
  - **Pátio:** `PLAYFUL`/`CURIOUS` → +5, senão +3
- `conflict = delta < 0 OU random < (TREINO 0.55 / resto 0.18)`

**É por isso que a rivalidade só "aparece" no Campo de Treino.** Nos outros locais a chance
de conflito é 18% e o delta-base é positivo, então na prática vira **farm de amizade**.
(Isso conecta com o seu pedido de deixar a rivalidade mais presente — ver seção 5.)

---

## 3. Por que soa repetitivo (a raiz do problema)

As frases atuais **não sabem nada sobre os mascotes envolvidos**. O sorteio ignora:

- **Personalidade** de cada um (um Guloso e um Tímido recebem a mesma reação genérica).
- **Espécie / tipo** (um Charizard e um Magikarp "cuidam da Horta" com o mesmo texto).
- **Nível da relação** (Conhecidos e Quase-Irmãos recebem o mesmo desfecho).
- **Histórico** (memórias anteriores entre os dois nunca são citadas).

Resultado: dois pares totalmente diferentes recebem histórias **estruturalmente idênticas**,
trocando só os nomes. Como a REAÇÃO e o DESFECHO são genéricos, a sensação de repetição
aparece rápido — o jogador percebe o "molde".

As **memórias** (`mascotBondMemory`) guardam a frase final e um `memoryType`
(`TRABALHARAM_JUNTOS`, `TREINARAM_JUNTOS`, `DESCANSARAM_JUNTOS`, `ENCONTRO_NO_PATIO`,
`RECURSO_DE_LACOS`), mas **não** guardam "ingredientes" que permitiriam variar o texto
por personalidade/tier depois.

---

## 4. As "perguntinhas" (eventos importantes) — já têm mais variedade

Quando um momento vira **importante**, `buildImportantRefugeOptions` gera 4 opções para o
jogador. Aqui já existe mais riqueza: cada uma das 4 posições sorteia entre **3 variantes**
(positivas/agressivas/neutras), com efeitos diferentes (relação, felicidade, EXP, custo de item).
Isso é bom e serve de **modelo** para o que quero fazer com as frases-história: **sortear
variante dentro de um "slot" tematizado**, em vez de concatenar bancos planos.

---

## 5. O que preciso de você (formato do novo banco modular)

Quero sair de "bancos planos genéricos" para **frases marcadas (tagged)**, para que o
sorteio possa escolher a frase certa para **aqueles** mascotes. O ideal é você trazer as
frases já **etiquetadas** pelos eixos abaixo. Não precisa preencher todos — quanto mais
eixos uma frase tiver, mais específica (e única) ela fica; frases sem etiqueta viram
"curinga" e valem para qualquer caso.

### 5.1 Eixos de etiqueta (o vocabulário controlado)

- **`local`**: `GARDEN` | `TRAINING` | `REST` | `YARD` | `ANY`
- **`resultado`**: `POSITIVE` | `CONFLICT` | `ANY`
- **`slot`**: `ABERTURA` | `REACAO` | `DESFECHO` (mesma estrutura de hoje, mas etiquetada)
- **`personalidade`** (opcional, de quem "puxa" a cena): `COMPETITIVE`, `GLUTTON`,
  `SERENE`, `TIMID`, `PLAYFUL`, `CURIOUS`, `LAZY`, `BRAVE`, … (as chaves de `MascotPersonality`)
- **`tier`** (opcional, faixa da relação atual): `NEMESIS` | `INIMIGO` | `RIVAL` |
  `CONHECIDO` | `COLEGA` | `AMIGO` | `SUPER_AMIGO` | `ANY`
- **`tipoElemental`** (opcional): `fire`, `water`, `bug`, … quando a frase citar o elemento

### 5.2 Placeholders permitidos dentro da frase

Para o texto se referir aos envolvidos e ao contexto, use marcadores que eu substituo:

- `{A}` = nome do mascote 1 · `{B}` = nome do mascote 2
- `{DONO_A}` / `{DONO_B}` = nome do treinador de cada um
- `{ELEMENTO_A}` / `{ELEMENTO_B}` = tipo (fogo, água…)
- `{LOCAL}` = nome do local (Horta, Campo de Treino…)
- `{PERSONALIDADE_A}` = rótulo da personalidade

> Regra de ouro: uma frase de **REAÇÃO** ou **DESFECHO** que cite `{ELEMENTO_A}`,
> `{PERSONALIDADE_A}` ou o `tier` já deixa de ser genérica — é isso que quebra a repetição.

### 5.3 Formato de entrega sugerido (JSON ou tabela)

Prefiro **JSON** (plugo direto), mas uma tabela também serve. Exemplo JSON:

```json
[
  { "slot": "ABERTURA", "local": "ANY", "resultado": "ANY", "texto": "Assim que o sino do Refúgio soou," },
  { "slot": "REACAO", "local": "TRAINING", "resultado": "CONFLICT", "personalidade": "COMPETITIVE",
    "texto": "{A}, do tipo {ELEMENTO_A}, recusou baixar a guarda e provocou {B} de novo" },
  { "slot": "DESFECHO", "local": "TRAINING", "resultado": "CONFLICT", "tier": "RIVAL",
    "texto": "A rivalidade entre {A} e {B} ganhou nome — e uma revanche marcada." },
  { "slot": "DESFECHO", "local": "REST", "resultado": "POSITIVE", "personalidade": "TIMID",
    "texto": "{A}, tímido, adormeceu perto de {B} pela primeira vez sem se afastar." }
]
```

Equivalente em tabela (colunas): `slot | local | resultado | personalidade | tier | tipoElemental | texto`.

### 5.4 Quanta variedade mirar (meta prática)

Para "cada mascote com história única", uma meta boa por eixo:

- **ABERTURA:** de 9 → **~30** (algumas etiquetadas por local/resultado).
- **REACAO:** de 7/local → **~15–20 por local**, das quais metade etiquetada por
  personalidade **ou** tier **ou** elemento.
- **DESFECHO:** de 3/local/resultado → **~10 por local por resultado**, com variantes por tier
  (Conhecido soa diferente de Super Amigo; Rival diferente de Nêmesis).
- **VERBO-DO-LOCAL:** hoje é 1 fixo por local; me traga **3–4** por local para variar o miolo.

Com isso o esqueleto sai de 189 → milhares de combinações **e**, mais importante, cada frase
passa a "encaixar" nos mascotes certos, então a repetição percebida cai muito mais do que o
número sugere.

---

## 6. O que eu faço quando você trouxer o banco

1. Substituo os arrays planos por um **banco etiquetado** + uma função `pickTagged(slot, ctx)`
   que filtra por `{local, resultado, personalidade, tier, elemento}` e cai em curinga quando
   não houver match — sem quebrar nada existente.
2. Passo a gravar nas memórias os **ingredientes** (personalidades, tier, elemento, ids das
   frases sorteadas) para permitir citar histórico em acontecimentos futuros ("como da última
   vez na Horta…").
3. Reequilibro a chance de conflito por local para a rivalidade aparecer fora do Treino
   (ligado ao seu pedido dos itens de rivalidade e combates — trato num passo à parte).

---

### Resumo de uma linha
Hoje as histórias são **3 bancos genéricos concatenados** (189 moldes por local/resultado) que
**ignoram** personalidade, espécie, tier e histórico. Me traga frases **etiquetadas** por
`slot/local/resultado/personalidade/tier/elemento` com os placeholders `{A} {B} {DONO_A} …` e
eu faço o sorteio virar contextual, deixando a história de cada mascote única.
