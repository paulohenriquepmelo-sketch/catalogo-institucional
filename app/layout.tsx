import type { Metadata } from 'next';
import {
  Baloo_2,
  Cinzel,
  DM_Sans,
  Dancing_Script,
  Manrope,
  Montserrat,
} from 'next/font/google';
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
import './theme-v4.css';
// Ajustes de cada tema de data, feitos a partir dos esboços do cliente.
import './themes/natal.css';
import './themes/ano-novo.css';
import './themes/dia-das-maes.css';
import './themes/aniversario.css';
import './themes/carnaval.css';
import './themes/dia-das-criancas.css';
import './themes/black-friday.css';
// Fundo da página com a textura de cada tema (depois dos temas).
import './theme-fundos.css';
import './promo-popup.css';
import './theme-popups.css';

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
// Letra ornamental do "NATAL" no banner (app/themes/natal.css), como no
// esboço do cliente. Sem preload: só baixa quando o tema Natal está ativo.
const natalDisplay = Cinzel({
  variable: '--font-natal',
  subsets: ['latin'],
  weight: ['700', '900'],
  preload: false,
});
// Frase cursiva do painel de ofertas do Natal (app/themes/natal.css).
const natalScript = Dancing_Script({
  variable: '--font-natal-script',
  subsets: ['latin'],
  weight: ['700'],
  preload: false,
});
// Algarismos arredondados do ano no banner de Ano Novo (app/themes/ano-novo.css).
const anoNovoDisplay = Baloo_2({
  variable: '--font-ano-novo',
  subsets: ['latin'],
  weight: ['800'],
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
        className={`${dmSans.variable} ${manrope.variable} ${bfDisplay.variable} ${natalDisplay.variable} ${anoNovoDisplay.variable} ${natalScript.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
