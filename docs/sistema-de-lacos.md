# Sistema de Laços de Mascote

> Documentação técnica e funcional do sistema social dos mascotes ("Laços").
> Página do jogador: **`/lacos`** — "Escolhas que mudam relações".

## 1. Visão geral

O **sistema de Laços** transforma os mascotes em personagens com **relacionamentos** entre si.
Periodicamente aparecem **eventos sociais** (dividir lanche, disputa de treino, inveja de comida,
provocação no descanso) em que o jogador escolhe como o seu mascote reage. Cada escolha:

- altera a **relação** entre os dois mascotes envolvidos (de −100 = *Nemesis* a +100 = *Quase Irmãos*);
- pode gastar **recursos** (Comida, Doce ou ZikaCoins);
- pode alterar **felicidade**, **EXP** e aplicar **cooldown social** nos mascotes;
- fica registrada no **Histórico Social** (algumas decisões ficam públicas).

Além disso há uma linha paralela de eventos de **cuidado/fuga**: mascotes famintos e tristes
podem **fugir**, e mascotes que fugiram de outros jogadores podem ser **resgatados** por você.

Relações fortes/ruins dentro da **mesma equipe** geram um **modificador leve de combate na Arena Z**.

### Arquivos principais

| Camada | Arquivo |
| --- | --- |
| Núcleo da lógica | `src/lib/mascot-bonds.ts` |
| Página / UI | `src/app/(app)/lacos/page.tsx` |
| Componentes cliente | `src/app/(app)/lacos/_components/bond-actions.tsx` |
| Server actions | `src/app/(app)/lacos/actions.ts` |
| Cron (mantém a fila ativa) | `src/app/api/cron/mascot-bonds/route.ts` |
| Efeito em combate | `src/lib/arena-z.ts` (`applyBondModifiersToArenaMascots`, `getBondCombatModifier`) |

### Modelos de dados (Prisma)

- **`MascotRelation`** — relação **direcional** entre dois mascotes: `relationshipScore`, `type`
  (`FRIEND`/`RIVAL`), `interactionCount`, `specialBondType`, `lastInteractionAt`. Chave única
  `(mascotAId, mascotBId)`. Cada interação grava **as duas direções** (A→B e B→A).
- **`MascotSocialEvent`** — um evento pendente/resolvido: `eventType`, `title`, `description`,
  `optionsJson`, `status` (`PENDING` / `RESOLVED` / `AUTO_RESOLVED`), `visibility`, `expiresAt`,
  `resolvedBy`, `resolvedOptionId`, `resultJson`.
- **`MascotSocialDecisionLog`** — histórico imutável de cada decisão (para a aba de histórico).
- **`Player.mascotBondBehavior`** — comportamento automático escolhido pelo jogador.
- Recursos: **`MascotFoodItem`** (`FOOD`/`SWEET`, com `quantity`) e **`ZikaCoinWallet`** (`balance`).

---

## 2. Escala de relação (score → título)

O `relationshipScore` vai de **−100 a +100** (`clampScore`). O título exibido vem de `relationTier`:

| Faixa de score | Título |
| --- | --- |
| ≤ −80 | **Nemesis** |
| −79 a −60 | Rival Direto |
| −59 a −35 | Rival Forte |
| −34 a −15 | Rival |
| −14 a +14 | **Conhecido** (neutro) |
| +15 a +34 | Colega |
| +35 a +59 | Amigo |
| +60 a +79 | Grande Amigo |
| +80 a +94 | Melhor Amigo |
| ≥ +95 | **Quase Irmãos** |

Na UI: score **≥ +15** pinta a relação de verde (amigável), **≤ −15** de vermelho (hostil).
A barra de progresso usa `(score + 100) / 2` (0–100%).

### Tipo derivado do score

`relationTypeFromScore`: **`FRIEND`** se `score ≥ 15`, senão **`RIVAL`**.

### Laço especial (`specialBondType`)

Calculado por `specialBondFromScore` a cada interação:

| Condição | specialBondType |
| --- | --- |
| score ≥ 95 | `QUASE_IRMAOS` |
| score ≥ 60 | `GRANDE_AMIGO` |
| score ≤ −80 | `NEMESIS` |
| score ≤ −60 | `RIVAL_DIRETO` |
| caso contrário | `null` |

### Score legado (compatibilidade)

Para relações antigas sem `relationshipScore` (valor 0/nulo), `effectiveRelationScore` cai no
cálculo legado por contagem de interações (`legacyRelationScore`):

- **FRIEND:** `min(94, 15 + max(1, interações) × 5)`
- **RIVAL:** `max(−79, −15 − max(1, interações) × 8)`

---

## 3. Eventos sociais normais

### 3.1. Geração de eventos (`createBondEventForPlayer`)

1. Busca até **12** mascotes do jogador que **não** estejam `INJURED`, priorizando equipados,
   favoritos e de maior nível. Precisa de **pelo menos 1** mascote.
2. Busca até **48** mascotes de **outros jogadores** (role `PLAYER`, não `INJURED`), ordenados
   por interação recente e nível. Se não houver nenhum, usa os próprios mascotes como fallback.
3. Sorteia **A** (seu mascote) e **B** (o outro).
4. Sorteia o **tipo de evento** (`Math.random()`):

   | Faixa do roll | Tipo | Título |
   | --- | --- | --- |
   | < 0,30 | `SHARE_SNACK` | Dividir lanche |
   | 0,30–0,58 | `EXP_STEAL` | Treino disputado |
   | 0,58–0,82 | `REST_PROVOKE` | Provocação na recarga |
   | ≥ 0,82 | `FOOD_ENVY` | Inveja de comida |

5. Cria o `MascotSocialEvent` com `expiresAt` = **24 h**. `visibility` é `PRIVATE` se A e B são do
   mesmo dono, senão `INVOLVED_PLAYERS`.

### 3.2. Opções por tipo de evento (`defaultBondOptions`)

Cada opção tem `type` (`POSITIVE` / `NEUTRAL` / `AGGRESSIVE`), `scoreDelta`, custos e efeitos.
`publicEligible: true` faz a decisão aparecer no histórico **público** dos últimos 7 dias.

**`SHARE_SNACK` — Dividir lanche**

| Opção | Tipo | Custo | Δscore | Felic. A | Felic. B | Público |
| --- | --- | --- | --- | --- | --- | --- |
| Dividir o lanche | POSITIVE | 2 Comida | **+12** | +4 | +10 | — |
| Guardar e evitar confusão | NEUTRAL | — | +1 | +1 | — | — |
| Comer sozinho e provocar inveja | AGGRESSIVE | — | **−10** | +6 | −6 | ✔ |

**`EXP_STEAL` — Treino disputado**

| Opção | Tipo | Custo | Δscore | EXP A | EXP B | Felic. B | Público |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Treinar os dois juntos | POSITIVE | 2 Doce | **+10** | +24 | +24 | — | — |
| Deixar o treino seguir | NEUTRAL | — | 0 | +8 | — | — | — |
| Tomar parte do treino | AGGRESSIVE | — | **−14** | +42 | — | −7 | ✔ |

**`REST_PROVOKE` — Provocação na recarga**

| Opção | Tipo | Custo | Δscore | Felic. A | Felic. B | Cooldown B | Público |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Proteger o descanso | POSITIVE | 2 Comida | **+9** | +2 | +9 | — | — |
| Deixar descansar | NEUTRAL | — | +1 | — | +2 | — | — |
| Atrapalhar o descanso | AGGRESSIVE | — | **−12** | +14 EXP A | −8 | 18 min | ✔ |

**`FOOD_ENVY` — Inveja de comida**

| Opção | Tipo | Custo | Δscore | Felic. A | Felic. B | Público |
| --- | --- | --- | --- | --- | --- | --- |
| Oferecer comida também | POSITIVE | 2 Comida | **+11** | +3 | +9 | — |
| Distrair sem gastar comida | NEUTRAL | — | 0 | — | +1 | — |
| Exibir a comida e causar inveja | AGGRESSIVE | — | **−13** | +5 | −9 | ✔ |

**Fallback (tipo desconhecido):** Ajudar com cuidado (+8, custa 2 Comida) / Observar (0) /
Incentivar provocação (−10, +12 EXP A, cooldown 10 min).

### 3.3. Resolução de uma opção (`applyBondOption`)

Roda em **transação** e é usada tanto pela escolha do jogador (`USER`) quanto pela resolução
automática (`AUTO`). Passos:

1. Valida o evento (existe, está `PENDING`, e — se `USER` — pertence ao jogador).
2. Escolhe a opção: `USER` usa a opção clicada; `AUTO` usa `pickAutoOption` (ver §5).
   **Resolução automática nunca pode consumir recursos** (custo ⇒ erro).
3. **Consome custos** (só no modo `USER`) via `consumeBondCost`:
   - `FOOD`/`SWEET`: debita de `MascotFoodItem`; erro se faltar.
   - `COINS`: debita de `ZikaCoinWallet`; erro se saldo insuficiente.
4. **Atualiza a relação nas duas direções** (A→B e B→A) com `scoreDelta` (`ensureDirectionalRelation`),
   incrementando `interactionCount` e recalculando `type`/`specialBondType`.
5. Aplica **felicidade** em A e/ou B (`happiness += …`).
6. Aplica **cooldown social** em B se `cooldownBMinutes` (`socialCooldownUntil`).
7. Grava `MascotSocialDecisionLog` (visibilidade `PUBLIC` se a opção for `publicEligible`, senão a
   visibilidade do evento).
8. Marca o evento como `RESOLVED` (ou `AUTO_RESOLVED`) com `resultJson`.
9. **Fora da transação:** aplica **EXP** (`addExp`) em A/B conforme `expA`/`expB`, e — no caso de
   `RUNAWAY_WARNING` com "Deixar fugir" — cria o evento de resgate (§4).

---

## 4. Linha de cuidado e fuga (Runaway)

Eventos especiais que **não** afetam relação (`scoreDelta: 0`); são sobre manter/perder o mascote.

### 4.1. Aviso de fuga (`RUNAWAY_WARNING`)

`ensureRunawayWarningsForPlayer` cria avisos para mascotes em risco. Um mascote entra em risco quando
**todas** estas condições valem:

- `arenaState = FREE`, **não** listado no bazar, **sem** expedição ativa;
- `happiness < 25` **E** está faminto — `mood = HUNGRY`, ou `lastFedAt` nulo, ou última alimentação
  há mais de **48 h**.

Cria no máximo os 4 mais críticos (equipados / menos felizes / mais tempo sem comer). O aviso dura
**2 dias** (`expiresAt`), com deduplicação de avisos repetidos por mascote.

Opções (`defaultBondOptions(RUNAWAY_WARNING)`):

| Opção | Custo | Efeito |
| --- | --- | --- |
| Cuidar com carinho, brincadeira e **comida** | 1 Comida | felicidade → 85, mood HAPPY, timestamps de cuidado zerados |
| Cuidar com carinho, brincadeira e **doce** | 1 Doce | idem (happinessA base +65) |
| **Deixar fugir** | — | felicidade −5; gera evento de resgate para outro jogador |

**Recuperação automática:** se o jogador alimentar o mascote por fora (deixando de bater os critérios
de fuga), `clearRunawayWarningIfRecovered` resolve o aviso como `recovered_by_feeding` e restaura o
mood. Contas em **standby** (ver `isStandbyActive`) têm avisos resolvidos automaticamente sem punição.

### 4.2. Resgate de mascote perdido (`RUNAWAY_RESCUE`)

Quando alguém escolhe **"Deixar fugir"**, `createRunawayRescueEvent`:

- coloca o mascote em `socialCooldownUntil` de **3 dias**, tira de equipado/favorito;
- cria um `RUNAWAY_RESCUE` para **outro jogador** (o mais ativo recentemente), com prazo de **3 dias**.

Opções: **Acolher com comida** (1 Comida) / **Acolher com doce** (1 Doce) / **Deixar seguir caminho**.
Se acolher, o mascote **muda de dono** (`playerId` = quem resgatou), tem estado resetado (FREE, feliz,
sem lock de EXP, sem expedição), **todas as relações antigas são apagadas**, e o Pokémon é registrado
na Pokédex do novo dono (fonte "Resgate em Laços").

---

## 5. Comportamento automático & expiração

Cada evento tem prazo. Se **expirar sem resposta**, o mascote decide sozinho — **nunca gastando**
recursos do jogador.

### 5.1. Auto-resolução (`autoResolveExpiredBondEvents`)

Ao abrir `/lacos` (e no cron), eventos `PENDING` com `expiresAt` vencido são resolvidos em modo `AUTO`.

### 5.2. Escolha automática (`pickAutoOption`) por comportamento

O jogador define `mascotBondBehavior` (rótulos em `BOND_BEHAVIOR_LABEL`). Regras:

- Eventos de fuga: sempre a opção **"deixar fugir"/"deixar seguir"** (sem gastar recursos).
- Considera **apenas opções sem custo**.
- `COMPETITIVE` → primeira opção **agressiva** disponível.
- `AVOID_CONFLICT` → primeira opção **neutra**.
- `FRIENDLY` / `SOCIAL` → opção neutra com `scoreDelta ≥ 0` (senão a primeira neutra/qualquer).
- Demais (`FREE`, `TRAINING`, `EXPEDITION`, `PROTECT_FOOD`, `SHARE_RESOURCES`, `PROTECT_WEAK`) →
  neutra, senão agressiva, senão a primeira sem custo.

Rótulos disponíveis: Temperamento Livre, Incentivar Amizades, Espírito Competitivo, Evitar Conflitos,
Foco em Treino, Foco em Expedição, Foco Social, Proteger Comida, Compartilhar Recursos, Cuidar dos Mais Fracos.

### 5.3. Cadência de eventos (`ensureBondEventCadence`)

Mantém a fila social "viva". Parâmetros padrão da página: `minHours` 1, `maxPending` 10, `maxCreate` 3.
No **cron** (`/api/cron/mascot-bonds`): `minHours` 3, `maxPending` 10, `maxCreate` 1.

- Se o último evento foi criado há menos de `minHours`, ou já há `maxPending` pendentes → cria 0.
- Quantidade desejada por tempo desde o último: **≥ 6 h → 3**, **≥ 3 h → 2**, senão **1**
  (limitada por `maxCreate` e pela folga até `maxPending`).

### 5.4. Cron

`GET /api/cron/mascot-bonds` (auth `Bearer CRON_SECRET`) processa até **100** jogadores ativos com
**sessão válida** e ao menos 1 mascote, em lotes de 5: resolve vencidos e cria novos conforme a cadência.

---

## 6. Efeito em combate (Arena Z)

Laços dentro da **mesma equipe** geram um modificador **pequeno e intencionalmente limitado**.

`getBondCombatModifier(mascotIds)` busca as relações entre os mascotes informados e soma um `delta`
por relação (por `mascotAId`):

| Score efetivo | Δ multiplicador |
| --- | --- |
| ≥ +80 | **+0,05** |
| +60 a +79 | +0,035 |
| +35 a +59 | +0,02 |
| −60 a −79 | −0,025 |
| ≤ −80 | **−0,04** |
| entre −59 e +34 | 0 |

O multiplicador final é **limitado ao intervalo `[0,90 ; 1,08]`** por mascote.
`applyBondModifiersToArenaMascots` aplica esse multiplicador a **force, agility, instinct, vitality e
hp** (arredondado, com pisos mínimos). É aplicado ao atacante em PvE e a atacante+defensor em PvP.

> Regra de balanceamento: o efeito é de propósito pequeno — cria consequência sem desequilibrar.

---

## 7. Recursos consumidos

| Recurso | Fonte | Onde é usado |
| --- | --- | --- |
| **Comida de Mascote** (`FOOD`) | `MascotFoodItem` | opções positivas de vários eventos; cuidar/resgatar |
| **Doce de Mascote** (`SWEET`) | `MascotFoodItem` | treinar juntos, cuidar/resgatar com doce |
| **ZikaCoins** (`COINS`) | `ZikaCoinWallet` | suportado por `consumeBondCost` (nenhuma opção padrão usa hoje) |

A UI (`withAvailability`) desabilita a opção e mostra o motivo ("Você precisa de Comida/Doce de
Mascote", "ZikaCoins insuficientes") quando faltam recursos.

---

## 8. Visibilidade e histórico

- **Eventos** têm `visibility`: `PRIVATE` (mesmo dono), `INVOLVED_PLAYERS` (donos de A e B) ou público.
- **Decisões públicas** (`publicEligible` → log `PUBLIC`) aparecem no Histórico Social de todos por
  **7 dias**; as demais só para quem está envolvido.
- A aba **Histórico Social** mostra as últimas 20 decisões relevantes (do jogador ou públicas
  recentes), com rótulo da opção, tipo (positiva/rivalidade/neutra) e quem resolveu (`USER`/`AUTO`/`SYSTEM`).

---

## 9. Resumo do fluxo

```
Cron / abrir /lacos
      │
      ├─ autoResolveExpiredBondEvents  → resolve vencidos em modo AUTO (sem gastar recursos)
      ├─ ensureRunawayWarningsForPlayer → cria avisos de fuga p/ mascotes famintos+tristes
      └─ ensureBondEventCadence        → cria novos eventos sociais conforme tempo/limite
                                              │
Jogador escolhe uma opção ── applyBondOption ─┤
                                              ├─ consome Comida/Doce/ZC (só USER)
                                              ├─ atualiza relação A↔B (score, tier, specialBond)
                                              ├─ felicidade / EXP / cooldown social
                                              ├─ grava log (público se publicEligible)
                                              └─ marca evento RESOLVED
                                              
Arena Z ── getBondCombatModifier → bônus/penalidade leve por laços na mesma equipe
```
