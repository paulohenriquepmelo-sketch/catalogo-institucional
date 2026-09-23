import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// Mesma API pública que o site do catálogo usa (sites-project). O app não
// tem nenhum modo "editor" — só lê o que já foi publicado, então qualquer
// publicação feita no editor aparece aqui automaticamente na próxima vez
// que o app buscar os dados (sem precisar atualizar o app em si).
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

export type SegmentRule = { name: string; note: string; keywords: string[] };

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
};

export type CatalogCampaign = {
  published?: boolean;
  title?: string;
  description?: string;
  image?: string;
  link?: string;
  [key: string]: unknown;
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

// Toda busca informa se o que voltou veio da rede ou do cache local, para a
// tela conseguir mostrar corretamente o aviso "sem conexão".
export type FetchResult<T> = {
  data: T;
  fromCache: boolean;
  revision?: number;
  /** Download interrompido no meio: os dados servem, mas não estão completos. */
  partial?: boolean;
};

type ConfigResponse = { config: CatalogConfig; revision: number };
type ProductsPageResponse = {
  items: Product[];
  nextCursor: number;
  done: boolean;
  revision: number;
};

const CACHE_CONFIG_KEY = '@catalogo/config-cache';
const CACHE_PRODUCTS_KEY = '@catalogo/products-cache';
const CACHE_SYNC_REVISION_KEY = '@catalogo/sync-revision';
// O catálogo completo (~2 MB) fica num arquivo, não no AsyncStorage: no
// Android cada registro do AsyncStorage tem limite de ~2 MB e, perto disso,
// a leitura falha e o app abria offline sem nenhum produto salvo.
const PRODUCTS_FILE = `${FileSystem.documentDirectory ?? ''}catalogo-produtos.json`;
const PAGE_LIMIT = 200;
// Segurança contra um catálogo enorme fazer o app buscar páginas para
// sempre: 60 páginas de 200 cobrem 12.000 produtos, bem acima do catálogo
// atual (~2.500).
const MAX_PAGES = 60;
const REQUEST_TIMEOUT = 30_000; // 30 segundos

// Os arquivos publicados pela API usam caminhos relativos. No navegador eles
// são resolvidos automaticamente; no React Native precisamos da URL completa.
export function mediaUrl(value?: string): string {
  const source = value?.trim();
  if (!source) return '';
  if (/^(https?:|data:|file:)/i.test(source)) return source;
  if (source.startsWith('//')) return `https:${source}`;
  return `${BASE_URL}${source.startsWith('/') ? '' : '/'}${source}`;
}

function normalizeProduct(product: Product): Product {
  return { ...product, image: mediaUrl(product.image) };
}

function normalizeConfig(config: CatalogConfig): CatalogConfig {
  return {
    ...config,
    logo: mediaUrl(config.logo),
    brands: (config.brands ?? []).map((brand) => ({
      ...brand,
      logo: mediaUrl(brand.logo),
    })),
    banners: (config.banners ?? []).map((banner) => ({
      ...banner,
      image: mediaUrl(banner.image),
    })),
    campaign: {
      ...(config.campaign ?? {}),
      image: mediaUrl(config.campaign?.image),
    },
  };
}

// Gravar no cache NUNCA pode derrubar dados que acabaram de ser baixados —
// se o disco estiver cheio ou o AsyncStorage falhar, seguimos com os dados
// em memória em vez de cair no catch e devolver cache velho.
async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    if (key === CACHE_PRODUCTS_KEY) {
      await writeProductsFile(JSON.stringify(value));
      return;
    }
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silencioso de propósito: cache é otimização, não requisito.
  }
}

// Grava num arquivo temporário e só então troca pelo definitivo: se o app
// fechar no meio da gravação, o catálogo anterior continua inteiro.
async function writeProductsFile(json: string) {
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
    // Arquivo ilegível: tenta o formato antigo abaixo.
  }
  // Versões anteriores do app guardavam no AsyncStorage. Migra uma vez para
  // o arquivo e libera o registro antigo.
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

// Serializar milhares de produtos é trabalho síncrono. Adiar e agrupar a
// gravação permite que a tela apareça primeiro e evita uma pausa perceptível
// quando uma atualização do catálogo termina.
function scheduleCacheWrite(key: string, value: unknown) {
  const pending = cacheWriteTimers.get(key);
  if (pending) clearTimeout(pending);
  const timer = setTimeout(() => {
    cacheWriteTimers.delete(key);
    void writeCache(key, value);
  }, 500);
  cacheWriteTimers.set(key, timer);
}

// Cada chamada tem seu próprio timeout de 30s (via AbortController interno),
// além de respeitar um `signal` externo (do catalog-store) para cancelamento
// manual quando uma nova busca substitui uma em andamento.
async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  // Se o signal externo já veio abortado, nem chega a disparar a requisição.
  if (signal?.aborted) controller.abort();

  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onExternalAbort);

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
    signal?.removeEventListener?.('abort', onExternalAbort);
  }
}

export async function fetchConfig(
  signal?: AbortSignal,
): Promise<FetchResult<CatalogConfig>> {
  try {
    const data = await getJson<ConfigResponse>('/api/config', signal);
    const config = normalizeConfig(data.config);
    scheduleCacheWrite(CACHE_CONFIG_KEY, { config, savedAt: Date.now() });
    return { data: config, fromCache: false, revision: data.revision };
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
    const parsed = JSON.parse(raw) as { config: CatalogConfig };
    if (!parsed?.config) return null;
    return normalizeConfig(parsed.config);
  } catch {
    return null;
  }
}

// Busca todas as páginas do catálogo publicado. Usado por todas as telas
// (ofertas, novidades, marcas, busca no catálogo) — o app carrega o catálogo
// inteiro uma vez e trabalha em memória, igual ao site.
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

    for (let page = 0; page < MAX_PAGES; page++) {
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
        // Ignora ids repetidos: id duplicado vira "key" duplicada nas listas
        // e faz produto sumir/renderizar errado na tela.
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        all.push(normalizeProduct(item));
      }
      onProgress?.(all.length);

      if (data?.done === true) {
        complete = true;
        break;
      }

      const next = data?.nextCursor;
      // Resposta anômala (cursor que não avança, cursor inválido ou página
      // vazia sem "done"): para o laço e trata como varredura INCOMPLETA.
      if (typeof next !== 'number' || next === cursor || items.length === 0) {
        break;
      }
      cursor = next;
    }

    // Só substitui o cache quando a varredura terminou de verdade E veio
    // conteúdo. Um download interrompido no meio (rede caindo, servidor
    // instável) jamais pode sobrescrever o catálogo completo já salvo —
    // essa era uma das causas reais de "os itens somem do app".
    if (complete && all.length > 0) {
      scheduleCacheWrite(CACHE_PRODUCTS_KEY, { items: all, savedAt: Date.now() });
      if (revision !== undefined) {
        scheduleCacheWrite(CACHE_SYNC_REVISION_KEY, revision);
      }
      return { data: all, fromCache: false, revision };
    }

    // Varredura incompleta: prefere o cache se ele tiver pelo menos tanto
    // quanto conseguimos baixar agora.
    const cached = await readCachedProducts();
    if (cached && cached.length >= all.length && cached.length > 0) {
      return { data: cached, fromCache: true, revision: await readCachedSyncRevision() };
    }
    if (all.length > 0) {
      // Parcial, porém melhor que nada — e de propósito NÃO vai para o cache.
      return { data: all, fromCache: false, revision, partial: true };
    }
    throw new Error('Não foi possível carregar o catálogo.');
  } catch (error) {
    const cached = await readCachedProducts();
    if (cached && cached.length > 0) {
      return { data: cached, fromCache: true, revision: await readCachedSyncRevision() };
    }
    throw error;
  }
}

export function persistSyncRevision(revision: number) {
  scheduleCacheWrite(CACHE_SYNC_REVISION_KEY, revision);
}

export async function readCachedSyncRevision(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_SYNC_REVISION_KEY);
    if (!raw) return 0;
    const revision = JSON.parse(raw) as number;
    return Number.isInteger(revision) && revision > 0 ? revision : 0;
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
    const { savedAt } = JSON.parse(raw) as { savedAt: number };
    return Date.now() - savedAt;
  } catch {
    return null;
  }
}

// Temas de campanha do site (lib/catalog-campaign.ts): a arte fica em /themes.
const CAMPAIGN_THEMES = [
  'natal',
  'ano-novo',
  'black-friday',
  'dia-das-maes',
  'aniversario',
  'carnaval',
  'dia-das-criancas',
];

/**
 * Imagem de fundo do topo, igual à do site público (campaignSlides do site):
 * modo "image" usa a imagem enviada no editor, "theme" a arte do tema e
 * "carousel" o primeiro slide visível. Campanha desligada → sem imagem.
 */
export function campaignBackground(config: CatalogConfig | null): string | undefined {
  const campaign = config?.campaign;
  if (!campaign || campaign.enabled === false) return undefined;
  if (campaign.mode === 'carousel') {
    const slides = Array.isArray(campaign.slides)
      ? (campaign.slides as { image?: string; visible?: boolean }[])
      : [];
    const slide = slides.find((s) => s.visible !== false && s.image);
    return slide?.image ? mediaUrl(slide.image) : undefined;
  }
  if (campaign.mode === 'image') return campaign.image || undefined;
  const theme = CAMPAIGN_THEMES.includes(String(campaign.theme))
    ? String(campaign.theme)
    : CAMPAIGN_THEMES[0];
  return `${BASE_URL}/themes/${theme}.png`;
}

// --- Regras replicadas do site público (product-showcase-carousel.tsx) ---
// para que "Ofertas" e "Novidades" no app mostrem exatamente os mesmos
// produtos que aparecem no site.

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function activeOffers(products: Product[], limit?: number): Product[] {
  const today = localDateKey();
  const list = products
    .filter((p) => p.published !== false)
    .filter((p) => {
      const offer = p.details?.offer;
      return (
        offer?.enabled === true &&
        offer.startsAt <= today &&
        offer.endsAt >= today
      );
    });
  return typeof limit === 'number' ? list.slice(0, limit) : list;
}

export function newProducts(
  products: Product[],
  days = 30,
  limit?: number,
): Product[] {
  const earliest = Date.now() - days * 86_400_000;
  // A data é convertida uma vez por produto, não a cada comparação da ordenação.
  const rows: { p: Product; created: number }[] = [];
  for (const p of products) {
    if (p.published === false || p.details?.showAsNew === false) continue;
    const created = Date.parse(p.createdAt ?? '');
    if (p.details?.showAsNew === true || (Number.isFinite(created) && created >= earliest)) {
      rows.push({ p, created });
    }
  }
  rows.sort((a, b) => b.created - a.created);
  const list = rows.map((r) => r.p);
  return typeof limit === 'number' ? list.slice(0, limit) : list;
}

export function offerTimeLabel(end: string, now = Date.now()): string {
  const endTime = new Date(`${end}T23:59:59`).getTime();
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
  return brands.filter((b) => b.published !== false);
}

// Mesma pontuação por proximidade usada no site (lib/catalog-discovery.ts)
// — mesma seção/categoria pesa mais que só a marca, segmento em comum some
// um pouco a mais, e só entra se pontuar mais que 1 (marca sozinha não
// basta). Mantém "itens similares" idênticos entre app e site.
// Palavras do nome que identificam o produto (sem números, medidas e siglas
// curtas), guardadas por produto para não refazer a cada abertura.
const nameWordsCache = new WeakMap<Product, Set<string>>();
function nameWords(product: Product) {
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

export function similarProducts(items: Product[], product: Product, limit = 8): Product[] {
  // Uma passada só, guardando os melhores. Ordenar o catálogo inteiro
  // (milhares de itens, com localeCompare) travava a abertura do produto.
  const best: { p: Product; score: number }[] = [];
  const beats = (a: { p: Product; score: number }, b: { p: Product; score: number }) =>
    a.score > b.score ||
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
    // Mesma linha de produto (outros sabores/tamanhos) vem antes: +1 por
    // palavra do nome em comum, até 4.
    let shared = 0;
    for (const word of nameWords(p)) if (words.has(word) && ++shared === 4) break;
    // Só marca/segmento em comum não basta (o segmento do site às vezes erra):
    // precisa ser da mesma seção ou ter algo em comum no nome.
    if (!sameSection && shared === 0) continue;
    score += shared;
    // Descarta cedo quem nem empata com o último colocado: evita o localeCompare.
    if (best.length === limit && score < best[limit - 1].score) continue;

    const entry = { p, score };
    let i = best.length;
    while (i > 0 && beats(entry, best[i - 1])) i -= 1;
    if (i < limit) {
      best.splice(i, 0, entry);
      if (best.length > limit) best.pop();
    }
  }
  return best.map((x) => x.p);
}
