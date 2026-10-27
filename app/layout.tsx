import type { Metadata } from 'next';
import { DM_Sans, Inter, Manrope, Montserrat } from 'next/font/google';
import { env } from 'cloudflare:workers';
import {
  getConfig,
  getPublishedCatalogSnapshot,
} from '@/lib/catalog-repository';
import { defaultConfig } from '@/lib/catalog-config';
import './globals.css';
import './marketing-polish.css';
import './carousel-color-fix.css';
import './theme-black-friday.css';
import './site-v2.css';

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });
// Fontes do tema Black Friday (app/theme-black-friday.css). Sem preload: o
// navegador só baixa quando o tema está ativo e o texto usa a fonte.
const bfDisplay = Montserrat({
  variable: '--font-bf-display',
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  style: ['normal', 'italic'],
  preload: false,
});
const bfSans = Inter({
  variable: '--font-bf-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
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
        className={`${dmSans.variable} ${manrope.variable} ${bfDisplay.variable} ${bfSans.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
