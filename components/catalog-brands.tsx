'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { normalize, type Brand } from '@/lib/catalog-config';
import type { Product } from '@/lib/catalog-data';
export function CatalogBrands({
  brands,
  items,
  onSelect,
}: {
  brands: Brand[];
  items: Product[];
  onSelect: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(24);
  const counts = items.reduce<Record<string, number>>((a, p) => {
    a[p.brand] = (a[p.brand] ?? 0) + 1;
    return a;
  }, {});
  const filtered = brands.filter((b) =>
    normalize(b.name).includes(normalize(query)),
  );
  return (
    <>
      <label className="brand-search">
        <span>Buscar entre {brands.length} marcas</span>
        <Input
          placeholder="Digite o nome da marca"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(24);
          }}
        />
      </label>
      <div className="brand-row">
        {filtered.slice(0, limit).map((b) => (
          <button key={b.name} onClick={() => onSelect(b.name)}>
            {b.logo ? (
              <img src={b.logo} alt={b.name} loading="lazy" />
            ) : (
              <strong>{b.name}</strong>
            )}
            <small>{counts[b.name] ?? 0} produtos</small>
          </button>
        ))}
      </div>
      {!filtered.length && <p>Nenhuma marca encontrada.</p>}
      {filtered.length > limit && (
        <Button
          className="brands-more"
          variant="outline"
          onClick={() => setLimit((n) => n + 24)}
        >
          Mostrar mais marcas
        </Button>
      )}
    </>
  );
}
