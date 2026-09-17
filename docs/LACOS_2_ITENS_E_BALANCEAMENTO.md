# Laços 2.0 — itens, níveis e efeitos propostos

Este documento define a primeira proposta de economia exclusiva do modo Laços. Os itens serão armazenados como `ShopItem`/`PlayerInventory`, poderão ser anunciados, leiloados e trocados entre jogadores no Bazar, mas não entrarão no Miauvadão, na ZikaShop ou em ofertas pessoais/exclusivas.

## Regras confirmadas dos espaços públicos

- Cada jogador pode manter até **8 mascotes** nos espaços públicos.
- No máximo **3 mascotes do mesmo jogador** podem ficar na mesma área.
- A recarga de troca é individual por mascote e dura **2 horas**.
- Retirar o mascote não apaga a recarga. Isso impede retirar e recolocar para contornar o tempo.
- O ciclo automático do Refúgio acontece a cada 4 horas, usando o cron já existente.

## Recursos produzidos por área

### Horta — cooperação, partilha e reconciliação

1. **Frutinha da Partilha** (`BOND_SHARED_BERRY`, comum)
   - Produção principal da Horta.
   - Paga escolhas positivas de dividir, cooperar ou presentear.
   - Efeito sugerido: +4 de relação na direção principal e +2 na direção recíproca.

2. **Erva Apaziguadora** (`BOND_CALMING_HERB`, incomum)
   - Chance menor de produção quando uma tarefa termina sem conflito.
   - Usada para reduzir a intensidade de uma discussão sem transformar rivais automaticamente em amigos.
   - Efeito sugerido: impede até 5 pontos negativos e registra uma memória de trégua.

### Campo de Treino — competição e respeito

3. **Ficha de Revanche** (`BOND_REVENGE_TOKEN`, comum)
   - Produzida em desafios e conflitos de treino.
   - Permite incentivar uma rivalidade saudável.
   - Efeito sugerido: -4 de relação, mas transforma o próximo conflito em treino controlado e impede consequências mais severas.

4. **Faixa de Treino em Dupla** (`BOND_TRAINING_RIBBON`, incomum)
   - Produzida quando dois mascotes encerram um treino com respeito.
   - Efeito sugerido: +5 de relação e cria uma memória de parceria de treino.

### Área de Descanso — conforto, confiança e ensino

5. **Almofada Compartilhada** (`BOND_SHARED_PILLOW`, comum)
   - Produzida por mascotes que passam ciclos completos descansando.
   - Efeito sugerido: +4 de relação e chance maior de uma história de cuidado ou ensino entre os mascotes.

6. **Chá de Boa-Noite** (`BOND_NIGHT_TEA`, incomum)
   - Produzido em encontros tranquilos ou reconciliações.
   - Efeito sugerido: remove a tensão deixada pelo último conflito e concede +2 de relação em ambas as direções.

### Pátio — encontros, grupos e descobertas

7. **Brinquedo de Pátio** (`BOND_YARD_TOY`, comum)
   - Produzido por brincadeiras e explorações coletivas.
   - Efeito sugerido: aumenta a chance do próximo evento envolver três ou mais mascotes e formar um círculo social.

8. **Convite Ilustrado** (`BOND_ILLUSTRATED_INVITATION`, incomum)
   - Produzido quando um mascote conhece alguém novo.
   - Permite escolher outro mascote presente na área como alvo preferencial do próximo encontro, sem garantir se será amizade ou rivalidade.

## Itens raros de acontecimentos

9. **Álbum de Memórias** (`BOND_MEMORY_ALBUM`, raro)
   - Obtido em marcos de Amigo, Super Amigo, Inimigo ou Nêmesis.
   - Permite transformar uma memória comum em memória marcante e protegida.
   - Não altera diretamente a pontuação; serve para preservar narrativa e habilitar histórias futuras.

10. **Sino de Trégua** (`BOND_TRUCE_BELL`, raro)
    - Obtido em uma reconciliação importante.
    - Encerra um momento de conflito pendente sem custo adicional e limita a mudança a no máximo +2/-2.

11. **Amuleto de Promessa** (`BOND_PROMISE_CHARM`, épico)
    - Obtido quando dois mascotes atingem Super Amigo pela primeira vez.
    - Protege aquele Laço de adormecimento automático por 30 dias. Não aumenta pontuação.

12. **Carta de Desafio** (`BOND_CHALLENGE_LETTER`, raro)
    - Obtida em marcos de Rival ou Inimigo.
    - Permite provocar um evento de revanche direcionado entre dois mascotes que já possuam relação negativa.
   - Não pode criar uma rivalidade do zero.

## Itens adicionais de competitividade

13. **Apito de Provocação**: +35 pontos percentuais à chance de conflito no próximo encontro de Treino.
14. **Quadro de Desafios**: procura um novo oponente compatível para o mascote escolhido, favorecendo a criação de outro Rival.
15. **Medalha de Segundo Lugar**: após uma derrota de treino, aplica -5 do perdedor para o vencedor e registra revanche.
16. **Faixa “Me Supere”**: aplica -4 nas duas direções para criar uma rivalidade saudável e simétrica.
17. **Troféu Rachado**: transforma uma relação Conhecido em Rival, fixando a pontuação em -15; exige interação anterior.
18. **Passe do Circuito Rival**: abre até 3 desafios separados contra oponentes diferentes, favorecendo múltiplas rivalidades.

Esses itens dão à rivalidade uma economia própria. Rival não é uma amizade que deu errado: é uma rota de progressão ofensiva, de revanche e motivação.

## Distribuição sugerida

- Cada mascote completa um ciclo a cada 4 horas.
- Item comum: 40% por ciclo elegível.
- Item incomum: 10% por ciclo elegível.
- Um mascote produz no máximo 2 itens de área por dia.
- Itens raros vêm de marcos e decisões, não de produção passiva.
- O jogador precisa entrar para escolher e consumir itens, mas não precisa entrar para que as histórias e a produção avancem.

Esses percentuais devem permanecer centralizados para ajuste posterior.

## Escala de relação

| Pontuação | Nível | Função |
|---:|---|---|
| -100 a -80 | Nêmesis | Confronto pessoal máximo |
| -79 a -50 | Inimigo | Hostilidade direcionada |
| -49 a -15 | Rival | Competição e motivação |
| -14 a +14 | Conhecido | Relação ainda indefinida |
| +15 a +39 | Colega | Convivência positiva, sem bônus de combate |
| +40 a +79 | Amigo | Cooperação mecânica moderada |
| +80 a +100 | Super Amigo | Cooperação máxima e efeito raro |

## Notificações

Notificação no site e push somente ao cruzar estes marcos:

- `+40`: tornou-se Amigo;
- `+80`: tornou-se Super Amigo;
- `-50`: tornou-se Inimigo;
- `-80`: tornou-se Nêmesis.

Colega e Rival aparecem no diário e na interface, mas não geram push. Isso mantém os extremos especiais e evita excesso de avisos.

## Efeitos fora do Refúgio

Todos os efeitos devem passar por um único resolvedor central, usado por Arena Z, Liga Semanal, Liga Rush e demais motores. Apenas Laços Ativos contam e somente o melhor efeito elegível por mascote é aplicado.

### Na mesma equipe

- **Colega:** sem bônus numérico.
- **Amigo — Sintonia:** enquanto os dois estiverem aptos no combate, cada um causa +2% de dano e recebe -2% de dano. Não acumula com outro Amigo.
- **Super Amigo — Cobertura:** +3% de dano e -3% de dano recebido enquanto ambos estiverem aptos. Uma vez por combate, quando um deles sofrer um golpe que o deixaria abaixo de 20% de HP, o dano daquele golpe é reduzido em mais 5%.
- **Rivais na mesma equipe — Competição:** +2% de dano, mas sem redução defensiva. O efeito termina quando um dos dois é derrotado.
- Inimigos e Nêmesis não fornecem bônus cooperativo na mesma equipe.

### Em lados opostos

- **Amigo:** o primeiro ataque direto entre os dois causa -5% de dano por hesitação; depois o combate segue normalmente.
- **Super Amigo:** o primeiro ataque direto entre os dois causa -10% de dano. Não impede K.O. se o dano restante for suficiente.
- **Rival:** +3% de dano somente contra aquele Rival.
- **Inimigo:** +5% de dano somente contra aquele Inimigo.
- **Nêmesis:** +8% de dano nos três primeiros turnos de confronto direto entre os dois. Termina com troca, K.O. ou após o terceiro turno direto.

### Limites de segurança

- Bônus ofensivo total proveniente de Laços: máximo de 8%.
- Redução defensiva total proveniente de Laços: máximo de 5%.
- Nenhum efeito é global contra a equipe inteira; sempre depende dos mascotes envolvidos.
- Cópias temporárias de combate devem preservar o ID do mascote de origem para consultar a relação correta.
- Partidas de teste envolvendo administradores não devem gerar progresso de Laços.

## Pontos para aprovação

1. Nomes e identidade visual dos 12 itens.
2. Chance de 40%/10% e limite de 2 itens por mascote/dia.
3. Se Amigo/Super Amigo devem conceder bônus ofensivo e defensivo ou apenas defensivo.
4. Se a hesitação ao enfrentar um amigo é desejável ou se amizades nunca devem trazer desvantagem.
5. Se Rivais na mesma equipe devem receber o bônus competitivo de +2%.
