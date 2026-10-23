'use client';
import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';

export type CatalogPdfInfo = {
  available: boolean;
  generatedAt?: string;
  products?: number;
  pages?: number;
  size?: number;
  layout?: 'classico' | 'moderno' | 'modelo';
  columns?: 3 | 4 | 5;
};

export function useCatalogPdfInfo() {
  const [info, setInfo] = useState<CatalogPdfInfo | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/catalog-pdf?info=1')
      .then((r) => (r.ok ? (r.json() as Promise<CatalogPdfInfo>) : null))
      .then((data) => active && setInfo(data))
      .catch(() => active && setInfo(null));
    return () => {
      active = false;
    };
  }, []);
  return info;
}

export const megabytes = (bytes?: number) =>
  bytes ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB` : '';

/** Link do menu: só aparece depois que o editor gerou o PDF completo. */
export function CatalogPdfLink({ className }: { className?: string }) {
  const info = useCatalogPdfInfo();
  if (!info?.available) return null;
  return (
    <a
      href="/api/catalog-pdf"
      download
      className={className}
      title={`Catálogo completo em PDF${info.size ? ` (${megabytes(info.size)})` : ''}`}
    >
      <FileDown className="size-4" aria-hidden="true" />
      Baixar catálogo em PDF
    </a>
  );
}
