export type ProductDetails = {
  packaging?: string;
  salesUnit?: string;
  salesUnitDescription?: string;
  masterPackaging?: string;
  masterUnit?: string;
  masterUnitDescription?: string;
  ncm?: string;
  ean?: string;
  masterEan?: string;
  supplier?: string;
  sourceFile?: string;
  sourceRow?: number;
  offer?: ProductOffer;
  showAsNew?: boolean;
};
export type ProductOffer = {
  enabled: boolean;
  discount: number;
  startsAt: string;
  endsAt: string;
};
export type Product = {
  id: number;
  name: string;
  code: string;
  department: string;
  section: string;
  category: string;
  segment: string;
  brand: string;
  description: string;
  image: string;
  featured?: boolean;
  specs: string[];
  published?: boolean;
  updatedAt?: string;
  createdAt?: string;
  details?: ProductDetails;
};
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
  ['supplier', 'Fornecedor (interno)'],
] as const;
export function productIssues(p: Product) {
  if (!p.details) return [];
  const issues: string[] = [];
  if (!p.details.masterPackaging) issues.push('Embalagem master não informada');
  if (!p.details.masterEan) issues.push('EAN master não informado');
  for (const key of ['ean', 'masterEan'] as const)
    if (p.details[key] && !/^(?:\d{8}|\d{12,14})$/.test(p.details[key]!))
      issues.push(
        `${key === 'ean' ? 'EAN de venda' : 'EAN master'}: conferir formato`,
      );
  if (p.details.ncm && !/^\d{8}$/.test(p.details.ncm))
    issues.push('NCM: conferir formato');
  return issues;
}
