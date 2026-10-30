import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useCatalog } from '@/lib/catalog-store';
import {
  ensureCachedImage,
  loadImageManifest,
  localUriFor,
  prefetchThemeImages,
  protectThemeImages,
} from '@/lib/image-cache';
import { isOnline, onNetworkChange } from '@/lib/network';
import {
  resolveThemeId,
  themeArtUrls,
  themeRegistry,
  type ThemeArts,
  type ThemeCopy,
  type ThemeId,
} from '@/lib/theme-registry';
import type { ThemeTokens } from '@/lib/theme';

type AppTheme = {
  id: ThemeId;
  tokens: Readonly<ThemeTokens>;
  arts: ThemeArts;
  copy: ThemeCopy;
  year: string;
  dark: boolean;
  // Pronto significa hero salvo ou prazo de abertura esgotado.
  ready: boolean;
};

const ThemeContext = createContext<AppTheme | null>(null);
const HERO_WAIT_MS = 4_000;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { config, configResolved } = useCatalog();
  const id = resolveThemeId(config);
  const definition = themeRegistry[id];
  const [readyId, setReadyId] = useState<ThemeId | null>(null);

  useEffect(() => {
    if (!configResolved || !config) return;

    let cancelled = false;
    const { arts } = definition;
    protectThemeImages(themeArtUrls(arts));

    const finish = () => {
      if (!cancelled) setReadyId(id);
    };

    const timer = setTimeout(finish, HERO_WAIT_MS);

    const prepare = async () => {
      await loadImageManifest();
      if (cancelled) return;

      if (localUriFor(arts.hero)) finish();

      // Enfileira o hero primeiro; fundo e painel vêm imediatamente depois.
      void ensureCachedImage(arts.hero, true).then((uri) => {
        if (uri) finish();
      });
      void prefetchThemeImages(
        [arts.hero, arts.background, arts.panel],
        Object.values(arts.extras),
      );
    };

    void prepare();
    const stopNetwork = onNetworkChange(() => {
      if (isOnline()) void prepare();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopNetwork();
    };
  }, [configResolved, Boolean(config), definition, id]);

  const year = config?.campaign.year || definition.copy.year;
  const ready = configResolved && config !== null && readyId === id;

  const value = useMemo<AppTheme>(() => ({
    id,
    tokens: definition.tokens,
    arts: definition.arts,
    copy: definition.copy,
    year,
    dark: definition.dark,
    ready,
  }), [id, definition, year, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme precisa estar dentro de ThemeProvider');
  return context;
}
