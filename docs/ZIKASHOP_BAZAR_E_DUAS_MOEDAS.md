# ZikaShop, Bazar e plano de pagamento em ZC/LC

Snapshot funcional e de preços em 03/09/2026. Este arquivo separa o sistema atual da proposta futura para facilitar a precificação em outra conversa.

## 1. Moedas

- **ZC (ZikaCoins):** moeda de gameplay. É obtida em torneios, eventos, expedições, apostas, recompensas e interações. Hoje paga toda a ZikaShop e todas as operações monetárias do Bazar.
- **LC (LigaCoins):** moeda premium comprada com dinheiro real. Já possui carteira, histórico, pacotes, pagamento Pix, confirmação por webhook e ajuste administrativo. Ainda não compra itens da ZikaShop nem circula no Bazar.
- As carteiras são independentes. Uma conversão automática entre ZC e LC não deve existir, pois destruiria a referência de preço e permitiria transformar recompensas gratuitas em moeda premium.

## 2. Como a ZikaShop funciona hoje

O catálogo vem de `ShopItem`, com preço inteiro em ZC, estado ativo, raridade, estoque/limites quando aplicáveis e promoções. A compra valida saldo e elegibilidade no servidor, debita ZC e entrega o item na mesma transação. Itens únicos/cosméticos duplicados seguem suas regras próprias. Itens inativos ou de recompensa não aparecem para compra comum.

### Consumíveis e utilidades (preço atual em ZC)

| Item | ZC |
|---|---:|
| Comida de Mascote | 20 |
| Ticket Zika Loot | 79 |
| Doce de Mascote | 100 |
| Água Fresca | 150 |
| Bala de Mel | 300 |
| Ovo Comum | 600 |
| Política de Fraqueza | 600 |
| Vitamina Chocante | 750 |
| Ovo da Sorte | 1.600 |
| Ticket de Férias do Prof. Carvalho | 1.600 |
| Pena Arco-Íris Comum | 900 |
| Amuleto da Sorte | 1.200 |
| Pena Arco-Íris Rara | 2.000 |
| Cesta de Piquenique Chocante | 2.500 |
| Pena Arco-Íris de Evento | 2.600 |
| Pena Arco-Íris Especial | 3.100 |
| Ovo Raro | 3.400 |
| Pena Arco-Íris de Laboratório | 4.200 |
| Proteína Zika | 4.500 |
| Ovo Especial | 6.750 |
| Compartilhador de XP | 8.000 |
| Compartilhador Geral de XP | 8.000 |
| Ovo de Laboratório | 12.000 |

### Itens da Liga Semanal (ZC)

| Item | ZC |
|---|---:|
| Spray de Confusão / Areia no Campo | 400 |
| Apito de Formação / Apito Irritante / Barulho da Arquibancada | 500 |
| Escudo de Banco / Placa de Caminho Errado / Fita Embaraçosa | 600 |
| Bandeira da Torcida / Olho Gordo do Miauvadão | 700 |
| Faixa de Capitão / Botas de Rodada / Bilhete de Provocação | 800 |
| Lanterna de Análise | 900 |
| Tônico de Vestiário | 1.000 |
| Estratégia do Enguiça | 1.200 |

### Cosméticos (ZC)

- Títulos comuns: **50**; incomuns: **120**; raros: **250**; épicos: **500**; lendários: **1.000**; `Anti Trapaça`: **2.000**.
- Banners comuns: **80**; incomuns: **200**; raros: **400** (com `Meu Time Na Praia` a **500**); épicos: **800**; `Mistério Genético`: **1.500**.
- Molduras básicas: **100**; `Chapéu de Palha`: **250**.

### Mega Stones (ZC)

- Todas as Mega Stones ativas, inclusive as novas/customizadas: **15.000**.
- Exceção: `Meteorito de Rayquaza`: **22.000**.

Itens de desafio com preço zero (`Metades do Ticket` e `Ticket Completo`) são recompensas/itens técnicos, não ofertas gratuitas da loja.

## 3. Como o Bazar funciona hoje

O Bazar é um mercado entre jogadores para mascotes, itens e cosméticos. Suporta venda direta, troca, venda ou troca, leilão e mesa de negociação direta. A taxa padrão configurável do anúncio é **10 ZC**; destaque do Miauvadão pode usar uma taxa própria. O anúncio guarda snapshot do ativo e prazo de expiração.

- **Venda:** comprador paga ZC, vendedor recebe ZC e o ativo muda de dono atomicamente.
- **Troca/proposta:** a oferta pode combinar ZC, quantidades de itens e mascotes. Ativos e moedas ficam reservados para impedir gasto ou anúncio simultâneo.
- **Negociação direta:** o dono aceita um participante, ambos montam e travam suas ofertas, dão OK e o anunciante finaliza. Qualquer lado pode cancelar a sessão sem fechar a mesa para futuros participantes.
- **Leilão:** lances em ZC são reservados; ao ser superado, o valor anterior é liberado. O maior lance válido vence no encerramento.
- **Empréstimo:** registra principal, juros e parcelas em ZC; não realiza cobrança automática.
- **Segurança:** mascotes protegidos, equipados, escalados ou ocupados não podem ser negociados; operações importantes usam transação de banco, histórico, atividade e notificações.
- **Histórico:** registra as duas pontas da negociação (`sellerItems`, `buyerItems`, moedas e participantes).

## 4. Estrutura proposta para ZC ou LC

### Catálogo da ZikaShop

Adicionar por oferta, não diretamente no item-base:

```text
ShopOfferPrice
- shopItemId
- currency: ZC | LC
- amount
- active
- startsAt / endsAt (opcionais)
- purchaseLimit (opcional)
```

Isso permite preço ZC, LC ou ambos sem duplicar o item. O painel deve editar os dois valores de modo independente. A compra recebe explicitamente a moeda escolhida e nunca seleciona automaticamente a carteira.

### Anúncios do Bazar

Adicionar:

```text
BazarListing
- acceptedCurrencies: [ZC], [LC] ou [ZC, LC]
- priceZc opcional
- priceLc opcional

BazarProposal
- zcOffer
- lcOffer
- zcEscrowed
- lcEscrowed

BazarTransaction
- zcAmount
- lcAmount
```

O anunciante escolhe quais moedas aceita e define cada preço. Se aceitar ambas, o comprador escolhe **uma das condições publicadas**; não se deve somar moedas sem uma opção explícita de preço misto. Propostas e mesas diretas podem permitir combinações ZC + LC, exibindo cada carteira e reserva separadamente.

### Regras indispensáveis para LC no Bazar

1. Reservar LC no servidor da mesma forma que ZC e itens.
2. Transferir comprador → vendedor atomicamente; nunca criar LC nova numa troca.
3. Registrar razão contábil própria para cada débito, crédito, liberação e cancelamento.
4. Impedir saldo negativo e concorrência entre propostas.
5. Devolver a reserva ao cancelar, expirar, rejeitar ou perder leilão.
6. Exibir claramente que LC recebida de outro jogador não equivale a saque em dinheiro real.
7. Manter limites, auditoria e ferramenta administrativa contra fraude/chargeback.
8. Em estorno de uma compra de LC já gasta ou transferida, criar saldo devedor/bloqueio de mercado em vez de retirar valor de terceiros silenciosamente.

## 5. Parâmetros fáceis de ajustar

Centralizar valores numa tabela/configuração administrativa: preços ZC/LC, taxa do anúncio por moeda, duração, destaque, limites por jogador e habilitação de LC por categoria. A UI lê essa configuração; regras de segurança e entrega continuam fixas no servidor.

## 6. Decisões de economia ainda necessárias

- Quais itens podem ser comprados com LC e quais continuam exclusivos de gameplay.
- Relação de referência LC/ZC apenas para precificação (sem conversão direta).
- Se vendedores podem receber LC livremente ou precisam de limite/nível mínimo.
- Taxa do Bazar em LC e destino dessa taxa.
- Políticas para leilão, empréstimo e ofertas mistas em LC.
- Tratamento de chargeback quando as LC compradas já circularam entre jogadores.
- Limites diários/mensais e trilha de auditoria para prevenção de abuso.

Este desenho preserva as mecânicas atuais: ZC continua funcionando como hoje; LC entra como uma segunda trilha optativa e explícita.
