# Laboratório da Dra. Cleide — Design

## Intenção

Dar ao Laboratório uma presença visual memorável, equivalente à do Miauvadão no Bazar, usando a Dra. Cleide Combustão como anfitriã sem alterar nenhuma operação ou regra existente.

## Objetivos

- Exibir a Dra. Cleide em escala grande como personagem-âncora no cabeçalho do Laboratório em telas amplas.
- Traduzir a identidade dela para o painel: fumaça roxa, brilhos de reagente, amarelo de segurança e faixas preto/amarelo.
- Manter o saldo de Pó de Criação, a introdução e as abas claramente legíveis e clicáveis.
- Preservar uma apresentação compacta e sem sobreposição de arte em dispositivos móveis.

## Fora de escopo

- Não mudar textos, lógica, ações de servidor, inventário, custos, limites ou abas do Laboratório.
- Não editar o fluxo de bloqueio narrativo do Laboratório.

## Abordagens consideradas

1. Um banner estático acima do Laboratório: simples, mas não cria a presença lateral característica do Bazar.
2. Dra. Cleide ancorada no painel, com conteúdo deslocado e fundo reativo: escolhida. Reaplica o padrão reconhecível do Miauvadão, protege os controles e mantém o layout responsivo.
3. Arte como plano de fundo integral: descartada porque reduziria contraste e esconderia detalhes da personagem atrás dos controles.

## Decisões de implementação

- A prancha fornecida será usada como referência para uma ilustração única com alpha, salva como `public/images/dra-cleide-lab-hero.png`; a prancha original possui fundo branco, textos e múltiplas poses e não será renderizada na interface.
- Um novo componente de cabeçalho encapsulará a composição visual; `LabClient` continuará responsável pelo estado e pelas ações.
- Em `md` ou maior, a imagem será absoluta e o conteúdo ganhará recuo à esquerda; no mobile, a personagem não será renderizada para preservar a área útil.
- A paleta usa violeta/fúcsia, amarelo Liga Zikachu e faixas de precaução, aplicada apenas ao cabeçalho do Laboratório.
