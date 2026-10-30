import type { Product } from '@/lib/api';

// Produtos restritos continuam no catálogo, mas não recebem promoção.
const RESTRICTIONS = [
  {
    pattern:
      /(?:^|[^a-z0-9])(?:fumo|tabaco|tabacaria|cigarro|cigarros|cigarrilha|charuto|narguile|palheiro)(?![a-z])/,
    rule: 'Produto de tabaco não pode ficar em destaque, oferta ou novidades (Lei 9.294/1996).',
  },
  {
    pattern:
      /(?:^|[^a-z0-9])(?:fogos|estalinhos?|estalos|traques?|girandola|rojao|rojoes|bombinhas?)(?![a-z])/,
    rule: 'Fogos de artifício não podem ficar em destaque, oferta ou novidades.',
  },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function restrictionRule(
  product: Pick<Product, 'name' | 'category'>,
): string | null {
  const text = normalize(`${product.name ?? ''} ${product.category ?? ''}`);
  return RESTRICTIONS.find(({ pattern }) => pattern.test(text))?.rule ?? null;
}

export function isRestrictedProduct(
  product: Pick<Product, 'name' | 'category'>,
): boolean {
  return restrictionRule(product) !== null;
}

export function withoutRestrictedPromotion<T extends Product>(product: T): T {
  if (!isRestrictedProduct(product)) return product;

  const details = { ...product.details, showAsNew: false };
  delete details.offer;
  return { ...product, featured: false, details };
}
