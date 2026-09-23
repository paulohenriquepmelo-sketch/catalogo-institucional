# Gera lib/segment-rules.ts do app a partir de segrules.py
import json, sys
from segrules import SEGMENTS
ICONS={'supermercados':'basket','restaurantes':'restaurant','padarias':'bread','docerias':'candy','bares':'beer',
       'delivery':'truck','higiene':'medkit','limpeza':'spray','utilidades':'grid','pizzarias':'pizza',
       'hamburguerias':'fast-food','sorveterias':'ice-cream','marmitarias':'soup'}
q=lambda x: json.dumps(x, ensure_ascii=False).replace('"',"'")
arr=lambda xs: '[' + ', '.join(q(x) for x in xs) + ']'
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
