# Torre dos Rebeldes — apresentação sem spoilers e rotas com escolhas reais

Data: 21/10/2026. Estado: especificação para revisão. Este documento não altera o jogo nem abre o evento.

## Objetivo e limites

O jogador deve ver a arte de abertura inteira, entender que há sete desafios sem descobrir antecipadamente os nomes dos chefes ou seus prêmios, e escolher corredores com informações suficientes para ponderar risco e utilidade. A surpresa permanece no resultado exato de cada sala, não na ausência de qualquer informação. As pistas são verdadeiras, porém incompletas: a Torre pode esconder detalhes, mas não mentir ao jogador sobre a natureza básica da passagem. O evento continua exclusivo para administradores e testadores; esta mudança não ativa tickets, baús ou acesso público.

O escopo é a página de entrada, a visão geral das recompensas e as bifurcações dentro das expedições. Nomes e prêmios podem aparecer depois da vitória, no relatório de combate ou de entrega, pois já foram descobertos. A configuração administrativa pode continuar mostrando os valores para teste. Não se alteram nesta etapa probabilidades de drop, dificuldade, combate, Pressão, classes ou recompensas.

## Diagnóstico e opção escolhida

O arquivo `cover.png` tem proporção vertical (1122 × 1402), mas o cabeçalho usa `background-size: cover` numa faixa horizontal de altura mínima 360 px. Esse encaixe necessariamente recorta grande parte da ilustração. A visão geral do lobby importa `TOWER_BOSS_PRIZES` no cliente e mostra de imediato os sete nomes e pacotes. No mapa, o gerador atribui tipos de sala por hash, sem garantir contraste entre duas saídas, enquanto a projeção esconde título e tipo de destinos não visitados; os botões móveis frequentemente dizem apenas “Rota desconhecida”.

Foram consideradas três direções para as rotas: só renomear os botões (rápida, mas ainda sem decisão real); revelar exatamente cada sala (informativa, mas elimina o mistério); ou mostrar indícios fiéis e assegurar tipos de oportunidade diferentes nas bifurcações. A terceira é a escolhida. Ela usa consequências que o jogo já possui, sem criar uma economia paralela nem prometer prêmio que não existe.

## Abertura e recompensas

O cabeçalho passa a separar texto e arte. Em telas largas, o pôster fica em uma coluna própria, inteiro e sem corte (`contain`), com fundo decorativo e moldura que não escondem partes da imagem. Em telas estreitas, texto e imagem são empilhados, com largura responsiva e altura proporcional. Não se substitui o arquivo original nem se reduz a legibilidade do texto sobre uma imagem concorrente. A verificação visual deve cobrir larguras móveis e desktop.

A seção de andares mantém a noção de progressão de 1 a 7, mas cada cartão público/testador usa apenas número do andar, identidade velada e recompensa lacrada, sem valor exato, espécie, tipo de ovo ou nome do chefe. O cliente não importa o catálogo secreto para construir essa visão. Recompensas efetivamente conquistadas continuam visíveis no relatório/registro apropriado, sem depender de CSS para esconder conteúdo já entregue ao navegador. O painel de administração preserva as informações necessárias a quem configura o evento.

## Bifurcações e dados apresentados

Cada saída navegável passa a exibir um cartão com um sinal ambiental curto, a oportunidade provável e o custo ou perigo conhecido. Os sinais vêm do tipo real da sala de destino, mas não revelam seu título específico, encontro, resposta de enigma, prêmio exato, presença de cativos ou resultado de um evento. Exemplos de linguagem: ruídos de patrulha sugerem confronto e desgaste; inscrições sugerem mecanismo cujo erro pressiona a Torre; calor de uma chama sugere recuperação de HP com custo de Pressão; marcas de contenção sugerem possibilidade de resgate, sem garantir que haja alguém preso. Achados instáveis são descritos como oportunidade de interação, sem prometer raridade ou item. Se uma saída leva a sala já visitada, o cartão mostra o fato e o nome já conhecido. Se está bloqueada, mostra por que não é selecionável.

O servidor produz uma projeção de pista para cada saída autorizada. O cliente recebe apenas essa projeção e dados já descobertos; não recebe o nó completo de um destino oculto para compor texto. `MAP`/`SCOUT` e outras capacidades existentes continuam podendo revelar o que já revelavam, sem regredir. O mesmo contrato de pista serve ao mapa desktop e à lista de rotas no celular. A interface distingue seleção pendente, voto de aliado, retorno por passagem conhecida e corredor bloqueado, preservando a regra de confirmação de todos os participantes.

Para **novas** runs, a geração determinística do mapa organiza as três salas de cada coluna intermediária em perfis estratégicos distintos: confronto (`COMBAT`), mecanismo (`PUZZLE`), recuperação (`REST`/`RECOVERY`), resgate (`RESCUE`) ou achado (`EVENT`/`LUCK`). Assim, as duas saídas de uma bifurcação não apresentam o mesmo tipo básico de oportunidade. Entrada, recuperação fixa e chefe são respeitados. A semente ainda determina a composição e mantém reprodutibilidade. A versão do gerador é fixada ao iniciar a run; runs anteriores continuam usando o gerador antigo também quando sobem de andar. Seus mapas persistidos não são regenerados nem migrados, e as pistas mostram honestamente as salas existentes, mesmo se duas opções tiverem perfil igual. Nenhuma rota recebe prêmio, cura ou multiplicador novo nesta mudança: o valor de escolher decorre das mecânicas reais de combate, enigma, descanso, recuperação, resgate e achado já implementadas.

O texto da pista nunca deve sugerir garantia de cura, resgate ou drop quando a condição real pode falhar. Se não houver informação suficiente para uma estimativa de custo, a UI mostra “desconhecido”, sem inventar números. A dificuldade continua vindo das consequências da decisão, da Pressão e dos encontros, não de informação deliberadamente falsa.

## Compatibilidade e verificação

Testes do gerador cobrem reprodutibilidade, fixação da entrada/recuperação/chefe, conectividade, contraste entre as duas saídas de cada bifurcação nova e manutenção da versão antiga em uma run já iniciada após subir de andar. Testes da projeção cobrem pistas coerentes com o destino, ausência de nome/recompensa exatos em destinos ocultos, respeito a `MAP`/`SCOUT`, passagem visitada, rota bloqueada e estado legado sem regeneração. Testes da visão geral garantem que nomes e pacotes de `TOWER_BOSS_PRIZES` não sejam renderizados nem importados no componente público. Verificação responsiva confirma que o pôster completo aparece sem corte e que cartões/ações de rota continuam legíveis no celular.

Antes de qualquer publicação, rodar os testes relevantes, checagem de tipos, lint e build, inspecionar o diff para preservar mudanças preexistentes e confirmar que o guard de acesso admin/testador permanece inalterado. A publicação para produção, se validada, só atualiza o modo fechado; não equivale à abertura do evento aos jogadores.
