# Efeitos de títulos — Johto Zikachu III

## Intenção

Trocar as atuais variações de um mesmo efeito pelos cinco momentos visuais de premiação de Johto III. Cada colocação precisa comunicar uma conquista distinta, permanecer legível em telas pequenas e evitar excesso de elementos concorrendo com o nome do jogador.

## Objetivos

- Criar uma composição e uma cadência próprias para 1º, 2º, 3º, 4º lugar e Campeão da Copa Johto.
- Exibir o conteúdo principal aproximadamente um segundo antes da versão atual (o nome começa hoje em 1,5 s; passará a entrar por volta de 0,5 s).
- Corrigir o rótulo de `CHAMPION` para **Campeão da Copa Johto**.
- Reaproveitar somente a infraestrutura do componente e as texturas existentes; não reusar a mesma sequência visual entre colocações.
- Respeitar `prefers-reduced-motion` e manter contraste/legibilidade do nome.

## Fora de escopo

- Mudar regras, recompensas ou dados do torneio.
- Incluir vídeos, dependências ou novos assets pesados.
- Alterar os outros títulos do produto.

## Abordagens consideradas

1. **Aprimorar o template atual:** menor mudança, mas preserva a sensação de níveis de um mesmo efeito; rejeitada.
2. **Cinco composições independentes em React/CSS:** cada uma ganha uma forma dominante, movimentos e paleta próprios, mantendo apenas utilitários e texturas compartilhadas; escolhida pela melhor identidade visual com baixo custo de carregamento.
3. **Efeitos em vídeo/assets animados:** pode ser mais cinematográfico, mas aumenta peso, dependência e complexidade de adaptação; rejeitada.

## Direção selecionada

| Resultado | Linguagem visual | Ritmo | Forma dominante |
| --- | --- | --- | --- |
| 1º lugar | ouro imperial, marfim e luz solar | abertura ascendente e coroação | arco/louros e coroa geométrica |
| 2º lugar | prata, azul glaciar e reflexos prismáticos | dobra/refração em duas passagens | losango facetado |
| 3º lugar | cobre, brasa e pedra quente | impacto curto e faíscas de forja | medalhão hexagonal |
| 4º lugar | verde-esmeralda e água profunda | anéis concêntricos calmos | ondas/órbita aquática |
| Campeão da Copa Johto | rubi, ouro e noite cerimonial | fanfarra compacta e selo final | troféu/coroa em vitral |

Os efeitos serão estruturados como renderizadores específicos por posição, em vez de um nível numérico que habilita/desabilita camadas. A entrada inicial deve concentrar a leitura no nome: o ornamento se forma antes ou junto dele, e partículas ficam discretas no fundo. A animação ambiental posterior será suave e não repetirá o impacto de estreia.

## Implementação e validação

- Refatorar `src/components/ui/title-entrance-johto3.tsx` para selecionar uma composição exclusiva por `tier`.
- Atualizar os keyframes e adicionar suporte de movimento reduzido.
- Criar teste estático ou de componente cobrindo os cinco rótulos e a ausência do rótulo antigo.
- Rodar typecheck e build; revisar visualmente em viewport desktop e mobile.

## Decisões de implementação

- **Minha decisão:** CSS e elementos vetoriais/HTML serão preferidos a emoji para preservar uma direção de arte consistente entre plataformas.
- **Minha decisão:** a duração de entrada será reduzida antecipando marcos atuais em aproximadamente 1 s, sem acelerar excessivamente as transições individuais.
