from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "reformulacao-personalidades-liga-zikachu.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Liga", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("LigaBold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFont(TTFont("LigaItalic", r"C:\Windows\Fonts\ariali.ttf"))

NAVY = colors.HexColor("#070B1A")
PANEL = colors.HexColor("#10182B")
PANEL_2 = colors.HexColor("#162138")
YELLOW = colors.HexColor("#FFD400")
CYAN = colors.HexColor("#4ED9F5")
GREEN = colors.HexColor("#54E6A4")
RED = colors.HexColor("#FF7185")
PURPLE = colors.HexColor("#BA8CFF")
TEXT = colors.HexColor("#F3F6FF")
MUTED = colors.HexColor("#A8B4CF")
LINE = colors.HexColor("#2A3855")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleLiga", fontName="LigaBold", fontSize=26, leading=30,
                          textColor=TEXT, alignment=TA_LEFT, spaceAfter=8))
styles.add(ParagraphStyle(name="SubtitleLiga", fontName="Liga", fontSize=11, leading=16,
                          textColor=MUTED, spaceAfter=14))
styles.add(ParagraphStyle(name="H1Liga", fontName="LigaBold", fontSize=18, leading=22,
                          textColor=YELLOW, spaceBefore=6, spaceAfter=9))
styles.add(ParagraphStyle(name="H2Liga", fontName="LigaBold", fontSize=13, leading=17,
                          textColor=CYAN, spaceBefore=5, spaceAfter=5))
styles.add(ParagraphStyle(name="BodyLiga", fontName="Liga", fontSize=9.2, leading=13.2,
                          textColor=TEXT, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallLiga", fontName="Liga", fontSize=7.8, leading=10.6,
                          textColor=MUTED))
styles.add(ParagraphStyle(name="CalloutLiga", fontName="LigaBold", fontSize=10.2, leading=14,
                          textColor=NAVY, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="TableHeadLiga", fontName="LigaBold", fontSize=8.3, leading=10,
                          textColor=NAVY, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="TableLiga", fontName="Liga", fontSize=7.8, leading=10.2,
                          textColor=TEXT))


def P(text, style="BodyLiga"):
    return Paragraph(text, styles[style])


def card(title, body, accent=CYAN):
    content = [[P(title, "H2Liga")], [P(body)]]
    table = Table(content, colWidths=[174*mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("BOX", (0, 0), (-1, -1), 0.7, accent),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return KeepTogether([table, Spacer(1, 4*mm)])


def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(YELLOW)
    canvas.rect(0, A4[1]-4*mm, A4[0], 4*mm, fill=1, stroke=0)
    canvas.setFont("LigaBold", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18*mm, 11*mm, "LIGA ZIKACHU - DOCUMENTO DE DESIGN")
    canvas.drawRightString(A4[0]-18*mm, 11*mm, f"PAGINA {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm,
                      topMargin=18*mm, bottomMargin=18*mm,
                      title="Reformulacao das Personalidades - Liga Zikachu",
                      author="Liga Zikachu")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="dark", frames=[frame], onPage=page)])

story = []
story += [Spacer(1, 22*mm), P("PERSONALIDADES COM IMPACTO REAL", "TitleLiga"),
          P("Proposta de reformulacao de afinidades, interacoes, expedicoes, combate e comunicacao visual.", "SubtitleLiga")]
notice = Table([[P("DOCUMENTO DE PROPOSTA - NENHUMA REGRA DESTE PDF FOI APLICADA AO JOGO.", "CalloutLiga")]], colWidths=[174*mm])
notice.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), YELLOW), ("BOX", (0,0), (-1,-1), 1, YELLOW),
                            ("TOPPADDING", (0,0), (-1,-1), 9), ("BOTTOMPADDING", (0,0), (-1,-1), 9)]))
story += [notice, Spacer(1, 12*mm)]
story += [P("Objetivo", "H1Liga"), P("Fazer cada personalidade mudar decisões reais sem apagar a identidade dos mascotes existentes. Os efeitos devem ser legíveis, resistíveis por atributos e reproduzidos de forma determinística nos replays."),
          P("Principios", "H1Liga"),
          P("1. Afinidades já existentes são preservadas. 2. Nenhum atributo atual é recalculado retroativamente. 3. Bônus e limitações indicam alvo, duração, origem e intensidade. 4. Resultados aleatórios são gravados no combate e não são sorteados novamente no replay. 5. Personalidade cria escolhas, não uma opção obrigatoriamente superior."),
          Spacer(1, 18*mm), P("Versao de trabalho - agosto de 2026", "SmallLiga")]
story.append(PageBreak())

story += [P("1. Afinidade de atributos", "H1Liga"),
          P("A afinidade define quais atributos a personalidade considera 'muito úteis' e 'úteis' ao escolher crescimento, buffs e debuffs inteligentes. Mascotes que já possuem afinidade mantêm a configuração atual; a tabela vale como padrão para novos registros ou personalidades sem configuração.")]
aff = [
    ["Personalidade", "Muito útil", "Útil"],
    ["Leal", "Carisma", "Vitalidade"], ["Orgulhoso", "Força", "Carisma"],
    ["Travesso", "Instinto", "Agilidade"], ["Preguiçoso", "Vitalidade", "Carisma"],
    ["Competitivo", "Força", "Instinto"], ["Dramático", "Carisma", "Força"],
    ["Brincalhão", "Agilidade", "Carisma"], ["Elétrico", "Agilidade", "Força"],
    ["Tímido", "Instinto", "Vitalidade"], ["Caótico", "Sem preferência fixa", "Sem preferência fixa"],
    ["Curioso", "Instinto", "Agilidade"], ["Guloso", "Vitalidade", "Força"],
    ["Sereno", "Carisma", "Vitalidade"],
]
data = [[P(c, "TableHeadLiga") for c in aff[0]]] + [[P(c, "TableLiga") for c in r] for r in aff[1:]]
t = Table(data, colWidths=[58*mm, 58*mm, 58*mm], repeatRows=1)
t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), YELLOW), ("BACKGROUND", (0,1), (-1,-1), PANEL),
                       ("GRID", (0,0), (-1,-1), .45, LINE), ("ROWBACKGROUNDS", (0,1), (-1,-1), [PANEL, PANEL_2]),
                       ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
                       ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
story += [t, Spacer(1, 6*mm), card("Como a afinidade entra no sistema", "Ao receber um efeito que busca um atributo útil ou muito útil, o jogo consulta esta afinidade. No crescimento, ela ajuda a escolher candidatos; ao remover uma opção, evita apagar o atributo central da personalidade. O Caótico permanece a exceção: ele não respeita uma preferência fixa.", PURPLE)]
story.append(PageBreak())

personalities = [
 ("Leal", "<b>Interações:</b> carinho dá +2 de felicidade; alimentação concede +10% de EXP; eventos sociais positivos são favorecidos.<br/><b>Expedições:</b> cada Super Amigo registrado no próprio mascote concede +1% de EXP final, limitado a +3%. O amigo não precisa participar, o vínculo não é consumido e só vale em modos que normalmente entregam EXP.<br/><b>Combate:</b> vincula-se a um aliado específico: Super Amigo da equipe; na ausência, maior laço; depois, maior Carisma. Enquanto o aliado estiver vivo e abaixo de 35% de HP, o Leal recebe +5% de Carisma e Vitalidade efetivos. Cura, proteção ou interceptação destinada a esse aliado recebe +5%. Não é bônus de equipe."),
 ("Orgulhoso", "<b>Interações:</b> carinho satisfatório rende mais felicidade; vitórias favorecem o humor Confiante; derrotas causam perda adicional de felicidade.<br/><b>Expedições:</b> com felicidade acima de 70, recebe +8% de EXP. Se encontrar ovo, item especial ou pedra de evolução, ganha +10 de felicidade e pode ficar Confiante. Este efeito substitui a antiga descrição ambígua de ponto percentual de item.<br/><b>Combate:</b> acima de 70% de HP, causa +6% de dano. O bônus desaparece ao ficar ferido."),
 ("Travesso", "<b>Interações:</b> Brincar tem 20% de chance de gerar um evento social específico entre ele e outro mascote.<br/><b>Expedições:</b> encontra 10% menos comida comum. A parcela removida é redistribuída somente entre doce, ovo e item especial já válidos naquela expedição; nunca libera recompensa proibida.<br/><b>Combate:</b> o primeiro ataque contra cada inimigo tem 15% de chance de reduzir em 8% o atributo mais útil daquele alvo por 1 round. Afeta apenas o inimigo atacado; toda a equipe se beneficia ao atacá-lo. O maior efeito prevalece e uma nova aplicação apenas renova a duração."),
 ("Preguiçoso", "<b>Interações:</b> Brincar pode deixá-lo Cansado; comida gera +50% de felicidade; carinho remove Cansado.<br/><b>Expedições:</b> jornadas de 3h ou 6h dão +8% de EXP. Se um ovo for obtido, ele nasce com +1 ponto percentual na chance de raridade do mascote. Isso não aumenta a chance de encontrar o ovo.<br/><b>Combate:</b> acima de 50% de HP, recebe -8% de dano.<br/><b>Limitação:</b> ações extras são os segundos ou terceiros atos concedidos por grande vantagem de Agilidade. O Preguiçoso precisa de 10 pontos adicionais de diferença para alcançar cada ação extra."),
 ("Competitivo", "<b>Interações:</b> Brincar concede +10% de EXP da interação e ativa humor Competitivo por 6h. A primeira vitória durante o humor dá +5 de felicidade.<br/><b>Expedições:</b> Treinamento concede +8% de EXP.<br/><b>Combate:</b> contra adversário de nível ou status total superior, causa +7% de dano. Contra Rival direto, também recebe -4% de dano. Não há bônus contra inimigos mais fracos."),
 ("Dramático", "<b>Interações:</b> mudanças de felicidade positivas ou negativas são 20% maiores; eventos sociais positivos podem gerar presente.<br/><b>Expedições:</b> Feliz ou Confiante concede +10% de EXP; Irritado ou Cansado não concede bônus.<br/><b>Combate:</b> abaixo de 35% de HP, causa +10% de dano e recebe +8% de cura. Uma vez por batalha, tem 25% de chance de sobreviver a um golpe fatal com 1 HP.<br/><b>Limitação:</b> mantém a afinidade atual de -15% no crescimento de Vitalidade, sem alteração retroativa."),
 ("Brincalhão", "<b>Interações:</b> Brincar concede +3 de felicidade, +10 de EXP e 15% de chance de reduzir o próximo cooldown de Brincar.<br/><b>Expedições:</b> se uma expedição Padrão encontrar ovo, esse ovo recebe +1 ponto percentual na raridade do mascote; eventos positivos com amigos ficam mais comuns.<br/><b>Combate:</b> ao entrar, tem 12% de chance de dar +5% de Agilidade ao time por 2 rounds. É coletivo e não causa dano."),
 ("Elétrico", "<b>Interações:</b> cooldown de Brincar -20% e menor chance de ficar Cansado.<br/><b>Expedições:</b> reduz um pouco mais o tempo de expedições de 30 minutos e 1 hora, respeitando o limite geral e exibindo o desconto antes da confirmação.<br/><b>Combate:</b> +12% de Agilidade no primeiro round e +5% depois. É forte no começo e em lutas curtas."),
 ("Tímido", "<b>Interações:</b> abaixo de 30 de felicidade pode recusar carinho; a partir de 60, carinho concede +3; acima de 80, cria laços com mais facilidade.<br/><b>Expedições:</b> com felicidade acima de 70, reduz em 20% a chance de um resultado vazio de material e tenta novamente apenas entre recompensas válidas.<br/><b>Combate:</b> antes de sofrer o primeiro golpe, recebe -10% de dano. Depois, ganha +5% de Instinto pelo restante da luta."),
 ("Caótico", "<b>Interações:</b> a primeira brincadeira diária grava um resultado no servidor: 75% de bônus aleatório para a próxima expedição (+10% EXP, -10% duração ou repetição de resultado vazio), 15% sem efeito e 10% de ida ao SUS sem combate. Atualizar a página não muda o sorteio.<br/><b>Combate:</b> a cada round, um atributo próprio recebe modificador aleatório entre -8% e +12%. Pode ser positivo ou negativo.<br/><b>Crescimento:</b> pode concentrar vários pontos da mesma subida de nível em um único atributo. O Laboratório deve sinalizar grande instabilidade."),
]
story += [P("2. Reformulação das personalidades atuais", "H1Liga")]
for i, (name, body) in enumerate(personalities):
    story.append(card(name, body, [CYAN, GREEN, PURPLE, YELLOW][i % 4]))
    if i in (2, 5, 7): story.append(PageBreak())

story.append(PageBreak())
story += [P("3. Novas personalidades", "H1Liga"),
          card("Curioso", "<b>Interações:</b> carinho ou brincadeira pode revelar uma dica sobre a próxima expedição.<br/><b>Expedições:</b> em expedição de Itens, repete o sorteio se o primeiro resultado for exclusivamente comida comum; a primeira expedição do dia concede +5% de EXP.<br/><b>Combate:</b> identifica o inimigo de maior status total e recebe +5% de Instinto contra ele até que seja derrotado.", CYAN),
          card("Guloso", "<b>Interações:</b> comida concede +50% de felicidade; comida e doces dão +15% de EXP; doce fornece +3% de Vitalidade temporária.<br/><b>Expedições:</b> aumenta a presença de comida e doce, reduzindo a parcela de item especial.<br/><b>Combate:</b> quando Alimentado ou Satisfeito, recebe -6% de dano. Com fome, perde essa proteção.", YELLOW),
          card("Sereno", "<b>Interações:</b> uma vez por dia, carinho remove Irritado ou Cansado.<br/><b>Expedições:</b> pode repetir um resultado vazio comum.<br/><b>Combate:</b> reduz em 1 round a duração de provocar e debuffs longos; efeitos de 1 round têm sua intensidade reduzida. Em troca, causa -4% de dano direto.", GREEN)]

story.append(PageBreak())
story += [P("4. Resistência de buffs e debuffs", "H1Liga"),
          P("Todo modificador deve guardar: origem, fonte, alvo, atributos usados, valor base, resistência, valor final, duração e regra de acúmulo. Assim, a interface e o replay podem explicar o cálculo sem esconder números."),
          card("Regra geral sugerida", "A força de um debuff usa principalmente o <b>Instinto da fonte</b>. A resistência do alvo usa <b>60% de Instinto + 40% de Vitalidade</b>. O confronto ajusta o efeito base entre 60% e 135%. Resistência reduz intensidade em vez de transformar a maioria das tentativas em falha total.", RED)]
roles = [
 ["Fonte", "Atributos principais"], ["Encorajador", "Carisma"], ["Cuidador", "Carisma + Vitalidade + nível"],
 ["Guardião", "Vitalidade + Carisma"], ["Batedor", "Agilidade + Instinto"], ["Oportunista", "Instinto"],
 ["Provocador", "Carisma + Instinto"], ["Sabotador", "Instinto + Agilidade"],
]
rt = Table([[P(c, "TableHeadLiga") for c in roles[0]]] + [[P(c, "TableLiga") for c in r] for r in roles[1:]], colWidths=[72*mm, 102*mm], repeatRows=1)
rt.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), YELLOW), ("ROWBACKGROUNDS", (0,1), (-1,-1), [PANEL, PANEL_2]),
                        ("GRID", (0,0), (-1,-1), .45, LINE), ("LEFTPADDING", (0,0), (-1,-1), 7),
                        ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6)]))
story += [rt, Spacer(1, 5*mm), P("O Oportunista enfraquece um inimigo específico e todos os aliados se beneficiam ao atacar esse alvo. Efeitos iguais não somam indefinidamente: o mais forte prevalece e uma nova aplicação renova a duração. Modificadores de atributos diferentes podem coexistir.")]

story.append(PageBreak())
story += [P("5. Comunicação visual e replays", "H1Liga"),
          P("A mecânica só ganha significado quando o jogador enxerga o que aconteceu. O mesmo padrão deve aparecer em Arena, Liga Semanal, Arena Sincronizada e demais replays."),
          card("Linguagem de ícones", "<font color='#54E6A4'><b>Verde:</b></font> buff. <font color='#FF7185'><b>Vermelho:</b></font> debuff. <font color='#4ED9F5'><b>Azul:</b></font> proteção. <font color='#BA8CFF'><b>Roxo:</b></font> personalidade. <font color='#FFD400'><b>Amarelo:</b></font> item.", CYAN),
          card("Detalhes ao tocar ou passar o mouse", "Nome e origem do efeito; alvo individual ou equipe; condição; duração restante; valor base; resistência aplicada; valor final; atributo responsável; regra de acúmulo.", GREEN),
          card("Durante a animação", "Aura curta na fonte, linha visual até o alvo, número flutuante com o modificador, ícone persistente no mascote e animação de encerramento. O resultado fica salvo no replay: assistir novamente nunca refaz sorteios.", PURPLE)]

story.append(PageBreak())
story += [P("6. Texto para WhatsApp ou Discord", "H1Liga"),
P("<b>⚡ PROPOSTA DE REFORMULAÇÃO DAS PERSONALIDADES ⚡</b><br/><i>Ainda não está ativa no jogo.</i><br/><br/>Estamos estudando uma atualização para fazer a personalidade de cada mascote importar de verdade em interações, expedições e combates - com vantagens, limitações e efeitos visuais claros.<br/><br/><b>Afinidades:</b> cada personalidade passa a reconhecer atributos muito úteis e úteis. Quem já tem afinidade não será alterado.<br/><br/><b>Leal:</b> escolhe um aliado específico para proteger e recebe força extra quando esse parceiro está em perigo. Super Amigos também aumentam a EXP de expedições, até +3%.<br/><b>Orgulhoso:</b> rende melhor quando feliz e saudável, mas sente mais as derrotas.<br/><b>Travesso:</b> encontra menos comida comum e pode enfraquecer somente o inimigo que atacou.<br/><b>Preguiçoso:</b> prefere jornadas longas, protege-se bem quando descansado e precisa de mais Agilidade para ações extras. Se encontrar ovo, melhora em 1 ponto percentual a raridade do mascote ao chocar.<br/><b>Competitivo:</b> cresce contra oponentes realmente mais fortes e Rivais.<br/><b>Dramático:</b> fica perigoso com pouca vida e pode sobreviver a um golpe fatal.<br/><b>Brincalhão:</b> melhora brincadeiras, amizades e pode acelerar a equipe.<br/><b>Elétrico:</b> é veloz no começo e reduz o tempo de expedições curtas.<br/><b>Tímido:</b> precisa de confiança, mas resiste melhor ao primeiro golpe.<br/><b>Caótico:</b> pode receber bênçãos, problemas, bônus ou penalidades - até seu crescimento por nível será imprevisível.<br/><br/><b>Novas personalidades propostas:</b><br/>Curioso investiga expedições e marca a maior ameaça; Guloso transforma alimentação em força e proteção; Sereno remove humores negativos e resiste a controle, causando um pouco menos de dano.<br/><br/>Buffs e debuffs também passarão a considerar os atributos de quem aplica e de quem resiste. Nos replays, ícones, auras e números mostrarão origem, alvo, duração e intensidade real de cada efeito.<br/><br/>A meta é simples: olhar para a personalidade e pensar em estratégia - não apenas ler uma palavra bonita no card.")]

story.append(PageBreak())
story += [P("7. Checklist antes da implementação", "H1Liga"),
          P("• Validar os valores em simulações de combate e expedição.<br/>• Definir limites de acúmulo e ordem de resolução.<br/>• Preservar afinidades e atributos já existentes.<br/>• Persistir sorteios diários e resultados de replay no servidor.<br/>• Exibir condições antes do uso de itens e da confirmação de expedições.<br/>• Atualizar manuais, cards, tooltips e logs.<br/>• Criar métricas de uso, vitória e economia para revisão após lançamento."),
          Spacer(1, 18*mm), card("Estado", "Documento aprovado apenas como proposta textual. A implementação das personalidades deve ocorrer em uma etapa separada e explicitamente autorizada.", YELLOW)]

doc.build(story)
print(OUT)
