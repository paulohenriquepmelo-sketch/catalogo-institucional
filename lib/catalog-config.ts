import sourceTaxonomy from './catalog-taxonomy.json';

export type TaxonomyPath = {
  department: string;
  section: string;
  category: string;
};
export type Brand = { name: string; logo: string };
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
  type: 'banners' | 'catalog' | 'segments' | 'brands' | 'text';
  title: string;
  body: string;
  visible: boolean;
};
export type CatalogConfig = {
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
};

export const defaultConfig: CatalogConfig = {
  name: 'NEXO',
  tagline: 'Seu mix completo de atacado e distribuição.',
  logo: '',
  email: '',
  footer:
    'Alimentos, bebidas, bombonieri, embalagens e utilidades para abastecer o seu negócio.',
  primary: '#173b2a',
  accent: '#cb5a3d',
  background: '#f4f1eb',
  font: 'sans',
  autoplay: true,
  interval: 6,
  demo: false,
  taxonomy: sourceTaxonomy.taxonomy,
  brands: sourceTaxonomy.brands,
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
  if (value === '') return '';
  if (value === '/og-wholesale.png') return value;
  if (typeof value !== 'string' || value.length > 2048)
    throw new Error('Endereço de imagem inválido.');
  if (
    /^\/api\/uploads\?key=images%2F[a-f0-9-]+\.(png|jpg|webp|gif)$/i.test(value)
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
        !['banners', 'catalog', 'segments', 'brands', 'text'].includes(b.type)
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
  for (const type of ['banners', 'segments', 'brands'])
    if (config.blocks.filter((b) => b.type === type).length > 1)
      throw new Error('Use apenas um bloco de cada tipo.');
  return config;
}
