import type { CatalogConfig } from './catalog-config';

export const PRIVACY_PATH = '/politica-de-privacidade';

/** O que falta para publicar a política: sem isso a página e o link ficam fora do ar. */
export function privacyPolicyMissing(config: CatalogConfig) {
  return [
    !config.legalName?.trim() && 'razão social',
    !config.cnpj?.trim() && 'CNPJ',
    !config.address?.trim() && 'endereço comercial',
    !config.privacyEmail?.trim() && 'e-mail para assuntos de privacidade',
  ].filter((item): item is string => Boolean(item));
}

export function privacyPolicyReady(config: CatalogConfig) {
  return privacyPolicyMissing(config).length === 0;
}
