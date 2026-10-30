import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import {
  campaignBackground,
  fetchAllProducts,
  fetchConfig,
  persistSyncRevision,
  readCachedConfig,
  readCachedProducts,
  readCachedSyncRevision,
  type CatalogConfig,
  type Product,
} from '@/lib/api';
import {
  loadImageManifest,
  prefetchAllImages,
  protectThemeImages,
  pruneImages,
} from '@/lib/image-cache';
import { isOnline, onNetworkChange } from '@/lib/network';
import { resolveThemeId, themeArtUrls, themeRegistry } from '@/lib/theme-registry';

type CatalogState = {
  config: CatalogConfig | null;
  configResolved: boolean;
  products: Product[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  offline: boolean;
  loadingLabel: string;
  loadingProgress: number | null;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogState | null>(null);
const CatalogSearchContext = createContext<{
  searchQuery: string;
  setSearchQuery: (query: string) => void;
} | null>(null);

const CHECK_INTERVAL_MS = 5 * 60_000;

export function isDiscontinued(product: Product, now = Date.now()): boolean {
  const until = Date.parse(product.discontinuedUntil ?? '');
  return product.published === false && Number.isFinite(until) && until > now;
}

export function removeExpiredDiscontinued(
  items: Product[],
  now = Date.now(),
): Product[] {
  return items.filter(
    (product) => product.published !== false || isDiscontinued(product, now),
  );
}

function catalogImages(config: CatalogConfig | null, products: Product[]) {
  const theme = themeRegistry[resolveThemeId(config)];
  return [
    config?.logo,
    ...(config?.brands ?? []).map((brand) => brand.logo),
    ...(config?.banners ?? []).map((banner) => banner.image),
    ...(config?.campaign.slides ?? []).map((slide) => slide.image),
    campaignBackground(config),
    ...themeArtUrls(theme.arts),
    ...products.map((product) => product.image),
  ];
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CatalogConfig | null>(null);
  const [configResolved, setConfigResolved] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Carregando catálogo…');
  const [searchQuery, setSearchQuery] = useState('');

  const productsRef = useRef<Product[]>([]);
  const configRef = useRef<CatalogConfig | null>(null);
  const syncRevisionRef = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const runningRef = useRef<Promise<void> | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(false);
  const pruneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyConfig = useCallback((next: CatalogConfig) => {
    configRef.current = next;
    // Protege antes de qualquer limpeza assíncrona já agendada.
    protectThemeImages(themeArtUrls(themeRegistry[resolveThemeId(next)].arts));
    setConfig(next);
    setConfigResolved(true);
  }, []);

  const pruneLater = useCallback(() => {
    if (pruneTimer.current) clearTimeout(pruneTimer.current);
    pruneTimer.current = setTimeout(() => {
      // Consulta os dados atuais, evitando remover artes de uma campanha nova.
      void pruneImages(catalogImages(configRef.current, productsRef.current));
    }, 15_000);
  }, []);

  const loadFull = useCallback(async (initial = false) => {
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;

    if (initial) {
      setLoading(true);
      setLoadingLabel('Carregando configuração…');
    }

    try {
      const configResult = await fetchConfig(controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return;

      // O tema fica disponível antes das páginas de produtos.
      applyConfig(configResult.data);
      setOffline(configResult.fromCache);
      setError(null);
      if (initial) setLoadingLabel('Baixando produtos…');

      const productsResult = await fetchAllProducts(controller.signal, (count) => {
        if (initial && mountedRef.current && !controller.signal.aborted) {
          setLoadingLabel(`Baixando produtos… ${count}`);
        }
      });
      if (controller.signal.aborted || !mountedRef.current) return;

      const next = removeExpiredDiscontinued(productsResult.data);
      if (next.length > 0) {
        productsRef.current = next;
        setProducts(next);
      }

      const complete =
        !configResult.fromCache &&
        !productsResult.fromCache &&
        !productsResult.partial;

      if (complete && configResult.revision) {
        syncRevisionRef.current = configResult.revision;
        persistSyncRevision(configResult.revision);
      }

      setOffline(configResult.fromCache || productsResult.fromCache);
      setError(null);
      pruneLater();
    } catch (caught) {
      if (controller.signal.aborted || !mountedRef.current) return;
      setOffline(true);
      if (!productsRef.current.length || !configRef.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Não foi possível carregar o catálogo.',
        );
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setConfigResolved(true);
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [applyConfig, pruneLater]);

  const syncIncremental = useCallback(async (manual = false) => {
    if (!initializedRef.current || !mountedRef.current) return;
    if (runningRef.current) return runningRef.current;

    if (!isOnline()) {
      setOffline(true);
      setConfigResolved(true);
      setLoading(false);
      setRefreshing(false);
      if (!configRef.current || !productsRef.current.length) {
        setError('Sem conexão e sem catálogo completo salvo neste aparelho.');
      }
      return;
    }

    const operation = (async () => {
      if (manual) setRefreshing(true);

      try {
        if (
          !configRef.current ||
          syncRevisionRef.current <= 0 ||
          !productsRef.current.length
        ) {
          await loadFull(!productsRef.current.length);
          return;
        }

        const controller = new AbortController();
        abortController.current = controller;
        const result = await fetchConfig(controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return;

        // Mesmo com produtos inalterados, a configuração é aplicada imediatamente.
        applyConfig(result.data);
        if (result.fromCache) {
          setOffline(true);
          return;
        }

        if (result.revision !== syncRevisionRef.current) {
          await loadFull(false);
          return;
        }

        setOffline(false);
        setError(null);

        const next = removeExpiredDiscontinued(productsRef.current);
        if (next.length !== productsRef.current.length) {
          productsRef.current = next;
          setProducts(next);
          pruneLater();
        }
      } catch (caught) {
        if (!mountedRef.current) return;
        if (!(caught instanceof Error && caught.name === 'AbortError')) {
          setOffline(true);
        }
      } finally {
        if (mountedRef.current) setRefreshing(false);
      }
    })();

    runningRef.current = operation;
    try {
      await operation;
    } finally {
      if (runningRef.current === operation) runningRef.current = null;
    }
  }, [applyConfig, loadFull, pruneLater]);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    initializedRef.current = false;

    void (async () => {
      // A leitura pequena da configuração não aguarda o arquivo de produtos.
      const configTask = readCachedConfig().then((cached) => {
        if (!cancelled && cached) applyConfig(cached);
        return cached;
      });

      const [, cachedProducts, cachedRevision] = await Promise.all([
        configTask,
        readCachedProducts(),
        readCachedSyncRevision(),
        loadImageManifest(),
      ]);
      if (cancelled) return;

      const next = removeExpiredDiscontinued(cachedProducts ?? []);
      productsRef.current = next;
      syncRevisionRef.current = cachedRevision;
      if (next.length) setProducts(next);
      if (configRef.current && next.length) setLoading(false);

      initializedRef.current = true;
      // Em uma remontagem, aguarda o cancelamento da operação anterior.
      const previous = runningRef.current;
      if (previous) await previous;
      if (!cancelled) void syncIncremental(false);
    })();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncIncremental(false);
    });

    const stopNetwork = onNetworkChange(() => {
      if (isOnline()) void syncIncremental(false);
      else if (mountedRef.current) setOffline(true);
    });

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void syncIncremental(false);
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      initializedRef.current = false;
      subscription.remove();
      stopNetwork();
      clearInterval(timer);
      if (pruneTimer.current) clearTimeout(pruneTimer.current);
      abortController.current?.abort();
    };
  }, [applyConfig, syncIncremental]);

  useEffect(() => {
    if (!products.length) return;
    const timer = setTimeout(() => {
      prefetchAllImages(catalogImages(config, products));
    }, 5_000);
    return () => clearTimeout(timer);
  }, [config, products]);

  const refresh = useCallback(() => syncIncremental(true), [syncIncremental]);

  const value = useMemo<CatalogState>(() => ({
    config,
    configResolved,
    products,
    loading,
    refreshing,
    error,
    offline,
    loadingLabel,
    loadingProgress: null,
    refresh,
  }), [
    config,
    configResolved,
    products,
    loading,
    refreshing,
    error,
    offline,
    loadingLabel,
    refresh,
  ]);

  const searchValue = useMemo(
    () => ({ searchQuery, setSearchQuery }),
    [searchQuery],
  );

  return (
    <CatalogContext.Provider value={value}>
      <CatalogSearchContext.Provider value={searchValue}>
        {children}
      </CatalogSearchContext.Provider>
    </CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogState {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog precisa estar dentro de CatalogProvider');
  return context;
}

export function useCatalogSearch() {
  const context = useContext(CatalogSearchContext);
  if (!context) {
    throw new Error('useCatalogSearch precisa estar dentro de CatalogProvider');
  }
  return context;
}
