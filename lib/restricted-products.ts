import type { Product } from './catalog-data';
import { normalize } from './segments';

// Produtos que continuam na lista geral do catálogo, mas nunca entram em
// destaque, oferta ou novidades.
const RESTRICTIONS = [
  {
    // Lei 9.294/1996, art. 3º-A, III: é proibida a propaganda de tabaco na internet.
    pattern:
      /(?:^|[^a-z0-9])(?:fumo|tabaco|tabacaria|cigarro|cigarros|cigarrilha|charuto|narguile|palheiro)(?![a-z])/,
    rule: 'Produto de tabaco não pode ficar em destaque, oferta ou novidades (Lei 9.294/1996).',
  },
  {
    // Fogos de artifício: venda controlada e proibida a menores (ECA, art. 81, V).
    pattern:
      /(?:^|[^a-z0-9])(?:fogos|estalinhos?|estalos|traques?|girandola|rojao|rojoes|bombinhas?)(?![a-z])/,
    rule: 'Fogos de artifício não podem ficar em destaque, oferta ou novidades.',
  },
];

/** Regra que impede o produto de ser promovido, ou null quando não há restrição. */
export function restrictionRule(product: Pick<Product, 'name' | 'category'>) {
  const text = normalize(`${product.name ?? ''} ${product.category ?? ''}`);
  return RESTRICTIONS.find(({ pattern }) => pattern.test(text))?.rule ?? null;
}

export function isRestrictedProduct(product: Pick<Product, 'name' | 'category'>) {
  return restrictionRule(product) !== null;
}

/** Tira o produto restrito de destaque, oferta e novidades. Os demais voltam sem mudança. */
export function withoutRestrictedPromotion<T extends Product>(product: T): T {
  if (!isRestrictedProduct(product)) return product;
  const details = { ...product.details, showAsNew: false };
  delete details.offer;
  return { ...product, featured: false, details };
}
