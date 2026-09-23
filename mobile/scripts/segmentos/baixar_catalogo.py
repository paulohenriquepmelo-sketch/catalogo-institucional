# Baixa o catálogo publicado (só leitura, site público/R2) para catalogo.json,
# usado por segeval.py e fam.py para conferir as regras dos segmentos.
import json, urllib.request

BASE = 'https://sites-project.paulohenriquepmelo.workers.dev'


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'curl/8', 'accept': 'application/json'})
    return json.load(urllib.request.urlopen(request, timeout=30))


cursor, items = 0, []
while True:
    page = get(f'{BASE}/api/products?paged=1&cursor={cursor}&limit=200')
    items += page['items']
    if page.get('done') or not page['items'] or page['nextCursor'] == cursor:
        break
    cursor = page['nextCursor']
json.dump(items, open('catalogo.json', 'w'), ensure_ascii=False)
print(len(items), 'produtos salvos em catalogo.json')
