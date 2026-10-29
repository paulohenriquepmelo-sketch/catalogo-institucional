import type { Product } from './catalog-data';
import { normalize } from './segments';

// Lei 9.294/1996, art. 3º-A, III: é proibida a propaganda de tabaco na
// internet. O produto continua na lista geral do catálogo, mas nunca entra em
// destaque, oferta ou novidades.
const TOBACCO_PATTERN =
  /(?:^|[^a-z0-9])(?:fumo|tabaco|tabacaria|cigarro|cigarros|cigarrilha|charuto|narguile|palheiro)(?![a-z])/;

export const TOBACCO_RULE =
  'Produto de tabaco não pode ficar em destaque, oferta ou novidades (Lei 9.294/1996).';

export function isTobaccoProduct(product: Pick<Product, 'name' | 'category'>) {
  return TOBACCO_PATTERN.test(normalize(`${product.name ?? ''} ${product.category ?? ''}`));
}

/** Tira o produto de tabaco de destaque, oferta e novidades. Os demais voltam sem mudança. */
export function withoutTobaccoPromotion<T extends Product>(product: T): T {
  if (!isTobaccoProduct(product)) return product;
  const details = { ...product.details, showAsNew: false };
  delete details.offer;
  return { ...product, featured: false, details };
}
