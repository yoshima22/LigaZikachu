"""Gera src/lib/abilities/data.generated.ts a partir de docs/habilidades-passivas-mascotes.xlsx.

A planilha é a fonte editável do balanceamento (abas Efeitos, Habilidades e Mascotes).
Uso: python scripts/generate-ability-data.py
"""
import json, re, sys
import openpyxl

SRC = 'docs/habilidades-passivas-mascotes.xlsx'
OUT = 'src/lib/abilities/data.generated.ts'

wb = openpyxl.load_workbook(SRC, data_only=True)

def rows(ws):
    it = ws.iter_rows(values_only=True)
    head = [str(h) for h in next(it)]
    for r in it:
        if all(v is None or v == '' for v in r):
            continue
        yield dict(zip(head, r))

def num(v):
    if v is None or v == '' or v == '-':
        return None
    return float(v) if not float(v).is_integer() else int(v)

effects = {}
for r in rows(wb['Efeitos (arquétipos)']):
    effects[r['Código']] = {
        'name': r['Efeito'], 'category': r['Categoria'], 'trigger': r['Gatilho'],
        'text': r['Descrição (use {rng} {T} {S})'], 'activations': int(r['Ativações por luta'] or 0),
        'scale': r['Atributo de escala'] if r['Atributo de escala'] != '-' else None,
        'min': num(r['Mínimo (%)']), 'max': num(r['Máximo (%)']),
    }

abilities, name_to_slug = {}, {}
for r in rows(wb['Habilidades']):
    slug = r['Código']; name_to_slug[r['Habilidade']] = slug
    code = r['Código do efeito']
    ent = {'name': r['Habilidade']}
    if r.get('Na Pokédex (resumo)'):
        ent['dex'] = r['Na Pokédex (resumo)']
    if code:
        ent['effect'] = code
        if r['Parâmetro (tipo/atributo)']:
            ent['param'] = r['Parâmetro (tipo/atributo)']
        base = effects[code]
        o = {}
        a, mn, mx = num(r['Ativações']), num(r['Mín (%)']), num(r['Máx (%)'])
        if a is not None and a != base['activations']: o['activations'] = a
        if mn is not None and mn != base['min']: o['min'] = mn
        if mx is not None and mx != base['max']: o['max'] = mx
        if o: ent['o'] = o
    abilities[slug] = ent

species = {}
unknown = set()
for r in rows(wb['Mascotes']):
    pid = int(r['ID'])
    normal = []
    for key in ('Habilidade padrão', 'Habilidade 2'):
        n = r[key]
        if n:
            s = name_to_slug.get(n)
            if not s: unknown.add(n)
            else: normal.append(s)
    hidden = None
    if r['Habilidade oculta']:
        hidden = name_to_slug.get(r['Habilidade oculta'])
        if not hidden: unknown.add(r['Habilidade oculta'])
    species[pid] = [normal, hidden]
if unknown:
    print('nomes sem slug:', unknown); sys.exit(1)

def j(v): return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
lines = ['// GERADO por scripts/generate-ability-data.py a partir de docs/habilidades-passivas-mascotes.xlsx. Não editar à mão.',
         'export type AbilityEffectDef = { name: string; category: string; trigger: string; text: string; activations: number; scale: string | null; min: number | null; max: number | null };',
         'export type AbilityDef = { name: string; dex?: string; effect?: string; param?: string; o?: { activations?: number; min?: number; max?: number } };',
         '', 'export const ABILITY_EFFECTS: Record<string, AbilityEffectDef> = {']
for k, v in effects.items(): lines.append(f'  {k}: {j(v)},')
lines += ['};', '', 'export const ABILITIES: Record<string, AbilityDef> = {']
for k, v in abilities.items(): lines.append(f'  {j(k)}: {j(v)},')
lines += ['};', '', '// pokemonId -> [habilidades comuns, habilidade oculta]', 'export const SPECIES_ABILITIES: Record<number, [string[], string | null]> = {']
for k, v in species.items(): lines.append(f'  {k}: {j(v)},')
lines.append('};')
open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('ok', len(effects), 'efeitos', len(abilities), 'habilidades', len(species), 'mascotes')
