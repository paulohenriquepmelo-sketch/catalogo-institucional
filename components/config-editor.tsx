'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Choice, Toggle, Panel, UploadField } from './editor-controls';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Block, CatalogConfig } from '@/lib/catalog-config';

export type EditorView =
  | 'overview'
  | 'products'
  | 'taxonomy'
  | 'brands'
  | 'segments'
  | 'banners'
  | 'appearance';
export function ConfigEditor({
  view,
  config,
  onChange,
  onBusy,
}: {
  view: EditorView;
  config: CatalogConfig;
  onChange: (config: CatalogConfig) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [brandQuery, setBrandQuery] = useState('');
  const [brandLimit, setBrandLimit] = useState(20);
  const selectedBrands = config.brands
    .map((brand, i) => ({ brand, i }))
    .filter(({ brand }) =>
      brand.name.toLowerCase().includes(brandQuery.toLowerCase()),
    );
  function change<K extends keyof CatalogConfig>(
    key: K,
    value: CatalogConfig[K],
  ) {
    onChange({ ...config, [key]: value });
  }
  function move(key: 'blocks' | 'banners', index: number, delta: number) {
    const items = [...config[key]];
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    onChange({ ...config, [key]: items });
  }
  const remove = (
    key: 'blocks' | 'banners' | 'brands' | 'taxonomy' | 'segments',
    index: number,
  ) => {
    if (
      window.confirm(
        'Remover este registro? A remoção só será aplicada ao salvar.',
      )
    )
      onChange({ ...config, [key]: config[key].filter((_, i) => i !== index) });
  };
  const order = (key: 'blocks' | 'banners', i: number) => (
    <div className="row-actions">
      <Button
        variant="outline"
        size="icon"
        aria-label="Mover para cima"
        disabled={i === 0}
        onClick={() => move(key, i, -1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Mover para baixo"
        disabled={i === config[key].length - 1}
        onClick={() => move(key, i, 1)}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="destructive"
        size="icon"
        aria-label="Remover"
        disabled={key === 'blocks' && config.blocks[i].type === 'catalog'}
        onClick={() => remove(key, i)}
      >
        <Trash2 />
      </Button>
    </div>
  );
  if (view === 'taxonomy')
    return (
      <Panel
        title="Departamentos, seções e categorias"
        note="Cada linha é um caminho completo. Categorias já usadas precisam ser desvinculadas dos produtos antes de serem removidas."
      >
        {config.taxonomy.map((path, i) => (
          <div className="settings-row" key={i}>
            {(['department', 'section', 'category'] as const).map((key, j) => (
              <Field
                key={key}
                label={['Departamento', 'Seção', 'Categoria'][j]}
                value={path[key]}
                onChange={(value) =>
                  change(
                    'taxonomy',
                    config.taxonomy.map((t, n) =>
                      n === i ? { ...t, [key]: value } : t,
                    ),
                  )
                }
              />
            ))}
            <Button
              variant="destructive"
              size="icon"
              aria-label="Remover categoria"
              onClick={() => remove('taxonomy', i)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() =>
            change('taxonomy', [
              ...config.taxonomy,
              { department: '', section: '', category: '' },
            ])
          }
        >
          <Plus /> Adicionar categoria
        </Button>
      </Panel>
    );
  if (view === 'brands')
    return (
      <Panel
        title="Marcas"
        note="O nome vincula os produtos à marca. O logo enviado aparece automaticamente no catálogo público."
      >
        <Field
          label={`Buscar entre ${config.brands.length} marcas`}
          value={brandQuery}
          onChange={(v) => {
            setBrandQuery(v);
            setBrandLimit(20);
          }}
        />
        <div className="settings-grid">
          {selectedBrands.slice(0, brandLimit).map(({ brand, i }) => (
            <article className="settings-card" key={i}>
              <Field
                label="Nome da marca"
                value={brand.name}
                onChange={(name) =>
                  change(
                    'brands',
                    config.brands.map((b, n) => (n === i ? { ...b, name } : b)),
                  )
                }
              />
              <UploadField
                label="Logo da marca"
                value={brand.logo}
                onBusy={onBusy}
                onChange={(logo) =>
                  change(
                    'brands',
                    config.brands.map((b, n) => (n === i ? { ...b, logo } : b)),
                  )
                }
              />
              <Button variant="destructive" onClick={() => remove('brands', i)}>
                <Trash2 /> Remover marca
              </Button>
            </article>
          ))}
        </div>
        {selectedBrands.length > brandLimit && (
          <Button
            variant="outline"
            onClick={() => setBrandLimit((n) => n + 20)}
          >
            Mostrar mais marcas
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            change('brands', [{ name: '', logo: '' }, ...config.brands]);
            setBrandQuery('');
            setBrandLimit(20);
          }}
        >
          <Plus /> Adicionar marca
        </Button>
      </Panel>
    );
  if (view === 'segments')
    return (
      <Panel
        title="Segmentos automáticos"
        note="A análise usa palavras-chave do cadastro: categoria tem peso 3, nome e descrição peso 2, outros campos peso 1. Empates ou falta de sinais ficam como “Sem classificação”. São sugestões de segmento para revisão, não uma IA generativa."
      >
        <div className="settings-grid">
          {config.segments.map((segment, i) => (
            <article className="settings-card" key={i}>
              <Field
                label="Nome do segmento"
                value={segment.name}
                onChange={(name) =>
                  change(
                    'segments',
                    config.segments.map((s, n) =>
                      n === i ? { ...s, name } : s,
                    ),
                  )
                }
              />
              <Field
                label="Descrição pública"
                value={segment.note}
                onChange={(note) =>
                  change(
                    'segments',
                    config.segments.map((s, n) =>
                      n === i ? { ...s, note } : s,
                    ),
                  )
                }
              />
              <Field
                label="Palavras-chave (uma por linha)"
                multiline
                value={segment.keywords.join('\n')}
                onChange={(words) =>
                  change(
                    'segments',
                    config.segments.map((s, n) =>
                      n === i ? { ...s, keywords: words.split('\n') } : s,
                    ),
                  )
                }
              />
              <Button
                variant="destructive"
                onClick={() => remove('segments', i)}
              >
                <Trash2 /> Remover segmento
              </Button>
            </article>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() =>
            change('segments', [
              ...config.segments,
              { name: '', note: '', keywords: [] },
            ])
          }
        >
          <Plus /> Adicionar segmento
        </Button>
      </Panel>
    );
  if (view === 'banners')
    return (
      <Panel
        title="Banners e carrossel"
        note="As imagens, textos e links abaixo formam o carrossel público. A animação respeita a preferência de movimento reduzido do visitante."
      >
        <div className="settings-row">
          <Toggle
            label="Avanço automático"
            value={config.autoplay}
            onChange={(value) => change('autoplay', value)}
          />
          <Field
            label="Intervalo (3 a 30 segundos)"
            type="number"
            value={String(config.interval)}
            onChange={(value) => change('interval', Number(value))}
          />
        </div>
        {config.banners.map((banner, i) => (
          <article className="settings-card" key={banner.id}>
            <div className="setting-card-title">
              <h2>Banner {i + 1}</h2>
              {order('banners', i)}
            </div>
            <Field
              label="Título"
              value={banner.title}
              onChange={(title) =>
                change(
                  'banners',
                  config.banners.map((b) =>
                    b.id === banner.id ? { ...b, title } : b,
                  ),
                )
              }
            />
            <Field
              label="Texto de apoio"
              multiline
              value={banner.description}
              onChange={(description) =>
                change(
                  'banners',
                  config.banners.map((b) =>
                    b.id === banner.id ? { ...b, description } : b,
                  ),
                )
              }
            />
            <UploadField
              label="Imagem do banner"
              value={banner.image}
              onBusy={onBusy}
              onChange={(image) =>
                change(
                  'banners',
                  config.banners.map((b) =>
                    b.id === banner.id ? { ...b, image } : b,
                  ),
                )
              }
            />
            <Field
              label="Link de destino"
              value={banner.link}
              onChange={(link) =>
                change(
                  'banners',
                  config.banners.map((b) =>
                    b.id === banner.id ? { ...b, link } : b,
                  ),
                )
              }
            />
            <Toggle
              label="Visível no site"
              value={banner.visible}
              onChange={(visible) =>
                change(
                  'banners',
                  config.banners.map((b) =>
                    b.id === banner.id ? { ...b, visible } : b,
                  ),
                )
              }
            />
          </article>
        ))}
        <Button
          variant="outline"
          onClick={() =>
            change('banners', [
              ...config.banners,
              {
                id: crypto.randomUUID(),
                title: 'Novo banner',
                description: '',
                image: '',
                link: '#catalogo',
                visible: false,
              },
            ])
          }
        >
          <Plus /> Adicionar banner
        </Button>
      </Panel>
    );
  return (
    <Panel
      title="Aparência e conteúdo"
      note="Salve para aplicar a identidade, textos e ordem das seções ao site público."
    >
      <div className="settings-grid">
        <Field
          label="Nome institucional"
          value={config.name}
          onChange={(v) => change('name', v)}
        />
        <Field
          label="Slogan"
          value={config.tagline}
          onChange={(v) => change('tagline', v)}
        />
        <Field
          label="E-mail para solicitar informações"
          value={config.email}
          type="email"
          onChange={(v) => change('email', v)}
        />
        <Choice
          label="Tipografia"
          value={config.font}
          options={['sans', 'serif']}
          onChange={(v) => change('font', v as 'sans' | 'serif')}
        />
      </div>
      <UploadField
        label="Logo institucional"
        value={config.logo}
        onChange={(v) => change('logo', v)}
        onBusy={onBusy}
      />
      <div className="settings-row">
        <Field
          label="Cor principal"
          type="color"
          value={config.primary}
          onChange={(v) => change('primary', v)}
        />
        <Field
          label="Destaques"
          type="color"
          value={config.accent}
          onChange={(v) => change('accent', v)}
        />
        <Field
          label="Fundo"
          type="color"
          value={config.background}
          onChange={(v) => change('background', v)}
        />
      </div>
      <Field
        label="Texto do rodapé"
        multiline
        value={config.footer}
        onChange={(v) => change('footer', v)}
      />
      <Toggle
        label="Exibir aviso de catálogo demonstrativo"
        value={config.demo}
        onChange={(v) => change('demo', v)}
      />
      <h2>Ordem e conteúdo das seções</h2>
      {config.blocks.map((block, i) => (
        <article className="settings-card" key={block.id}>
          <div className="setting-card-title">
            <strong>
              {
                {
                  catalog: 'Catálogo',
                  banners: 'Carrossel',
                  segments: 'Segmentos',
                  brands: 'Marcas',
                  text: 'Texto institucional',
                }[block.type]
              }
            </strong>
            {order('blocks', i)}
          </div>
          <Field
            label="Título da seção"
            value={block.title}
            onChange={(title) =>
              change(
                'blocks',
                config.blocks.map((b) =>
                  b.id === block.id ? { ...b, title } : b,
                ),
              )
            }
          />
          <Field
            label="Texto"
            multiline
            value={block.body}
            onChange={(body) =>
              change(
                'blocks',
                config.blocks.map((b) =>
                  b.id === block.id ? { ...b, body } : b,
                ),
              )
            }
          />
          <Toggle
            label="Visível"
            value={block.visible}
            onChange={(visible) =>
              change(
                'blocks',
                config.blocks.map((b) =>
                  b.id === block.id ? { ...b, visible } : b,
                ),
              )
            }
          />
        </article>
      ))}
      <div className="row-actions">
        <Button
          variant="outline"
          onClick={() =>
            change('blocks', [
              ...config.blocks,
              {
                id: crypto.randomUUID(),
                type: 'text',
                title: 'Sobre nós',
                body: '',
                visible: true,
              },
            ])
          }
        >
          <Plus /> Seção institucional
        </Button>
        {(['banners', 'segments', 'brands'] as Block['type'][])
          .filter((type) => !config.blocks.some((b) => b.type === type))
          .map((type) => (
            <Button
              key={type}
              variant="outline"
              onClick={() =>
                change('blocks', [
                  ...config.blocks,
                  { id: type, type, title: type, body: '', visible: true },
                ])
              }
            >
              Restaurar {type}
            </Button>
          ))}
      </div>
    </Panel>
  );
}
