import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  isRestrictedProduct,
  withoutRestrictedPromotion,
} from '@/lib/restricted-products';

export const BASE_URL = 'https://sites-project.paulohenriquepmelo.workers.dev';

export type ProductOffer = {
  enabled: boolean;
  discount: number;
  startsAt: string;
  endsAt: string;
};

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
  offer?: ProductOffer;
  showAsNew?: boolean;
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
  discontinuedAt?: string;
  discontinuedUntil?: string;
};

export type Brand = {
  name: string;
  logo: string;
  published: boolean;
  featured: boolean;
};

export type SegmentRule = {
  name: string;
  note: string;
  keywords: string[];
};

export type Banner = {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  visible: boolean;
};

export type ProductShowcase = {
  published: boolean;
  title: string;
  eyebrow: string;
  layout: 'banner' | 'carousel';
  autoplay: boolean;
  interval: number;
  limit: number;
  days?: number;
  fromCode?: number;
};

export type CampaignMode = 'theme' | 'image' | 'carousel';

export type CampaignSlide = Banner & {
  eyebrow: string;
  button: string;
};

export type CatalogCampaign = {
  enabled: boolean;
  mode: CampaignMode;
  // Valores desconhecidos são preservados; o resolvedor aplica Padrão.
  theme: string;
  eyebrow: string;
  title: string;
  description: string;
  button: string;
  link: string;
  year?: string;
  image: string;
  slides: CampaignSlide[];
};

export type CatalogConfig = {
  name: string;
  tagline: string;
  logo: string;
  email: string;
  footer: string;
  primary: string;
  accent: string;
  background: string;
  brands: Brand[];
  segments: SegmentRule[];
  banners: Banner[];
  campaign: CatalogCampaign;
  offers: ProductShowcase;
  newProducts: ProductShowcase;
};

export type FetchResult<T> = {
  data: T;
  fromCache: boolean;
  revision?: number;
  partial?: boolean;
};

type ProductsPageResponse = {
  items: Product[];
  nextCursor: number;
  done: boolean;
  revision: number;
};

const CACHE_CONFIG_KEY = '@catalogo/config-cache';
const CACHE_PRODUCTS_KEY = '@catalogo/products-cache';
const CACHE_SYNC_REVISION_KEY = '@catalogo/sync-revision';
const PRODUCTS_FILE = `${FileSystem.documentDirectory ?? ''}catalogo-produtos.json`;
const PAGE_LIMIT = 200;
const MAX_PAGES = 60;
const REQUEST_TIMEOUT = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function mediaUrl(value?: string): string {
  const source = value?.trim();
  if (!source) return '';
  if (/^(https?:|data:|file:)/i.test(source)) return source;
  if (source.startsWith('//')) return `https:${source}`;
  return `${BASE_URL}${source.startsWith('/') ? '' : '/'}${source}`;
}

function normalizeBanner(value: unknown, index: number): Banner {
  const item = record(value);
  return {
    id: stringValue(item.id, String(index)),
    title: stringValue(item.title),
    description: stringValue(item.description),
    image: mediaUrl(stringValue(item.image)),
    link: stringValue(item.link),
    visible: booleanValue(item.visible, true),
  };
}

/** Rede e cache antigo passam pela mesma validação em tempo de execução. */
export function normalizeCampaign(value: unknown): CatalogCampaign {
  const campaign = record(value);
  const mode: CampaignMode =
    campaign.mode === 'image' || campaign.mode === 'carousel'
      ? campaign.mode
      : 'theme';

  const rawYear = campaign.year;
  const year =
    typeof rawYear === 'string'
      ? rawYear.trim()
      : typeof rawYear === 'number' && Number.isFinite(rawYear)
        ? String(rawYear)
        : '';

  return {
    enabled: booleanValue(
      campaign.enabled,
      booleanValue(campaign.published, false),
    ),
    mode,
    theme: stringValue(campaign.theme, 'padrao'),
    eyebrow: stringValue(campaign.eyebrow),
    title: stringValue(campaign.title),
    description: stringValue(campaign.description),
    button: stringValue(campaign.button),
    link: stringValue(campaign.link),
    year: year || undefined,
    image: mediaUrl(stringValue(campaign.image)),
    slides: arrayValue(campaign.slides)
      .filter(isRecord)
      .map((slide, index) => ({
        ...normalizeBanner(slide, index),
        eyebrow: stringValue(slide.eyebrow),
        button: stringValue(slide.button),
      })),
  };
}

function normalizeShowcase(value: unknown, defaultLimit: number): ProductShowcase {
  const showcase = record(value);
  return {
    published: booleanValue(showcase.published, true),
    title: stringValue(showcase.title),
    eyebrow: stringValue(showcase.eyebrow),
    layout: showcase.layout === 'banner' ? 'banner' : 'carousel',
    autoplay: booleanValue(showcase.autoplay, false),
    interval: numberValue(showcase.interval, 5_000),
    limit: numberValue(showcase.limit, defaultLimit),
    days: optionalNumber(showcase.days),
    fromCode: optionalNumber(showcase.fromCode),
  };
}

function normalizeProduct(product: Product): Product {
  return withoutRestrictedPromotion({
    ...product,
    image: mediaUrl(product.image),
  });
}

function normalizeConfig(value: unknown): CatalogConfig {
  if (!isRecord(value)) {
    throw new Error('A configuração do catálogo é inválida.');
  }

  return {
    name: stringValue(value.name, 'DISTRIBUIDORA LAURENCINI'),
    tagline: stringValue(value.tagline),
    logo: mediaUrl(stringValue(value.logo)),
    email: stringValue(value.email),
    footer: stringValue(value.footer),
    primary: stringValue(value.primary, '#263f85'),
    accent: stringValue(value.accent, '#d92826'),
    background: stringValue(value.background, '#ffffff'),
    brands: arrayValue(value.brands).filter(isRecord).map((brand) => ({
      name: stringValue(brand.name),
      logo: mediaUrl(stringValue(brand.logo)),
      published: booleanValue(brand.published, true),
      featured: booleanValue(brand.featured, false),
    })),
    segments: arrayValue(value.segments).filter(isRecord).map((segment) => ({
      name: stringValue(segment.name),
      note: stringValue(segment.note),
      keywords: arrayValue(segment.keywords).filter(
        (keyword): keyword is string => typeof keyword === 'string',
      ),
    })),
    banners: arrayValue(value.banners).filter(isRecord).map(normalizeBanner),
    campaign: normalizeCampaign(value.campaign),
    offers: normalizeShowcase(value.offers, 12),
    newProducts: normalizeShowcase(value.newProducts, 30),
  };
}

// Falhas de persistência não substituem dados novos por cache antigo.
async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    if (key === CACHE_PRODUCTS_KEY) {
      await writeProductsFile(JSON.stringify(value));
      return;
    }
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // O catálogo continua disponível em memória.
  }
}

async function writeProductsFile(json: string): Promise<void> {
  const temp = `${PRODUCTS_FILE}.tmp`;
  await FileSystem.writeAsStringAsync(temp, json);
  await FileSystem.deleteAsync(PRODUCTS_FILE, { idempotent: true });
  await FileSystem.moveAsync({ from: temp, to: PRODUCTS_FILE });
}

async function readProductsRaw(): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(PRODUCTS_FILE);
    if (info.exists) return await FileSystem.readAsStringAsync(PRODUCTS_FILE);
  } catch {
    // Tenta o armazenamento das versões anteriores.
  }

  try {
    const legacy = await AsyncStorage.getItem(CACHE_PRODUCTS_KEY);
    if (!legacy) return null;
    await writeProductsFile(legacy);
    await AsyncStorage.removeItem(CACHE_PRODUCTS_KEY);
    return legacy;
  } catch {
    return null;
  }
}

const cacheWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleCacheWrite(key: string, value: unknown): void {
  const pending = cacheWriteTimers.get(key);
  if (pending) clearTimeout(pending);

  const timer = setTimeout(() => {
    cacheWriteTimers.delete(key);
    void writeCache(key, value);
  }, 500);
  cacheWriteTimers.set(key, timer);
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  if (signal?.aborted) controller.abort();

  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Falha ao carregar (${response.status}).`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function fetchConfig(
  signal?: AbortSignal,
): Promise<FetchResult<CatalogConfig>> {
  try {
    const response = await getJson<unknown>('/api/config', signal);
    if (!isRecord(response)) {
      throw new Error('A resposta da configuração é inválida.');
    }
    const config = normalizeConfig(response.config);
    // A configuração é pequena e precisa sobreviver ao fechamento imediato.
    await writeCache(CACHE_CONFIG_KEY, { config, savedAt: Date.now() });
    return {
      data: config,
      fromCache: false,
      revision: optionalNumber(response.revision),
    };
  } catch (error) {
    const cached = await readCachedConfig();
    if (cached) return { data: cached, fromCache: true };
    throw error;
  }
}

export async function readCachedConfig(): Promise<CatalogConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_CONFIG_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.config)) return null;
    return normalizeConfig(parsed.config);
  } catch {
    return null;
  }
}

export async function fetchAllProducts(
  signal?: AbortSignal,
  onProgress?: (loaded: number) => void,
): Promise<FetchResult<Product[]>> {
  try {
    const all: Product[] = [];
    const seenIds = new Set<number>();
    let cursor = 0;
    let complete = false;
    let revision: number | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await getJson<ProductsPageResponse>(
        `/api/products?paged=1&cursor=${cursor}&limit=${PAGE_LIMIT}`,
        signal,
      );
      const items = data?.items ?? [];

      if (revision === undefined) revision = data.revision;
      if (data.revision !== revision) {
        throw new Error('O catálogo mudou durante o carregamento. Tentando novamente.');
      }

      for (const item of items) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        all.push(normalizeProduct(item));
      }
      onProgress?.(all.length);

      if (data.done === true) {
        complete = true;
        break;
      }

      const next = data.nextCursor;
      if (typeof next !== 'number' || next === cursor || items.length === 0) break;
      cursor = next;
    }

    if (complete && all.length > 0) {
      scheduleCacheWrite(CACHE_PRODUCTS_KEY, { items: all, savedAt: Date.now() });
      if (revision !== undefined) {
        scheduleCacheWrite(CACHE_SYNC_REVISION_KEY, revision);
      }
      return { data: all, fromCache: false, revision };
    }

    const cached = await readCachedProducts();
    if (cached && cached.length >= all.length && cached.length > 0) {
      return {
        data: cached,
        fromCache: true,
        revision: await readCachedSyncRevision(),
      };
    }
    if (all.length > 0) {
      return { data: all, fromCache: false, revision, partial: true };
    }
    throw new Error('Não foi possível carregar o catálogo.');
  } catch (error) {
    const cached = await readCachedProducts();
    if (cached && cached.length > 0) {
      return {
        data: cached,
        fromCache: true,
        revision: await readCachedSyncRevision(),
      };
    }
    throw error;
  }
}

export function persistSyncRevision(revision: number): void {
  scheduleCacheWrite(CACHE_SYNC_REVISION_KEY, revision);
}

export async function readCachedSyncRevision(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_SYNC_REVISION_KEY);
    if (!raw) return 0;
    const revision: unknown = JSON.parse(raw);
    return typeof revision === 'number' && Number.isInteger(revision) && revision > 0
      ? revision
      : 0;
  } catch {
    return 0;
  }
}

export async function readCachedProducts(): Promise<Product[] | null> {
  try {
    const raw = await readProductsRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items: Product[] };
    if (!Array.isArray(parsed?.items)) return null;
    return parsed.items.map(normalizeProduct);
  } catch {
    return null;
  }
}

export async function getCacheAge(): Promise<number | null> {
  try {
    const raw = await readProductsRaw();
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.savedAt !== 'number') return null;
    return Date.now() - parsed.savedAt;
  } catch {
    return null;
  }
}

export const CAMPAIGN_THEME_IDS = [
  'padrao',
  'natal',
  'ano-novo',
  'dia-das-maes',
  'aniversario',
  'carnaval',
  'dia-das-criancas',
  'black-friday',
] as const;

export type CampaignThemeId = (typeof CAMPAIGN_THEME_IDS)[number];

export function isCampaignThemeId(value: unknown): value is CampaignThemeId {
  return typeof value === 'string' &&
    CAMPAIGN_THEME_IDS.some((id) => id === value);
}

export function campaignThemeHero(theme: CampaignThemeId): string {
  const file =
    theme === 'padrao' ? 'padrao.png'
      : theme === 'natal' ? 'natal-hero.webp'
        : theme === 'dia-das-maes' ? 'dia-das-maes-etiqueta.webp'
          : `${theme}.webp`;
  return mediaUrl(`/themes/${file}`);
}

export function campaignBackground(
  config: CatalogConfig | null,
): string | undefined {
  const campaign = config?.campaign;
  if (!campaign?.enabled) return undefined;

  if (campaign.mode === 'carousel') {
    return campaign.slides.find((slide) => slide.visible && slide.image)?.image;
  }
  if (campaign.mode === 'image') return campaign.image || undefined;

  return campaignThemeHero(
    isCampaignThemeId(campaign.theme) ? campaign.theme : 'padrao',
  );
}

function localDateKey(date: Date): string | undefined {
  if (!Number.isFinite(date.getTime())) return undefined;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/** Rejeita datas ausentes, formatos ambíguos e dias inexistentes. */
function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value;
}

/** Regra única para listas, selos, detalhes e notificações. */
export function isOfferEligible(
  product: Product,
  now: Date = new Date(),
): boolean {
  if (product.published === false || isRestrictedProduct(product)) return false;

  const offer = product.details?.offer;
  if (
    offer?.enabled !== true ||
    !isDateKey(offer.startsAt) ||
    !isDateKey(offer.endsAt) ||
    offer.startsAt > offer.endsAt
  ) return false;

  const today = localDateKey(now);
  return today !== undefined && offer.startsAt <= today && offer.endsAt >= today;
}

export function activeOffers(products: Product[], limit?: number): Product[] {
  const now = new Date();
  const list = products.filter((product) => isOfferEligible(product, now));
  return typeof limit === 'number' ? list.slice(0, limit) : list;
}

const codeNumber = (code: string): number => {
  const value = Number(code.replace(/\D/g, ''));
  return Number.isFinite(value) ? value : 0;
};

export function newProducts(
  products: Product[],
  fromCode?: number,
  limit?: number,
): Product[] {
  const from = fromCode ?? 0;
  const list = products
    .filter((product) => {
      if (
        product.published === false ||
        product.details?.showAsNew === false ||
        isRestrictedProduct(product)
      ) return false;

      return product.details?.showAsNew === true || codeNumber(product.code) >= from;
    })
    .sort(
      (a, b) =>
        Number(b.details?.showAsNew === true) - Number(a.details?.showAsNew === true) ||
        codeNumber(b.code) - codeNumber(a.code),
    );
  return list.slice(0, limit ?? 30);
}

export function offerTimeLabel(end: string, now = Date.now()): string {
  if (!isDateKey(end) || !Number.isFinite(now)) return 'Oferta encerrada';

  const endTime = new Date(`${end}T23:59:59.999`).getTime();
  const remaining = Math.max(0, endTime - now);
  if (remaining <= 0) return 'Oferta encerrada';

  const seconds = Math.floor(remaining / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  if (days > 0) return `Encerra em ${days}d ${hours}h`;

  const minutes = Math.floor((seconds % 3600) / 60);
  return `Encerra em ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function publishedBrands(brands: Brand[]): Brand[] {
  return brands.filter((brand) => brand.published !== false);
}

const nameWordsCache = new WeakMap<Product, Set<string>>();

function nameWords(product: Product): Set<string> {
  let words = nameWordsCache.get(product);
  if (!words) {
    words = new Set(
      product.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length >= 3),
    );
    nameWordsCache.set(product, words);
  }
  return words;
}

export function similarProducts(
  items: Product[],
  product: Product,
  limit = 8,
): Product[] {
  if (limit <= 0) return [];

  const best: { p: Product; score: number }[] = [];
  const beats = (
    a: { p: Product; score: number },
    b: { p: Product; score: number },
  ) => a.score > b.score ||
    (a.score === b.score && a.p.name.localeCompare(b.p.name, 'pt-BR') < 0);

  const words = nameWords(product);
  for (const p of items) {
    if (p.id === product.id || p.published === false) continue;
    const sameSection = p.department === product.department && p.section === product.section;
    let score =
      (sameSection && p.category === product.category ? 8 : 0) +
      (p.brand === product.brand ? 1 : 0) +
      (sameSection ? 3 : 0) +
      (p.segment === product.segment && p.segment !== 'Sem classificação' ? 2 : 0);
    if (score <= 1) continue;

    let shared = 0;
    for (const word of nameWords(p)) {
      if (words.has(word) && ++shared === 4) break;
    }
    if (!sameSection && shared === 0) continue;
    score += shared;
    if (best.length === limit && score < best[limit - 1].score) continue;

    const entry = { p, score };
    let index = best.length;
    while (index > 0 && beats(entry, best[index - 1])) index -= 1;
    if (index < limit) {
      best.splice(index, 0, entry);
      if (best.length > limit) best.pop();
    }
  }
  return best.map(({ p }) => p);
}
