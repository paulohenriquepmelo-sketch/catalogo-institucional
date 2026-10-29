import type { Metadata } from 'next';
import { DM_Sans, Fraunces, Fredoka, Manrope, Montserrat } from 'next/font/google';
import { env } from 'cloudflare:workers';
import {
  getConfig,
  getPublishedCatalogSnapshot,
} from '@/lib/catalog-repository';
import { defaultConfig } from '@/lib/catalog-config';
import './globals.css';
import './marketing-polish.css';
import './carousel-color-fix.css';
import './site-v2.css';
import './theme-v3.css';
import './promo-popup.css';

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });
// Fonte dos títulos do layout (--v2-display em app/site-v2.css). Sem
// preload: o navegador só baixa quando o texto usa a fonte.
const bfDisplay = Montserrat({
  variable: '--font-bf-display',
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  style: ['normal', 'italic'],
  preload: false,
});
// Fontes dos temas de data (app/theme-v3.css): Dia das Mães e Dia das
// Crianças. Também sem preload.
const themeSerif = Fraunces({
  variable: '--font-theme-serif',
  subsets: ['latin'],
  preload: false,
});
const themeFun = Fredoka({
  variable: '--font-theme-fun',
  subsets: ['latin'],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const configResult =
    env.WORKER_ROLE === 'public' ? getPublishedCatalogSnapshot() : getConfig();
  const { config } = await configResult.catch(() => ({
    config: defaultConfig,
  }));
  const title = `${config.name} — Catálogo institucional`;
  const origin = env.SITE_ORIGIN ? new URL(env.SITE_ORIGIN) : undefined;
  const preview = origin
    ? new URL('/og-wholesale.png', origin).href
    : undefined;
  const icon = '/favicon.svg';
  return {
    title,
    description: config.tagline,
    metadataBase: origin,
    icons: {
      icon: [{ url: icon }],
      shortcut: [{ url: icon }],
      apple: [{ url: icon }],
    },
    openGraph: {
      title,
      description: config.tagline,
      type: 'website',
      locale: 'pt_BR',
      ...(preview
        ? {
            images: [
              {
                url: preview,
                width: 1731,
                height: 909,
                alt: `${config.name} — Catálogo institucional`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: config.tagline,
      ...(preview ? { images: [preview] } : {}),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${dmSans.variable} ${manrope.variable} ${bfDisplay.variable} ${themeSerif.variable} ${themeFun.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
