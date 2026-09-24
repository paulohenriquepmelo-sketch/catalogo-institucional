import re
# Quantidade no nome → gramas ou ml. "1,01KG", "5,01 LTS", "900ML", "25KG", "3,4kg", "02KG", "1LT"
RX = re.compile(r'(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|grs|gramas|lt|lts|l|litro|litros|ml)(?![a-z])')
def size_of(name):
    n = name.lower()
    best = None
    for num, unit in RX.findall(n):
        v = float(num.replace(',', '.'))
        if unit.startswith('k'): v *= 1000
        elif unit in ('lt', 'lts', 'l', 'litro', 'litros'): v *= 1000
        best = v if best is None else max(best, v)
    return best
BULK_WORDS = ['bag', 'galao', 'balde', 'fardo', 'bombona', 'food service', 'foods service', 'prof', 'profissional',
              'institucional', 'granel']
