import type { CSSProperties } from 'react';

export const defaultLayout = {
  logoWidth: 180,
  productImageHeight: 200,
  productImageFit: 'contain' as 'contain' | 'cover',
};
export type CatalogLayout = typeof defaultLayout;
export function validateLayout(value: unknown): CatalogLayout {
  if (value === undefined) return { ...defaultLayout };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Revise os tamanhos do catálogo.');
  const layout = { ...defaultLayout, ...value } as CatalogLayout;
  if (
    !Number.isInteger(layout.logoWidth) ||
    layout.logoWidth < 80 ||
    layout.logoWidth > 320
  )
    throw new Error('A largura da logo deve ficar entre 80 e 320 pixels.');
  if (
    !Number.isInteger(layout.productImageHeight) ||
    layout.productImageHeight < 100 ||
    layout.productImageHeight > 360
  )
    throw new Error('A altura das fotos deve ficar entre 100 e 360 pixels.');
  if (!['contain', 'cover'].includes(layout.productImageFit))
    throw new Error('Escolha o enquadramento das fotos.');
  return {
    logoWidth: layout.logoWidth,
    productImageHeight: layout.productImageHeight,
    productImageFit: layout.productImageFit,
  };
}
export function catalogLayoutStyle(layout?: CatalogLayout): CSSProperties {
  const values = { ...defaultLayout, ...layout };
  return {
    '--logo-width': `${values.logoWidth}px`,
    '--product-photo-height': `${values.productImageHeight}px`,
    '--product-photo-fit': values.productImageFit,
  } as CSSProperties;
}
