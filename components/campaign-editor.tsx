'use client';
/* oxlint-disable next/no-img-element -- These are previews of the exact static campaign artworks. */
import { useState } from 'react';
import {
  Check,
  Plus,
  ArrowDown,
  ArrowUp,
  Trash2,
  Image,
  Images,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Field, Toggle, Panel, UploadField } from './editor-controls';
import { CatalogCampaign } from './catalog-campaign';
import type { CatalogConfig } from '@/lib/catalog-config';
import { catalogColorStyle } from '@/lib/catalog-colors';
import { ColorEditor } from './color-editor';
import {
  campaignPreset,
  campaignThemes,
  defaultCampaign,
  type CampaignSlide,
  type CampaignThemeId,
  type CatalogCampaign as Campaign,
} from '@/lib/catalog-campaign';

export function CampaignEditor({
  config,
  onChange,
  onBusy,
}: {
  config: CatalogConfig;
  onChange: (config: CatalogConfig) => void;
  onBusy: (busy: boolean) => void;
}) {
  const campaign = config.campaign ?? defaultCampaign;
  const [addTheme, setAddTheme] = useState<CampaignThemeId>('natal');
  const change = (patch: Partial<Campaign>) =>
    onChange({ ...config, campaign: { ...campaign, ...patch } });
  function editSlide(id: string, patch: Partial<CampaignSlide>) {
    change({
      slides: campaign.slides.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });
  }
  function move(index: number, delta: number) {
    const slides = [...campaign.slides];
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    [slides[index], slides[target]] = [slides[target], slides[index]];
    change({ slides });
  }
  function addSlide(theme?: CampaignThemeId) {
    const preset = campaignThemes.find((t) => t.id === theme);
    change({
      slides: [
        ...campaign.slides,
        {
          id: crypto.randomUUID(),
          image: preset?.image ?? '',
          title: preset?.title ?? 'Nova campanha',
          description: preset?.description ?? '',
          button: 'Explorar catálogo',
          link: '#catalogo',
          visible: Boolean(preset),
        },
      ],
    });
  }
  return (
    <Panel
      title="Temas, banners e fundo do catálogo"
      note="O tema é somente um plano de fundo para o título do catálogo, a busca e os filtros. Não adiciona painéis, chamadas promocionais ou contadores."
    >
      <Toggle
        label="Exibir plano de fundo no catálogo"
        value={campaign.enabled}
        onChange={(enabled) => change({ enabled })}
      />
      <div className="campaign-editor-modes" aria-label="Formato do fundo">
        {(
          [
            { id: 'theme', label: 'Tema pronto', Icon: Palette },
            { id: 'image', label: 'Minha imagem', Icon: Image },
            { id: 'carousel', label: 'Carrossel de fundo', Icon: Images },
          ] as const
        ).map(({ id, label, Icon }) => (
          <Button
            key={id}
            variant={campaign.mode === id ? 'default' : 'outline'}
            aria-pressed={campaign.mode === id}
            onClick={() => change({ mode: id })}
          >
            <Icon />
            {label}
          </Button>
        ))}
      </div>
      <h2>Datas comemorativas</h2>
      <p className="source-note">
        Clique para aplicar somente o plano de fundo. A troca não é automática
        por data; você decide quando ativar cada campanha. Nenhuma mudança
        aparece no catálogo até salvar.
      </p>
      <div className="campaign-theme-grid">
        {campaignThemes.map((theme) => (
          <button
            type="button"
            key={theme.id}
            className={
              campaign.theme === theme.id && campaign.mode === 'theme'
                ? 'selected'
                : ''
            }
            aria-pressed={
              campaign.theme === theme.id && campaign.mode === 'theme'
            }
            onClick={() =>
              onChange({
                ...config,
                campaign: campaignPreset(theme.id, campaign),
              })
            }
          >
            <img src={theme.image} alt="" loading="lazy" />
            <span>
              {theme.name}
              {campaign.theme === theme.id && campaign.mode === 'theme' && (
                <Check />
              )}
            </span>
          </button>
        ))}
      </div>
      {campaign.mode === 'image' && (
        <UploadField
          label="Imagem de fundo da campanha"
          value={campaign.image}
          onChange={(image) => change({ image })}
          onBusy={onBusy}
        />
      )}
      {campaign.mode === 'carousel' && (
        <>
          <p className="source-note">
            Adicione até 12 banners. Apenas os visíveis com imagem aparecem no
            carrossel. Somente a imagem muda; a busca e os filtros permanecem no
            lugar.
          </p>
          {campaign.slides.map((slide, index) => (
            <article className="settings-card" key={slide.id}>
              <div className="setting-card-title">
                <h3>Banner {index + 1}</h3>
                <div className="campaign-slide-actions">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Mover banner ${index + 1} para cima`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Mover banner ${index + 1} para baixo`}
                    disabled={index === campaign.slides.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remover banner ${index + 1}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Remover este banner da campanha? A imagem enviada continuará armazenada.',
                        )
                      )
                        change({
                          slides: campaign.slides.filter(
                            (s) => s.id !== slide.id,
                          ),
                        });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <UploadField
                label="Arte de fundo"
                value={slide.image}
                onChange={(image) => editSlide(slide.id, { image })}
                onBusy={onBusy}
              />
              <div className="settings-grid">
                <Field
                  label="Nome interno da imagem (não aparece no site)"
                  value={slide.title}
                  onChange={(title) => editSlide(slide.id, { title })}
                />
              </div>
              <Toggle
                label="Banner visível"
                value={slide.visible}
                onChange={(visible) => editSlide(slide.id, { visible })}
              />
            </article>
          ))}
          <div className="campaign-add-slide">
            <label className="editor-field" htmlFor="campaign-add-theme">
              <span>Adicionar arte pronta ao carrossel</span>
              <NativeSelect
                id="campaign-add-theme"
                value={addTheme}
                onChange={(e) => setAddTheme(e.target.value as CampaignThemeId)}
              >
                {campaignThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <Button
              variant="outline"
              disabled={campaign.slides.length >= 12}
              onClick={() => addSlide(addTheme)}
            >
              <Plus />
              Adicionar tema
            </Button>
            <Button
              variant="outline"
              disabled={campaign.slides.length >= 12}
              onClick={() => addSlide()}
            >
              <Plus />
              Adicionar minha arte
            </Button>
          </div>
          <div className="settings-row">
            <Toggle
              label="Avançar automaticamente"
              value={campaign.autoplay}
              onChange={(autoplay) => change({ autoplay })}
            />
            <Field
              type="number"
              label="Intervalo em segundos (3 a 30)"
              value={String(campaign.interval)}
              onChange={(value) => change({ interval: Number(value) })}
            />
          </div>
        </>
      )}
      <div className="campaign-layout-options">
        <label className="editor-field" htmlFor="campaign-scope">
          <span>Onde usar o fundo</span>
          <NativeSelect
            id="campaign-scope"
            value={campaign.scope}
            onChange={(e) =>
              change({ scope: e.target.value as Campaign['scope'] })
            }
          >
            <option value="hero">Atrás do título, busca e filtros</option>
            <option value="catalog">
              Cabeçalho e fundo da área de produtos
            </option>
          </NativeSelect>
        </label>
        <label className="editor-field" htmlFor="campaign-position">
          <span>Enquadramento da imagem</span>
          <NativeSelect
            id="campaign-position"
            value={campaign.position}
            onChange={(e) =>
              change({ position: e.target.value as Campaign['position'] })
            }
          >
            <option value="center">Centro</option>
            <option value="top">Topo</option>
            <option value="bottom">Base</option>
          </NativeSelect>
        </label>
        <Field
          type="number"
          label="Clareamento do fundo (0 a 70%)"
          value={String(campaign.overlay)}
          onChange={(value) => change({ overlay: Number(value) })}
        />
      </div>
      <p className="source-note">
        Artes horizontais funcionam melhor. Ajuste o enquadramento e o
        clareamento para manter o texto legível. A reprodução automática pausa
        ao interagir e respeita movimento reduzido.
      </p>
      <p className="source-note">
        O título e o texto institucional continuam em Aparência e página, no
        bloco Catálogo. Os temas não substituem esses textos.
      </p>
      <div className="campaign-preview-label">
        <strong>Prévia do plano de fundo</strong>
        <span>As alterações ainda precisam ser salvas.</span>
      </div>
      <ColorEditor config={config} onChange={onChange} themeOnly />
      <div style={catalogColorStyle(config)}>
        <CatalogCampaign
          campaign={campaign}
          intro={
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Catálogo institucional</span>
                  <h2>
                    {
                      config.blocks.find((block) => block.type === 'catalog')
                        ?.title
                    }
                  </h2>
                </div>
                <p>
                  {
                    config.blocks.find((block) => block.type === 'catalog')
                      ?.body
                  }
                </p>
              </div>
              <div className="campaign-preview-search">
                Buscar por nome, código ou característica…
              </div>
              <div className="campaign-preview-filters">
                {['Seção', 'Categoria', 'Marca', 'Segmento'].map((label) => (
                  <span key={label}>
                    {label}
                    <strong>Todos</strong>
                  </span>
                ))}
              </div>
            </>
          }
          preview
        >
          {campaign.scope === 'catalog' && (
            <div className="campaign-preview-products">
              <strong>Seus produtos continuam logo abaixo</strong>
              <p>
                Os cartões e filtros continuam sobre uma área clara para
                facilitar a leitura.
              </p>
            </div>
          )}
        </CatalogCampaign>
      </div>
    </Panel>
  );
}
