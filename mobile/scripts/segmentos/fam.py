import re, collections, sys, segeval
def family(name):
    toks=[t for t in re.split(r'\s+', re.sub(r'[()]', ' ', name)) if t and not re.match(r'^[\d.,/x]+[a-z]*$', t, re.I)]
    return ' '.join(toks[:2])
def show(sid):
    s=[s for s in segeval.comp if s['id']==sid][0]
    print(f"\n######## {s['name']}")
    for g in s['groups']:
        fams=collections.Counter(family(h) for h in g['hits'])
        print(f"\n== {g['name']} ({len(g['hits'])}): " + '; '.join(f'{k}×{v}' if v>1 else k for k,v in sorted(fams.items())))
if __name__=='__main__':
    for sid in sys.argv[1:]: show(sid)
