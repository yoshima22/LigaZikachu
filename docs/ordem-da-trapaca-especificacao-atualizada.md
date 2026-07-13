# Ordem da Trapaca - Especificacao Atualizada

Documento de alinhamento para implementacao local/offline do evento "Ordem da Trapaca" e da base futura de Raid Bosses.

Importante: todo desenvolvimento deste modo deve permanecer local ate aprovacao explicita. Nao fazer push, PR ou deploy para Vercel sem autorizacao.

## 1. Objetivo

Criar um evento especial em tres fases:

1. Invasao da Ordem da Trapaca, com travessuras temporarias em sistemas existentes.
2. Investigacao comunitaria com pistas gerais e especificas, liberando solucoes para cada travessura.
3. Senha do esconderijo e Raid Boss coletiva contra o Capitao Trambique usando Sableye, com Mega Sableye aos 30% de HP.

Depois do evento, a pagina deve servir como base reutilizavel para futuras Raid Bosses manuais iniciadas por admin.

## 2. Regra Central de Investigacao

Os botoes/interacoes de solucao nao aparecem imediatamente.

O jogador primeiro ve apenas a travessura ativa e seus efeitos no sistema afetado.

As solucoes so ficam disponiveis quando a comunidade tiver pistas suficientes:

```txt
pistasGeraisEncontradas >= requiredGeneralClues
pistasEspecificasDaEtapa >= requiredSpecificClues
etapaAnteriorResolvida == true, quando houver etapa anterior
```

Antes disso:

- o elemento pode parecer suspeito;
- pode ter visual de anomalia;
- nao deve resolver nada;
- se houver feedback, deve dizer que ainda faltam pistas.

Depois disso:

- o botao/interacao aparece claramente;
- o primeiro jogador que resolver remove a travessura;
- o painel do evento registra quem resolveu;
- o sistema afetado volta ao normal imediatamente.

## 3. Tipos de Pistas

### 3.1 Pistas Gerais

Pistas menos precisas. Contam para liberar qualquer etapa.

Exemplo:

```txt
A Ordem da Trapaca gosta de esconder botao onde ninguem costuma clicar.
```

Uso:

- contam para todas as etapas;
- aparecem na pagina do evento;
- podem ser boas, ruins ou piadas;
- ajudam a liberar botoes de solucao.

### 3.2 Pistas Especificas

Pistas relacionadas a uma etapa especifica.

Exemplo:

```txt
O slot do meio do Bazar esta vendendo uma mentira.
```

Uso:

- contam apenas para a etapa correspondente;
- aparecem separadas por etapa na pagina do evento;
- indicam o tema da travessura;
- ajudam a liberar o botao daquela etapa.

### 3.3 Fontes de Drop das Pistas

As pistas podem dropar somente em:

- Arena Z;
- Liga Semanal dos Mascotes;
- expedicoes padrao de 30 minutos;
- expedicoes padrao de 1 hora.

Nao incluir em:

- expedicoes longas;
- expedicoes apenas de item;
- sistemas que favorecem jogador online o dia todo;
- drops presos a um jogador especifico.

Mensagem de drop sugerida:

```txt
Seu mascote encontrou uma pista importante sobre a Ordem da Trapaca.
```

ou:

```txt
Depois da partida, um bilhete suspeito caiu no chao.
```

### 3.4 Limite Diario

Limite sugerido:

```txt
maximo de 10 pistas novas por dia
```

Regras:

- pista descoberta vira publica para todos;
- se a pista ja foi descoberta, nao duplicar;
- se precisar compensar, entregar pequena recompensa alternativa;
- progresso nao deve depender de um unico jogador.

## 4. Exibicao das Pistas na Pagina do Evento

A pagina do evento deve mostrar:

- pistas gerais encontradas;
- pistas especificas separadas por etapa;
- nome da travessura;
- efeito ativo;
- quantidade encontrada e quantidade necessaria;
- lista das dicas ja reveladas;
- estado da etapa;
- quem resolveu, quando resolvida.

Exemplo:

```txt
Pistas gerais: 7 encontradas

ZikaLoot roubada: 3/5 pistas especificas
Bazar sabotado: 2/5 pistas especificas
Laboratorio travado: 4/5 pistas especificas
Liga Semanal adulterada: 1/5 pistas especificas
Mascotes atacados: 0/5 pistas especificas
```

Estados visuais por etapa:

- Travessura ativa;
- Investigando;
- Solucao liberada;
- Resolvida.

## 5. Travessuras Iniciais

Ao iniciar o evento, as travessuras entram em vigor ao mesmo tempo.

Cada travessura esta ligada a uma etapa do misterio e so deve ser removida quando aquela etapa for resolvida.

### 5.1 Etapa 1 - ZikaLoot roubada

Chave tecnica:

```txt
ZIKALOOT_FAKE_NUMBER
```

Novo comportamento:

- ZikaLoot fica trancada;
- recompensas aparecem como roubadas;
- sorteio normal deve ficar bloqueado enquanto a travessura estiver ativa, conforme configuracao admin;
- pagina mostra mensagem tematica;
- botao/interacao de solucao so aparece com pistas suficientes.

Texto sugerido:

```txt
A Ordem da Trapaca roubou as recompensas da ZikaLoot!
O painel foi trancado e um numero falso apareceu no lugar do sorteio.
```

Solucao:

- clicar no numero falso ou botao liberado;
- remover tranca da ZikaLoot;
- registrar quem resolveu.

Feedback:

```txt
O numero falso se desfez em fumaca roxa.
A ZikaLoot foi recuperada da Ordem da Trapaca!
```

### 5.2 Etapa 2 - Bazar sabotado

Chave tecnica:

```txt
BAZAR_SLOT_SIX_CLICKS
```

Novo comportamento:

- slot do meio do Bazar fica sempre visivel;
- mesmo apos atualizacoes/rolagens, o slot do meio continua sabotado;
- item do slot do meio nao pode ser comprado;
- slot deve ter visual corrompido;
- botao/interacao de solucao so aparece com pistas suficientes.

Texto sugerido:

```txt
O slot do meio foi adulterado pela Ordem da Trapaca.
Ele aparece no Bazar, mas a compra foi bloqueada.
```

Solucao:

- apos pistas suficientes, clicar no slot sabotado 6 vezes;
- alternativa: botao de solucao liberado que executa a mesma contagem;
- remover slot sabotado;
- Bazar volta ao comportamento normal.

Feedback:

```txt
O slot sabotado travou, piscou e voltou ao normal.
A Ordem da Trapaca perdeu o controle do Bazar!
```

### 5.3 Etapa 3 - Laboratorio travado

Chave tecnica:

```txt
LAB_SMOKE_TO_MACHINE
```

Novo comportamento:

- analise de mascotes fica trancada;
- conversao em Po de Criacao pode continuar ou nao, conforme configuracao admin;
- pagina mostra fumaca, falha, mensagem corrompida ou simbolo da Ordem;
- botao/interacao de solucao so aparece com pistas suficientes.

Texto sugerido:

```txt
A maquina de analise foi sabotada.
A fumaca roxa parece estar tentando mostrar alguma coisa.
```

Solucao:

- preferencial: arrastar fumaca/icone ate a maquina;
- fallback: clicar na fumaca e depois na maquina;
- liberar analise de mascotes.

Feedback:

```txt
A fumaca foi sugada pela maquina.
O Laboratorio voltou a analisar mascotes!
```

### 5.4 Etapa 4 - Liga Semanal adulterada

Chave tecnica:

```txt
MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS
```

Novo comportamento:

- slots 1, 2 e 3 de todos os times da Liga Semanal recebem -50% em todos os atributos;
- efeito vale apenas enquanto a travessura estiver ativa;
- efeito precisa aparecer claramente na pagina, no combate e no replay;
- botao/interacao de solucao so aparece com pistas suficientes.

Efeito:

```txt
Slots afetados: 1, 2 e 3
Forca: -50%
Agilidade: -50%
Carisma: -50%
Instinto: -50%
Vitalidade: -50%
```

Texto sugerido:

```txt
A Ordem da Trapaca adulterou os primeiros slots da Liga Semanal!
Os tres primeiros mascotes de cada equipe estao lutando com metade dos atributos.
```

Solucao:

- apos pistas suficientes, clicar 3 vezes no ultimo colocado da tabela;
- alternativa: botao visivel na area corrompida da tabela;
- remover debuff para combates futuros.

Observacao:

- combates ja resolvidos nao precisam ser recalculados automaticamente;
- admin pode recalcular manualmente se quiser.

Feedback:

```txt
A tabela tremeu e os numeros adulterados desapareceram.
Os mascotes da Liga Semanal recuperaram seus atributos!
```

### 5.5 Etapa 5 - Mascotes atacados

Chave tecnica:

```txt
MASCOTS_EQUIPPED_WHISPER
```

Novo comportamento:

- alguns mascotes sao feridos aleatoriamente durante o dia;
- ferimento simula retorno da Arena;
- deve haver limite diario baixo;
- admin deve ter botao de emergencia para desligar;
- evitar atingir mascotes importantes demais de forma excessiva;
- quando a etapa for resolvida, novos ferimentos param.

Texto sugerido:

```txt
A Ordem da Trapaca esta atacando mascotes desavisados!
Alguns mascotes podem aparecer feridos como se tivessem acabado de voltar da Arena.
```

Solucao:

- apos pistas suficientes, ir a pagina de Mascotes;
- clicar na foto do mascote equipado;
- o mascote solta fala especial;
- isso revela o ultimo fragmento e encerra a travessura.

Fala especial:

```txt
Eu vi o simbolo da Ordem da Trapaca... eles deixaram numeros marcados nos perfis!
```

Feedback:

```txt
Seu mascote revelou a ultima pista.
Os ataques aleatorios da Ordem da Trapaca foram interrompidos.
```

## 6. Fase da Senha do Esconderijo

Quando todas as travessuras forem resolvidas:

- pagina do evento vira interface de digitador de senha;
- texto explica que a Ordem deixou numeros marcados nos perfis;
- jogadores precisam descobrir uma senha de 6 digitos.

Texto sugerido:

```txt
A porta do esconderijo apareceu.
Mas ela exige uma senha de 6 digitos.
Os carimbos deixados nos perfis dos jogadores escondem a combinacao.
Apenas os numeros verdes estao na posicao correta.
```

### 6.1 Carimbos nos Perfis

Durante a fase da senha, alguns perfis exibem carimbo da Ordem com um numero de 6 digitos.

Regras:

- cada carimbo mostra 6 digitos;
- apenas um digito aparece verde;
- outros 5 aparecem vermelhos;
- digito verde indica valor e posicao correta na senha;
- sistema deve garantir cobertura das 6 posicoes;
- pelo menos 6 jogadores devem ter posicoes verdes diferentes;
- se houver menos de 6 jogadores elegiveis, criar NPCs/cards publicos do evento.

Exemplo:

```txt
Senha correta: 123456
Perfil A: 897236
Verde: 6 na sexta posicao

Perfil B: 183999
Verde: 1 na primeira posicao
```

### 6.2 Geracao Tecnica

Ao entrar na fase de senha:

1. Gerar senha de 6 digitos.
2. Salvar hash da senha.
3. Selecionar jogadores elegiveis.
4. Garantir que cada posicao da senha aparece verde pelo menos uma vez.
5. Gerar numeros falsos nas demais posicoes.
6. Evitar que um mesmo carimbo tenha mais de um digito correto em verde.
7. Salvar carimbos.
8. Exibir carimbos nos perfis.

Admin:

- pode ver senha em modo debug local;
- pode resetar senha;
- reset deve gerar log.

### 6.3 Digitador de Senha

A pagina deve ter:

- campo de 6 digitos;
- botao confirmar;
- feedback de erro;
- feedback de sucesso;
- limite simples de tentativas por usuario.

Feedback errado:

```txt
A porta rangeu, mas nao abriu.
A combinacao ainda esta errada.
```

Feedback certo:

```txt
A porta abriu.
O Capitao Trambique estava esperando do outro lado.
```

Ao acertar:

- marcar quem abriu;
- registrar horario;
- remover travessuras restantes;
- iniciar RAID_ACTIVE;
- mostrar animacao global;
- liberar Raid Boss.

## 7. Raid Boss - Capitao Trambique e Sableye

Chefe:

```txt
Capitao Trambique
```

Boss:

```txt
Sableye
```

Forma Mega:

```txt
Mega Sableye
```

Combate:

- 6 mascotes do jogador contra 1 boss;
- interface especial e epica;
- similar a Arena/Liga Semanal, mas com identidade propria;
- boss grande no centro/direita;
- time do jogador em formacao de 6;
- HP global do boss;
- dano individual da tentativa;
- replay.

## 8. Regras do Combate de Raid

Difere do combate padrao:

- boss pode agir mais de uma vez por rodada;
- boss pode usar ataques em area;
- boss pode aplicar efeitos trapaceiros;
- boss pode quebrar buffs;
- boss pode marcar alvo;
- dano causado reduz HP global;
- boss e adaptado ao jogador.

Dificuldade:

- automatica;
- jogador nao escolhe dificuldade;
- considerar nivel medio, status, raridade e quantidade de mascotes validos;
- jogadores casuais devem contribuir;
- jogadores fortes devem causar mais dano, mas nao trivializar;
- derrota ainda pode causar dano global se o jogador causou dano;
- limitar dano maximo por tentativa para evitar abuso.

## 9. Mega Sableye aos 30%

Quando HP global chegar a 30% ou menos:

- exibir aviso global;
- trocar visual para Mega Sableye;
- registrar no historico;
- mostrar no replay;
- aplicar aumento de dificuldade.

Modificador sugerido:

```txt
Mega Sableye fica cerca de 15% mais forte que o combate padrao.
```

Pode aplicar em:

- dano causado;
- resistencia;
- chance de efeitos especiais;
- ou combinacao moderada.

Mensagem:

```txt
O Sableye do Capitao Trambique reagiu ao desespero!
Ele megaevoluiu para Mega Sableye!
A batalha ficou mais perigosa.
```

## 10. Mascotes Disponiveis para Raid

Raid usa snapshot temporario.

Pode usar mascotes mesmo se estiverem:

- em expedicao;
- descansando;
- na Arena;
- em Rastros;
- feridos;
- em recuperacao;
- em outros modos.

Excecao:

- mascotes listados no Bazar nao podem ser usados.

Justificativa:

- Raid nao deve travar o resto do jogo;
- nao deve punir casual;
- nao altera estado real do mascote;
- nao consome disponibilidade normal.

## 11. HP Global e Cooldown

Exemplo:

```txt
HP Global do Sableye: 1.000.000
Cooldown por jogador: 6 horas
```

Admin deve configurar:

- HP maximo;
- HP atual;
- cooldown;
- dano maximo por tentativa;
- prazo da raid;
- inicio/fim da fase Mega.

## 12. Ranking de Raid

Mostrar:

- dano total por jogador;
- numero de tentativas;
- maior dano em uma tentativa;
- vitorias contra instancia;
- tentativas na fase Mega;
- participacao diaria.

Pontuacao sugerida:

```txt
Tentativa valida: +10
Vitoria contra instancia: +20
Tentativa durante fase Mega: +5
Maior dano pessoal do dia: +5
```

Ordenacao principal:

```txt
dano total desc, participacao desc
```

## 13. Encerramento

Ao derrotar o Capitao Trambique:

- distribuir recompensas;
- desligar modificadores da Ordem;
- remover travessuras restantes;
- remover carimbos/pichacoes ativas;
- restaurar sistemas;
- marcar RAID_DEFEATED ou ENDED;
- transformar pagina em base de Raid Bosses futuras.

Depois:

- admin pode iniciar novas raids manualmente;
- futuras raids nao precisam ter travessuras;
- estrutura de HP global, cooldown, ranking e recompensa continua reutilizavel.

## 14. Admin e Debug

Admin precisa conseguir:

### Evento

- criar/preparar evento;
- editar fase;
- ativar/desativar;
- resetar localmente;
- encerrar;
- forcar fase de senha;
- forcar fase de raid;
- limpar evento.

### Travessuras

- ativar/desativar cada travessura;
- editar intensidade;
- editar texto;
- testar efeito;
- limpar efeito;
- marcar resolvida;
- desfazer resolucao localmente;
- simular botao de solucao;
- ver logs.

### Pistas

- criar pista;
- liberar pista manualmente;
- liberar pistas por cron;
- respeitar limite de 10 por dia;
- marcar pista como geral ou especifica;
- editar etapa relacionada;
- ver painel publico.

### Senha

- gerar senha;
- ver senha em debug local;
- gerar carimbos;
- validar cobertura dos 6 digitos;
- resetar senha;
- testar entrada correta/incorreta.

### Raid

- configurar boss;
- configurar HP;
- alterar HP;
- iniciar Mega;
- resetar Mega;
- simular batalha;
- resetar cooldown;
- ver ranking;
- ver replays;
- forcar derrota/falha.

## 15. Ordem de Implementacao Recomendada

### Parte 1 - Alinhar fases e nomes

- Ajustar fases para ANNOUNCED, INVASION_ACTIVE, MYSTERY_SOLVING, PASSWORD_PHASE, RAID_ACTIVE, RAID_MEGA_PHASE, RAID_DEFEATED, RAID_FAILED, ENDED.
- Remover etapa antiga da Arena Sincronizada, se ela nao fizer parte do novo fluxo.
- Renomear etapas para nomes de travessura.

### Parte 2 - Travessuras reais

- ZikaLoot trancada.
- Bazar com slot do meio sabotado.
- Laboratorio com analise trancada.
- Liga Semanal com debuff slots 1-3.
- Mascotes feridos aleatoriamente com limite e emergencia admin.

### Parte 3 - Drops de pistas

- Arena Z.
- Liga Semanal.
- Expedicao padrao 30 minutos.
- Expedicao padrao 1 hora.
- Limite de 10 pistas publicas por dia.
- Recompensa alternativa quando pista duplicada.

### Parte 4 - Solucoes

- Exibir solucao apenas com pistas suficientes.
- Resolver travessura individualmente.
- Remover efeito.
- Registrar quem resolveu.
- Atualizar painel publico.

### Parte 5 - Senha

- Gerar senha.
- Gerar carimbos.
- Exibir nos perfis.
- Digitador de 6 digitos.
- Transicao para raid.

### Parte 6 - Raid Sableye

- Combate 6v1.
- Replay.
- HP global.
- Cooldown.
- Ranking.
- Mega aos 30%.

### Parte 7 - Futuras raids

- Encerrar evento.
- Restaurar sistemas.
- Transformar pagina em base de Raid Bosses manuais.

## 16. Ajustes Importantes Contra a Versao Anterior

- A etapa `SYNC_HIDDEN_DRAG_BUTTON` nao faz parte do fluxo novo, salvo se o admin decidir manter uma travessura extra.
- Os botoes de anomalia nao devem aparecer desde o inicio.
- Pistas nao sao botao de solucao.
- O jogador nao resolve travessura clicando em pista.
- Pistas sao drops publicos comunitarios.
- O painel deve mostrar claramente contagens gerais e especificas.
- A senha so aparece apos todas as travessuras resolvidas.
- Mega Sableye nao deve ser revelado antes da hora; apenas quando HP <= 30%.

