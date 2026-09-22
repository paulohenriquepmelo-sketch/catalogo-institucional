import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  fetchAllProducts, fetchCatalogChanges, fetchConfig, persistCatalogConfig,
  persistCatalogSnapshot, persistSyncRevision, readCachedConfig, readCachedProducts,
  readCachedSyncRevision, type CatalogChange, type CatalogConfig, type Product,
} from './api';
import { loadImageManifest, pruneImages } from './image-cache';

type CatalogState = {
  config: CatalogConfig | null; products: Product[]; loading: boolean;
  refreshing: boolean; error: string | null; offline: boolean; syncing: boolean;
  loadingLabel: string; loadingProgress: number | null; refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogState | null>(null);
const CatalogSearchContext = createContext<{ searchQuery: string; setSearchQuery: (query: string) => void } | null>(null);
const DISCONTINUED_RETENTION_MS = 30 * 86_400_000;

export function isDiscontinued(product: Product, now = Date.now()) {
  const until = Date.parse(product.discontinuedUntil ?? '');
  return product.published === false && Number.isFinite(until) && until > now;
}

export function removeExpiredDiscontinued(items: Product[], now = Date.now()) {
  return items.filter((product) => product.published !== false || isDiscontinued(product, now));
}

export function applyCatalogChanges(current: Product[], changes: CatalogChange[], now = Date.now()) {
  const productsById = new Map(current.map((product) => [product.id, product]));
  for (const change of changes) {
    if (change.action === 'upsert') {
      productsById.set(change.product.id, {
        ...change.product, published: true, discontinuedAt: undefined, discontinuedUntil: undefined,
      });
      continue;
    }
    const existing = productsById.get(change.productId);
    if (!existing) continue;
    const discontinuedAt = change.publishedAt || new Date(now).toISOString();
    const publishedTime = Date.parse(discontinuedAt);
    productsById.set(change.productId, {
      ...existing, published: false, discontinuedAt,
      discontinuedUntil: new Date(
        (Number.isFinite(publishedTime) ? publishedTime : now) + DISCONTINUED_RETENTION_MS,
      ).toISOString(),
    });
  }
  return removeExpiredDiscontinued([...productsById.values()], now);
}

function catalogImages(config: CatalogConfig | null, products: Product[]) {
  return [
    ...(config?.brands ?? []).map((brand) => brand.logo),
    ...(config?.banners ?? []).map((banner) => banner.image),
    ...products.map((product) => product.image),
  ];
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CatalogConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Carregando catálogo…');
  const [searchQuery, setSearchQuery] = useState('');
  const productsRef = useRef<Product[]>([]);
  const configRef = useRef<CatalogConfig | null>(null);
  const syncRevisionRef = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const runningRef = useRef<Promise<void> | null>(null);

  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { configRef.current = config; }, [config]);

  const pruneLater = useCallback((nextConfig: CatalogConfig | null, next: Product[]) => {
    const images = catalogImages(nextConfig, next);
    setTimeout(() => void pruneImages(images), 15_000);
  }, []);

  const loadFull = useCallback(async (initial = false) => {
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    if (initial) { setLoading(true); setLoadingLabel('Baixando produtos…'); }
    else setSyncing(true);
    try {
      const [configResult, productsResult] = await Promise.all([
        fetchConfig(controller.signal),
        fetchAllProducts(controller.signal, (count) => {
          if (initial) setLoadingLabel(`Baixando produtos… ${count}`);
        }),
      ]);
      if (controller.signal.aborted) return;
      const next = removeExpiredDiscontinued(productsResult.data);
      setConfig(configResult.data); configRef.current = configResult.data;
      if (next.length > 0) { setProducts(next); productsRef.current = next; }
      if (productsResult.revision) syncRevisionRef.current = productsResult.revision;
      setOffline(configResult.fromCache || productsResult.fromCache);
      setError(null);
      pruneLater(configResult.data, next);
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') return;
      setOffline(true);
      if (!productsRef.current.length) {
        setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o catálogo.');
      }
    } finally {
      setLoading(false); setSyncing(false); setRefreshing(false);
    }
  }, [pruneLater]);

  const syncIncremental = useCallback(async (manual = false) => {
    if (runningRef.current) return runningRef.current;
    const operation = (async () => {
      if (manual) setRefreshing(true); else setSyncing(true);
      const controller = new AbortController();
      abortController.current = controller;
      try {
        const since = syncRevisionRef.current;
        if (since <= 0) { await loadFull(!productsRef.current.length); return; }
        let cursor = 0;
        let target: number | undefined;
        let changes: CatalogChange[] = [];
        let nextConfig: CatalogConfig | undefined;
        let attempts = 0;
        while (true) {
          const page = await fetchCatalogChanges(since, cursor, target, controller.signal);
          if (page.reset) { await loadFull(false); return; }
          if (page.restart) {
            if (++attempts > 2) throw new Error('O catálogo mudou durante a sincronização.');
            cursor = 0; target = undefined; changes = []; nextConfig = undefined;
            continue;
          }
          target = page.revision;
          if (page.config) nextConfig = page.config;
          changes.push(...page.items);
          if (page.done) break;
          cursor = page.nextCursor;
        }
        const withoutExpired = removeExpiredDiscontinued(productsRef.current);
        const expiredChanged = withoutExpired.length !== productsRef.current.length;
        const nextProducts = changes.length
          ? applyCatalogChanges(withoutExpired, changes)
          : withoutExpired;
        const productsChanged = changes.length > 0 || expiredChanged;
        const resolvedConfig = nextConfig ?? configRef.current;
        if (productsChanged) {
          productsRef.current = nextProducts;
          setProducts(nextProducts);
        }
        if (nextConfig) {
          configRef.current = nextConfig; setConfig(nextConfig); persistCatalogConfig(nextConfig);
        }
        syncRevisionRef.current = target ?? since;
        if (productsChanged) persistCatalogSnapshot(nextProducts, syncRevisionRef.current);
        else persistSyncRevision(syncRevisionRef.current);
        setOffline(false); setError(null);
        if (productsChanged || nextConfig) pruneLater(resolvedConfig, nextProducts);
      } catch (caught) {
        if (!(caught instanceof Error && caught.name === 'AbortError')) setOffline(true);
      } finally {
        setSyncing(false); setRefreshing(false);
      }
    })();
    runningRef.current = operation;
    try { await operation; } finally { runningRef.current = null; }
  }, [loadFull, pruneLater]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadImageManifest();
      const [cachedConfig, cachedProducts, cachedRevision] = await Promise.all([
        readCachedConfig(), readCachedProducts(), readCachedSyncRevision(),
      ]);
      if (cancelled) return;
      const next = removeExpiredDiscontinued(cachedProducts ?? []);
      configRef.current = cachedConfig; productsRef.current = next; syncRevisionRef.current = cachedRevision;
      if (cachedConfig) setConfig(cachedConfig);
      if (next.length) setProducts(next);
      if (cachedConfig && next.length) setLoading(false);
      void syncIncremental(false);
    })();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncIncremental(false);
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void syncIncremental(false);
    }, 60_000);
    return () => {
      cancelled = true; subscription.remove(); clearInterval(timer); abortController.current?.abort();
    };
  }, [syncIncremental]);

  const refresh = useCallback(() => syncIncremental(true), [syncIncremental]);
  const value = useMemo(() => ({
    config, products, loading, refreshing, error, offline, syncing,
    loadingLabel, loadingProgress: null, refresh,
  }), [config, products, loading, refreshing, error, offline, syncing, loadingLabel, refresh]);
  const searchValue = useMemo(() => ({ searchQuery, setSearchQuery }), [searchQuery]);
  return (
    <CatalogContext.Provider value={value}>
      <CatalogSearchContext.Provider value={searchValue}>{children}</CatalogSearchContext.Provider>
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog precisa estar dentro de CatalogProvider');
  return ctx;
}

export function useCatalogSearch() {
  const ctx = useContext(CatalogSearchContext);
  if (!ctx) throw new Error('useCatalogSearch precisa estar dentro de CatalogProvider');
  return ctx;
}
