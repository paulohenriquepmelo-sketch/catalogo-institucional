import sourceTaxonomy from './catalog-taxonomy.json';
import {
  defaultLayout,
  validateLayout,
  type CatalogLayout,
} from './catalog-layout';
import {
  defaultColors,
  validateColors,
  type CatalogColors,
} from './catalog-colors';
import {
  campaignThemes,
  defaultCampaign,
  type CatalogCampaign,
} from './catalog-campaign';

export type TaxonomyPath = {
  department: string;
  section: string;
  category: string;
};
export type Brand = {
  name: string;
  logo: string;
  published: boolean;
  featured: boolean;
};
export type SegmentRule = { name: string; note: string; keywords: string[] };
export type Banner = {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  visible: boolean;
};
export type Block = {
  id: string;
  type:
    | 'banners'
    | 'catalog'
    | 'offers'
    | 'new-products'
    | 'segments'
    | 'brands'
    | 'text';
  title: string;
  body: string;
  visible: boolean;
};
export type ProductShowcase = {
  published: boolean;
  title: string;
  eyebrow: string;
  layout: 'banner' | 'carousel';
  autoplay: boolean;
  interval: number;
  limit: number;
  days?: number;
};
export type CatalogConfig = {
  layout: CatalogLayout;
  colors: CatalogColors;
  name: string;
  tagline: string;
  logo: string;
  email: string;
  footer: string;
  primary: string;
  accent: string;
  background: string;
  font: 'sans' | 'serif';
  autoplay: boolean;
  interval: number;
  demo: boolean;
  taxonomy: TaxonomyPath[];
  brands: Brand[];
  segments: SegmentRule[];
  banners: Banner[];
  blocks: Block[];
  campaign: CatalogCampaign;
  offers: ProductShowcase;
  newProducts: ProductShowcase;
};

export const defaultOffers: ProductShowcase = {
  published: true,
  title: 'Ofertas por tempo limitado',
  eyebrow: 'Economize agora',
  layout: 'banner',
  autoplay: true,
  interval: 5,
  limit: 12,
};
export const defaultNewProducts: ProductShowcase = {
  published: true,
  title: 'Acabaram de chegar',
  eyebrow: 'Novidades no catálogo',
  layout: 'carousel',
  autoplay: true,
  interval: 5,
  limit: 12,
  days: 30,
};

export const defaultConfig: CatalogConfig = {
  layout: { ...defaultLayout },
  colors: { ...defaultColors },
  campaign: defaultCampaign,
  offers: defaultOffers,
  newProducts: defaultNewProducts,
  name: 'Distribuidora Laurencini',
  tagline: 'Marcas fortes, produtos certos e parceria para o seu negócio.',
  logo: '/distribuidora-laurencini-logo.jpeg',
  email: '',
  footer:
    'Distribuição, variedade e atendimento comercial para fortalecer o seu ponto de venda.',
  primary: '#263f85',
  accent: '#ef312f',
  background: '#f5f7fb',
  font: 'sans',
  autoplay: true,
  interval: 6,
  demo: false,
  taxonomy: sourceTaxonomy.taxonomy,
  brands: sourceTaxonomy.brands.map((brand) => ({
    ...brand,
    published: true,
    featured: false,
  })),
  segments: [
    {
      name: 'Supermercados e mercearias',
      note: 'Itens para o abastecimento diário',
      keywords: [
        'mercearia',
        'biscoitos',
        'massas',
        'santa amalia',
        'farinhas & farofas',
        'sucos',
        'refrigerantes',
        'agua mineral',
        'alimentos',
      ],
    },
    {
      name: 'Restaurantes e lanchonetes',
      note: 'Ingredientes e insumos para food service',
      keywords: [
        'food service',
        'foods service',
        'condimentos',
        'temperos',
        'sache',
        'catchup',
        'maionese',
        'mostarda',
        'banhas',
        'torresmos',
      ],
    },
    {
      name: 'Padarias e confeitarias',
      note: 'Preparo, recheios e finalização',
      keywords: [
        'panificacao',
        'dona benta',
        'cobertura',
        'chantilly',
        'recheio',
        'fermento',
        'confeito',
        'chocolate em po',
        'confeitaria',
      ],
    },
    {
      name: 'Docerias e bombonieres',
      note: 'Doces, chocolates e guloseimas',
      keywords: [
        'bombonieri',
        'balas & drops',
        'chicletes',
        'chocolates',
        'pirulitos',
        'gulozitos',
        'hersheys',
        'barra regular',
        'barra dark',
        'hersheys mix',
        'salgadinhos',
        'pipocas',
        'batata chips',
        'palha art fritas',
      ],
    },
    {
      name: 'Bares e conveniências',
      note: 'Bebidas e itens de conveniência',
      keywords: [
        'bebidas alcoolicas',
        'destilados',
        'vinhos & espumantes',
        'cervejas',
        'energeticos',
      ],
    },
    {
      name: 'Delivery e embalagens',
      note: 'Embalagens para preparo e transporte',
      keywords: [
        'embalagens & eps',
        'descartaveis',
        'sacolas/ bobinas',
        'potes redondo',
        'eps (isopor)',
        'filme pvc',
        'papel aluminio',
      ],
    },
    {
      name: 'Perfumarias e higiene',
      note: 'Cuidados e higiene pessoal',
      keywords: ['higiene & perfumaria', 'higiene pessoal'],
    },
    {
      name: 'Limpeza profissional',
      note: 'Conservação de ambientes e superfícies',
      keywords: [
        'limpeza',
        'detergente',
        'desinfetante',
        'agua sanitaria',
        'multiuso',
      ],
    },
    {
      name: 'Utilidades e bazar',
      note: 'Utensílios e itens para o dia a dia',
      keywords: ['utilidades', 'fogos'],
    },
  ],
  banners: [
    {
      id: 'atacado',
      title: 'O mix certo para o seu negócio.',
      description:
        'Explore nosso catálogo de atacado e distribuição por departamento, segmento e marca.',
      image: '/og-wholesale.png',
      link: '#catalogo',
      visible: true,
    },
    {
      id: 'embalagens',
      title: 'Da prateleira ao delivery.',
      description:
        'Consulte embalagens de venda, unidades master e códigos de cada produto.',
      image: '/og-wholesale.png',
      link: '#catalogo',
      visible: true,
    },
  ],
  blocks: [
    {
      id: 'catalog',
      type: 'catalog',
      title: 'Tudo para abastecer seu negócio.',
      body: 'Produtos de atacado e distribuição, organizados a partir do seu cadastro.',
      visible: true,
    },
    {
      id: 'banners',
      type: 'banners',
      title: 'Em destaque',
      body: '',
      visible: true,
    },
    {
      id: 'offers',
      type: 'offers',
      title: 'Ofertas por tempo limitado',
      body: 'Condições válidas durante o período informado em cada produto.',
      visible: true,
    },
    {
      id: 'new-products',
      type: 'new-products',
      title: 'Acabaram de chegar',
      body: 'Os produtos mais novos do nosso catálogo.',
      visible: true,
    },
    {
      id: 'segments',
      type: 'segments',
      title: 'Produtos por segmento.',
      body: 'Classificação automática por palavras-chave do cadastro, com revisão editorial.',
      visible: true,
    },
    {
      id: 'brands',
      type: 'brands',
      title: 'As marcas do nosso catálogo.',
      body: '',
      visible: true,
    },
  ],
};

export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
export function imageUrl(value: unknown): string {
  if (campaignThemes.some((theme) => theme.image === value))
    return String(value);
  if (value === '') return '';
  if (value === '/og-wholesale.png') return value;
  if (typeof value !== 'string' || value.length > 2048)
    throw new Error('Endereço de imagem inválido.');
  if (
    /^\/api\/uploads\?key=(?:images%2F[a-f0-9-]+\.(?:png|jpg|webp|gif)|pending%2Fproduct-images%2F[a-zA-Z0-9_-]+%2F[a-zA-Z0-9_-]+%2F[a-zA-Z0-9-]+\.webp)$/i.test(
      value,
    )
  )
    return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password)
      return value;
  } catch {
    /* rejected below */
  }
  throw new Error('Use uma imagem enviada ou um endereço HTTPS.');
}
export function safeLink(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048)
    throw new Error('Link inválido.');
  if (/^#[a-z0-9-]+$/i.test(value)) return value;
  if (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\r\n]/.test(value)
  )
    return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password)
      return value;
  } catch {
    /* rejected below */
  }
  throw new Error('Use um link HTTPS ou uma seção como #catalogo.');
}

function field(
  value: unknown,
  label: string,
  max = 300,
  optional = false,
): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (!optional && !value.trim())
  )
    throw new Error(`Revise ${label}.`);
  return value.trim();
}
function list(value: unknown, max: number): any[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error('Quantidade de registros inválida.');
  return value;
}
function validateShowcase(
  value: unknown,
  fallback: ProductShowcase,
  withDays = false,
): ProductShowcase {
  const v = (value ?? fallback) as ProductShowcase;
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('Revise a vitrine de produtos.');
  if (!['banner', 'carousel'].includes(v.layout))
    throw new Error('Escolha banner ou carrossel para a vitrine.');
  if (!Number.isInteger(v.interval) || v.interval < 3 || v.interval > 30)
    throw new Error('A animação deve avançar entre 3 e 30 segundos.');
  if (!Number.isInteger(v.limit) || v.limit < 1 || v.limit > 30)
    throw new Error('Exiba entre 1 e 30 produtos na vitrine.');
  if (withDays && (!Number.isInteger(v.days) || v.days! < 1 || v.days! > 365))
    throw new Error('Considere novidades entre 1 e 365 dias.');
  return {
    published: v.published === true,
    title: field(v.title, 'título da vitrine', 180),
    eyebrow: field(v.eyebrow, 'chamada da vitrine', 100, true),
    layout: v.layout,
    autoplay: v.autoplay === true,
    interval: v.interval,
    limit: v.limit,
    ...(withDays ? { days: v.days } : {}),
  };
}
export function validateConfig(value: unknown): CatalogConfig {
  if (!value || typeof value !== 'object')
    throw new Error('Configuração inválida.');
  const v = value as CatalogConfig;
  for (const key of ['primary', 'accent', 'background'] as const)
    if (!/^#[0-9a-f]{6}$/i.test(v[key])) throw new Error('Cor inválida.');
  if (!Number.isInteger(v.interval) || v.interval < 3 || v.interval > 30)
    throw new Error('Use um intervalo de 3 a 30 segundos.');
  if (v.font !== 'sans' && v.font !== 'serif')
    throw new Error('Fonte inválida.');
  const config: CatalogConfig = {
    layout: validateLayout(v.layout),
    colors: validateColors(v.colors),
    campaign: validateCampaign(v.campaign ?? defaultCampaign),
    offers: validateShowcase(v.offers, defaultOffers),
    newProducts: validateShowcase(v.newProducts, defaultNewProducts, true),
    name: field(v.name, 'nome', 80),
    tagline: field(v.tagline, 'slogan', 250),
    logo: imageUrl(v.logo),
    email: field(v.email, 'e-mail', 254, true),
    footer: field(v.footer, 'rodapé', 1000, true),
    primary: v.primary,
    accent: v.accent,
    background: v.background,
    font: v.font,
    autoplay: v.autoplay === true,
    interval: v.interval,
    demo: v.demo === true,
    brands: list(v.brands, 1000).map((b) => ({
      name: field(b.name, 'marca', 80),
      logo: imageUrl(b.logo),
      published: b.published === true,
      featured: b.featured === true,
    })),
    taxonomy: list(v.taxonomy, 500).map((t) => ({
      department: field(t.department, 'departamento', 80),
      section: field(t.section, 'seção', 80),
      category: field(t.category, 'categoria', 80),
    })),
    segments: list(v.segments, 40).map((s) => ({
      name: field(s.name, 'segmento', 80),
      note: field(s.note, 'descrição', 200, true),
      keywords: [
        ...new Set(
          list(s.keywords, 100)
            .map((w) => field(w, 'palavra-chave', 80, true))
            .filter(Boolean),
        ),
      ],
    })),
    banners: list(v.banners, 30).map((b) => ({
      id: field(b.id, 'identificador', 80),
      title: field(b.title, 'título', 180),
      description: field(b.description, 'texto', 1000, true),
      image: imageUrl(b.image),
      link: safeLink(b.link),
      visible: b.visible === true,
    })),
    blocks: list(v.blocks, 30).map((b) => {
      if (
        ![
          'banners',
          'catalog',
          'offers',
          'new-products',
          'segments',
          'brands',
          'text',
        ].includes(b.type)
      )
        throw new Error('Bloco inválido.');
      return {
        id: field(b.id, 'identificador', 80),
        type: b.type,
        title: field(b.title, 'título', 180),
        body: field(b.body, 'texto', 4000, true),
        visible: b.visible === true,
      };
    }),
  };
  if (config.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email))
    throw new Error('E-mail inválido.');
  const unique = (keys: string[]) => new Set(keys).size === keys.length;
  if (
    !unique(config.brands.map((b) => normalize(b.name))) ||
    !unique(config.segments.map((s) => normalize(s.name))) ||
    !unique(config.blocks.map((b) => b.id)) ||
    !unique(config.banners.map((b) => b.id)) ||
    !unique(config.taxonomy.map((t) => JSON.stringify(t)))
  )
    throw new Error('Existem cadastros duplicados.');
  if (
    config.blocks.filter((b) => b.type === 'catalog').length !== 1 ||
    !config.blocks.find((b) => b.type === 'catalog')?.visible
  )
    throw new Error('Mantenha exatamente um bloco de catálogo visível.');
  if (config.segments.some((s) => normalize(s.name) === 'sem classificacao'))
    throw new Error(
      '“Sem classificação” é reservado aos itens que precisam de revisão.',
    );
  for (const type of [
    'banners',
    'offers',
    'new-products',
    'segments',
    'brands',
  ])
    if (config.blocks.filter((b) => b.type === type).length > 1)
      throw new Error('Use apenas um bloco de cada tipo.');
  return config;
}

export function validateCampaign(value: unknown): CatalogCampaign {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Configuração de campanha inválida.');
  const v = value as CatalogCampaign;
  if (!campaignThemes.some((theme) => theme.id === v.theme))
    throw new Error('Escolha um tema de campanha válido.');
  if (
    !['theme', 'image', 'carousel'].includes(v.mode) ||
    !['hero', 'catalog'].includes(v.scope) ||
    !['center', 'top', 'bottom'].includes(v.position)
  )
    throw new Error('Revise o formato e a posição do fundo.');
  if (!Number.isInteger(v.interval) || v.interval < 3 || v.interval > 30)
    throw new Error('O carrossel deve avançar a cada 3 a 30 segundos.');
  if (!Number.isFinite(v.overlay) || v.overlay < 0 || v.overlay > 70)
    throw new Error('A camada de clareamento deve ficar entre 0 e 70%.');
  if (!Array.isArray(v.slides) || v.slides.length > 12)
    throw new Error('Use até 12 imagens no carrossel de fundo.');
  const slides = v.slides.map((s) => {
    if (!s || typeof s !== 'object')
      throw new Error('Banner de campanha inválido.');
    return {
      id: field(s.id, 'identificador do banner', 80),
      image: imageUrl(s.image),
      title: field(s.title, 'título do banner', 180),
      description: field(s.description, 'texto do banner', 1000, true),
      link: safeLink(s.link),
      button: field(s.button, 'texto do botão', 45),
      visible: s.visible === true,
    };
  });
  if (new Set(slides.map((slide) => slide.id)).size !== slides.length)
    throw new Error('Existem banners de campanha duplicados.');
  const result: CatalogCampaign = {
    enabled: v.enabled === true,
    theme: v.theme,
    mode: v.mode,
    scope: v.scope,
    image: imageUrl(v.image),
    eyebrow: field(v.eyebrow, 'chamada da campanha', 100, true),
    title: field(v.title, 'título da campanha', 180),
    description: field(v.description, 'texto da campanha', 1000, true),
    button: field(v.button, 'texto do botão', 45),
    link: safeLink(v.link),
    showStats: v.showStats === true,
    autoplay: v.autoplay === true,
    interval: v.interval,
    overlay: v.overlay,
    position: v.position,
    slides,
  };
  if (result.enabled && result.mode === 'image' && !result.image)
    throw new Error('Envie uma imagem para o fundo da campanha.');
  if (
    result.enabled &&
    result.mode === 'carousel' &&
    !result.slides.some((slide) => slide.visible && slide.image)
  )
    throw new Error(
      'Adicione ao menos um banner visível com imagem ao carrossel.',
    );
  if (
    result.enabled &&
    result.mode === 'carousel' &&
    result.slides.some((slide) => slide.visible && !slide.image)
  )
    throw new Error(
      'Envie a imagem dos banners visíveis ou oculte os banners incompletos.',
    );
  return result;
}

