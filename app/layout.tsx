import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nexo Catálogo — Curadoria para projetos',
  description: 'Catálogo institucional de mobiliário, iluminação e soluções para projetos corporativos, residenciais e de hospitalidade.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'Nexo Catálogo — Curadoria para projetos',
    description: 'Escolhas que transformam espaços.',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'Nexo Catálogo — Escolhas que transformam espaços.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexo Catálogo — Curadoria para projetos',
    description: 'Escolhas que transformam espaços.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${dmSans.variable} ${manrope.variable}`}>{children}</body></html>;
}
