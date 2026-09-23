import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  BASE_URL, campaignBackground, fetchAllProducts, fetchConfig, persistSyncRevision, readCachedConfig, readCachedProducts,
  readCachedSyncRevision, type CatalogConfig, type Product,
} from './api';
import { loadImageManifest, prefetchAllImages, pruneImages } from './image-cache';
import { isOnline, onNetworkChange } from './network';

type CatalogState = {
  config: CatalogConfig | null; products: Product[]; loading: boolean;
  refreshing: boolean; error: string | null; offline: boolean;
  loadingLabel: string; loadingProgress: number | null; refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogState | null>(null);
const CatalogSearchContext = createContext<{ searchQuery: string; setSearchQuery: (query: string) => void } | null>(null);

const CHECK_INTERVAL_MS = 5 * 60_000;

export function isDiscontinued(product: Product, now = Date.now()) {
  const until = Date.parse(product.discontinuedUntil ?? '');
  return product.published === false && Number.isFinite(until) && until > now;
}

export function removeExpiredDiscontinued(items: Product[], now = Date.now()) {
  return items.filter((product) => product.published !== false || isDiscontinued(product, now));
}

function catalogImages(config: CatalogConfig | null, products: Product[]) {
  return [
    ...(config?.brands ?? []).map((brand) => brand.logo),
    ...(config?.banners ?? []).map((banner) => banner.image),
    // Fundo do topo da Início, salvo no aparelho para aparecer offline: a
    // foto da marca (Padrão) e a arte do tema da campanha ativa.
    campaignBackground(config),
    typeof config?.campaign?.image === 'string' ? config.campaign.image : undefined,
    config?.campaign?.enabled !== false && config?.campaign?.theme
      ? `${BASE_URL}/themes/${String(config.campaign.theme)}.png`
      : undefined,
    ...products.map((product) => product.image),
  ];
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CatalogConfig | null>(null);
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
    try {
      // Configuração primeiro: a versão anotada é a de ANTES dos produtos. Se
      // alguém publicar durante o download, a próxima checagem vê a versão
      // nova e baixa de novo, em vez de ficar com um catálogo misturado.
      const configResult = await fetchConfig(controller.signal);
      const productsResult = await fetchAllProducts(controller.signal, (count) => {
        if (initial) setLoadingLabel(`Baixando produtos… ${count}`);
      });
      if (controller.signal.aborted) return;
      const next = removeExpiredDiscontinued(productsResult.data);
      setConfig(configResult.data); configRef.current = configResult.data;
      if (next.length > 0) { setProducts(next); productsRef.current = next; }
      // A versão só é anotada com o catálogo completo: se veio parcial, a
      // próxima checagem ainda vê diferença e tenta baixar de novo.
      const complete = !configResult.fromCache && !productsResult.fromCache && !productsResult.partial;
      if (complete && configResult.revision) {
        syncRevisionRef.current = configResult.revision;
        persistSyncRevision(configResult.revision);
      }
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
      setLoading(false); setRefreshing(false);
    }
  }, [pruneLater]);

  const syncIncremental = useCallback(async (manual = false) => {
    // Sem internet não adianta tentar: marca offline na hora, sem esperar
    // uma requisição falhar e sem redesenhar as telas a cada checagem.
    if (!isOnline()) { setOffline(true); setRefreshing(false); return; }
    if (runningRef.current) return runningRef.current;
    const operation = (async () => {
      if (manual) setRefreshing(true);
      const controller = new AbortController();
      abortController.current = controller;
      try {
        if (syncRevisionRef.current <= 0 || !productsRef.current.length) {
          await loadFull(!productsRef.current.length);
          return;
        }
        // Checagem barata: só a configuração (1 leitura no R2, poucos KB),
        // que traz o número da versão publicada. O catálogo inteiro (~2 MB,
        // 13 páginas) só é baixado de novo quando esse número muda, ou seja,
        // quando algo é publicado no editor.
        const configResult = await fetchConfig(controller.signal);
        if (configResult.fromCache) { setOffline(true); return; }
        if (configResult.revision !== syncRevisionRef.current) {
          await loadFull(false);
          return;
        }
        setOffline(false); setError(null);
        // Nada publicado: só retira itens descontinuados cujo prazo venceu.
        const withoutExpired = removeExpiredDiscontinued(productsRef.current);
        if (withoutExpired.length !== productsRef.current.length) {
          productsRef.current = withoutExpired;
          setProducts(withoutExpired);
        }
      } catch (caught) {
        if (!(caught instanceof Error && caught.name === 'AbortError')) setOffline(true);
      } finally {
        setRefreshing(false);
      }
    })();
    runningRef.current = operation;
    try { await operation; } finally { runningRef.current = null; }
  }, [loadFull]);

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
    // Caiu a internet: mostra o aviso na hora. Voltou: sincroniza sozinho.
    const stopNetwork = onNetworkChange(() => {
      if (isOnline()) void syncIncremental(false); else setOffline(true);
    });
    // Checagem de fundo a cada 5 minutos (1 leitura no R2 cada). Ao voltar
    // para o app, a checagem roda na hora (listener do AppState acima).
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void syncIncremental(false);
    }, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true; subscription.remove(); stopNetwork(); clearInterval(timer); abortController.current?.abort();
    };
  }, [syncIncremental]);

  // Com o catálogo em mãos, baixa em segundo plano as fotos que faltam no
  // aparelho (só em Wi-Fi), para tudo aparecer também sem internet.
  useEffect(() => {
    if (!products.length) return;
    const timer = setTimeout(() => prefetchAllImages(catalogImages(config, products)), 5_000);
    return () => clearTimeout(timer);
  }, [config, products]);

  const refresh = useCallback(() => syncIncremental(true), [syncIncremental]);
  // A sincronização de fundo (a cada 5 minutos) não tem estado aqui de propósito:
  // se tivesse, redesenharia todas as telas abertas duas vezes a cada rodada.
  const value = useMemo(() => ({
    config, products, loading, refreshing, error, offline,
    loadingLabel, loadingProgress: null, refresh,
  }), [config, products, loading, refreshing, error, offline, loadingLabel, refresh]);
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
