"""Dá um efeito positivo ao dono de cada habilidade que estava sem efeito (as 67 'penalidades/utilitárias').

Cria 5 efeitos novos e mapeia as demais para efeitos já existentes, sempre com a leitura
"o que a habilidade faz na Pokédex" -> "vantagem equivalente no combate".
Uso: python scripts/ability-positive-effects.py   (depois: python scripts/generate-ability-data.py)
"""
import openpyxl

SRC = 'docs/habilidades-passivas-mascotes.xlsx'

NEW_EFFECTS = {
    # código: (nome, categoria, gatilho, texto, ativações, escala, mín, máx)
    'ANULAR_BONUS': ('Anula bônus rivais', 'Suporte', 'Início da rodada',
                     'Nas 3 primeiras rodadas, anula os bônus de Ambiente e de Aura dos rivais.', 3, 'Instinto', None, None),
    'PESADELO': ('Pesadelo', 'Controle', 'Início da rodada',
                 'Nas 3 primeiras rodadas, cada rival perde {rng} do HP máximo no início da rodada.', 3, 'Instinto', 2, 6),
    'AQUECIMENTO': ('Aquecimento', 'Defesa', 'Início da rodada',
                    'Nas 2 primeiras rodadas recebe {rng} menos dano; depois, seus 3 golpes seguintes causam {rng} mais dano.', 3, 'Vitalidade', 6, 20),
    'GOLPE_FELIZ': ('Golpe feliz', 'Dano', 'Ao atacar',
                    '30% de chance de o golpe causar {rng} mais dano.', 3, 'Instinto', 8, 20),
    'VAMPIRISMO': ('Roubo de vida', 'Suporte', 'Ao atacar',
                   'Recupera {rng} do dano causado.', 3, 'Força', 6, 15),
}

# slug -> (efeito, parâmetro)
MAP = {
    'air-lock': ('ANULAR_BONUS', None), 'cloud-nine': ('ANULAR_BONUS', None), 'aura-break': ('ANULAR_BONUS', None),
    'neutralizing-gas': ('ANULAR_BONUS', None), 'teraform-zero': ('ANULAR_BONUS', None), 'screen-cleaner': ('ANULAR_BONUS', None),
    'bad-dreams': ('PESADELO', None),
    'slow-start': ('AQUECIMENTO', None), 'truant': ('AQUECIMENTO', None),
    'serene-grace': ('GOLPE_FELIZ', None),
    'magician': ('VAMPIRISMO', None), 'pickpocket': ('VAMPIRISMO', None),
    'anticipation': ('ARMADURA', None), 'tera-shift': ('ARMADURA', None),
    'arena-trap': ('INTIMIDACAO', 'Agilidade'), 'magnet-pull': ('INTIMIDACAO', 'Agilidade'), 'shadow-tag': ('INTIMIDACAO', 'Agilidade'),
    'ball-fetch': ('CURA_GRADUAL', None), 'honey-gather': ('CURA_GRADUAL', None), 'pickup': ('CURA_GRADUAL', None), 'ripen': ('CURA_GRADUAL', None),
    'gluttony': ('REGENERACAO', None),
    'run-away': ('EVASIVA', None), 'illusion': ('EVASIVA', None), 'light-metal': ('EVASIVA', None), 'propeller-tail': ('EVASIVA', None),
    'color-change': ('CASCO', None), 'heavy-metal': ('CASCO', None),
    'comatose': ('CORPO_LIMPO', None), 'sticky-hold': ('CORPO_LIMPO', None), 'suction-cups': ('CORPO_LIMPO', None),
    'commander': ('REFORCO', None),
    'contrary': ('ADVERSIDADE', None), 'klutz': ('ADVERSIDADE', None), 'simple': ('ADVERSIDADE', None),
    'damp': ('IMUNE_INDIRETO', None),
    'dancer': ('GOLPE_DUPLO', None),
    'defeatist': ('FURIA', None), 'zen-mode': ('FURIA', None), 'power-construct': ('FURIA', None),
    'early-bird': ('PURIFICACAO', None),
    'forecast': ('VANTAGEM', None), 'multitype': ('VANTAGEM', None), 'rks-system': ('VANTAGEM', None),
    'libero': ('VANTAGEM', None), 'protean': ('VANTAGEM', None), 'mimicry': ('VANTAGEM', None),
    'forewarn': ('ANALISE', None), 'frisk': ('ANALISE', None),
    'gulp-missile': ('REVIDE', None), 'opportunist': ('REVIDE', None), 'steadfast': ('REVIDE', None),
    'hunger-switch': ('IMPULSO', None),
    'illuminate': ('QUEBRA_GUARDA', None), 'mycelium-might': ('QUEBRA_GUARDA', None), 'stalwart': ('QUEBRA_GUARDA', None),
    'imposter': ('ESPELHO', None), 'trace': ('ESPELHO', None),
    'normalize': ('MAESTRIA_TIPO', 'Normal'),
    'rivalry': ('PODER_BRUTO', None), 'stance-change': ('PODER_BRUTO', None),
    'sand-spit': ('AMBIENTE', 'Pedra'),
    'schooling': ('ESCAMAS', None), 'shields-down': ('ESCAMAS', None),
    'stall': ('ULTIMO', None),
    'telepathy': ('GUARDA', None),
    'zero-to-hero': ('VINGANCA', None),
}

NOTES = {
    'air-lock': 'Anula os efeitos de clima.', 'cloud-nine': 'Anula os efeitos de clima.', 'aura-break': 'Inverte e enfraquece as auras Sombria e de Fada.',
    'neutralizing-gas': 'Neutraliza as habilidades de todos em campo.', 'teraform-zero': 'Neutraliza clima e terreno ao assumir a forma Estelar.',
    'screen-cleaner': 'Anula barreiras como Reflect e Light Screen.', 'bad-dreams': 'Machuca rivais dormindo a cada turno.',
    'slow-start': 'Corta Ataque e Velocidade pela metade nos primeiros 5 turnos.', 'truant': 'Só age em turnos alternados.',
    'serene-grace': 'Dobra a chance dos efeitos extras dos golpes.', 'magician': 'Rouba o item do alvo ao atingir.', 'pickpocket': 'Rouba o item de quem o atinge com contato.',
    'anticipation': 'Avisa se o rival tem um golpe super efetivo.', 'tera-shift': 'Assume a forma Terastal ao entrar.',
    'arena-trap': 'Impede os rivais de fugir ou trocar.', 'magnet-pull': 'Impede rivais de Aço de fugir ou trocar.', 'shadow-tag': 'Impede os rivais de fugir ou trocar.',
    'ball-fetch': 'Recupera a Poké Bola de uma captura que falhou.', 'honey-gather': 'Pode achar mel depois da batalha.', 'pickup': 'Pega itens usados ou largados.', 'ripen': 'Dobra o efeito das frutas.',
    'gluttony': 'Come a fruta mais cedo, com HP abaixo da metade.', 'run-away': 'Foge com certeza de batalhas selvagens.', 'illusion': 'Disfarça-se como outro Pokémon até ser atingido.',
    'light-metal': 'Reduz o peso pela metade.', 'propeller-tail': 'Ignora golpes e habilidades que atraem ataques.', 'color-change': 'Muda de tipo para o do golpe que o atingiu.',
    'heavy-metal': 'Dobra o peso.', 'comatose': 'Age sempre como se estivesse dormindo (imune a status).', 'sticky-hold': 'Impede que lhe roubem o item.',
    'suction-cups': 'Impede ser forçado a sair de campo.', 'commander': 'Entra na boca de um Dondozo aliado.', 'contrary': 'Inverte as mudanças de atributo.',
    'klutz': 'Não consegue usar o item que segura.', 'simple': 'Dobra as mudanças de atributo.', 'damp': 'Impede explosões em campo.', 'dancer': 'Repete golpes de dança que vê.',
    'defeatist': 'Perde força quando o HP cai abaixo da metade.', 'zen-mode': 'Muda de forma com HP abaixo da metade.', 'power-construct': 'Muda de forma com HP abaixo da metade.',
    'early-bird': 'Acorda do sono mais rápido.', 'forecast': 'Muda de tipo e forma conforme o clima.', 'multitype': 'Muda de tipo conforme a placa que segura.', 'rks-system': 'Muda de tipo conforme a memória que segura.',
    'libero': 'Muda de tipo para o do último golpe usado.', 'protean': 'Muda de tipo para o de cada golpe usado.', 'mimicry': 'Muda de tipo conforme o terreno.',
    'forewarn': 'Revela o golpe mais forte do rival ao entrar.', 'frisk': 'Revela o item do rival ao entrar.', 'gulp-missile': 'Captura presas ao usar Surf e as lança quando atingido.',
    'opportunist': 'Copia os aumentos de atributo do rival.', 'steadfast': 'Velocidade sobe ao recuar (flinch).', 'hunger-switch': 'Alterna entre duas formas a cada turno.',
    'illuminate': 'Dobra a chance de encontros selvagens e evita perda de precisão.', 'mycelium-might': 'Golpes de status agem por último, mas ignoram habilidades do alvo.',
    'stalwart': 'Ignora golpes e habilidades que atraem ataques.', 'imposter': 'Transforma-se no Pokémon rival ao entrar.', 'trace': 'Copia a habilidade do rival ao entrar.',
    'normalize': 'Todos os seus golpes viram Normais.', 'rivalry': 'Mais dano contra o mesmo gênero e menos contra o oposto.', 'stance-change': 'Muda de forma conforme usa ataques ou defesa.',
    'sand-spit': 'Cria tempestade de areia ao ser atingido.', 'schooling': 'Forma cardume quando o HP está alto.', 'shields-down': 'Muda de forma quando o HP cai abaixo da metade.',
    'stall': 'Sempre age por último dentro da prioridade.', 'telepathy': 'Evita golpes dos aliados.', 'zero-to-hero': 'Assume a forma Heroica ao sair de campo.',
}


def main():
    wb = openpyxl.load_workbook(SRC)
    we = wb['Efeitos (arquétipos)']
    he = [c.value for c in we[1]]
    existing = {row[0].value for row in we.iter_rows(min_row=2)}
    for code, (name, cat, trig, text, ativ, scale, mn, mx) in NEW_EFFECTS.items():
        if code not in existing:
            we.append([code, name, cat, trig, text, ativ, scale, mn, mx])
    eff = {}
    for row in we.iter_rows(min_row=2):
        v = [c.value for c in row]
        eff[v[0]] = dict(zip(he, v))
    wh = wb['Habilidades']
    hh = [c.value for c in wh[1]]
    ci = {h: i for i, h in enumerate(hh)}
    seen = set()
    for row in wh.iter_rows(min_row=2):
        slug = row[ci['Código']].value
        if slug in MAP:
            code, param = MAP[slug]
            e = eff[code]
            mn, mx = e['Mínimo (%)'], e['Máximo (%)']
            text = e['Descrição (use {rng} {T} {S})']
            rng = f"{mn}% a {mx}%" if mn is not None else ''
            row[ci['Categoria']].value = e['Categoria']
            row[ci['Efeito']].value = e['Efeito']
            row[ci['Código do efeito']].value = code
            row[ci['Parâmetro (tipo/atributo)']].value = param or ''
            row[ci['Gatilho']].value = e['Gatilho']
            row[ci['Descrição em português']].value = text.replace('{rng}', rng).replace('{T}', param or '').replace('{S}', param or '')
            row[ci['Ativações']].value = e['Ativações por luta']
            row[ci['Atributo de escala']].value = e['Atributo de escala']
            row[ci['Mín (%)']].value = mn
            row[ci['Máx (%)']].value = mx
            seen.add(slug)
        if slug in NOTES:
            row[ci['Na Pokédex (resumo)']].value = NOTES[slug]
    miss = set(MAP) - seen
    print('sem linha na planilha:', sorted(miss))
    # nenhuma habilidade pode ficar sem efeito
    left = [r[ci['Código']].value for r in wh.iter_rows(min_row=2) if not r[ci['Código do efeito']].value]
    print('ainda sem efeito:', left)
    wb.save(SRC)


main()
