'use client';
import { useId, useState, type CSSProperties } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalize, type Brand } from '@/lib/catalog-config';
import { publishedBrands } from '@/lib/catalog-brands';
import type { Product } from '@/lib/catalog-data';
import { BrandChoice } from './brand-choice';
import { CollectionProducts } from './collection-products';

type Props = {
  brands: Brand[];
  items: Product[];
  counts: Record<string, number>;
  email: string;
  style?: CSSProperties;
};

export function AllBrandsList({ brands, items, counts, email, style }: Props) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Brand | null>(null);
  const filtered = publishedBrands(brands).filter((b) =>
    normalize(b.name).includes(normalize(query)),
  );
  return (
    <>
      <label className="all-brands-search" htmlFor={searchId}>
        Buscar marca
        <Input
          id={searchId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite o nome da marca"
        />
      </label>
      <output>{filtered.length} marcas encontradas</output>
      <div className="all-brands-results">
        <Dialog
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
        >
          <div className="all-brands-grid brand-row">
            {filtered.map((b) => (
              <BrandChoice
                key={b.name}
                brand={b}
                count={counts[b.name] ?? 0}
                onSelect={setSelected}
              />
            ))}
          </div>
          {!filtered.length && <p>Nenhuma marca encontrada.</p>}
          {selected && (
            <CollectionProducts
              key={selected.name}
              kind="brand"
              name={selected.name}
              logo={selected.logo}
              items={items}
              email={email}
              style={style}
            />
          )}
        </Dialog>
      </div>
    </>
  );
}

export function AllBrandsDialog(props: Props) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button className="brands-more" variant="outline" />}
      >
        Mostrar mais marcas
      </DialogTrigger>
      <DialogContent className="all-brands-dialog" style={props.style}>
        <DialogHeader>
          <DialogTitle>Todas as marcas</DialogTitle>
          <DialogDescription>
            Escolha uma marca para ver seus produtos. Ao fechar os produtos,
            você volta a esta lista.
          </DialogDescription>
        </DialogHeader>
        <AllBrandsList {...props} />
      </DialogContent>
    </Dialog>
  );
}
