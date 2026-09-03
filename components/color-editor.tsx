'use client';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  defaultColors,
  resolveColors,
  colorWarnings,
  type CatalogColors,
} from '@/lib/catalog-colors';
import type { CatalogConfig } from '@/lib/catalog-config';

export function ColorEditor({
  config,
  onChange,
  themeOnly = false,
}: {
  config: CatalogConfig;
  onChange: (config: CatalogConfig) => void;
  themeOnly?: boolean;
}) {
  const colors = { ...defaultColors, ...config.colors };
  const resolved = resolveColors(config);
  type ColorField = {
    key: keyof CatalogColors;
    label: string;
    description: string;
  };
  const groups: { title: string; description: string; fields: ColorField[] }[] =
    themeOnly
      ? [
          {
            title: 'Textos sobre a imagem ou tema',
            description:
              'Cores usadas somente quando existe uma imagem ou tema no fundo do catálogo.',
            fields: [
              {
                key: 'themeHeading',
                label: 'Títulos sobre o fundo',
                description: 'Título principal exibido sobre a imagem do tema.',
              },
              {
                key: 'themeText',
                label: 'Textos sobre o fundo',
                description:
                  'Descrições, filtros e informações sobre a imagem.',
              },
            ],
          },
        ]
      : [
          {
            title: 'Página e botões',
            description:
              'Cores gerais usadas no catálogo, fora das áreas especiais abaixo.',
            fields: [
              {
                key: 'heading',
                label: 'Títulos da página',
                description: 'Títulos grandes do catálogo e das seções comuns.',
              },
              {
                key: 'text',
                label: 'Texto principal',
                description:
                  'Nomes de produtos e informações mais importantes.',
              },
              {
                key: 'muted',
                label: 'Textos auxiliares',
                description: 'Descrições, códigos e informações secundárias.',
              },
              {
                key: 'highlight',
                label: 'Links e destaques',
                description:
                  'Chamadas pequenas, links e palavras em evidência.',
              },
              {
                key: 'primaryText',
                label: 'Texto sobre a cor principal',
                description: 'Letras dos botões e da faixa superior do site.',
              },
            ],
          },
          {
            title: 'Carrossel de segmentos',
            description: 'Ajustes exclusivos da área “Produtos por segmento”.',
            fields: [
              {
                key: 'segmentSectionBackground',
                label: 'Fundo da área de segmentos',
                description: 'Cor sólida atrás de todos os cards de segmentos.',
              },
              {
                key: 'segmentSectionText',
                label: 'Letras dos segmentos',
                description:
                  'Títulos, descrições, ícones e quantidade de produtos.',
              },
              {
                key: 'segmentBorder',
                label: 'Contorno dos cards',
                description: 'Linha que delimita cada card de segmento.',
              },
            ],
          },
          {
            title: 'Carrossel de marcas',
            description: 'Fundo geral da seção e cores dos cards das marcas.',
            fields: [
              {
                key: 'brandSectionBackground',
                label: 'Fundo da área de marcas',
                description:
                  'Cor sólida atrás do carrossel completo de marcas.',
              },
              {
                key: 'brandSectionText',
                label: 'Títulos da área de marcas',
                description:
                  'Título, chamada e controles externos do carrossel.',
              },
              {
                key: 'brandCardBackground',
                label: 'Fundo dos cards das marcas',
                description: 'Cor individual de cada card que contém uma logo.',
              },
              {
                key: 'brandCardText',
                label: 'Letras dentro dos cards',
                description:
                  'Nome da marca, quantidade de produtos e destaque.',
              },
            ],
          },
          {
            title: 'Imagem ou tema de fundo',
            description:
              'Usado no catálogo quando um tema festivo ou imagem de fundo estiver ativo.',
            fields: [
              {
                key: 'themeHeading',
                label: 'Títulos sobre a imagem',
                description: 'Título principal exibido sobre o tema de fundo.',
              },
              {
                key: 'themeText',
                label: 'Textos sobre a imagem',
                description: 'Descrições, filtros e informações sobre o tema.',
              },
            ],
          },
          {
            title: 'Ofertas e produtos novos',
            description:
              'Cores das duas vitrines de produtos exibidas no catálogo público.',
            fields: [
              {
                key: 'offerSectionBackground',
                label: 'Fundo da vitrine de ofertas',
                description: 'Cor sólida atrás dos cards escuros de promoção.',
              },
              {
                key: 'offerSectionText',
                label: 'Título da vitrine de ofertas',
                description: 'Título, chamada e botões externos da promoção.',
              },
              {
                key: 'newSectionBackground',
                label: 'Fundo da vitrine de novidades',
                description:
                  'Cor sólida atrás dos produtos marcados como novos.',
              },
              {
                key: 'newSectionText',
                label: 'Título da vitrine de novidades',
                description: 'Título, chamada e botões externos das novidades.',
              },
            ],
          },
          {
            title: 'Rodapé',
            description: 'Cores da última faixa do site.',
            fields: [
              {
                key: 'footerBackground',
                label: 'Fundo do rodapé',
                description: 'Cor de toda a área inferior do catálogo.',
              },
              {
                key: 'footerText',
                label: 'Letras do rodapé',
                description: 'Logo, texto institucional e direitos autorais.',
              },
            ],
          },
        ];
  const change = (key: keyof CatalogColors, value: string) =>
    onChange({ ...config, colors: { ...colors, [key]: value } });
  const warnings = colorWarnings(config).filter(
    (label) => !themeOnly || label.includes('tema'),
  );
  const previewStyle = {
    background: resolved.themePanel,
    color: resolved.themeText,
  } as CSSProperties;
  return (
    <section className="color-settings">
      <h2>
        {themeOnly
          ? 'Cores e leitura sobre o tema'
          : 'Cores dos textos, cards e rodapé'}
      </h2>
      <p>
        Recomendamos manter em <strong>Automático</strong>: o editor escolhe
        letras claras ou escuras conforme o fundo. Use{' '}
        <strong>Personalizado</strong> somente quando quiser uma cor específica.
      </p>
      <div className="color-groups">
        {groups.map((group) => (
          <section className="color-group" key={group.title}>
            <header>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </header>
            <div className="color-settings-grid">
              {group.fields.map(({ key, label, description }) => (
                <article className="color-setting" key={key}>
                  <div className="color-setting-copy">
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </div>
                  <div className="color-setting-controls">
                    <NativeSelect
                      aria-label={`Modo da cor: ${label}`}
                      value={colors[key] === 'auto' ? 'auto' : 'custom'}
                      onChange={(e) =>
                        change(
                          key,
                          e.target.value === 'auto' ? 'auto' : resolved[key],
                        )
                      }
                    >
                      <option value="auto">Automático</option>
                      <option value="custom">Personalizado</option>
                    </NativeSelect>
                    <Input
                      aria-label={`Escolher cor: ${label}`}
                      type="color"
                      value={resolved[key]}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </div>
                  <small>
                    {colors[key] === 'auto'
                      ? 'Cor calculada: '
                      : 'Cor escolhida: '}
                    {resolved[key].toUpperCase()}
                  </small>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      {warnings.length > 0 && (
        <p role="alert" className="data-warning">
          Pouco contraste em: {warnings.join(', ')}. Escolha uma cor mais
          clara/escura ou volte ao automático.
        </p>
      )}
      <Button
        variant="outline"
        onClick={() =>
          onChange({
            ...config,
            colors: themeOnly
              ? { ...colors, themeText: 'auto', themeHeading: 'auto' }
              : { ...defaultColors },
          })
        }
      >
        Restaurar todas as cores automáticas
      </Button>
      <div
        className="color-preview"
        style={
          themeOnly
            ? previewStyle
            : { background: config.background, color: resolved.text }
        }
      >
        <strong
          style={{
            color: themeOnly ? resolved.themeHeading : resolved.heading,
          }}
        >
          {config.name}
        </strong>
        <p>Produtos e informações do catálogo</p>
        {!themeOnly && (
          <>
            <small style={{ color: resolved.muted }}>
              Descrições e informações complementares
            </small>
            <span
              className="color-preview-button"
              style={{
                background: config.primary,
                color: resolved.primaryText,
              }}
            >
              Explorar produtos
            </span>
            <div className="discovery-color-preview">
              <span
                style={{
                  background: resolved.segmentSectionBackground,
                  color: resolved.segmentSectionText,
                  border: `2px solid ${resolved.segmentBorder}`,
                }}
              >
                Segmento com contorno
              </span>
              <span
                style={{
                  padding: 10,
                  background: resolved.brandSectionBackground,
                  color: resolved.brandSectionText,
                }}
              >
                <span
                  style={{
                    background: resolved.brandCardBackground,
                    color: resolved.brandCardText,
                  }}
                >
                  Card de marca · 12 produtos
                </span>
              </span>
            </div>
            <div
              className="color-preview-footer"
              style={{
                background: resolved.footerBackground,
                color: resolved.footerText,
              }}
            >
              {config.footer || 'Rodapé institucional'}
            </div>
          </>
        )}
      </div>
      <p className="source-note">
        Nos temas e imagens, uma área de leitura protege os textos do fundo. O
        cálculo considera as cores dessa área, não uma média da fotografia.
        Salve para aplicar ao site.
      </p>
    </section>
  );
}
