"""Aplica na planilha docs/habilidades-passivas-mascotes.xlsx as sugestões dos GMs (planilha "habilidades-efeitos-para-gms")
e o sistema de estados alterados (queimado, envenenado, paralisado, dormindo, confuso, congelado, maldito).

Uso (uma vez): py -3 scripts/ability-status-update.py   e depois   py -3 scripts/generate-ability-data.py
Idempotente: reaplicar não muda nada. Lê o que existe e só altera as linhas/efeitos listados aqui.
"""
import sys, io, openpyxl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
SRC = 'docs/habilidades-passivas-mascotes.xlsx'
wb = openpyxl.load_workbook(SRC)
we, wa, wm = wb['Efeitos (arquétipos)'], wb['Habilidades'], wb['Mascotes']

# ── Efeitos: (código, nome, categoria, gatilho, texto, ativações, escala, mín, máx) ─────────────────────────────
NEW_EFFECTS = [
    ('ESTADO_CONTATO', 'Contágio', 'Controle', 'Ao ser atingido', 'Tem {rng} de chance de deixar o atacante {T} (um estado por vez).', 3, 'Instinto', 6, 10),
    ('ESTADO_TOQUE', 'Toque de estado', 'Controle', 'Ao atacar', 'Tem {rng} de chance de deixar o alvo {T} ao atacar (um estado por vez).', 3, 'Instinto', 6, 9),
    ('ESTADO_ALEATORIO', 'Espinhos tóxicos', 'Reflexo', 'Ao ser atingido', 'Tem {rng} de chance de deixar um rival aleatório {T} ao ser atingido.', 3, 'Vitalidade', 6, 20),
    ('ESTADO_DEVOLVE', 'Sincronia', 'Defesa', 'Ao receber um estado', 'Tem {rng} de chance de devolver a quem o causou o estado alterado recebido.', 2, 'Instinto', 20, 25),
    ('IMUNE_ESTADO', 'Imunidade a estado', 'Defesa', 'Passivo', 'Imunidade a estados alterados: {T}.', 0, '-', None, None),
    ('FORCA_ESTADO', 'Força sob estado', 'Dano', 'Com estado alterado', 'Enquanto estiver com {T}, os golpes causam {rng} mais dano.', 0, 'Força', 10, 22),
    ('DEFESA_ESTADO', 'Defesa sob estado', 'Defesa', 'Com estado alterado', 'Enquanto estiver com {T}, recebe {rng} menos dano.', 0, 'Vitalidade', 10, 22),
    ('AGILIDADE_ESTADO', 'Agilidade sob estado', 'Suporte', 'Com estado alterado', 'Enquanto estiver com {T}, ganha {rng} de Agilidade.', 0, 'Agilidade', 10, 22),
    ('CURA_VENENO', 'Cura tóxica', 'Suporte', 'Envenenado', 'Quando envenenado, em vez de perder HP recupera {rng} do HP máximo no fim do turno.', 0, 'Vitalidade', 5, 10),
    ('DANO_CONTRA_ESTADO', 'Aproveitar a fraqueza', 'Dano', 'Ao atacar', 'Golpes contra alvos {T} causam {rng} mais dano.', 3, 'Força', 12, 25),
    ('BONUS_CHANCE_ESTADO', 'Provocar estados', 'Suporte', 'Passivo', 'Soma {rng} (pontos percentuais) à chance dos estados alterados aplicados pelas habilidades dos aliados.', 0, 'Instinto', 3, 5),
    ('IGNORA_IMUNIDADE', 'Corrosão', 'Controle', 'Passivo', 'Os estados de veneno dos aliados têm {rng} de chance de ignorar a imunidade de mascotes Veneno e Metal.', 0, 'Instinto', 10, 20),
    ('CLIMA_CHUVA', 'Chuva', 'Suporte', 'Início da luta', 'Terreno de chuva: nas 3 primeiras rodadas, aliados do tipo {T} ganham {rng} de Agilidade.', 3, 'Instinto', 9, 15),
    ('CLIMA_AREIA', 'Tempestade de areia', 'Suporte', 'Início da luta', 'Nas 3 primeiras rodadas, todos os mascotes que não são dos tipos Pedra, Terra ou Metal perdem 3% do HP máximo no início da rodada.', 3, '-', None, None),
    ('CLIMA_AREIA_REACAO', 'Areia reativa', 'Suporte', 'Ao ser atingido', 'Tem {rng} de chance, ao ser atingido, de criar uma tempestade de areia na rodada seguinte (quem não é Pedra, Terra ou Metal perde 3% do HP máximo).', 3, 'Instinto', 6, 15),
    ('CURA_CLIMA', 'Pele hidratada', 'Suporte', 'Ao agir na chuva', 'Em terreno de chuva, antes de atacar recupera {rng} do HP máximo.', 3, 'Vitalidade', 5, 10),
    ('ATRIBUTO_CLIMA', 'Impulso do sol', 'Dano', 'Sob sol forte', 'Sob sol forte, o maior atributo do mascote sobe {rng}: Força e Instinto viram mais dano, Agilidade vira velocidade e Vitalidade vira menos dano recebido.', 2, 'Força', 8, 20),
    ('ARMADURA_FRACA', 'Armadura quebrada', 'Suporte', 'Ao ser atingido', 'Ao ser atingido pela primeira vez, passa a receber 10% mais dano, mas ganha {rng} de Agilidade pelo resto da luta.', 1, 'Agilidade', 14, 22),
    ('COPIA_TIPO_ALIADO', 'Disfarce', 'Defesa', 'Primeira ação', 'Na primeira ação, assume o tipo do primeiro mascote do próprio time e ganha {rng} de Vitalidade (menos dano recebido) por 2 rodadas.', 1, 'Agilidade', 6, 10),
    ('COPIA_TIPO_RIVAL', 'Impostor', 'Defesa', 'Primeira ação', 'Na primeira ação, assume o tipo do primeiro rival em campo e ganha {rng} de Agilidade por 2 rodadas.', 1, 'Instinto', 6, 10),
    ('CONVERSAO_TIPO', 'Conversão de tipo', 'Dano', 'Ao atacar', 'Se o mascote é do tipo Normal, tem {rng} de chance de o golpe virar {T} e ser super efetivo (+30% de dano) contra mascotes fracos a esse tipo.', 2, 'Força', 20, 30),
    ('ANULA_DEBUFF', 'Anular debuff', 'Defesa', 'Ao receber debuff', 'Tem {rng} de chance de ignorar um debuff recebido.', 3, 'Vitalidade', 5, 15),
    ('ATAQUE_RAPIDO', 'Garra rápida', 'Dano', 'Primeira rodada', 'Na 1ª rodada, ganha {rng} de Agilidade e age primeiro.', 1, 'Agilidade', 12, 22),
    ('IGNORA_PROVOCADOR', 'Alvo firme', 'Defesa', 'Ao atacar', 'Tem {rng} de chance de ignorar um Provocador e manter o alvo escolhido.', 3, 'Agilidade', 6, 15),
    ('ATACA_APESAR_ESTADO', 'Mente aberta', 'Dano', 'Ao agir com estado', 'Tem {rng} de chance de ignorar um estado que o impediria de agir (sono, paralisia ou confusão).', 2, 'Instinto', 15, 30),
    ('COPIA_BUFF', 'Copiar buff', 'Defesa', 'Rival ganha buff', 'Tem {rng} de chance de copiar por 2 rodadas um buff que um rival receber (um por vez).', 2, 'Instinto', 10, 25),
    ('GUARDA_TIPO', 'Proteção de tipo', 'Defesa', 'Ao proteger', 'Quando o Guardião protege um aliado do tipo {T}, o golpe causa {rng} menos dano.', 1, 'Vitalidade', 9, 15),
    ('MUDANCA_STATUS', 'Mudança de status', 'Controle', 'Início da luta', 'Embaralha os atributos do rival mais forte: o maior atributo dele cai {rng}.', 1, 'Instinto', 6, 12),
]
TEXT_CHANGES = {
    'PURIFICACAO': 'No início da rodada, reduz em {rng} o maior debuff do próprio mascote e remove o estado alterado que ele tiver (queimado, envenenado, paralisado, dormindo, confuso ou congelado).',
    'PURIFICACAO_GRUPO': 'No início da rodada, reduz em {rng} o maior debuff de um aliado e remove o estado alterado que ele tiver (queimado, envenenado, paralisado, dormindo, confuso ou congelado).',
    'AQUECIMENTO': 'Nas 2 primeiras rodadas recebe de 10% a 15% menos dano (cresce com a Vitalidade). A partir da 3ª rodada, os 3 golpes seguintes que ele dá causam {rng} mais dano. Nunca recebe mais dano por causa disto.',
}

eff_rows = {r[0].value: r for r in we.iter_rows(min_row=2) if r[0].value}
for code, text in TEXT_CHANGES.items():
    eff_rows[code][4].value = text
eff_rows['AQUECIMENTO'][7].value, eff_rows['AQUECIMENTO'][8].value = 10, 20
for e in NEW_EFFECTS:
    if e[0] in eff_rows:
        row = eff_rows[e[0]]
        for i, v in enumerate(e): row[i].value = v if v is not None else None
    else:
        we.append(list(e)); eff_rows[e[0]] = we[we.max_row]
EFF = {r[0].value: [c.value for c in r] for r in we.iter_rows(min_row=2) if r[0].value}

# ── Habilidades: slug -> (efeito, parâmetro, ativações, escala, mín, máx) — None = herda do efeito ─────────────────
ST = 'qualquer estado alterado'
CH = {
    # sugestões dos GMs
    'bad-dreams': ('DANO_CONTRA_ESTADO', 'dormindo', 3, None, 12, 25),
    'clear-body': ('ANULA_DEBUFF', None, 1, None, 15, 35),
    'corrosion': ('IGNORA_IMUNIDADE', None, 0, None, 10, 20),
    'desolate-land': ('AMBIENTE', 'Fogo e Planta', 3, None, 4, 12),
    'drought': ('AMBIENTE', 'Fogo e Planta', 3, None, 4, 12),
    'mega-sol': ('AMBIENTE', 'Fogo e Planta', 3, None, 4, 12),
    'orichalcum-pulse': ('AMBIENTE', 'Fogo e Planta', 3, None, 4, 12),
    'drizzle': ('CLIMA_CHUVA', 'Água', 3, None, 9, 15),
    'dry-skin': ('CURA_CLIMA', None, 3, None, 5, 10),
    'emergency-exit': ('RETIRADA', None, 1, None, 40, 55),
    'flame-body': ('ESTADO_CONTATO', 'queimado', 3, None, 6, 10),
    'guts': ('FORCA_ESTADO', ST, 0, None, 10, 22),
    'illusion': ('COPIA_TIPO_ALIADO', None, 1, 'Agilidade', 6, 10),
    'imposter': ('COPIA_TIPO_RIVAL', None, 1, 'Instinto', 6, 10),
    'immunity': ('IMUNE_ESTADO', 'Envenenado', 0, None, None, None),
    'insomnia': ('IMUNE_ESTADO', 'Dormindo', 0, None, None, None),
    'own-tempo': ('IMUNE_ESTADO', 'Confuso', 0, None, None, None),
    'water-veil': ('IMUNE_ESTADO', 'Queimado', 0, None, None, None),
    'levitate': ('PELAGEM', 'Terra', 3, None, 20, 30),
    'no-guard': ('ATACA_APESAR_ESTADO', None, 2, None, 15, 30),
    'perish-body': ('ULTIMO_SUSPIRO', None, 1, None, 8, 15),
    'poison-heal': ('CURA_VENENO', None, 0, None, 5, 10),
    'poison-point': ('ESTADO_CONTATO', 'envenenado', 3, None, 6, 10),
    'poison-touch': ('ESTADO_TOQUE', 'envenenado', 3, None, 6, 9),
    'prankster': ('BONUS_CHANCE_ESTADO', None, 0, None, 3, 5),
    'propeller-tail': ('IGNORA_PROVOCADOR', None, 3, None, 6, 15),
    'protosynthesis': ('ATRIBUTO_CLIMA', None, 2, None, 8, 20),
    'refrigerate': ('CONVERSAO_TIPO', 'Gelo', 2, None, 20, 30),
    'sand-spit': ('CLIMA_AREIA_REACAO', None, 3, None, 6, 15),
    'sand-stream': ('CLIMA_AREIA', None, 3, None, None, None),
    'slow-start': ('AQUECIMENTO', None, 3, None, 10, 20),
    'static': ('ESTADO_CONTATO', 'paralisado', 3, None, 6, 20),
    'synchronize': ('ESTADO_DEVOLVE', None, 2, None, 20, 25),
    'toxic-debris': ('ESTADO_ALEATORIO', 'envenenado', 3, None, 6, 20),
    'trace': ('COPIA_BUFF', None, 2, None, 10, 25),
    'weak-armor': ('ARMADURA_FRACA', None, 1, None, 14, 22),
    'wonder-skin': ('ANULA_DEBUFF', None, 3, None, 5, 15),
    # revisão pela Pokédex: o que era só "debuff genérico" passa a usar os estados e imunidades
    'vital-spirit': ('IMUNE_ESTADO', 'Dormindo', 0, None, None, None),
    'limber': ('IMUNE_ESTADO', 'Paralisado', 0, None, None, None),
    'magma-armor': ('IMUNE_ESTADO', 'Congelado', 0, None, None, None),
    'comatose': ('IMUNE_ESTADO', 'Todos os estados alterados', 0, None, None, None),
    'purifying-salt': ('IMUNE_ESTADO', 'Todos os estados alterados', 0, None, None, None),
    'leaf-guard': ('IMUNE_ESTADO', 'Todos os estados alterados (sob sol forte)', 0, None, None, None),
    'sweet-veil': ('IMUNE_ESTADO', 'Dormindo (também aliados)', 0, None, None, None),
    'effect-spore': ('ESTADO_CONTATO', 'paralisado, envenenado ou dormindo (aleatório)', 3, None, 6, 12),
    'spicy-spray': ('ESTADO_CONTATO', 'queimado', 3, None, 6, 10),
    'cursed-body': ('ESTADO_CONTATO', 'maldito', 2, None, 5, 10),
    'toxic-chain': ('ESTADO_TOQUE', 'envenenado', 2, None, 6, 12),
    'poison-puppeteer': ('ESTADO_TOQUE', 'confuso', 2, None, 6, 12),
    'merciless': ('DANO_CONTRA_ESTADO', 'envenenados', 3, None, 8, 20),
    'toxic-boost': ('FORCA_ESTADO', 'o estado envenenado', 0, None, 10, 22),
    'flare-boost': ('FORCA_ESTADO', 'o estado queimado', 0, None, 10, 22),
    'quick-feet': ('AGILIDADE_ESTADO', ST, 0, None, 10, 22),
    'marvel-scale': ('DEFESA_ESTADO', ST, 0, None, 10, 22),
    'stalwart': ('IGNORA_PROVOCADOR', None, 3, None, 6, 15),
    'aerilate': ('CONVERSAO_TIPO', 'Voador', 2, None, 20, 30),
    'pixilate': ('CONVERSAO_TIPO', 'Fada', 2, None, 20, 30),
    'liquid-voice': ('CONVERSAO_TIPO', 'Água', 2, None, 20, 30),
}
DEX = {
    'bad-dreams': 'Machuca rivais dormindo (dano extra contra alvos dormindo).',
    'corrosion': 'Pode envenenar Pokémon de Metal e Veneno (os aliados ignoram a imunidade).',
    'dry-skin': 'Recupera HP na chuva.',
    'emergency-exit': 'Sai de campo quando o HP cai abaixo da metade (aqui: reduz o golpe seguinte).',
    'synchronize': 'Devolve queimadura, paralisia e veneno a quem os causou.',
}

# novas habilidades: (nome, slug, efeito, parâmetro, ativações, escala, mín, máx, dex, espécies [ids])
NEW_ABILITIES = [
    ('Transform', 'transform', 'COPIA_TIPO_RIVAL', None, 1, 'Instinto', 6, 10, 'Transforma-se no rival ao entrar (aqui: copia o tipo dele). Exclusiva de Mew e Ditto.', [151, 132]),
    ('Wonder Room', 'wonder-room', 'MUDANCA_STATUS', 'Psíquico', 1, 'Instinto', 6, 12, 'Embaralha os atributos em campo.', [355, 436, 720, 480, 858, 869]),
    ('Endeavor', 'endeavor', 'VINGANCA', 'Normal', 2, 'Vitalidade', 3, 9, 'Revida quando o time está em desvantagem.', [19, 254, 276, 115, 473, 304, 25]),
    ('Air Balloon', 'air-balloon', 'EVASIVA', None, 1, 'Carisma', 12, 20, 'Flutua com um balão: esquiva parcial.', [25, 425, 587, 133, 213, 572, 39, 35]),
    ('Lum Protection', 'lum-protection', 'GUARDA_TIPO', 'Voador', 1, 'Vitalidade', 9, 15, 'Protege aliados com a força das aves.', [398, 733, 41, 18, 715, 468, 663, 521, 249]),
    ('Quick Claw', 'quick-claw', 'ATAQUE_RAPIDO', None, 1, 'Agilidade', 12, 22, 'Às vezes age primeiro.', []),
]

hdr = [c.value for c in wa[1]]
col = {h: i for i, h in enumerate(hdr)}
rows = {r[col['Código']].value: r for r in wa.iter_rows(min_row=2) if r[col['Código']].value}

def set_row(row, slug, effect, param, act, scale, mn, mx):
    e = EFF[effect]
    row[col['Código do efeito']].value = effect
    row[col['Efeito']].value = e[1]
    row[col['Categoria']].value = e[2]
    row[col['Gatilho']].value = e[3]
    row[col['Parâmetro (tipo/atributo)']].value = param
    row[col['Ativações']].value = act if act is not None else e[5]
    row[col['Atributo de escala']].value = scale or (None if e[6] == '-' else e[6])
    row[col['Mín (%)']].value = mn if mn is not None else e[7]
    row[col['Máx (%)']].value = mx if mx is not None else e[8]
    row[col['Descrição em português']].value = e[4]

for slug, (effect, param, act, scale, mn, mx) in CH.items():
    if slug not in rows: print('sem linha:', slug); continue
    set_row(rows[slug], slug, effect, param, act, scale, mn, mx)
for slug, text in DEX.items():
    if slug in rows: rows[slug][col['Na Pokédex (resumo)']].value = text

# espécies: coluna "Habilidade 3" nova; 2º slot livre primeiro
mh = [c.value for c in wm[1]]
if 'Habilidade 3' not in mh:
    wm.cell(row=1, column=len(mh) + 1, value='Habilidade 3'); mh.append('Habilidade 3')
mc = {h: i for i, h in enumerate(mh)}
species_rows = {r[mc['ID']].value: r for r in wm.iter_rows(min_row=2) if r[mc['ID']].value is not None}
added = []
for name, slug, effect, param, act, scale, mn, mx, dex, species in NEW_ABILITIES:
    if slug not in rows:
        wa.append([None] * len(hdr))
        row = wa[wa.max_row]
        row[col['Habilidade']].value = name
        row[col['Código']].value = slug
        row[col['Original (Pokédex, inglês)']].value = name
        row[col['Na Pokédex (resumo)']].value = dex
        rows[slug] = row
    set_row(rows[slug], slug, effect, param, act, scale, mn, mx)
    for pid in species:
        r = species_rows.get(pid)
        if not r: print('espécie não encontrada:', pid); continue
        names = [r[mc[k]].value for k in ('Habilidade padrão', 'Habilidade 2', 'Habilidade 3')]
        if name in names: continue
        for key in ('Habilidade 2', 'Habilidade 3'):
            cell = wm.cell(row=r[0].row, column=mc[key] + 1)
            if not cell.value:
                cell.value = name; added.append((pid, key, name)); break
        else:
            print('sem espaço:', pid, name)

# Nº de mascotes de cada habilidade (recontado)
count = {}
for r in wm.iter_rows(min_row=2, values_only=True):
    for k in ('Habilidade padrão', 'Habilidade 2', 'Habilidade 3', 'Habilidade oculta'):
        n = r[mc[k]]
        if n: count[n] = count.get(n, 0) + 1
for r in wa.iter_rows(min_row=2):
    n = r[col['Habilidade']].value
    if n: r[col['Nº de mascotes']].value = count.get(n, 0)

wb.save(SRC)
print('efeitos novos:', len(NEW_EFFECTS), '| habilidades alteradas:', len(CH), '| novas:', len(NEW_ABILITIES), '| espécies ligadas:', len(added))
