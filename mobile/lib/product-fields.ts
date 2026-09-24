// Espelha lib/catalog-data.ts do site — os mesmos rótulos, na mesma ordem,
// para a ficha do produto no app bater com a do site público. "supplier" é
// dado interno (o site também filtra esse campo antes de exibir ao
// público), então nunca é mostrado aqui.
export const detailFields = [
  ['packaging', 'Embalagem de venda'],
  ['salesUnit', 'Unidade de venda'],
  ['salesUnitDescription', 'Descrição da unidade de venda'],
  ['masterPackaging', 'Embalagem master'],
  ['masterUnit', 'Unidade master'],
  ['masterUnitDescription', 'Descrição da unidade master'],
  ['ncm', 'NCM'],
  ['ean', 'EAN de venda'],
  ['masterEan', 'EAN master'],
] as const;
