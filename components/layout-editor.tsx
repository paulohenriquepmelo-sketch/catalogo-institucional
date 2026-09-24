'use client';
/* oxlint-disable next/no-img-element -- Preview the exact saved logo. */
import { Input } from '@/components/ui/input';
import { defaultLayout } from '@/lib/catalog-layout';
import type { CatalogConfig } from '@/lib/catalog-config';

export function LayoutEditor({
  config,
  onChange,
}: {
  config: CatalogConfig;
  onChange: (config: CatalogConfig) => void;
}) {
  const layout = { ...defaultLayout, ...config.layout };
  return (
    <section className="size-settings">
      <h2>Tamanho da logo e das fotos</h2>
      {(
        [
          ['logoWidth', 'Largura da logo', 80, 320],
          ['productImageHeight', 'Altura das fotos dos produtos', 100, 360],
        ] as const
      ).map(([key, label, min, max]) => (
        <label className="size-setting" key={key}>
          <span>
            {label} <strong>{layout[key]} px</strong>
          </span>
          <Input
            type="range"
            min={min}
            max={max}
            step={10}
            value={layout[key]}
            onChange={(e) =>
              onChange({
                ...config,
                layout: { ...layout, [key]: Number(e.target.value) },
              })
            }
          />
          <small>
            {min} a {max} pixels
          </small>
        </label>
      ))}
      <p className="editor-field-note">
        As fotos dos produtos aparecem sempre inteiras, sem cortar, ajustadas
        dentro da área.
      </p>
      {config.logo && (
        <div className="logo-size-preview">
          <img
            src={config.logo}
            alt="Prévia do tamanho da logo"
            style={{
              width: layout.logoWidth,
              maxWidth: '100%',
              maxHeight: 140,
              objectFit: 'contain',
            }}
          />
        </div>
      )}
      <div
        className="photo-size-preview"
        style={{ height: layout.productImageHeight }}
      >
        Área da foto · {layout.productImageHeight} px de altura
      </div>
      <p className="source-note">
        A logo respeita o espaço disponível no celular. A altura das fotos vale
        para o catálogo e os cartões nos popups. Salve para aplicar.
      </p>
    </section>
  );
}
