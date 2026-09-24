import json,re,unicodedata,sys,random
from segrules import SEGMENTS
from size import size_of
BULK=re.compile(r'(?:^|[^a-z0-9])(?:bag|galao|balde|bombona)(?![a-z])|\(gr\)')
def norm(t): return re.sub(r'\s+',' ',''.join(ch for ch in unicodedata.normalize('NFD',t or '') if unicodedata.category(ch)!='Mn').lower()).strip()
def kwnorm(w): return re.sub(r'\s+',' ',''.join(ch for ch in unicodedata.normalize('NFD',w) if unicodedata.category(ch)!='Mn').lower()).lstrip()
def rx(words): return re.compile(r'(?:^|[^a-z0-9])(?:'+'|'.join(re.escape(kwnorm(w)) for w in words)+')') if words else None
items=[p for p in json.load(open('catalogo.json')) if p.get('published') is not False]
def compile_group(g): return dict(name=g['name'], cats=set(norm(x) for x in g.get('categories',[])), kw=rx(g.get('keywords',[])), ex=rx(g.get('exclude',[])), min=g.get('min_size',0))
comp=[dict(id=s['id'],name=s['name'],groups=[compile_group(g) for g in s['groups']]) for s in SEGMENTS]
def match(g,p,n,cat):
    if g['ex'] and g['ex'].search(n): return False
    by_cat = cat in g['cats']
    if not (by_cat or (g['kw'] and g['kw'].search(n))): return False
    if not g['min']: return True
    if BULK.search(n): return True
    sz = size_of(n)
    return sz is not None and sz >= g['min']
member={}
for s in comp:
    for g in s['groups']:
        g['hits']=[]
for p in items:
    n=' '+norm(p['name'])+' '; cat=norm(p.get('category'))
    segs=[]
    for s in comp:
        for g in s['groups']:
            if match(g,p,n,cat): g['hits'].append(p['name']); segs.append(s['id'])
    member[p['id']]=set(segs)
if __name__=='__main__':
    only=sys.argv[1] if len(sys.argv)>1 else None
    random.seed(3)
    for s in comp:
        if only and s['id']!=only: continue
        tot=len({pid for pid,ss in member.items() if s['id'] in ss})
        print(f"\n### {s['name']} — {tot} produtos")
        for g in s['groups']:
            h=g['hits']; print(f"  - {g['name']}: {len(h)} :: "+' | '.join(random.sample(h,min(6 if not only else 14,len(h)))))
    none=[p['name'] for p in items if not member[p['id']]]
    print('\nSEM SEGMENTO:',len(none),' | '.join(none[:40]))
