import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import { env } from 'cloudflare:workers';
import { getConfig } from '@/lib/catalog-repository';
import { defaultConfig } from '@/lib/catalog-config';
import './globals.css';

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getConfig().catch(() => ({ config: defaultConfig }));
  const title = `${config.name} — Catálogo institucional`;
  const origin = env.SITE_ORIGIN ? new URL(env.SITE_ORIGIN) : undefined;
  const preview = origin
    ? new URL('/og-wholesale.png', origin).href
    : undefined;
  return {
    title,
    description: config.tagline,
    metadataBase: origin,
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
      <body className={`${dmSans.variable} ${manrope.variable}`}>
        {children}
      </body>
    </html>
  );
}
