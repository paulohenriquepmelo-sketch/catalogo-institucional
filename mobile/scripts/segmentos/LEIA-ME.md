# Regras dos segmentos do app

A fonte das regras é `segrules.py`, usada pelo **app e pelo site**. Dela são
**gerados** dois arquivos — não edite os `.ts` à mão:

- app: `mobile/lib/segment-rules.ts`
- site e editor: `lib/segment-rules.ts` (raiz do repositório)

Para ajustar um segmento:

```bash
cd mobile/scripts/segmentos
python3 baixar_catalogo.py             # baixa o catálogo publicado (catalogo.json)
# edite segrules.py
python3 segeval.py                     # contagem por segmento/grupo + produtos sem segmento
python3 segeval.py padarias            # amostra maior de um segmento
python3 fam.py padarias bares          # revisão por "família" (2 primeiras palavras do nome)
python3 gen.py ../../lib/segment-rules.ts            # gera o arquivo do app
python3 gen.py ../../../lib/segment-rules.ts --site  # gera o arquivo do site
```

Cuidados que já apareceram:
- Palavras do sabor ou da embalagem puxam produtos errados ("chocolate" pegava
  mistura p/ bolo; "copo" pegava azeitona copo; "seleta" pegava cachaça). Prefira
  categorias ou palavras mais específicas, e use `exclude`.
- `min_size` (g/ml, lido do nome) separa food service de varejo nos segmentos
  de alimentação.
- Apóstrofo em palavra-chave quebra o arquivo gerado. Use outra parte do nome.
