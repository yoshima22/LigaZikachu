# Máquina de Raridade do Laboratório

## Intenção

Permitir que administradores testem uma máquina de fusão no Laboratório. Jogadores e GMs veem a aba **Máquina Parada**, sem poder operar a mecânica até a liberação futura.

## Objetivos

- O administrador seleciona explicitamente um **mascote mantido** e os mascotes **consumidos**.
- Converter três mascotes da mesma origem no mascote mantido, elevando a origem em uma etapa: `COMMON → RARE → EVENT → SPECIAL → LAB`.
- Aplicar ao mantido uma reinicialização equivalente à Pena Arco-Íris nas fusões de origem.
- Fundir mascotes de Laboratório no nível 100 para obter estrelas de 1 a 5.
- Todas as validações e alterações acontecem atomicamente no servidor.

## Não objetivos

- Liberar a máquina para jogadores ou GMs.
- Converter mascotes sem origem de ovo, travados, no Bazar, em Arena, em Liga Semanal ou vinculados primordialmente.
- Alterar espécies, apelidos ou a aparência deliberadamente escolhida pelo dono, exceto a volta à forma-base inerente ao reset de Pena.

## Mutação Genética

Cada fusão de origem exige e consome uma unidade de **Mutação Genética** correspondente ao resultado. É um item consumível de inventário, armazenado e exibido no mesmo espaço dos amuletos de sorte. A arte inicial será um placeholder substituível posteriormente.

| Item | Custo na loja de Pó de Criação | Usado em |
| --- | ---: | --- |
| Mutação Genética Rara | 50 | Comum → Raro |
| Mutação Genética de Evento | 100 | Raro → Evento |
| Mutação Genética Especial | 150 | Evento → Especial |
| Mutação Genética de Laboratório | 200 | Especial → Laboratório |

Os quatro itens ficam disponíveis para compra na loja de Pó de Criação do Laboratório. A compra credita o inventário do jogador; a fusão só pode ser confirmada se o inventário tiver a mutação exigida, que é decrementada na mesma transação que atualiza e consome os mascotes.

## Regras de fusão de origem

Cada receita usa **3 mascotes da mesma origem atual**: um é o mantido e dois são consumidos.

| Entradas | Resultado no mantido |
| --- | --- |
| 3 Comuns | origem Rara |
| 3 Raros | origem de Evento |
| 3 de Evento | origem Especial |
| 3 Especiais | origem de Laboratório |

O mantido recebe o reset completo aplicado pela Pena Arco-Íris: retorna à forma-base, nível 1 e EXP 0; personalidade e cinco atributos são sorteados novamente na faixa da **nova origem**. Humor/felicidade, dados de análise, marcos e bônus de proteína são resetados como no item existente. Bônus de evento permanece se já existir, seguindo o comportamento atual da Pena. Os dois consumidos são removidos com suas relações em cascata.

## Regras de estrelas do Laboratório

- Apenas mascotes com origem `LAB`, livres para operações e nível 100 participam.
- O mantido e o consumido devem ter exatamente o mesmo número de estrelas.
- Começam em **1 estrela** por padrão assim que um mascote chega à origem LAB; não há conversão de estrelas para mascotes não-LAB.
- A fusão consome um e mantém o outro em nível 100; aumenta suas estrelas em 1 e soma **+5** permanentemente em força, agilidade, carisma, instinto e vitalidade.
- São válidas as fusões `1★ + 1★ → 2★`, `2★ + 2★ → 3★`, `3★ + 3★ → 4★` e `4★ + 4★ → 5★`. Cinco estrelas é o teto.

## Interface e autorização

- Nova aba no Laboratório: `Máquina Parada` para `PLAYER` e `GAMEMASTER`, com explicação de indisponibilidade.
- Para `ADMIN` e `SUPER_ADMIN`, a mesma aba se torna `Máquina de Raridade`, exibindo as duas modalidades, receitas, pré-requisitos e um resumo claro de sobrevivente/consumidos antes da confirmação.
- A ação do servidor exige administrador mesmo que a interface seja adulterada.

## Persistência e auditoria

- Adicionar `labStars` (inteiro, padrão 0) ao mascote. Um mascote de origem LAB usa no mínimo 1 estrela; não-LAB permanece em 0.
- Cadastrar quatro itens de inventário `Mutação Genética` com imagem placeholder e os preços definidos acima.
- Registrar cada fusão na atividade do jogador, com IDs envolvidos, origem/estrelas antes e resultado após a operação.
- Revalidar propriedade, disponibilidade e todos os pré-requisitos dentro de uma transação serializável, com bloqueio lógico dos IDs envolvidos.

## Abordagens consideradas

1. **Atualizar o mascote mantido (escolhida):** deixa a escolha de sobrevivência visível, preserva a identidade e integra-se ao inventário existente.
2. Criar um quarto mascote de resultado: acrescentaria inventário e perderia a continuidade do mascote que o admin escolheu preservar.

## Decisões de implementação

- Reutilizar a rotina de reset da Pena Arco-Íris, extraindo uma função interna que aceite a nova origem como parâmetro. Isso evita divergência de regras de atributos e forma-base.
- Manter a máquina isolada no Laboratório, usando o mesmo padrão de servidor e proteções já usado pela reciclagem.
- Cobrir receitas, validações de estrela e autorização com testes automatizados antes da interface.
