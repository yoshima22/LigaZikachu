# Laços — expansão massiva do sistema de histórias modulares

> Documento de conteúdo + especificação narrativa para ampliar `src/lib/mascot-bonds-v2.ts` sem perder compatibilidade com o sistema atual.

## 0. Objetivo

O sistema atual já combina abertura, reação e desfecho, mas a percepção de repetição continua alta porque o texto raramente reconhece **quem são os mascotes, qual é a relação entre eles e o que já aconteceu antes**. Esta expansão mantém o modelo modular atual e acrescenta uma camada de continuidade para que o Refúgio conte pequenas histórias ao longo de dias ou semanas.

A meta não é apenas aumentar o número de frases. É fazer com que duas duplas diferentes **tenham trajetórias diferentes**, e que a mesma dupla possa construir: primeira impressão → hábito → conflito → revanche → reconciliação → piada interna → tradição.

### Escopo desta entrega

- **46 aberturas**.
- **24 verbos de local**.
- **212 reações** já etiquetadas por local/resultado e, quando aplicável, personalidade, tier ou elemento.
- **94 desfechos**.
- **32 callbacks de memória**.
- **16 arcos narrativos**, com **64 capítulos/beats**.
- **4 eventos importantes** prontos para alimentar as perguntinhas.
- Total de **472 peças narrativas** descritas no arquivo, sem contar as combinações resultantes.

**Observação importante:** o documento-base enumera explicitamente as personalidades `COMPETITIVE`, `GLUTTON`, `SERENE`, `TIMID`, `PLAYFUL`, `CURIOUS`, `LAZY` e `BRAVE`; por isso esta entrega não inventa novas chaves. Da mesma forma, para `tipoElemental` foram usados como valores específicos apenas `fire`, `water` e `bug`, que são os exemplos nomeados no documento-base. As demais chaves reais devem ser preenchidas a partir do enum do projeto.

---

## 1. Compatibilidade: o sistema pode crescer sem jogar fora o modelo atual

A seleção básica continua funcionando com `slot + local + resultado + personalidade + tier + tipoElemental`. O banco abaixo pode ser plugado gradualmente. Os campos extras são recomendados para reduzir repetição percebida e construir continuidade.

### 1.1 Campos recomendados

```json
{
  "id": "rea_training_conflict_p_competitive",
  "slot": "REACAO",
  "local": "TRAINING",
  "resultado": "CONFLICT",
  "personalidade": "COMPETITIVE",
  "tier": "RIVAL",
  "tipoElemental": "ANY",
  "familiaNarrativa": "competicao_revanche",
  "peso": 1.4,
  "cooldownPair": 12,
  "texto": "{A} se recusou a baixar a guarda e tratou cada acerto de {B} como provocação pessoal"
}
```

| Campo | Função | Obrigatório agora? |
|---|---|---|
| `id` | Identificador estável da frase. Permite cooldown e histórico. | Recomendado |
| `slot` | `ABERTURA`, `VERBO_LOCAL`, `REACAO`, `DESFECHO`, `CALLBACK`. | Sim |
| `local` | `GARDEN`, `TRAINING`, `REST`, `YARD`, `ANY`. | Sim |
| `resultado` | `POSITIVE`, `CONFLICT`, `ANY`. | Sim |
| `personalidade` | Personalidade de quem puxa a cena. | Opcional |
| `tier` | Relação atual. | Opcional |
| `tipoElemental` | Tipo necessário para a frase fazer sentido. | Opcional |
| `familiaNarrativa` | Agrupa frases semanticamente parecidas. Evita repetir a mesma *ideia* com palavras diferentes. | Novo |
| `peso` | Peso relativo depois que a frase passou pelos filtros. | Novo |
| `cooldownPair` | Quantos momentos daquela dupla devem passar antes de repetir o mesmo `id`/família. | Novo |
| `requerMemoria` | Marca frases que só podem aparecer quando existe histórico recuperável. | Novo |

### 1.2 Placeholders adicionais recomendados

Os placeholders atuais continuam válidos. Para continuidade real, vale acrescentar:

- `{MEMORIA_LOCAL}`: local de um acontecimento anterior recuperado.
- `{MEMORIA_RESUMO}`: resumo curto estruturado do acontecimento anterior.
- `{CONTAGEM_ENCONTROS}`: quantidade de encontros relevantes da dupla.
- `{OBJETO_MEMORIA}`: objeto persistente criado por um arco, quando existir.

Esses quatro são **novos** e exigem suporte de código; por isso o banco principal continua funcionando mesmo sem eles. Apenas as entradas `CALLBACK` dependem de memória.

---

## 2. Regra anti-repetição: não basta sortear

Sugestão de seleção por pontuação, em vez de `pick()` uniforme:

1. Filtrar por `slot`, `local` e `resultado`.
2. Dar bônus por especificidade: `personalidade`, `tier`, `tipoElemental` que realmente casem com o contexto.
3. Remover frases incompatíveis.
4. Penalizar `id` usado recentemente pela mesma dupla.
5. Penalizar `familiaNarrativa` usada recentemente pela mesma dupla, mesmo que o texto seja outro.
6. Dar bônus a `CALLBACK` quando houver memória compatível.
7. Dar bônus ao próximo `beat` de um arco ativo.
8. Só então sortear pelo `peso` final.

### 2.1 Cooldowns sugeridos

| Coisa repetida | Cooldown sugerido |
|---|---:|
| Mesmo `id` para a mesma dupla | 20 momentos da dupla |
| Mesma `familiaNarrativa` para a mesma dupla | 8 momentos |
| Mesmo `id` globalmente | 4 ciclos do Refúgio |
| Mesma abertura | 5 acontecimentos exibidos ao mesmo jogador |
| Mesmo arco depois do `PAYOFF` | Nunca reiniciar para a mesma dupla, salvo reset explícito |

### 2.2 Regra de diversidade semântica

O ponto mais importante é armazenar também `familiaNarrativa`. Duas frases como “disputaram a melhor parte da colheita” e “brigaram pela parte mais bonita da colheita” são diferentes para um `id`, mas iguais para o jogador. O cooldown precisa alcançar a **família**, não só a frase.

---

## 3. Memória estruturada da dupla

Além da frase final já armazenada, cada memória deveria registrar ingredientes mínimos:

```ts
type BondStoryMemory = {
  pairKey: string
  phraseIds: string[]
  families: string[]
  local: 'GARDEN' | 'TRAINING' | 'REST' | 'YARD'
  resultado: 'POSITIVE' | 'CONFLICT'
  tierAtMoment: string
  personalityA?: string
  personalityB?: string
  elementA?: string
  elementB?: string
  arcId?: string
  arcBeat?: 'SETUP' | 'DEVELOPMENT' | 'TURN' | 'PAYOFF'
  tagsCreated?: string[]
  tagsConsumed?: string[]
  createdAt: Date
}
```

Isso permite que o sistema saiba não apenas **o texto que foi mostrado**, mas **o que aconteceu**.

---

## 4. Arcos: como transformar eventos soltos em histórias

Um arco é uma sequência curta opcional. Ele não bloqueia os eventos normais. Quando uma cena cria um `arcId`, encontros posteriores da mesma dupla ganham chance de puxar o próximo beat.

### Regras

- Um arco pode demorar vários dias para avançar.
- Não precisa avançar em encontros consecutivos.
- Um conflito pode virar amizade; uma amizade pode gerar um conflito sem apagar o histórico.
- `PAYOFF` deve criar uma tag persistente curta, como `PIADA_INTERNA_PATIO` ou `LUGAR_COMPARTILHADO_REST`.
- Tags persistentes liberam callbacks raros no futuro.
- A dupla deve ter no máximo **2 arcos ativos** ao mesmo tempo para evitar novela ilegível.

### Banco de arcos

```json
[
  {
    "arcId": "horta_colheita_dividida",
    "local": "GARDEN",
    "titulo": "A cesta no meio",
    "beats": [
      [
        "SETUP",
        "ANY",
        "Os dois encontram a melhor parte da colheita ao mesmo tempo e nenhum sabe ainda se deve dividir ou disputar."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "Em outro encontro, a lembrança da cesta reaparece quando {A} tenta escolher primeiro."
      ],
      [
        "TURN",
        "POSITIVE",
        "Dessa vez, {B} separa duas partes antes mesmo de {A} pedir."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "A antiga disputa vira tradição: sempre que trabalham juntos, um separa a primeira parte para o outro."
      ]
    ]
  },
  {
    "arcId": "horta_canteiro_secreto",
    "local": "GARDEN",
    "titulo": "O canteiro secreto",
    "beats": [
      [
        "SETUP",
        "POSITIVE",
        "{A} mostra a {B} um pequeno canto da Horta que costuma observar sozinho."
      ],
      [
        "DEVELOPMENT",
        "ANY",
        "Os dois passam a verificar o mesmo canto sempre que coincidem na Horta."
      ],
      [
        "TURN",
        "CONFLICT",
        "Uma alteração no canteiro faz cada um suspeitar que o outro mexeu sem avisar."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "Depois de descobrir o mal-entendido, o canteiro passa a ser tratado como um projeto dos dois."
      ]
    ]
  },
  {
    "arcId": "horta_ferramenta",
    "local": "GARDEN",
    "titulo": "A ferramenta disputada",
    "beats": [
      [
        "SETUP",
        "CONFLICT",
        "Uma ferramenta preferida vira motivo de disputa entre {A} e {B}."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "Nos encontros seguintes, ambos tentam chegar primeiro à mesma ferramenta."
      ],
      [
        "TURN",
        "POSITIVE",
        "Um deles encontra outra ferramenta melhor e entrega a antiga sem provocação."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "A ferramenta deixa de ser prêmio e vira uma piada recorrente entre os dois."
      ]
    ]
  },
  {
    "arcId": "horta_planta_quebrada",
    "local": "GARDEN",
    "titulo": "Quem quebrou?",
    "beats": [
      [
        "SETUP",
        "CONFLICT",
        "Uma planta aparece danificada enquanto {A} e {B} trabalham próximos."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "Os dois passam a se vigiar mais do que deveriam durante as tarefas."
      ],
      [
        "TURN",
        "ANY",
        "Um novo detalhe mostra que nenhum dos dois tinha causado o dano."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "A desconfiança vira constrangimento e, depois, um cuidado exagerado em não culpar o outro cedo demais."
      ]
    ]
  },
  {
    "arcId": "treino_revanche",
    "local": "TRAINING",
    "titulo": "A revanche",
    "beats": [
      [
        "SETUP",
        "CONFLICT",
        "Uma disputa termina sem consenso sobre quem venceu."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "Toda vez que se encontram no treino, um dos dois menciona o resultado anterior."
      ],
      [
        "TURN",
        "ANY",
        "Uma nova disputa termina empatada de um jeito difícil de contestar."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "A necessidade de provar superioridade começa a virar respeito pela persistência do outro."
      ]
    ]
  },
  {
    "arcId": "treino_tecnica_copiada",
    "local": "TRAINING",
    "titulo": "A técnica copiada",
    "beats": [
      [
        "SETUP",
        "ANY",
        "{A} percebe um movimento característico de {B} e tenta reproduzi-lo."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "{B} interpreta a imitação como provocação e exige que {A} pare."
      ],
      [
        "TURN",
        "POSITIVE",
        "{A} admite que estava tentando aprender, não zombar."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "{B} passa a corrigir a técnica de {A}, e o movimento ganha uma versão que pertence aos dois."
      ]
    ]
  },
  {
    "arcId": "treino_protecao",
    "local": "TRAINING",
    "titulo": "Treino interrompido",
    "beats": [
      [
        "SETUP",
        "ANY",
        "Um exercício sai do controle e um dos dois interrompe antes que o outro se machuque."
      ],
      [
        "DEVELOPMENT",
        "POSITIVE",
        "Nos treinos seguintes, ambos passam a prestar mais atenção aos limites do parceiro."
      ],
      [
        "TURN",
        "CONFLICT",
        "Um deles confunde cautela com falta de confiança e reage mal."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "Depois de esclarecer o motivo, proteção deixa de parecer condescendência e vira sinal de respeito."
      ]
    ]
  },
  {
    "arcId": "treino_placar",
    "local": "TRAINING",
    "titulo": "O placar que ninguém esquece",
    "beats": [
      [
        "SETUP",
        "CONFLICT",
        "{A} começa a registrar vitórias e derrotas dos encontros com {B}."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "O placar passa a ser citado em qualquer exercício, mesmo quando não faz sentido."
      ],
      [
        "TURN",
        "POSITIVE",
        "Uma sessão cooperativa não cabe no placar e força os dois a medir sucesso de outro jeito."
      ],
      [
        "PAYOFF",
        "ANY",
        "O placar continua existindo, mas agora registra também desafios concluídos em conjunto."
      ]
    ]
  },
  {
    "arcId": "rest_lugar_favorito",
    "local": "REST",
    "titulo": "O lugar favorito",
    "beats": [
      [
        "SETUP",
        "CONFLICT",
        "{A} e {B} descobrem que preferem exatamente o mesmo lugar para descansar."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "Cada encontro começa com uma corrida discreta para chegar primeiro."
      ],
      [
        "TURN",
        "POSITIVE",
        "Num dia mais tranquilo, um deles abre espaço sem ser solicitado."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "O lugar deixa de ter dono e passa a ser reconhecido como o canto que os dois dividem."
      ]
    ]
  },
  {
    "arcId": "rest_silencio",
    "local": "REST",
    "titulo": "Silêncio confortável",
    "beats": [
      [
        "SETUP",
        "ANY",
        "Os dois passam uma pausa inteira próximos sem trocar nenhum gesto claro."
      ],
      [
        "DEVELOPMENT",
        "POSITIVE",
        "O mesmo silêncio se repete em outro dia, agora sem qualquer tensão."
      ],
      [
        "TURN",
        "CONFLICT",
        "Uma tentativa de quebrar a rotina silenciosa acontece na hora errada."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "Os dois encontram um jeito próprio de sinalizar quando querem companhia e quando querem distância."
      ]
    ]
  },
  {
    "arcId": "rest_pesadelo",
    "local": "REST",
    "titulo": "Acordar assustado",
    "beats": [
      [
        "SETUP",
        "ANY",
        "{A} acorda assustado e encontra {B} ainda por perto."
      ],
      [
        "DEVELOPMENT",
        "POSITIVE",
        "Em outro descanso, {B} escolhe ficar mais próximo sem mencionar o ocorrido."
      ],
      [
        "TURN",
        "ANY",
        "{A} percebe o padrão e entende que a presença de {B} foi intencional."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "A Área de Descanso vira um dos poucos lugares em que {A} baixa a guarda completamente perto de {B}."
      ]
    ]
  },
  {
    "arcId": "rest_ruido",
    "local": "REST",
    "titulo": "O barulho irritante",
    "beats": [
      [
        "SETUP",
        "CONFLICT",
        "Um hábito barulhento de {A} interrompe repetidamente o descanso de {B}."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "{B} passa a evitar descansar perto de {A}."
      ],
      [
        "TURN",
        "POSITIVE",
        "{A} percebe o motivo e muda o hábito sem que ninguém peça novamente."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "A mudança é reconhecida por {B}, e o problema antigo vira exemplo de que os dois conseguem se ajustar."
      ]
    ]
  },
  {
    "arcId": "yard_objeto_perdido",
    "local": "YARD",
    "titulo": "O objeto perdido",
    "beats": [
      [
        "SETUP",
        "ANY",
        "{A} encontra algo no Pátio e {B} afirma já estar procurando aquilo."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "Nenhum dos dois concorda sobre quem deveria ficar com o objeto enquanto procuram o dono."
      ],
      [
        "TURN",
        "POSITIVE",
        "Os dois descobrem juntos a quem o objeto pertence e precisam devolvê-lo."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "A antiga disputa vira uma lembrança engraçada sempre que algo perdido aparece no Pátio."
      ]
    ]
  },
  {
    "arcId": "yard_corrida",
    "local": "YARD",
    "titulo": "A corrida do Pátio",
    "beats": [
      [
        "SETUP",
        "CONFLICT",
        "Uma corrida improvisada termina com resultado contestado."
      ],
      [
        "DEVELOPMENT",
        "CONFLICT",
        "Novas corridas aparecem sempre que os dois se encontram."
      ],
      [
        "TURN",
        "POSITIVE",
        "Um obstáculo força um deles a parar para ajudar o outro."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "As corridas continuam, mas ninguém mais considera vitória chegar sozinho."
      ]
    ]
  },
  {
    "arcId": "yard_piada_interna",
    "local": "YARD",
    "titulo": "A piada que só os dois entendem",
    "beats": [
      [
        "SETUP",
        "POSITIVE",
        "Um acidente bobo faz {A} e {B} reagirem do mesmo jeito."
      ],
      [
        "DEVELOPMENT",
        "POSITIVE",
        "A lembrança reaparece em pequenos gestos sempre que se encontram."
      ],
      [
        "TURN",
        "ANY",
        "Um terceiro mascote tenta entender e deixa a situação ainda mais engraçada para os dois."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "A piada vira um marcador da relação: basta um gesto para ambos lembrarem de toda a história."
      ]
    ]
  },
  {
    "arcId": "yard_curiosidade",
    "local": "YARD",
    "titulo": "O canto que ninguém usa",
    "beats": [
      [
        "SETUP",
        "ANY",
        "{A} percebe que {B} sempre visita o mesmo canto pouco movimentado do Pátio."
      ],
      [
        "DEVELOPMENT",
        "ANY",
        "Depois de alguns encontros, {A} decide acompanhar sem perguntar."
      ],
      [
        "TURN",
        "CONFLICT",
        "{B} interpreta a presença como invasão e reage mal."
      ],
      [
        "PAYOFF",
        "POSITIVE",
        "Quando o motivo é esclarecido, o canto deixa de ser secreto e passa a ser um ponto de encontro dos dois."
      ]
    ]
  }
]
```

---

## 5. Banco modular principal

O bloco abaixo é conteúdo pronto para conversão em constante/JSON. `VERBO_LOCAL` é um slot novo apenas para substituir o verbo fixo atual; se preferir, ele pode continuar em um mapa separado.

```json
[
  {
    "id": "op_any_01",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Em um intervalo que parecia comum,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_02",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Sem que nenhum treinador precisasse chamar,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_03",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Quando o Refúgio ficou mais silencioso,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_04",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Entre uma atividade e outra,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_05",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "No meio da rotina do Refúgio,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_06",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Pouco depois da chegada de um visitante,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_07",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Antes que alguém percebesse o que estava acontecendo,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_08",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Quando os dois acabaram no mesmo canto,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_09",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Num daqueles encontros que começam sem planejamento,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_10",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Enquanto os treinadores cuidavam de outras coisas,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_11",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Quando ninguém parecia estar prestando atenção,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_12",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "ANY",
    "texto": "Depois de alguns minutos dividindo o mesmo espaço,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_13",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "O clima estava surpreendentemente leve quando",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_14",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Uma pequena gentileza mudou o ritmo do momento quando",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_15",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Sem fazer alarde, algo começou a aproximá-los quando",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_16",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "O encontro tomou um rumo melhor do que o esperado quando",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_17",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "A tranquilidade durou pouco quando",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_18",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "Bastou um detalhe para a tensão aparecer quando",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_19",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "O encontro começou normal, mas ganhou outro tom quando",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_any_20",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "Uma implicância antiga pareceu voltar à tona quando",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_garden_01",
    "slot": "ABERTURA",
    "local": "GARDEN",
    "resultado": "ANY",
    "texto": "Entre vasos, ferramentas e cheiro de terra,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_garden_02",
    "slot": "ABERTURA",
    "local": "GARDEN",
    "resultado": "ANY",
    "texto": "No canto mais movimentado da Horta,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_garden_03",
    "slot": "ABERTURA",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "Durante uma colheita particularmente tranquila,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_garden_04",
    "slot": "ABERTURA",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "Enquanto separavam o que estava pronto para colher,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_garden_05",
    "slot": "ABERTURA",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "Quando uma pequena confusão começou entre os canteiros,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_garden_06",
    "slot": "ABERTURA",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "Perto de uma cesta de colheita deixada no chão,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_training_01",
    "slot": "ABERTURA",
    "local": "TRAINING",
    "resultado": "ANY",
    "texto": "Assim que o Campo de Treino foi liberado,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_training_02",
    "slot": "ABERTURA",
    "local": "TRAINING",
    "resultado": "ANY",
    "texto": "Entre marcas no chão e sinais de treino recente,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_training_03",
    "slot": "ABERTURA",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "Depois de uma sequência de exercícios sem incidentes,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_training_04",
    "slot": "ABERTURA",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "Quando o treino deixou de parecer uma disputa,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_training_05",
    "slot": "ABERTURA",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "Antes mesmo do aquecimento terminar,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_training_06",
    "slot": "ABERTURA",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "Quando o placar improvisado começou a chamar atenção demais,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_rest_01",
    "slot": "ABERTURA",
    "local": "REST",
    "resultado": "ANY",
    "texto": "Na parte mais calma da Área de Descanso,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_rest_02",
    "slot": "ABERTURA",
    "local": "REST",
    "resultado": "ANY",
    "texto": "Quando o movimento do Refúgio finalmente diminuiu,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_rest_03",
    "slot": "ABERTURA",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "Com o silêncio ajudando mais do que qualquer convite,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_rest_04",
    "slot": "ABERTURA",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "Depois que os dois encontraram um canto confortável,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_rest_05",
    "slot": "ABERTURA",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "Quando parecia impossível discutir naquele lugar,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_rest_06",
    "slot": "ABERTURA",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "Bastou um deles ocupar o espaço preferido do outro para que",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_yard_01",
    "slot": "ABERTURA",
    "local": "YARD",
    "resultado": "ANY",
    "texto": "No Pátio, onde quase sempre alguma coisa acontece,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_yard_02",
    "slot": "ABERTURA",
    "local": "YARD",
    "resultado": "ANY",
    "texto": "Perto do centro do Pátio,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_yard_03",
    "slot": "ABERTURA",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "No meio de uma brincadeira que atraiu alguns olhares,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_yard_04",
    "slot": "ABERTURA",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "Enquanto exploravam o Pátio sem muita pressa,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_yard_05",
    "slot": "ABERTURA",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "Quando uma brincadeira passou um pouco do ponto,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_yard_06",
    "slot": "ABERTURA",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "Depois de uma provocação que parecia inocente demais para ser acidente,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_tier_01",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Como se já conhecessem melhor o jeito um do outro,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "op_tier_02",
    "slot": "ABERTURA",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "Como se nenhum dos dois tivesse esquecido o último atrito,",
    "familiaNarrativa": "abertura"
  },
  {
    "id": "verb_garden_01",
    "slot": "VERBO_LOCAL",
    "local": "GARDEN",
    "resultado": "ANY",
    "texto": "dividiram uma tarefa na Horta",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_garden_02",
    "slot": "VERBO_LOCAL",
    "local": "GARDEN",
    "resultado": "ANY",
    "texto": "acabaram trabalhando no mesmo canteiro",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_garden_03",
    "slot": "VERBO_LOCAL",
    "local": "GARDEN",
    "resultado": "ANY",
    "texto": "foram parar diante da mesma cesta de colheita",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_garden_04",
    "slot": "VERBO_LOCAL",
    "local": "GARDEN",
    "resultado": "ANY",
    "texto": "tentaram cuidar juntos de uma parte da Horta",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_garden_05",
    "slot": "VERBO_LOCAL",
    "local": "GARDEN",
    "resultado": "ANY",
    "texto": "se encontraram entre ferramentas e mudas",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_garden_06",
    "slot": "VERBO_LOCAL",
    "local": "GARDEN",
    "resultado": "ANY",
    "texto": "passaram alguns minutos ocupados com a mesma colheita",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_training_01",
    "slot": "VERBO_LOCAL",
    "local": "TRAINING",
    "resultado": "ANY",
    "texto": "treinaram lado a lado no Campo de Treino",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_training_02",
    "slot": "VERBO_LOCAL",
    "local": "TRAINING",
    "resultado": "ANY",
    "texto": "aceitaram dividir a mesma sequência de exercícios",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_training_03",
    "slot": "VERBO_LOCAL",
    "local": "TRAINING",
    "resultado": "ANY",
    "texto": "transformaram o treino em um pequeno desafio",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_training_04",
    "slot": "VERBO_LOCAL",
    "local": "TRAINING",
    "resultado": "ANY",
    "texto": "testaram movimentos um contra o outro",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_training_05",
    "slot": "VERBO_LOCAL",
    "local": "TRAINING",
    "resultado": "ANY",
    "texto": "acabaram comparando desempenho no Campo de Treino",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_training_06",
    "slot": "VERBO_LOCAL",
    "local": "TRAINING",
    "resultado": "ANY",
    "texto": "se encontraram no meio de uma sessão de treino",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_rest_01",
    "slot": "VERBO_LOCAL",
    "local": "REST",
    "resultado": "ANY",
    "texto": "dividiram a Área de Descanso",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_rest_02",
    "slot": "VERBO_LOCAL",
    "local": "REST",
    "resultado": "ANY",
    "texto": "acabaram escolhendo lugares próximos para descansar",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_rest_03",
    "slot": "VERBO_LOCAL",
    "local": "REST",
    "resultado": "ANY",
    "texto": "foram parar no mesmo canto tranquilo",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_rest_04",
    "slot": "VERBO_LOCAL",
    "local": "REST",
    "resultado": "ANY",
    "texto": "tentaram relaxar no mesmo espaço",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_rest_05",
    "slot": "VERBO_LOCAL",
    "local": "REST",
    "resultado": "ANY",
    "texto": "passaram um tempo lado a lado sem nenhuma tarefa",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_rest_06",
    "slot": "VERBO_LOCAL",
    "local": "REST",
    "resultado": "ANY",
    "texto": "se encontraram durante uma pausa mais longa",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_yard_01",
    "slot": "VERBO_LOCAL",
    "local": "YARD",
    "resultado": "ANY",
    "texto": "se encontraram no Pátio",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_yard_02",
    "slot": "VERBO_LOCAL",
    "local": "YARD",
    "resultado": "ANY",
    "texto": "acabaram explorando o mesmo canto do Pátio",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_yard_03",
    "slot": "VERBO_LOCAL",
    "local": "YARD",
    "resultado": "ANY",
    "texto": "entraram na mesma brincadeira",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_yard_04",
    "slot": "VERBO_LOCAL",
    "local": "YARD",
    "resultado": "ANY",
    "texto": "passaram a circular juntos pelo Pátio",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_yard_05",
    "slot": "VERBO_LOCAL",
    "local": "YARD",
    "resultado": "ANY",
    "texto": "foram atraídos pela mesma pequena confusão",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "verb_yard_06",
    "slot": "VERBO_LOCAL",
    "local": "YARD",
    "resultado": "ANY",
    "texto": "acabaram dividindo uma atividade improvisada no Pátio",
    "familiaNarrativa": "verbo_local"
  },
  {
    "id": "rea_garden_positive_g_01",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "a divisão das tarefas aconteceu sem que nenhum dos dois precisasse disputar espaço",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_02",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} empurrou uma ferramenta na direção de {B}, que entendeu o gesto sem explicação",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_03",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "uma pequena bagunça virou trabalho em equipe antes que pudesse virar problema",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_04",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "os dois começaram a separar a colheita de um jeito quase coordenado",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_05",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{B} percebeu que {A} estava com dificuldade e ficou por perto em vez de ir embora",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_06",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "uma descoberta pequena entre as folhas fez os dois interromperem o trabalho ao mesmo tempo",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_07",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "a melhor parte da colheita acabou ficando no meio dos dois, esperando uma decisão",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_08",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} deixou {B} escolher primeiro sem transformar aquilo em competição",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_09",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "uma tarefa chata ficou mais rápida quando os dois resolveram fazê-la juntos",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_10",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "os dois discordaram sobre como começar, mas testaram as duas ideias antes de decidir",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_11",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "um erro bobo terminou em risada em vez de acusação",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_g_12",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} começou a imitar o jeito de {B} organizar as coisas e a tarefa passou a render melhor",
    "familiaNarrativa": "garden_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_01",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "a divisão da colheita virou assunto sério demais para uma tarefa tão simples",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_02",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} tomou para si uma parte da tarefa que {B} já considerava sua",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_03",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "uma ferramenta mudou de dono sem nenhum dos dois concordar com isso",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_04",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{B} acusou {A} de escolher sempre a parte mais fácil do trabalho",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_05",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "o melhor pedaço da colheita ficou no centro de uma disputa silenciosa",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_06",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "os dois tentaram organizar o mesmo canteiro de maneiras opostas",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_07",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} refez uma parte do trabalho de {B} sem pedir",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_08",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "uma pequena sujeira jogada para o lado errado foi tratada como provocação",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_09",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{B} percebeu que {A} estava escondendo algo da cesta e não deixou passar",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_10",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "ninguém quis ceder o caminho estreito entre os canteiros",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_11",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "uma tarefa atrasou porque os dois passaram mais tempo implicando um com o outro do que trabalhando",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_conflict_g_12",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "o que parecia uma brincadeira com a colheita terminou em olhares atravessados",
    "familiaNarrativa": "garden_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_01",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} diminuiu o ritmo para que {B} pudesse acompanhar a sequência inteira",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_02",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{B} mostrou um movimento e {A} tentou repetir sem transformar aquilo em disputa",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_03",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "os dois passaram a corrigir um ao outro em vez de apenas contar acertos",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_04",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "uma falha de {A} recebeu ajuda de {B}, não provocação",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_05",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} deixou de buscar o placar por alguns minutos e começou a observar a técnica de {B}",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_06",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "a competição foi ficando menos importante que descobrir até onde os dois conseguiam chegar",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_07",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "um exercício difícil só funcionou quando os dois sincronizaram o tempo",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_08",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{B} percebeu o cansaço de {A} e encerrou a sequência antes de exagerar",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_09",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "o treino virou troca de truques e pequenas descobertas",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_10",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} comemorou um acerto de {B} como se fosse seu",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_11",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "os dois repetiram a mesma sequência até conseguirem terminá-la juntos",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_positive_g_12",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "uma provocação virou incentivo antes que o clima pudesse pesar",
    "familiaNarrativa": "training_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_01",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} transformou cada exercício em uma tentativa de superar {B}",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_02",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{B} contou um ponto que {A} jurava não ter valido",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_03",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "um golpe controlado pareceu forte demais para quem recebeu",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_04",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} recusou encerrar a sequência depois de perder vantagem",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_05",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "o treino parou por alguns segundos porque nenhum dos dois aceitou o resultado",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_06",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{B} repetiu exatamente o movimento que tinha irritado {A} no exercício anterior",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_07",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "uma correção técnica foi recebida como provocação",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_08",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} comemorou cedo demais e {B} fez questão de responder",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_09",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "os dois começaram a competir até no tempo de descanso",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_10",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "uma revanche foi pedida antes mesmo do exercício atual terminar",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_11",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{B} acusou {A} de escolher regras que o favoreciam",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_training_conflict_g_12",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "o treino deixou de ser treino no momento em que os dois começaram a levar cada ponto para o lado pessoal",
    "familiaNarrativa": "training_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_01",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} escolheu ficar perto de {B} mesmo havendo espaço de sobra",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_02",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "os dois passaram vários minutos em silêncio sem que o silêncio parecesse desconfortável",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_03",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{B} cedeu o lugar mais confortável sem precisar ser solicitado",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_04",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} relaxou o suficiente para baixar a guarda perto de {B}",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_05",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "uma mudança de posição terminou com os dois ainda mais próximos",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_06",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{B} percebeu que {A} não queria conversa e respeitou isso",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_07",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} acordou por um instante, viu {B} ali e simplesmente voltou a descansar",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_08",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "os dois acabaram compartilhando a sombra mais fresca do local",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_09",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "um pequeno ruído despertou os dois, mas nenhum deles decidiu ir embora",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_10",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} se aproximou devagar e {B} abriu espaço como se já esperasse por isso",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_11",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "a pausa se alongou porque nenhum dos dois parecia com pressa de sair",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_positive_g_12",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "os dois encontraram um ritmo tranquilo sem precisar fazer nada especial",
    "familiaNarrativa": "rest_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_01",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} ocupou justamente o lugar que {B} vinha escolhendo havia algum tempo",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_02",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "um barulho repetido começou a incomodar mais do que deveria",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_03",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{B} tentou se afastar e {A} interpretou o gesto como desprezo",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_04",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "o espaço confortável ficou pequeno demais para duas teimosias",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_05",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} insistiu em brincar quando {B} queria apenas silêncio",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_06",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "um empurrão para abrir espaço foi devolvido com força demais",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_07",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{B} interrompeu o descanso de {A} e não demonstrou arrependimento",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_08",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "os dois passaram a disputar até quem tinha chegado primeiro",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_09",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} se recusou a ceder um canto que claramente caberia aos dois",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_10",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "uma tentativa de aproximação aconteceu na pior hora possível",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_11",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{B} reagiu mal ao ser acordado e {A} decidiu não ignorar",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_rest_conflict_g_12",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "o silêncio acabou justamente porque nenhum dos dois quis deixar o assunto morrer",
    "familiaNarrativa": "rest_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_01",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} puxou {B} para uma brincadeira e, dessa vez, o convite foi aceito",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_02",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "os dois começaram a seguir a mesma curiosidade pelo Pátio",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_03",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{B} encontrou algo interessante e chamou {A} antes de investigar sozinho",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_04",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "uma corrida improvisada terminou com os dois voltando juntos",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_05",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} inventou uma regra nova para a brincadeira e {B} entrou no jogo",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_06",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "os dois passaram a se revezar em uma atividade sem ninguém precisar mandar",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_07",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "uma pequena descoberta virou segredo compartilhado por alguns minutos",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_08",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{B} esperou {A} alcançar antes de continuar explorando",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_09",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} tentou impressionar {B} e acabou conseguindo arrancar uma reação sincera",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_10",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "uma brincadeira simples durou muito mais porque nenhum dos dois quis encerrá-la",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_11",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "os dois ajudaram um terceiro mascote e voltaram para o Pátio lado a lado",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_positive_g_12",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} criaram uma rotina improvisada que só fazia sentido para eles",
    "familiaNarrativa": "yard_positive_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_01",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} levou uma brincadeira longe demais para o gosto de {B}",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_02",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{B} pegou primeiro algo que {A} já tinha decidido que queria",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_03",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "uma corrida terminou em discussão sobre quem realmente venceu",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_04",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} escondeu um objeto de {B} e demorou demais para admitir",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_05",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "uma provocação repetida deixou de parecer brincadeira",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_06",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{B} interrompeu uma atividade só para testar a paciência de {A}",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_07",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "os dois foram atrás da mesma coisa e nenhum aceitou chegar em segundo",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_08",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} tentou entrar numa brincadeira que {B} claramente queria fazer sozinho",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_09",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "um esbarrão no meio do Pátio virou acusação de propósito",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_10",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{B} riu no momento errado e {A} guardou aquilo como provocação",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_11",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "uma curiosidade compartilhada virou disputa por quem teria o direito de investigar primeiro",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_yard_conflict_g_12",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "o Pátio inteiro pareceu pequeno quando os dois decidiram não sair do caminho um do outro",
    "familiaNarrativa": "yard_conflict_cotidiano",
    "peso": 1.0
  },
  {
    "id": "rea_garden_positive_p_competitive",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} transformou a tarefa em desafio, mas dessa vez fez questão de puxar {B} junto para bater o próprio ritmo",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive",
    "peso": 1.35
  },
  {
    "id": "rea_training_positive_p_competitive",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} cobrou muito de {B}, mas comemorou cada melhora como prova de que a disputa estava ficando melhor",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive",
    "peso": 1.35
  },
  {
    "id": "rea_rest_positive_p_competitive",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} tentou transformar até o descanso em competição, porém acabou desistindo quando percebeu que {B} não entrou no jogo",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive",
    "peso": 1.35
  },
  {
    "id": "rea_yard_positive_p_competitive",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} inventou uma competição no Pátio e surpreendeu ao aceitar a vitória de {B} sem pedir revanche imediata",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive",
    "peso": 1.35
  },
  {
    "id": "rea_garden_conflict_p_competitive",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} começou a contar quem tinha feito mais e transformou a Horta em placar",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive",
    "peso": 1.35
  },
  {
    "id": "rea_training_conflict_p_competitive",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} se recusou a baixar a guarda e tratou cada acerto de {B} como provocação pessoal",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive",
    "peso": 1.35
  },
  {
    "id": "rea_rest_conflict_p_competitive",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} decidiu que até o melhor lugar para descansar precisava ter vencedor",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive",
    "peso": 1.35
  },
  {
    "id": "rea_yard_conflict_p_competitive",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} converteu uma brincadeira simples em disputa e não aceitou quando {B} deixou de achar graça",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive",
    "peso": 1.35
  },
  {
    "id": "rea_garden_positive_p_glutton",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} ficou de olho na colheita, mas separou uma parte especialmente boa para {B}",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton",
    "peso": 1.35
  },
  {
    "id": "rea_training_positive_p_glutton",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} só aceitou repetir a sequência depois de combinar uma recompensa para dividir com {B}",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton",
    "peso": 1.35
  },
  {
    "id": "rea_rest_positive_p_glutton",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} apareceu com algo para comer e, contra o costume, ofereceu a primeira parte a {B}",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton",
    "peso": 1.35
  },
  {
    "id": "rea_yard_positive_p_glutton",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} encontrou algo apetitoso pelo caminho e chamou {B} antes de experimentar",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton",
    "peso": 1.35
  },
  {
    "id": "rea_garden_conflict_p_glutton",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} tentou reservar para si a melhor parte da colheita e {B} percebeu rápido demais",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton",
    "peso": 1.35
  },
  {
    "id": "rea_training_conflict_p_glutton",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} perdeu o foco do treino por causa de uma recompensa e culpou {B} quando ela desapareceu",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton",
    "peso": 1.35
  },
  {
    "id": "rea_rest_conflict_p_glutton",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} não gostou de ver {B} perto do que tinha guardado para depois",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton",
    "peso": 1.35
  },
  {
    "id": "rea_yard_conflict_p_glutton",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} encontrou comida antes de {B} e decidiu que isso encerrava qualquer ideia de divisão",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton",
    "peso": 1.35
  },
  {
    "id": "rea_garden_positive_p_serene",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} trabalhou sem pressa e o ritmo calmo acabou fazendo {B} desacelerar também",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene",
    "peso": 1.35
  },
  {
    "id": "rea_training_positive_p_serene",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} respondeu aos erros de {B} com paciência até o treino inteiro mudar de tom",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene",
    "peso": 1.35
  },
  {
    "id": "rea_rest_positive_p_serene",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} ficou tão tranquilo perto de {B} que a presença dos dois quase se confundiu com o silêncio do lugar",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene",
    "peso": 1.35
  },
  {
    "id": "rea_yard_positive_p_serene",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} preferiu observar antes de agir e acabou mostrando a {B} um detalhe que teria passado despercebido",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene",
    "peso": 1.35
  },
  {
    "id": "rea_garden_conflict_p_serene",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} tentou ignorar a provocação, mas {B} insistiu até a calma deixar de funcionar",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene",
    "peso": 1.35
  },
  {
    "id": "rea_training_conflict_p_serene",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} pediu para reduzir o ritmo e interpretou a insistência de {B} como falta de respeito",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene",
    "peso": 1.35
  },
  {
    "id": "rea_rest_conflict_p_serene",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} tentou preservar o silêncio, mas a repetição de {B} acabou quebrando sua paciência",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene",
    "peso": 1.35
  },
  {
    "id": "rea_yard_conflict_p_serene",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} não entrou na brincadeira e {B} tomou a recusa como provocação",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene",
    "peso": 1.35
  },
  {
    "id": "rea_garden_positive_p_timid",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} começou trabalhando longe, mas aos poucos aproximou sua parte da tarefa da de {B}",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid",
    "peso": 1.35
  },
  {
    "id": "rea_training_positive_p_timid",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} errou, hesitou em continuar e só voltou para a sequência depois de um gesto de incentivo de {B}",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid",
    "peso": 1.35
  },
  {
    "id": "rea_rest_positive_p_timid",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} escolheu ficar perto de {B} pela primeira vez sem procurar uma saída logo depois",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid",
    "peso": 1.35
  },
  {
    "id": "rea_yard_positive_p_timid",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} observou de longe até {B} abrir espaço na brincadeira sem pressionar",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid",
    "peso": 1.35
  },
  {
    "id": "rea_garden_conflict_p_timid",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} recuou quando {B} se aproximou demais e a insistência transformou desconforto em irritação",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid",
    "peso": 1.35
  },
  {
    "id": "rea_training_conflict_p_timid",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} interpretou a pressão de {B} como exposição e encerrou a sequência de forma brusca",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid",
    "peso": 1.35
  },
  {
    "id": "rea_rest_conflict_p_timid",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} tentou se afastar discretamente, mas {B} seguiu perto demais",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid",
    "peso": 1.35
  },
  {
    "id": "rea_yard_conflict_p_timid",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} não quis participar e reagiu mal quando {B} decidiu insistir em público",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid",
    "peso": 1.35
  },
  {
    "id": "rea_garden_positive_p_playful",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} inventou uma brincadeira com a tarefa e {B} acabou entrando no ritmo",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful",
    "peso": 1.35
  },
  {
    "id": "rea_training_positive_p_playful",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} transformou um exercício repetitivo em jogo e fez {B} esquecer o placar por alguns minutos",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful",
    "peso": 1.35
  },
  {
    "id": "rea_rest_positive_p_playful",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} tentou provocar uma reação e soube parar exatamente quando {B} começou a achar graça",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful",
    "peso": 1.35
  },
  {
    "id": "rea_yard_positive_p_playful",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} criou uma brincadeira do nada e {B} acrescentou uma regra que os dois adotaram",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful",
    "peso": 1.35
  },
  {
    "id": "rea_garden_conflict_p_playful",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} tratou uma ferramenta como brinquedo e {B} não achou graça nenhuma",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful",
    "peso": 1.35
  },
  {
    "id": "rea_training_conflict_p_playful",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} fez piada depois de um erro de {B} e escolheu o pior momento possível para continuar",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful",
    "peso": 1.35
  },
  {
    "id": "rea_rest_conflict_p_playful",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} insistiu em brincar quando {B} queria silêncio e não percebeu o limite a tempo",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful",
    "peso": 1.35
  },
  {
    "id": "rea_yard_conflict_p_playful",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} repetiu a mesma provocação até {B} parar de considerar aquilo uma brincadeira",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful",
    "peso": 1.35
  },
  {
    "id": "rea_garden_positive_p_curious",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} percebeu algo estranho entre as plantas e chamou {B} para investigar antes de tocar em qualquer coisa",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious",
    "peso": 1.35
  },
  {
    "id": "rea_training_positive_p_curious",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} quis entender por que o movimento de {B} funcionava e transformou o treino em experimento conjunto",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious",
    "peso": 1.35
  },
  {
    "id": "rea_rest_positive_p_curious",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} reparou num hábito de {B}, mas preferiu observar sem invadir o espaço",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious",
    "peso": 1.35
  },
  {
    "id": "rea_yard_positive_p_curious",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} encontrou uma pista no Pátio e fez questão de dividir a descoberta com {B}",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious",
    "peso": 1.35
  },
  {
    "id": "rea_garden_conflict_p_curious",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} mexeu onde {B} tinha pedido para não mexer e descobriu tarde demais que a curiosidade tinha limite",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious",
    "peso": 1.35
  },
  {
    "id": "rea_training_conflict_p_curious",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} insistiu em testar uma ideia no treino mesmo depois de {B} dizer que não queria",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious",
    "peso": 1.35
  },
  {
    "id": "rea_rest_conflict_p_curious",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} ficou curioso demais sobre o que {B} escondia e se aproximou sem permissão",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious",
    "peso": 1.35
  },
  {
    "id": "rea_yard_conflict_p_curious",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} tentou descobrir o que {B} estava fazendo sozinho e transformou curiosidade em invasão",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious",
    "peso": 1.35
  },
  {
    "id": "rea_garden_positive_p_lazy",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} procurou o jeito mais fácil de terminar a tarefa e, por acaso, encontrou um método que ajudou {B} também",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy",
    "peso": 1.35
  },
  {
    "id": "rea_training_positive_p_lazy",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} tentou reduzir a sequência, mas acabou completando tudo quando {B} aceitou acompanhar no mesmo ritmo",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy",
    "peso": 1.35
  },
  {
    "id": "rea_rest_positive_p_lazy",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} escolheu o primeiro lugar confortável que encontrou e abriu espaço quando {B} se aproximou",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy",
    "peso": 1.35
  },
  {
    "id": "rea_yard_positive_p_lazy",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} evitou a parte mais cansativa da brincadeira, mas ficou por perto o bastante para participar do resto",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy",
    "peso": 1.35
  },
  {
    "id": "rea_garden_conflict_p_lazy",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} tentou empurrar a parte mais trabalhosa para {B} e foi pego no ato",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy",
    "peso": 1.35
  },
  {
    "id": "rea_training_conflict_p_lazy",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} cortou caminho no exercício e irritou {B}, que estava levando a sequência a sério",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy",
    "peso": 1.35
  },
  {
    "id": "rea_rest_conflict_p_lazy",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} ocupou espaço demais e se recusou a levantar quando {B} reclamou",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy",
    "peso": 1.35
  },
  {
    "id": "rea_yard_conflict_p_lazy",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} desistiu no meio da atividade e deixou toda a parte difícil para {B}",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy",
    "peso": 1.35
  },
  {
    "id": "rea_garden_positive_p_brave",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} assumiu a tarefa mais complicada e chamou {B} para fazer a parte decisiva junto",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave",
    "peso": 1.35
  },
  {
    "id": "rea_training_positive_p_brave",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} tomou a frente num exercício difícil, mas voltou para buscar {B} antes de concluir",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave",
    "peso": 1.35
  },
  {
    "id": "rea_rest_positive_p_brave",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} ficou atento quando um ruído estranho surgiu e só relaxou depois de perceber que {B} estava bem",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave",
    "peso": 1.35
  },
  {
    "id": "rea_yard_positive_p_brave",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} foi o primeiro a investigar uma pequena confusão e fez sinal para {B} acompanhar",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave",
    "peso": 1.35
  },
  {
    "id": "rea_garden_conflict_p_brave",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} decidiu resolver tudo sozinho e tratou a tentativa de ajuda de {B} como interferência",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave",
    "peso": 1.35
  },
  {
    "id": "rea_training_conflict_p_brave",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} recusou diminuir a intensidade, mesmo quando {B} deixou claro que o treino tinha passado do limite",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave",
    "peso": 1.35
  },
  {
    "id": "rea_rest_conflict_p_brave",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} interpretou uma reclamação de {B} como desafio e se recusou a recuar",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave",
    "peso": 1.35
  },
  {
    "id": "rea_yard_conflict_p_brave",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} se colocou na frente de {B} numa situação banal e transformou proteção em confronto",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave",
    "peso": 1.35
  },
  {
    "id": "rea_garden_positive_t_conhecido",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} ainda mediam distância, mas pela primeira vez terminaram uma tarefa sem se evitar",
    "tier": "CONHECIDO",
    "familiaNarrativa": "tier_conhecido",
    "peso": 1.5
  },
  {
    "id": "rea_training_positive_t_conhecido",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} começaram formais demais, até um pequeno acerto arrancar o primeiro sinal de respeito",
    "tier": "CONHECIDO",
    "familiaNarrativa": "tier_conhecido",
    "peso": 1.5
  },
  {
    "id": "rea_rest_positive_t_conhecido",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} escolheram ficar próximos mesmo sem intimidade suficiente para conversar",
    "tier": "CONHECIDO",
    "familiaNarrativa": "tier_conhecido",
    "peso": 1.5
  },
  {
    "id": "rea_yard_positive_t_conhecido",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} passaram algum tempo juntos sem que nenhum precisasse de outro motivo além da curiosidade",
    "tier": "CONHECIDO",
    "familiaNarrativa": "tier_conhecido",
    "peso": 1.5
  },
  {
    "id": "rea_garden_positive_t_colega",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "a parceria entre {A} e {B} já foi natural o bastante para cada um assumir uma parte sem combinar",
    "tier": "COLEGA",
    "familiaNarrativa": "tier_colega",
    "peso": 1.5
  },
  {
    "id": "rea_training_positive_t_colega",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} treinaram como quem já conhece o ritmo do outro",
    "tier": "COLEGA",
    "familiaNarrativa": "tier_colega",
    "peso": 1.5
  },
  {
    "id": "rea_rest_positive_t_colega",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} dividiram o espaço com a familiaridade de quem já repetiu aquela pausa antes",
    "tier": "COLEGA",
    "familiaNarrativa": "tier_colega",
    "peso": 1.5
  },
  {
    "id": "rea_yard_positive_t_colega",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} retomaram uma brincadeira antiga quase do ponto em que tinham parado",
    "tier": "COLEGA",
    "familiaNarrativa": "tier_colega",
    "peso": 1.5
  },
  {
    "id": "rea_garden_positive_t_amigo",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} percebeu o que {B} precisava antes mesmo do pedido e ajustou a tarefa sem comentar",
    "tier": "AMIGO",
    "familiaNarrativa": "tier_amigo",
    "peso": 1.5
  },
  {
    "id": "rea_training_positive_t_amigo",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} soube exatamente quando pressionar {B} e quando aliviar o ritmo",
    "tier": "AMIGO",
    "familiaNarrativa": "tier_amigo",
    "peso": 1.5
  },
  {
    "id": "rea_rest_positive_t_amigo",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} se acomodou ao lado de {B} sem nenhuma hesitação",
    "tier": "AMIGO",
    "familiaNarrativa": "tier_amigo",
    "peso": 1.5
  },
  {
    "id": "rea_yard_positive_t_amigo",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} chamou {B} com a confiança de quem já espera uma resposta positiva",
    "tier": "AMIGO",
    "familiaNarrativa": "tier_amigo",
    "peso": 1.5
  },
  {
    "id": "rea_garden_positive_t_super_amigo",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} trabalharam quase sem se olhar, como se cada movimento do outro já fosse conhecido",
    "tier": "SUPER_AMIGO",
    "familiaNarrativa": "tier_super_amigo",
    "peso": 1.5
  },
  {
    "id": "rea_training_positive_t_super_amigo",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} completaram uma sequência difícil com uma sintonia que chamou atenção",
    "tier": "SUPER_AMIGO",
    "familiaNarrativa": "tier_super_amigo",
    "peso": 1.5
  },
  {
    "id": "rea_rest_positive_t_super_amigo",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} adormeceu perto de {B} sem manter qualquer distância de segurança",
    "tier": "SUPER_AMIGO",
    "familiaNarrativa": "tier_super_amigo",
    "peso": 1.5
  },
  {
    "id": "rea_yard_positive_t_super_amigo",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} transformaram um detalhe banal em mais uma piada que parecia pertencer só aos dois",
    "tier": "SUPER_AMIGO",
    "familiaNarrativa": "tier_super_amigo",
    "peso": 1.5
  },
  {
    "id": "rea_garden_conflict_t_rival",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} começaram a comparar até quem terminava primeiro a própria parte",
    "tier": "RIVAL",
    "familiaNarrativa": "tier_rival",
    "peso": 1.6
  },
  {
    "id": "rea_training_conflict_t_rival",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} reconheceram a presença um do outro e o treino virou revanche sem precisar de convite",
    "tier": "RIVAL",
    "familiaNarrativa": "tier_rival",
    "peso": 1.6
  },
  {
    "id": "rea_rest_conflict_t_rival",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} evitaram ceder espaço simplesmente porque o outro estava ali",
    "tier": "RIVAL",
    "familiaNarrativa": "tier_rival",
    "peso": 1.6
  },
  {
    "id": "rea_yard_conflict_t_rival",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} transformaram uma disputa pequena em mais um capítulo da competição entre eles",
    "tier": "RIVAL",
    "familiaNarrativa": "tier_rival",
    "peso": 1.6
  },
  {
    "id": "rea_garden_conflict_t_inimigo",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} refez o trabalho de {B} de propósito e deixou claro que não confiava no resultado",
    "tier": "INIMIGO",
    "familiaNarrativa": "tier_inimigo",
    "peso": 1.6
  },
  {
    "id": "rea_training_conflict_t_inimigo",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} recusaram qualquer exercício cooperativo e exigiram lados opostos",
    "tier": "INIMIGO",
    "familiaNarrativa": "tier_inimigo",
    "peso": 1.6
  },
  {
    "id": "rea_rest_conflict_t_inimigo",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} passaram mais tempo vigiando um ao outro do que descansando",
    "tier": "INIMIGO",
    "familiaNarrativa": "tier_inimigo",
    "peso": 1.6
  },
  {
    "id": "rea_yard_conflict_t_inimigo",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} escolheram caminhos diferentes e ainda assim conseguiram se encontrar para discutir",
    "tier": "INIMIGO",
    "familiaNarrativa": "tier_inimigo",
    "peso": 1.6
  },
  {
    "id": "rea_garden_conflict_t_nemesis",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "a simples presença de {B} fez {A} transformar uma tarefa comum em confronto de orgulho",
    "tier": "NEMESIS",
    "familiaNarrativa": "tier_nemesis",
    "peso": 1.6
  },
  {
    "id": "rea_training_conflict_t_nemesis",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} entraram no Campo de Treino como se o resto do Refúgio tivesse desaparecido",
    "tier": "NEMESIS",
    "familiaNarrativa": "tier_nemesis",
    "peso": 1.6
  },
  {
    "id": "rea_rest_conflict_t_nemesis",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "nem a Área de Descanso foi suficiente para impedir {A} e {B} de medir forças em silêncio",
    "tier": "NEMESIS",
    "familiaNarrativa": "tier_nemesis",
    "peso": 1.6
  },
  {
    "id": "rea_yard_conflict_t_nemesis",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} se perceberam de lados opostos do Pátio e nenhum dos dois desviou o caminho",
    "tier": "NEMESIS",
    "familiaNarrativa": "tier_nemesis",
    "peso": 1.6
  },
  {
    "id": "rea_garden_positive_e_fire",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} controlou o próprio calor com cuidado para ajudar {B} sem danificar a Horta",
    "tipoElemental": "fire",
    "familiaNarrativa": "elemento_fire",
    "peso": 1.45
  },
  {
    "id": "rea_training_positive_e_fire",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} usou seu elemento de fogo com precisão e deixou espaço para {B} responder no próprio ritmo",
    "tipoElemental": "fire",
    "familiaNarrativa": "elemento_fire",
    "peso": 1.45
  },
  {
    "id": "rea_rest_positive_e_fire",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "o calor natural de {A} tornou o canto mais confortável e {B} decidiu ficar por perto",
    "tipoElemental": "fire",
    "familiaNarrativa": "elemento_fire",
    "peso": 1.45
  },
  {
    "id": "rea_yard_positive_e_fire",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} usou pequenas faíscas de fogo para transformar a brincadeira em espetáculo sem assustar {B}",
    "tipoElemental": "fire",
    "familiaNarrativa": "elemento_fire",
    "peso": 1.45
  },
  {
    "id": "rea_garden_conflict_e_fire",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "o calor de {A} chegou perto demais das plantas e {B} reagiu antes mesmo de qualquer dano acontecer",
    "tipoElemental": "fire",
    "familiaNarrativa": "elemento_fire",
    "peso": 1.45
  },
  {
    "id": "rea_training_conflict_e_fire",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} aumentou demais a intensidade do fogo e {B} interpretou aquilo como provocação",
    "tipoElemental": "fire",
    "familiaNarrativa": "elemento_fire",
    "peso": 1.45
  },
  {
    "id": "rea_rest_conflict_e_fire",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "o calor de {A} incomodou {B}, mas nenhum dos dois quis ser o primeiro a mudar de lugar",
    "tipoElemental": "fire",
    "familiaNarrativa": "elemento_fire",
    "peso": 1.45
  },
  {
    "id": "rea_yard_conflict_e_fire",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "uma demonstração de fogo de {A} passou do ponto e {B} respondeu de forma nada amistosa",
    "tipoElemental": "fire",
    "familiaNarrativa": "elemento_fire",
    "peso": 1.45
  },
  {
    "id": "rea_garden_positive_e_water",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} usou água na medida certa e {B} passou a confiar nele para cuidar das partes mais delicadas",
    "tipoElemental": "water",
    "familiaNarrativa": "elemento_water",
    "peso": 1.45
  },
  {
    "id": "rea_training_positive_e_water",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} controlou a força da água para manter o exercício seguro e permitir que {B} continuasse",
    "tipoElemental": "water",
    "familiaNarrativa": "elemento_water",
    "peso": 1.45
  },
  {
    "id": "rea_rest_positive_e_water",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} refrescou o espaço ao redor e {B} se acomodou mais perto",
    "tipoElemental": "water",
    "familiaNarrativa": "elemento_water",
    "peso": 1.45
  },
  {
    "id": "rea_yard_positive_e_water",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} improvisou uma brincadeira com água e {B} entrou na ideia antes que alguém pudesse reclamar",
    "tipoElemental": "water",
    "familiaNarrativa": "elemento_water",
    "peso": 1.45
  },
  {
    "id": "rea_garden_conflict_e_water",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} encharcou uma parte do canteiro e {B} tratou o descuido como se fosse pessoal",
    "tipoElemental": "water",
    "familiaNarrativa": "elemento_water",
    "peso": 1.45
  },
  {
    "id": "rea_training_conflict_e_water",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} acertou {B} com água mais forte do que o combinado",
    "tipoElemental": "water",
    "familiaNarrativa": "elemento_water",
    "peso": 1.45
  },
  {
    "id": "rea_rest_conflict_e_water",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "uma pequena quantidade de água de {A} foi suficiente para acabar com o descanso de {B}",
    "tipoElemental": "water",
    "familiaNarrativa": "elemento_water",
    "peso": 1.45
  },
  {
    "id": "rea_yard_conflict_e_water",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} molhou {B} durante a brincadeira e descobriu que o outro não estava no mesmo clima",
    "tipoElemental": "water",
    "familiaNarrativa": "elemento_water",
    "peso": 1.45
  },
  {
    "id": "rea_garden_positive_e_bug",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} percebeu movimentos entre as folhas antes de {B} e ajudou a proteger a colheita",
    "tipoElemental": "bug",
    "familiaNarrativa": "elemento_bug",
    "peso": 1.45
  },
  {
    "id": "rea_training_positive_e_bug",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} mostrou um jeito incomum de se mover e {B} passou a observar com interesse em vez de estranhar",
    "tipoElemental": "bug",
    "familiaNarrativa": "elemento_bug",
    "peso": 1.45
  },
  {
    "id": "rea_rest_positive_e_bug",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} encontrou um canto discreto e deixou espaço para {B} dividir o abrigo",
    "tipoElemental": "bug",
    "familiaNarrativa": "elemento_bug",
    "peso": 1.45
  },
  {
    "id": "rea_yard_positive_e_bug",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} encontrou um pequeno caminho pelo Pátio que {B} nunca tinha notado",
    "tipoElemental": "bug",
    "familiaNarrativa": "elemento_bug",
    "peso": 1.45
  },
  {
    "id": "rea_garden_conflict_e_bug",
    "slot": "REACAO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} se aproximou das plantas de um jeito que deixou {B} desconfiado sobre a colheita",
    "tipoElemental": "bug",
    "familiaNarrativa": "elemento_bug",
    "peso": 1.45
  },
  {
    "id": "rea_training_conflict_e_bug",
    "slot": "REACAO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} usou movimentos difíceis de acompanhar e {B} acusou o exercício de ser injusto",
    "tipoElemental": "bug",
    "familiaNarrativa": "elemento_bug",
    "peso": 1.45
  },
  {
    "id": "rea_rest_conflict_e_bug",
    "slot": "REACAO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} escolheu um canto fechado demais e não gostou quando {B} tentou se aproximar",
    "tipoElemental": "bug",
    "familiaNarrativa": "elemento_bug",
    "peso": 1.45
  },
  {
    "id": "rea_yard_conflict_e_bug",
    "slot": "REACAO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} desapareceu por um caminho estreito e {B} interpretou aquilo como tentativa de escapar da disputa",
    "tipoElemental": "bug",
    "familiaNarrativa": "elemento_bug",
    "peso": 1.45
  },
  {
    "id": "des_garden_positive_g_01",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "No fim, a tarefa terminou antes do esperado e nenhum dos dois pareceu ter pressa de ir embora.",
    "familiaNarrativa": "garden_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_positive_g_02",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "{A} deixou uma parte da colheita separada para {B} sem fazer anúncio algum.",
    "familiaNarrativa": "garden_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_positive_g_03",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "A Horta ficou arrumada, mas o detalhe mais importante foi a naturalidade com que os dois trabalharam juntos.",
    "familiaNarrativa": "garden_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_positive_g_04",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "Quando terminaram, os dois ainda ficaram alguns instantes olhando o resultado como se fosse uma pequena conquista em comum.",
    "familiaNarrativa": "garden_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_positive_g_05",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "A próxima tarefa entre os canteiros já não pareceu algo que precisaria ser evitado.",
    "familiaNarrativa": "garden_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_positive_g_06",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "Um gesto pequeno de {B} ficou na memória de {A} por mais tempo que a própria colheita.",
    "familiaNarrativa": "garden_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_positive_g_07",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "Nada grandioso aconteceu, mas a parceria pareceu um pouco menos acidental.",
    "familiaNarrativa": "garden_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_positive_g_08",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "Quando se afastaram da Horta, levaram a sensação de que a próxima vez poderia ser ainda mais fácil.",
    "familiaNarrativa": "garden_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_conflict_g_01",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "A tarefa terminou, mas os dois saíram da Horta em direções diferentes.",
    "familiaNarrativa": "garden_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_conflict_g_02",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "A colheita foi dividida; a irritação, não.",
    "familiaNarrativa": "garden_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_conflict_g_03",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "Nenhum dano sério aconteceu, embora a próxima tarefa conjunta tenha ficado menos provável.",
    "familiaNarrativa": "garden_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_conflict_g_04",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} foi embora primeiro e {B} ficou para refazer parte do trabalho do próprio jeito.",
    "familiaNarrativa": "garden_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_conflict_g_05",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "O problema foi pequeno, mas os dois encontraram motivos para não esquecer.",
    "familiaNarrativa": "garden_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_conflict_g_06",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "A Horta voltou ao silêncio, deixando uma revanche social para outro dia.",
    "familiaNarrativa": "garden_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_conflict_g_07",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "Quando a tarefa acabou, o assunto ainda não tinha acabado para nenhum dos dois.",
    "familiaNarrativa": "garden_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_garden_conflict_g_08",
    "slot": "DESFECHO",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "O canteiro ficou em ordem. A relação entre os dois, nem tanto.",
    "familiaNarrativa": "garden_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_positive_g_01",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "Quando o treino acabou, o resultado importava menos do que o progresso que os dois tinham percebido.",
    "familiaNarrativa": "training_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_positive_g_02",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} encerraram a sessão com a promessa silenciosa de repetir aquela sequência.",
    "familiaNarrativa": "training_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_positive_g_03",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "O último exercício saiu melhor justamente porque os dois pararam de competir por alguns minutos.",
    "familiaNarrativa": "training_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_positive_g_04",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "O respeito entre eles pareceu um pouco mais concreto depois daquele treino.",
    "familiaNarrativa": "training_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_positive_g_05",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{B} saiu cansado, mas com a certeza de que {A} tinha levado seu esforço a sério.",
    "familiaNarrativa": "training_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_positive_g_06",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "O Campo de Treino ganhou mais uma lembrança que parecia parceria, não placar.",
    "familiaNarrativa": "training_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_positive_g_07",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "Nenhum dos dois declarou vitória; ainda assim, os dois saíram satisfeitos.",
    "familiaNarrativa": "training_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_positive_g_08",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "Ao terminar, {A} repetiu para {B} o gesto de incentivo que tinha recebido antes.",
    "familiaNarrativa": "training_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_conflict_g_01",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "O treino acabou sem vencedor reconhecido e com uma revanche praticamente marcada.",
    "familiaNarrativa": "training_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_conflict_g_02",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} e {B} deixaram o Campo de Treino olhando para trás como se o assunto ainda não tivesse terminado.",
    "familiaNarrativa": "training_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_conflict_g_03",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "O placar foi esquecido; a provocação, não.",
    "familiaNarrativa": "training_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_conflict_g_04",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "Ninguém precisou separar os dois, mas ficou claro que a próxima sessão seria observada de perto.",
    "familiaNarrativa": "training_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_conflict_g_05",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "A rivalidade ganhou mais um detalhe específico para ser lembrado.",
    "familiaNarrativa": "training_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_conflict_g_06",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{A} encerrou primeiro; {B} interpretou isso como fuga, não como fim.",
    "familiaNarrativa": "training_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_conflict_g_07",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "O exercício terminou, mas a disputa apenas mudou de lugar.",
    "familiaNarrativa": "training_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_training_conflict_g_08",
    "slot": "DESFECHO",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "Quando saíram, cada um parecia ter uma versão diferente de quem tinha levado a melhor.",
    "familiaNarrativa": "training_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_positive_g_01",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "Quando se levantaram, o silêncio entre os dois já parecia confortável em vez de estranho.",
    "familiaNarrativa": "rest_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_positive_g_02",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} saiu primeiro, mas deixou o lugar ao lado livre como se esperasse encontrar {B} ali outra vez.",
    "familiaNarrativa": "rest_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_positive_g_03",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "A pausa terminou sem evento grandioso — exatamente por isso pareceu tão íntima.",
    "familiaNarrativa": "rest_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_positive_g_04",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "Depois daquele descanso, ficar perto um do outro pareceu um pouco mais normal.",
    "familiaNarrativa": "rest_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_positive_g_05",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{B} demorou alguns segundos para perceber que {A} já tinha ido embora.",
    "familiaNarrativa": "rest_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_positive_g_06",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "O momento foi simples o bastante para poder se repetir sem convite.",
    "familiaNarrativa": "rest_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_positive_g_07",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "Nenhum dos dois fez questão de quebrar o silêncio antes de sair.",
    "familiaNarrativa": "rest_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_positive_g_08",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "A tranquilidade compartilhada ficou marcada como uma memória melhor do que parecia no começo.",
    "familiaNarrativa": "rest_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_conflict_g_01",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "O descanso acabou cedo para os dois.",
    "familiaNarrativa": "rest_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_conflict_g_02",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} trocou de lugar; {B} fingiu não se importar.",
    "familiaNarrativa": "rest_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_conflict_g_03",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "O silêncio voltou só depois que um deles foi embora.",
    "familiaNarrativa": "rest_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_conflict_g_04",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "A Área de Descanso ficou tranquila novamente, mas não por mérito dos dois.",
    "familiaNarrativa": "rest_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_conflict_g_05",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "Um espaço vazio permaneceu entre eles até o fim da pausa.",
    "familiaNarrativa": "rest_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_conflict_g_06",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "Quando saíram, nenhum dos dois parecia disposto a repetir aquela proximidade tão cedo.",
    "familiaNarrativa": "rest_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_conflict_g_07",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "O incômodo foi pequeno, porém específico o bastante para virar lembrança.",
    "familiaNarrativa": "rest_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_rest_conflict_g_08",
    "slot": "DESFECHO",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "O lugar continuou confortável; a companhia, nem tanto.",
    "familiaNarrativa": "rest_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_positive_g_01",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "A brincadeira acabou, mas os dois continuaram andando juntos pelo Pátio.",
    "familiaNarrativa": "yard_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_positive_g_02",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{A} e {B} saíram com uma nova piada interna que provavelmente ninguém mais entenderia.",
    "familiaNarrativa": "yard_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_positive_g_03",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "O encontro terminou sem cerimônia, como se já fosse natural que acontecesse de novo.",
    "familiaNarrativa": "yard_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_positive_g_04",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "Uma atividade improvisada virou mais uma pequena tradição entre os dois.",
    "familiaNarrativa": "yard_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_positive_g_05",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "{B} chamou {A} de volta uma última vez antes de cada um seguir seu caminho.",
    "familiaNarrativa": "yard_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_positive_g_06",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "O Pátio ficou para trás, mas a descoberta compartilhada ainda parecia assunto para depois.",
    "familiaNarrativa": "yard_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_positive_g_07",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "Nenhum dos dois ganhou nada concreto; mesmo assim, ambos pareceram satisfeitos com o tempo gasto.",
    "familiaNarrativa": "yard_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_positive_g_08",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "Quando se separaram, já existia um motivo novo para se procurarem outra vez.",
    "familiaNarrativa": "yard_positive_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_conflict_g_01",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "A brincadeira terminou no exato momento em que deixou de ser brincadeira.",
    "familiaNarrativa": "yard_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_conflict_g_02",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{A} seguiu por um lado do Pátio e {B} escolheu o oposto.",
    "familiaNarrativa": "yard_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_conflict_g_03",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "Ninguém saiu machucado, mas a provocação encontrou lugar na lista de coisas a cobrar depois.",
    "familiaNarrativa": "yard_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_conflict_g_04",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "O objeto da disputa perdeu importância antes que a irritação perdesse.",
    "familiaNarrativa": "yard_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_conflict_g_05",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "O Pátio voltou ao normal; os dois ainda não.",
    "familiaNarrativa": "yard_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_conflict_g_06",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{B} foi embora primeiro e {A} ficou com a sensação de que aquilo não era o fim.",
    "familiaNarrativa": "yard_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_conflict_g_07",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "A discussão terminou sem acordo e com versões completamente diferentes sobre quem começou.",
    "familiaNarrativa": "yard_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_yard_conflict_g_08",
    "slot": "DESFECHO",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "O encontro rendeu mais motivo para implicância do que qualquer um dos dois admitiria.",
    "familiaNarrativa": "yard_conflict_fim",
    "peso": 1.0
  },
  {
    "id": "des_positive_t_conhecido_01",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Pela primeira vez, o nome de {B} deixou de ser apenas o de um visitante para {A}.",
    "tier": "CONHECIDO",
    "familiaNarrativa": "tier_conhecido_fim",
    "peso": 1.7
  },
  {
    "id": "des_positive_t_conhecido_02",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Ainda não era amizade, mas o próximo encontro já não precisaria começar do zero.",
    "tier": "CONHECIDO",
    "familiaNarrativa": "tier_conhecido_fim",
    "peso": 1.7
  },
  {
    "id": "des_positive_t_colega_01",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "A convivência ganhou mais uma prova de que os dois funcionam melhor juntos do que separados.",
    "tier": "COLEGA",
    "familiaNarrativa": "tier_colega_fim",
    "peso": 1.7
  },
  {
    "id": "des_positive_t_colega_02",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "A relação não mudou de nome naquele instante, mas ficou mais fácil entender por que já eram colegas.",
    "tier": "COLEGA",
    "familiaNarrativa": "tier_colega_fim",
    "peso": 1.7
  },
  {
    "id": "des_positive_t_amigo_01",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Para {A}, confiar em {B} pareceu menos uma decisão e mais um hábito.",
    "tier": "AMIGO",
    "familiaNarrativa": "tier_amigo_fim",
    "peso": 1.7
  },
  {
    "id": "des_positive_t_amigo_02",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "O tipo de cuidado mostrado ali só fazia sentido porque os dois já tinham história suficiente para entendê-lo.",
    "tier": "AMIGO",
    "familiaNarrativa": "tier_amigo_fim",
    "peso": 1.7
  },
  {
    "id": "des_positive_t_super_amigo_01",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Quem observasse de fora talvez não entendesse o gesto; {A} e {B} entenderam imediatamente.",
    "tier": "SUPER_AMIGO",
    "familiaNarrativa": "tier_super_amigo_fim",
    "peso": 1.7
  },
  {
    "id": "des_positive_t_super_amigo_02",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "O momento entrou para a coleção de pequenas coisas que só acontecem quando dois mascotes já se conhecem muito bem.",
    "tier": "SUPER_AMIGO",
    "familiaNarrativa": "tier_super_amigo_fim",
    "peso": 1.7
  },
  {
    "id": "des_conflict_t_rival_01",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "A próxima disputa entre {A} e {B} deixou de ser possibilidade e virou expectativa.",
    "tier": "RIVAL",
    "familiaNarrativa": "tier_rival_fim",
    "peso": 1.7
  },
  {
    "id": "des_conflict_t_rival_02",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "Nenhum dos dois precisou dizer 'revanche' para que a palavra ficasse implícita.",
    "tier": "RIVAL",
    "familiaNarrativa": "tier_rival_fim",
    "peso": 1.7
  },
  {
    "id": "des_conflict_t_inimigo_01",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "O encontro terminou sem reconciliação e reforçou a certeza de que os dois já esperam o pior um do outro.",
    "tier": "INIMIGO",
    "familiaNarrativa": "tier_inimigo_fim",
    "peso": 1.7
  },
  {
    "id": "des_conflict_t_inimigo_02",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "Mais do que a discussão, ficou a confirmação de que a confiança entre os dois está quase ausente.",
    "tier": "INIMIGO",
    "familiaNarrativa": "tier_inimigo_fim",
    "peso": 1.7
  },
  {
    "id": "des_conflict_t_nemesis_01",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "Para {A} e {B}, aquilo não foi um incidente isolado — foi só mais um capítulo de uma história que nenhum dos dois aceita encerrar.",
    "tier": "NEMESIS",
    "familiaNarrativa": "tier_nemesis_fim",
    "peso": 1.7
  },
  {
    "id": "des_conflict_t_nemesis_02",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "O Refúgio seguiu sua rotina, mas a tensão entre {A} e {B} saiu dali maior do que entrou.",
    "tier": "NEMESIS",
    "familiaNarrativa": "tier_nemesis_fim",
    "peso": 1.7
  },
  {
    "id": "des_any_positive_p_competitive",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{A} ainda queria vencer da próxima vez, mas agora queria que {B} estivesse lá para tornar a vitória interessante.",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_conflict_p_competitive",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} saiu repetindo mentalmente o momento exato em que pretendia virar o resultado no próximo encontro.",
    "personalidade": "COMPETITIVE",
    "familiaNarrativa": "personalidade_competitive_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_positive_p_glutton",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Antes de ir embora, {A} garantiu que {B} não saísse de mãos vazias.",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_conflict_p_glutton",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} saiu convicto de que, da próxima vez, ninguém tocaria na parte que ele considerava sua.",
    "personalidade": "GLUTTON",
    "familiaNarrativa": "personalidade_glutton_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_positive_p_serene",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{A} levou consigo a sensação rara de que a presença de {B} deixava as coisas mais simples.",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_conflict_p_serene",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} demorou a perder a calma, e talvez por isso tenha demorado ainda mais a esquecer o motivo.",
    "personalidade": "SERENE",
    "familiaNarrativa": "personalidade_serene_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_positive_p_timid",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Para {A}, ficar mais alguns segundos perto de {B} já foi uma pequena vitória.",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_conflict_p_timid",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} se afastou primeiro e decidiu que precisaria de tempo antes de tentar se aproximar novamente.",
    "personalidade": "TIMID",
    "familiaNarrativa": "personalidade_timid_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_positive_p_playful",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{A} saiu com uma nova brincadeira reservada especificamente para a próxima vez que encontrasse {B}.",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_conflict_p_playful",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} percebeu tarde demais que a piada tinha deixado de ser engraçada para {B}.",
    "personalidade": "PLAYFUL",
    "familiaNarrativa": "personalidade_playful_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_positive_p_curious",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{A} saiu com mais perguntas sobre {B}, mas agora elas pareciam curiosidade amigável, não desconfiança.",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_conflict_p_curious",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} conseguiu uma resposta para sua curiosidade e, junto dela, um novo motivo para {B} manter distância.",
    "personalidade": "CURIOUS",
    "familiaNarrativa": "personalidade_curious_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_positive_p_lazy",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{A} concluiu que estar com {B} tinha uma vantagem importante: certas tarefas pareciam dar menos trabalho.",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_conflict_p_lazy",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} decidiu que evitar {B} por algum tempo seria, de longe, a opção menos cansativa.",
    "personalidade": "LAZY",
    "familiaNarrativa": "personalidade_lazy_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_positive_p_brave",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{A} deixou o local satisfeito por saber que poderia contar com {B} quando algo realmente difícil aparecesse.",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave_fim",
    "peso": 1.4
  },
  {
    "id": "des_any_conflict_p_brave",
    "slot": "DESFECHO",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} não recuou durante o conflito e saiu ainda mais decidido a não recuar no próximo.",
    "personalidade": "BRAVE",
    "familiaNarrativa": "personalidade_brave_fim",
    "peso": 1.4
  },
  {
    "id": "cb_01",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Como da última vez em {MEMORIA_LOCAL}, {A} reconheceu o gesto de {B} antes que ele terminasse.",
    "familiaNarrativa": "continuidade_gesto",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_02",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "A discussão lembrou imediatamente o que já tinha acontecido em {MEMORIA_LOCAL}.",
    "familiaNarrativa": "continuidade_atrito",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_03",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{A} repetiu o mesmo cuidado que {B} tinha demonstrado no encontro anterior.",
    "familiaNarrativa": "reciprocidade",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_04",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{B} percebeu a mesma provocação do encontro anterior e reagiu antes que ela se repetisse por completo.",
    "familiaNarrativa": "provocacao_recorrente",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_05",
    "slot": "CALLBACK",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "A tarefa trouxe de volta a lembrança da primeira vez em que os dois dividiram uma colheita.",
    "familiaNarrativa": "horta_memoria",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_06",
    "slot": "CALLBACK",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "O canteiro era diferente, mas a disputa lembrava demais a última confusão entre os dois na Horta.",
    "familiaNarrativa": "horta_memoria",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_07",
    "slot": "CALLBACK",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "{A} tentou novamente a técnica que {B} tinha mostrado em um treino anterior — e dessa vez conseguiu.",
    "familiaNarrativa": "treino_tecnica",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_08",
    "slot": "CALLBACK",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "O placar improvisado trouxe de volta uma derrota que {A} ainda não tinha esquecido.",
    "familiaNarrativa": "treino_placar",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_09",
    "slot": "CALLBACK",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "{A} voltou ao mesmo canto onde já tinha descansado perto de {B} antes.",
    "familiaNarrativa": "descanso_lugar",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_10",
    "slot": "CALLBACK",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "O lugar preferido voltou a ser exatamente o mesmo problema da última vez.",
    "familiaNarrativa": "descanso_lugar",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_11",
    "slot": "CALLBACK",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "A velha brincadeira surgiu de novo sem que nenhum dos dois precisasse explicar as regras.",
    "familiaNarrativa": "patio_brincadeira",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_12",
    "slot": "CALLBACK",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "Uma piada antiga reapareceu e, desta vez, {B} decidiu que já tinha ouvido o suficiente.",
    "familiaNarrativa": "patio_piada",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_13",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{B} citou, do seu jeito, a promessa silenciosa que os dois tinham deixado no encontro anterior.",
    "familiaNarrativa": "promessa",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_14",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} aproveitou a primeira oportunidade para cobrar algo que tinha ficado pendente entre os dois.",
    "familiaNarrativa": "pendencia",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_15",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "O que antes exigia cautela aconteceu agora com naturalidade, como se a relação tivesse aprendido o caminho.",
    "familiaNarrativa": "progresso",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_16",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "Uma implicância que parecia esquecida voltou inteira assim que os dois se encontraram.",
    "familiaNarrativa": "implicancia",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_17",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{A} trouxe para o encontro um hábito que claramente tinha aprendido observando {B}.",
    "familiaNarrativa": "aprendizado",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_18",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{B} antecipou o comportamento de {A} e isso só deixou a discussão mais pessoal.",
    "familiaNarrativa": "antecipacao",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_19",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Dessa vez, {A} fez primeiro o gesto que antes só {B} costumava fazer.",
    "familiaNarrativa": "espelhamento",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_20",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "Os dois reconheceram o padrão do conflito cedo demais — e mesmo assim repetiram quase tudo.",
    "familiaNarrativa": "padrao_conflito",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_21",
    "slot": "CALLBACK",
    "local": "GARDEN",
    "resultado": "POSITIVE",
    "texto": "A pequena divisão que já tinha causado discussão antes foi resolvida sem palavras desta vez.",
    "familiaNarrativa": "horta_resolucao",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_22",
    "slot": "CALLBACK",
    "local": "GARDEN",
    "resultado": "CONFLICT",
    "texto": "{A} lembrou exatamente de como {B} tinha dividido a colheita antes e se recusou a aceitar de novo.",
    "familiaNarrativa": "horta_cobranca",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_23",
    "slot": "CALLBACK",
    "local": "TRAINING",
    "resultado": "POSITIVE",
    "texto": "O movimento que antes terminava em provocação virou agora parte da rotina dos dois.",
    "familiaNarrativa": "treino_resolucao",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_24",
    "slot": "CALLBACK",
    "local": "TRAINING",
    "resultado": "CONFLICT",
    "texto": "{B} pediu a revanche que tinha ficado prometida e {A} aceitou rápido demais.",
    "familiaNarrativa": "treino_revanche",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_25",
    "slot": "CALLBACK",
    "local": "REST",
    "resultado": "POSITIVE",
    "texto": "O silêncio que antes era desconfortável agora parecia ser uma espécie de acordo entre eles.",
    "familiaNarrativa": "descanso_progresso",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_26",
    "slot": "CALLBACK",
    "local": "REST",
    "resultado": "CONFLICT",
    "texto": "{A} mudou de lugar antes mesmo de {B} se aproximar, lembrando do último descanso juntos.",
    "familiaNarrativa": "descanso_evitar",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_27",
    "slot": "CALLBACK",
    "local": "YARD",
    "resultado": "POSITIVE",
    "texto": "O objeto que já tinha virado disputa apareceu de novo, e dessa vez {A} entregou a {B} primeiro.",
    "familiaNarrativa": "patio_objeto",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_28",
    "slot": "CALLBACK",
    "local": "YARD",
    "resultado": "CONFLICT",
    "texto": "{B} encontrou o mesmo objeto da antiga disputa e fez questão de segurá-lo antes de {A}.",
    "familiaNarrativa": "patio_objeto",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_29",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "Um pequeno gesto mostrou que {A} não tinha esquecido a ajuda recebida dias atrás.",
    "familiaNarrativa": "gratidao",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_30",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "{A} ainda lembrava exatamente quem tinha ido embora primeiro na última discussão.",
    "familiaNarrativa": "orgulho",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_31",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "POSITIVE",
    "texto": "{B} percebeu que uma antiga cautela de {A} já não aparecia com a mesma força.",
    "familiaNarrativa": "confianca",
    "requerMemoria": true,
    "peso": 2.0
  },
  {
    "id": "cb_32",
    "slot": "CALLBACK",
    "local": "ANY",
    "resultado": "CONFLICT",
    "texto": "A confiança perdida no encontro anterior ainda não tinha voltado.",
    "familiaNarrativa": "confianca",
    "requerMemoria": true,
    "peso": 2.0
  }
]
```

---

## 6. Eventos importantes para as perguntinhas

Estes eventos não substituem `buildImportantRefugeOptions`; servem como novas famílias de situações para que as quatro opções deixem de parecer sempre a mesma escolha com outra frase.

```json
[
  {
    "id": "imp_dividir_recurso",
    "local": "GARDEN",
    "gatilho": "A dupla encontra uma parte especialmente valiosa da colheita.",
    "opcoes": [
      {
        "tom": "POSITIVO",
        "texto": "Incentivar a dividir de forma justa.",
        "efeitoNarrativo": "cria memoria PARTILHA_JUSTA"
      },
      {
        "tom": "AFETIVO",
        "texto": "Sugerir que {A} deixe {B} escolher primeiro.",
        "efeitoNarrativo": "reforça confiança"
      },
      {
        "tom": "NEUTRO",
        "texto": "Deixar os dois decidirem sozinhos.",
        "efeitoNarrativo": "resultado depende de tier/personalidade"
      },
      {
        "tom": "AGRESSIVO",
        "texto": "Incentivar {A} a ficar com a melhor parte.",
        "efeitoNarrativo": "pode criar COBRANCA_COLHEITA"
      }
    ]
  },
  {
    "id": "imp_revanche",
    "local": "TRAINING",
    "gatilho": "Uma disputa termina sem consenso.",
    "opcoes": [
      {
        "tom": "POSITIVO",
        "texto": "Incentivar os dois a repetir o treino com regras claras.",
        "efeitoNarrativo": "cria REVANCHE_JUSTA"
      },
      {
        "tom": "AFETIVO",
        "texto": "Pedir para reconhecerem o esforço um do outro.",
        "efeitoNarrativo": "reduz tensão"
      },
      {
        "tom": "NEUTRO",
        "texto": "Deixar a rivalidade seguir sem interferência.",
        "efeitoNarrativo": "pode fortalecer RIVAL"
      },
      {
        "tom": "AGRESSIVO",
        "texto": "Provocar {A} dizendo que {B} levou a melhor.",
        "efeitoNarrativo": "aumenta chance de COBRANCA_PLACAR"
      }
    ]
  },
  {
    "id": "imp_lugar_descanso",
    "local": "REST",
    "gatilho": "Os dois disputam o mesmo lugar favorito.",
    "opcoes": [
      {
        "tom": "POSITIVO",
        "texto": "Sugerir que dividam o espaço.",
        "efeitoNarrativo": "cria LUGAR_COMPARTILHADO"
      },
      {
        "tom": "AFETIVO",
        "texto": "Pedir para {A} ceder desta vez.",
        "efeitoNarrativo": "gera gesto de cuidado"
      },
      {
        "tom": "NEUTRO",
        "texto": "Não interferir.",
        "efeitoNarrativo": "o tier atual pesa mais"
      },
      {
        "tom": "AGRESSIVO",
        "texto": "Reforçar que quem chegou primeiro deve ficar.",
        "efeitoNarrativo": "pode criar DISPUTA_LUGAR"
      }
    ]
  },
  {
    "id": "imp_objeto_patio",
    "local": "YARD",
    "gatilho": "Um objeto perdido aparece entre os dois.",
    "opcoes": [
      {
        "tom": "POSITIVO",
        "texto": "Incentivar a procurar o dono juntos.",
        "efeitoNarrativo": "cria MISSAO_COMPARTILHADA"
      },
      {
        "tom": "AFETIVO",
        "texto": "Pedir que {A} confie o objeto a {B}.",
        "efeitoNarrativo": "testa confiança"
      },
      {
        "tom": "NEUTRO",
        "texto": "Deixar que decidam sozinhos.",
        "efeitoNarrativo": "abre variação por personalidade"
      },
      {
        "tom": "AGRESSIVO",
        "texto": "Dizer que {A} encontrou primeiro.",
        "efeitoNarrativo": "pode criar DISPUTA_OBJETO"
      }
    ]
  }
]
```

---

## 7. Novas famílias de memória sugeridas

Além dos `memoryType` atuais, vale guardar tags narrativas menores. Elas não precisam virar enum principal; podem ser um `string[]`.

- `PARTILHA_JUSTA`
- `COBRANCA_COLHEITA`
- `CANTEIRO_COMPARTILHADO`
- `FERRAMENTA_DISPUTADA`
- `REVANCHE_PENDENTE`
- `REVANCHE_JUSTA`
- `TECNICA_APRENDIDA`
- `PLACAR_RECUSADO`
- `LUGAR_COMPARTILHADO`
- `DISPUTA_LUGAR`
- `SILENCIO_CONFORTAVEL`
- `DESCANSO_INTERROMPIDO`
- `PIADA_INTERNA_PATIO`
- `DISPUTA_OBJETO`
- `MISSAO_COMPARTILHADA`
- `CORRIDA_RECORRENTE`
- `GESTO_RETRIBUIDO`
- `PEDIDO_DE_DESCULPA`
- `PROMESSA_IMPLICITA`
- `CONFIANCA_QUEBRADA`
- `CONFIANCA_RECUPERADA`
- `AJUDA_NAO_PEDIDA`
- `PROVOCACAO_RECORRENTE`
- `HABITO_COMPARTILHADO`

Essas tags permitem cenas como: **“na última vez ele não dividiu”**, **“eles já têm um lugar favorito”**, **“essa revanche estava pendente”** e **“a piada interna voltou”**, sem precisar fazer NLP sobre a frase antiga.

---

## 8. Frequência e raridade narrativa

Nem toda cena precisa ser hiper-específica. Se tudo for especial, nada parece especial.

| Classe | Frequência sugerida | Uso |
|---|---:|---|
| Cotidiana | 55% | Reações genéricas/contextuais; mantém o mundo vivo |
| Personalidade/tier | 25% | Faz o mascote parecer ele mesmo |
| Callback | 10% | Mostra que o jogo lembra |
| Avanço de arco | 8% | Conta história em capítulos |
| Cena rara | 2% | Payoff, reconciliação, tradição, nêmesis, super amizade |

Esses percentuais são ponto de partida, não regra rígida. O importante é impedir que callbacks ou arcos consumam todo encontro.

---

## 9. Seleção de protagonista narrativo

O documento-base fala em personalidade de quem “puxa” a cena. Para evitar que o mascote do dono seja sempre o centro, escolha o protagonista por encontro:

- 45% `{A}` puxa a cena.
- 45% `{B}` puxa a cena.
- 10% cena realmente simétrica.

Quando `{B}` for o protagonista, o renderer pode espelhar os placeholders ou passar `personalityDriver = B`. Isso dá independência real ao visitante.

---

## 10. Regras para tier não soar incoerente

- `CONHECIDO`: evitar intimidade, contato automático e piadas internas.
- `COLEGA`: familiaridade funcional; podem trabalhar/treinar juntos sem grande afeto.
- `AMIGO`: confiança explícita, ajuda espontânea, procura ativa.
- `SUPER_AMIGO`: gestos que dispensam explicação, hábitos compartilhados, proteção e callbacks fortes.
- `RIVAL`: competição recorrente ainda pode ser divertida e mutuamente respeitosa.
- `INIMIGO`: baixa confiança, interpretações negativas e cooperação rara.
- `NEMESIS`: continuidade forte; o encontro atual deve parecer capítulo de algo antigo, não briga aleatória.

---

## 11. Regras para personalidade não virar caricatura

A personalidade deve **inclinar** o comportamento, não repetir o mesmo bordão. Um `GLUTTON` não precisa falar de comida em toda cena; um `COMPETITIVE` não precisa transformar tudo em luta. Use frases de personalidade com peso maior apenas em parte dos encontros, intercalando com cenas cotidianas e callbacks.

---

## 12. Exemplo de montagem completa

Contexto: `TRAINING + CONFLICT + COMPETITIVE + RIVAL`.

> **Antes mesmo do aquecimento terminar, {A} e {B} transformaram o treino em um pequeno desafio quando {A} se recusou a baixar a guarda e tratou cada acerto de {B} como provocação pessoal. Nenhum dos dois precisou dizer “revanche” para que a palavra ficasse implícita.**

Em um encontro futuro, se existir `REVANCHE_PENDENTE`, o sistema pode trocar a reação por um callback:

> **{B} pediu a revanche que tinha ficado prometida e {A} aceitou rápido demais.**

A diferença é que o segundo texto não é apenas outra combinação: ele **só existe porque o primeiro aconteceu**.

---

## 13. Exemplo de uma história atravessando vários dias

1. **Horta / conflito:** os dois disputam uma ferramenta.
2. **Pátio / neutro-positivo:** um encontra a ferramenta esquecida e entrega ao outro.
3. **Horta / positivo:** a ferramenta é oferecida primeiro sem discussão.
4. **Descanso / positivo:** aparece um callback sobre como a dupla finalmente parou de transformar tudo em disputa.
5. **Horta / payoff:** a ferramenta vira uma piada interna e deixa de ser motivo de conflito.

O sistema não precisa roteirizar exatamente essa sequência. Basta que as memórias criem e consumam tags, permitindo que eventos de locais diferentes conversem entre si.

---

## 14. Checklist de implementação

- [ ] Adicionar `id` estável às frases.
- [ ] Adicionar `familiaNarrativa`.
- [ ] Substituir o `pick()` puro por seleção ponderada.
- [ ] Guardar histórico de `id` e família por dupla.
- [ ] Variar `VERBO_LOCAL`.
- [ ] Salvar ingredientes estruturados nas memórias.
- [ ] Implementar `CALLBACK` com fallback seguro quando não houver memória.
- [ ] Implementar `arcId`/`beat` sem impedir acontecimentos normais.
- [ ] Limitar a dois arcos ativos por dupla.
- [ ] Criar tags narrativas persistentes simples.
- [ ] Espelhar protagonista A/B.
- [ ] Adicionar métricas: quantos `id` e famílias diferentes cada jogador viu nos últimos 7/30 dias.
- [ ] Só depois ajustar probabilidades de amizade/conflito por local.

---

## 15. Métrica de sucesso

O sistema deve ser avaliado por **repetição percebida**, não apenas pelo número teórico de combinações. Algumas métricas úteis:

- Percentual de acontecimentos dos últimos 30 dias com `familiaNarrativa` inédita para a dupla.
- Intervalo médio até repetir uma família.
- Percentual de duplas com pelo menos um callback após 5+ encontros.
- Percentual de duplas com arco concluído.
- Distribuição de cenas por personalidade/tier, para impedir que uma tag monopolize o texto.
- Quantidade de histórias em que um acontecimento atual referencia algo anterior.

---

## 16. Princípio final

A sensação de “história única” aparece quando o jogador consegue reconhecer três coisas: **este mascote agiu como ele mesmo; essa relação está em um estágio específico; e o jogo lembrou do que aconteceu antes**. O banco grande ajuda, mas a memória estruturada e a seleção antirrepetição são o que transformam centenas de frases em uma narrativa viva.