# Gera lib/segment-rules.ts do app a partir de segrules.py
import json, sys
from segrules import SEGMENTS
ICONS={'supermercados':'basket','restaurantes':'restaurant','padarias':'bread','docerias':'candy','bares':'beer',
       'delivery':'truck','higiene':'medkit','limpeza':'spray','utilidades':'grid','pizzarias':'pizza',
       'hamburguerias':'fast-food','sorveterias':'ice-cream','marmitarias':'soup'}
q=lambda x: json.dumps(x, ensure_ascii=False).replace('"',"'")
arr=lambda xs: '[' + ', '.join(q(x) for x in xs) + ']'
# `--site` gera a cópia do site (lib/segment-rules.ts na raiz do repositório),
# com o mesmo conteúdo e o ícone como texto (o site mapeia para lucide-react).
SITE_HEADER = '''/**
 * Segmentos de clientes do SITE — mesmas regras do app mobile. ARQUIVO GERADO:
 * edite `mobile/scripts/segmentos/segrules.py` e rode
 * `python3 gen.py ../../lib/segment-rules.ts` e
 * `python3 gen.py ../../../lib/segment-rules.ts --site` (veja o LEIA-ME.md).
 *
 * Um produto pode estar em VÁRIOS segmentos; cada segmento tem grupos.
 * Um grupo inclui o produto quando a CATEGORIA está em `categories` OU o NOME
 * tem alguma palavra de `keywords`, e o nome não tem nenhuma de `exclude`.
 * `minSize` (g/ml, lido do nome) exige embalagem food service.
 */

export type SegmentGroupRule = {
  name: string;
  categories: string[];
  keywords: string[];
  exclude: string[];
  minSize: number;
};

export type SegmentRule = {
  id: string;
  name: string;
  note: string;
  icon: string;
  /** Coleção de data: não aparece na lista de segmentos. */
  hidden?: boolean;
  groups: SegmentGroupRule[];
};

'''
site = '--site' in sys.argv
if site:
    header = SITE_HEADER
else:
    src=open(sys.argv[1]).read()
    header=src[:src.index('export const SEGMENT_RULES')]
out=[header+'export const SEGMENT_RULES: SegmentRule[] = [']
for s in SEGMENTS:
    out += ['  {', f"    id: {q(s['id'])},", f"    name: {q(s['name'])},", f"    note: {q(s['note'])},", f"    icon: {q(ICONS[s['id']])},", '    groups: [']
    for g in s['groups']:
        out += ['      {', f"        name: {q(g['name'])},"] + [f"        {k}: {arr(g.get(k, []))}," for k in ('categories','keywords','exclude')] + [f"        minSize: {g.get('min_size', 0)},", '      },']
    out += ['    ],', '  },']
out.append('];\n')
open(sys.argv[1],'w').write('\n'.join(out))
