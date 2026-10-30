'use client';
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages -- Logo, fotos e logos de marca já são enviados otimizados (WebP); o site navega com links comuns, como o restante do catálogo. */
import {
  createElement,
  useEffect,
  useDeferredValue,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Headset,
  Mail,
  Menu,
  MessageCircle,
  Package,
  Pause,
  Phone,
  Play,
  Search,
  Settings2,
  Star,
  Truck,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  whatsappNumber,
  type Brand,
  type CatalogConfig,
  type ProductShowcase,
} from '@/lib/catalog-config';
import { publishedBrands } from '@/lib/catalog-brands';
import { buildSegments, segmentPhoto, type Segment } from '@/lib/segments';
import { isRestrictedProduct } from '@/lib/restricted-products';
import { CATALOG_NOTICE, OFFERS_NOTICE } from '@/lib/catalog-notices';
import { PRIVACY_PATH, privacyPolicyReady } from '@/lib/privacy-policy';
import { segmentIconById } from '@/lib/segment-icons';
import { campaignSlides } from '@/lib/catalog-campaign';
import { CollectionProducts } from './collection-products';
import { CatalogPdfLink } from './catalog-pdf-download';
import { AllBrandsList } from './all-brands-dialog';
import { ProductCard } from './product-card';
import {
  selectActiveOffers,
  selectNewProducts,
} from './product-showcase-carousel';
import { catalogDateKey, type Product } from '@/lib/catalog-data';
import { discover, emptyFilters } from '@/lib/catalog-discovery';

// Layout institucional da página inicial e do catálogo completo, conforme o
// esboço aprovado em 27/10/2026. Os temas de data usam este mesmo layout;
// app/theme-v4.css veste cada seção e este mapa traz os textos de cada tema.
const themeCopy = {
  natal: { topbar: 'Natal na Distribuidora Laurencini', offers: 'Seleção de Natal' },
  'ano-novo': {
    topbar: 'Ano Novo, mais oportunidades para o seu negócio!',
    offers: 'Seleção de Ano Novo',
    // Ano padrão do banner; o editor pode trocar em "Ano em destaque".
    year: '2026',
  },
  'dia-das-maes': {
    topbar: 'Dia das Mães: carinho em cada escolha',
    offers: 'Seleção para as mães',
  },
  aniversario: {
    topbar: 'Celebramos nossa história com você',
    offers: 'Seleção de Aniversário',
  },
  carnaval: {
    topbar: 'O Carnaval chegou na Distribuidora Laurencini!',
    offers: 'Seleção de Carnaval',
  },
  'dia-das-criancas': {
    topbar: 'Dia das Crianças: mais sorrisos para o seu negócio',
    offers: 'Seleção para as crianças',
  },
  'black-friday': {
    topbar: 'Black Friday na Distribuidora Laurencini',
    offers: 'Seleção Black Friday',
  },
} as const;

type SeasonalThemeId = keyof typeof themeCopy;

function isSeasonalThemeId(value: unknown): value is SeasonalThemeId {
  return typeof value === 'string' && Object.hasOwn(themeCopy, value);
}

/** Tema de data ativo (fora o Padrão) e os textos dele. */
function activeSeasonalTheme(config?: CatalogConfig) {
  const campaign = config?.campaign;
  if (!campaign?.enabled || campaign.mode !== 'theme' || !isSeasonalThemeId(campaign.theme))
    return undefined;
  return { campaign, copy: themeCopy[campaign.theme] };
}

/** Divide o título do banner em [antes, destaque, depois]: o destaque sai na
 * cor do tema. Com " | ", o destaque vai do primeiro " | " ao segundo (ou ao
 * fim). Sem ele, uma quebra de linha, o primeiro ". " ou ", " separam; sem
 * separador, o título fica inteiro. */
export function splitThemeTitle(title: string): [string, string?, string?] {
  const bars = title.split(' | ').map((part) => part.trim());
  if (bars.length > 1 && bars[0] && bars[1])
    return [bars[0], bars[1], bars.slice(2).join(' ') || undefined];
  for (const sep of [/\r?\n/, /\. /, /, /]) {
    const m = sep.exec(title);
    if (!m) continue;
    const keep = m[0].startsWith('.') || m[0].startsWith(',') ? m[0][0] : '';
    const first = (title.slice(0, m.index) + keep).trim();
    const second = title.slice(m.index + m[0].length).trim();
    if (first && second) return [first, second];
  }
  return [title];
}

/** Ícone do tema (desenhado pelo CSS). */
function ThemeMark() {
  return <span className="td-theme-mark" aria-hidden="true" />;
}

const rcaMessage =
  'Olá! Quero saber qual é o RCA (representante comercial) que atende a minha região. Minha cidade é: ';

/** Link do RCA com a cidade já na mensagem: WhatsApp comercial ou, sem ele,
 * e-mail. Vazio quando não há nenhum dos dois cadastrado. */
export function rcaLink(
  config: Pick<CatalogConfig, 'whatsapp' | 'email'>,
  city = '',
) {
  const text = rcaMessage + city.trim().slice(0, 80);
  if (config.whatsapp)
    return `https://wa.me/${whatsappNumber(config.whatsapp)}?text=${encodeURIComponent(text)}`;
  if (config.email)
    return `mailto:${config.email}?subject=${encodeURIComponent('RCA da minha região')}&body=${encodeURIComponent(text)}`;
  return '';
}

/** Botão do RCA: pergunta a cidade numa caixa e então abre o WhatsApp (ou o
 * e-mail) com a mensagem pronta. */
export function RcaButton({
  config,
  className,
  children,
}: {
  config: CatalogConfig;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('');
  if (!rcaLink(config)) return null;
  const viaWhatsapp = Boolean(config.whatsapp);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="v2-rca-dialog">
          <DialogHeader>
            <DialogTitle>Qual é a sua cidade?</DialogTitle>
            <DialogDescription>
              Informe a cidade para indicarmos o representante comercial (RCA)
              que atende a sua região.{' '}
              {viaWhatsapp
                ? 'Ao enviar, abrimos o WhatsApp (serviço externo) com a mensagem pronta; a cidade não fica guardada no site.'
                : 'Ao enviar, abrimos o seu e-mail com a mensagem pronta; a cidade não fica guardada no site.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="v2-rca-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!city.trim()) return;
              const href = rcaLink(config, city);
              if (viaWhatsapp) {
                // Sem "noopener" nas opções: com ele o navegador devolve null
                // mesmo abrindo a aba. O vínculo é cortado logo em seguida.
                const tab = window.open(href, '_blank');
                if (tab) tab.opener = null;
                else window.location.href = href;
              } else window.location.href = href;
              setOpen(false);
              setCity('');
            }}
          >
            <label htmlFor="v2-rca-city">Cidade</label>
            <input
              id="v2-rca-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex.: Vitória"
              autoComplete="address-level2"
              maxLength={80}
              required
            />
            <button type="submit" disabled={!city.trim()}>
              <MessageCircle aria-hidden="true" />
              {viaWhatsapp ? 'Enviar no WhatsApp' : 'Enviar por e-mail'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function contactLinks(config: CatalogConfig) {
  const whatsapp = config.whatsapp
    ? `https://wa.me/${whatsappNumber(config.whatsapp)}`
    : '';
  return {
    whatsapp,
    rca: rcaLink(config),
    phone: config.phone ? `tel:+${whatsappNumber(config.phone)}` : '',
    email: config.email ? `mailto:${config.email}` : '',
  };
}

export function SiteTopbar({ config }: { config: CatalogConfig }) {
  const links = contactLinks(config);
  const seasonal = activeSeasonalTheme(config);
  return (
    <div className="v2-topbar">
      <div className="v2-container v2-topbar-inner">
        <span className="v2-topbar-message">
          {seasonal && <ThemeMark />}
          {seasonal?.copy.topbar ||
            'Qualidade, variedade e atendimento para o seu negócio.'}
        </span>
        <div className="v2-topbar-contacts">
          {config.phone && (
            <a href={links.phone} className="v2-topbar-secondary">
              <Phone aria-hidden="true" /> {config.phone}
            </a>
          )}
          {config.email && (
            <a href={links.email} className="v2-topbar-secondary">
              <Mail aria-hidden="true" /> {config.email}
            </a>
          )}
          <RcaButton config={config} className="v2-topbar-rca">
            <MessageCircle aria-hidden="true" /> Fale com o RCA da sua região
          </RcaButton>
        </div>
      </div>
    </div>
  );
}

export type NavKey = 'inicio' | 'catalogo';

const SUGGESTIONS = 8;

/** Busca do topo: mostra os produtos enquanto a pessoa digita (a partir de
 * 2 letras). Clique ou Enter num item abre a ficha; Enter sem item
 * escolhido leva ao catálogo filtrado. */
function HeaderSearch({
  initialQuery,
  products,
  onSearch,
  onOpenProduct,
}: {
  initialQuery: string;
  products: Product[];
  onSearch: (query: string) => void;
  onOpenProduct: (product: Product) => void;
}) {
  // A busca ativa chega como valor inicial (o pai troca a key ao mudar).
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Digitar fica fluido: a lista acompanha o texto logo em seguida.
  const deferred = useDeferredValue(query.trim());
  const found = useMemo(
    () =>
      deferred.length >= 2
        ? discover(products, { ...emptyFilters, query: deferred })
        : [],
    [products, deferred],
  );
  const shown = found.slice(0, SUGGESTIONS);
  const visible = open && deferred.length >= 2;
  function choose(product: Product) {
    setOpen(false);
    setActive(-1);
    onOpenProduct(product);
  }
  return (
    <form
      aria-label="Buscar no catálogo"
      className="v2-search"
      onSubmit={(e) => {
        e.preventDefault();
        if (visible && active >= 0 && shown[active]) {
          choose(shown[active]);
          return;
        }
        setOpen(false);
        onSearch(query.trim());
      }}
    >
      <Search className="v2-search-icon" aria-hidden="true" />
      <label htmlFor="v2-search-input" className="sr-only">
        Buscar produtos
      </label>
      <input
        id="v2-search-input"
        type="search"
        aria-controls="v2-search-list"
        aria-describedby={visible ? 'v2-search-count' : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Fecha só quando o foco sai da busca (não ao clicar na lista).
          if (!e.currentTarget.form?.contains(e.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setActive(-1);
          } else if (e.key === 'ArrowDown' && shown.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % shown.length);
          } else if (e.key === 'ArrowUp' && shown.length) {
            e.preventDefault();
            setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
          }
        }}
        placeholder="Buscar por produto, marca ou código…"
        autoComplete="off"
        enterKeyHint="search"
      />
      <button type="submit" aria-label="Buscar">
        <ArrowRight aria-hidden="true" />
      </button>
      {visible && (
        <div className="v2-suggest">
          <output id="v2-search-count" className="sr-only">
            {found.length}{' '}
            {found.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
          </output>
          <ul id="v2-search-list" aria-label="Produtos encontrados">
            {shown.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={i === active ? 'is-active' : undefined}
                  aria-current={i === active ? 'true' : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(p)}
                  onMouseEnter={() => setActive(i)}
                >
                <span className="v2-suggest-thumb">
                  {p.image ? (
                    <img src={p.image} alt="" loading="lazy" />
                  ) : (
                    <Package aria-hidden="true" />
                  )}
                </span>
                <span className="v2-suggest-text">
                  <strong>{p.name}</strong>
                  <small>
                    Código {p.code}
                    {p.brand ? ` · ${p.brand}` : ''}
                  </small>
                </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length ? (
            <button
              type="submit"
              className="v2-suggest-all"
              onMouseDown={(e) => e.preventDefault()}
            >
              Ver todos os {found.length}{' '}
              {found.length === 1 ? 'resultado' : 'resultados'} no catálogo
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <p className="v2-suggest-empty">
              Nenhum produto encontrado para “{deferred}”.
            </p>
          )}
        </div>
      )}
    </form>
  );
}

export function SiteHeader({
  config,
  current,
  hasSegments,
  hasBrands,
  hasOffers,
  showEditorLink,
  onSearch,
  initialQuery = '',
  products,
  onOpenProduct,
}: {
  config: CatalogConfig;
  current: NavKey;
  hasSegments: boolean;
  hasBrands: boolean;
  hasOffers: boolean;
  showEditorLink: boolean;
  onSearch: (query: string) => void;
  initialQuery?: string;
  products: Product[];
  onOpenProduct: (product: Product) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const home = current === 'inicio' ? '' : '/';
  const items: [string, string, boolean][] = [
    ['Início', current === 'inicio' ? '#inicio' : '/', current === 'inicio'],
    ['Catálogo', '/produtos', current === 'catalogo'],
    ...(hasSegments
      ? [['Segmentos', `${home}#segmentos`, false] as [string, string, boolean]]
      : []),
    ...(hasBrands
      ? [['Marcas', `${home}#marcas`, false] as [string, string, boolean]]
      : []),
    ...(hasOffers
      ? [['Ofertas', `${home}#ofertas`, false] as [string, string, boolean]]
      : []),
    ['Contato', '#contato', false],
  ];
  return (
    <header className="v2-header">
      <div className="v2-container v2-header-inner">
        <a
          href={current === 'inicio' ? '#inicio' : '/'}
          className="v2-logo"
          aria-label={`${config.name} — início`}
        >
          <img
            src={config.logo || '/distribuidora-laurencini-logo.jpeg'}
            alt={config.name}
          />
        </a>
        <nav
          aria-label="Principal"
          id="v2-menu"
          className={menuOpen ? 'v2-nav is-open' : 'v2-nav'}
        >
          {items.map(([label, href, active]) => (
            <a
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={active ? 'is-active' : undefined}
            >
              {label}
            </a>
          ))}
          <a
            href="/api/app-download"
            download
            className="v2-nav-download"
            title="Baixe o app do catálogo (Android)"
            onClick={() => setMenuOpen(false)}
          >
            <Download aria-hidden="true" />
            <span className="download-label">Baixe o app</span>
          </a>
          <CatalogPdfLink className="v2-nav-download" label="Baixar catálogo" />
          {showEditorLink && (
            <a href="/editor" className="v2-editor-link">
              <Settings2 aria-hidden="true" /> Editor
            </a>
          )}
        </nav>
        <HeaderSearch
          initialQuery={initialQuery}
          products={products}
          onSearch={onSearch}
          onOpenProduct={onOpenProduct}
        />
        <button
          type="button"
          className="v2-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="v2-menu"
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}

export function HomeHero({ config }: { config: CatalogConfig }) {
  // Foto institucional real: a imagem do banner cadastrada no editor.
  const photo = config.campaign?.enabled
    ? campaignSlides(config.campaign).find((s) => s.image)?.image
    : '';
  // Tema de data ativo: a arte do tema cobre o banner e os textos vêm do editor.
  const seasonal = activeSeasonalTheme(config);
  const theme = seasonal?.campaign;
  // Ano do tema Ano Novo: o do editor; sem ele, o padrão de themeCopy.
  const editorYear = typeof theme?.year === 'string' ? theme.year.trim() : '';
  const year =
    seasonal && 'year' in seasonal.copy
      ? editorYear || seasonal.copy.year
      : '';
  const eyebrow = theme?.eyebrow.trim();
  const title = theme?.title.trim();
  const description = theme?.description.trim();
  const [titleFirst, titleSecond, titleRest] = splitThemeTitle(title || '');
  // A animação do tema não para sozinha: o botão deixa pausar.
  const [paused, setPaused] = useState(false);
  return (
    <section
      className={`v2-hero${theme ? ' is-theme' : ''}${paused ? ' is-paused' : ''}`}
      aria-labelledby="v2-hero-title"
    >
      <div className="v2-hero-media" aria-hidden="true">
        {photo && <img src={photo} alt="" fetchPriority="high" />}
        {theme && (
          <span className="td-hero-decor">
            {Array.from({ length: 10 }, (_, i) => (
              <span className="td-particle" key={i} />
            ))}
            <span className="td-ornament" />
            {year && (
              // Texto de verdade (editável), desenhado como números dourados
              // em 3D; data-year alimenta a camada de volume no CSS.
              <span className="td-hero-year" data-year={year}>
                <span>{year}</span>
              </span>
            )}
          </span>
        )}
      </div>
      <div className="v2-container v2-hero-inner">
        <div className="v2-hero-copy">
          <span className="v2-hero-eyebrow">
            {theme && <ThemeMark />}
            {eyebrow || 'Distribuidora Laurencini'}
          </span>
          {title ? (
            <h2 id="v2-hero-title">
              {titleFirst}
              {titleSecond && (
                <>
                  {' '}
                  <span className="v2-hero-title-accent">{titleSecond}</span>
                </>
              )}
              {titleRest && <> {titleRest}</>}
            </h2>
          ) : (
            <h2 id="v2-hero-title">
              Há mais de 30 anos{' '}
              <span className="v2-hero-line">
                atendendo o <span className="v2-red">seu negócio.</span>
              </span>
            </h2>
          )}
          <p>
            {description ||
              'Com um portfólio completo, trabalhamos para levar qualidade, variedade e as melhores marcas para o seu estabelecimento.'}
          </p>
          <a className="v2-button v2-button-red" href="/produtos">
            Conheça nosso catálogo <ArrowRight aria-hidden="true" />
            {theme && <span className="td-cta-shine" aria-hidden="true" />}
          </a>
        </div>
      </div>
      {theme && (
        <button
          type="button"
          className="v2-hero-pause"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {paused ? 'Retomar animação' : 'Pausar animação'}
        </button>
      )}
    </section>
  );
}

const benefits = [
  { icon: Truck, title: 'Entrega rápida', text: '' },
  { icon: BadgeCheck, title: 'Produtos de qualidade', text: 'Das melhores marcas' },
  { icon: Star, title: 'Condições especiais', text: 'Para o seu negócio' },
  { icon: Headset, title: 'Atendimento especializado', text: 'E suporte sempre' },
];

export function HomeBenefits() {
  return (
    <section className="v2-benefits" aria-label="Nossos diferenciais">
      <ul className="v2-container v2-benefits-grid">
        {benefits.map(({ icon: Icon, title, text }) => (
          <li key={title} className="v2-benefit">
            <span className="v2-benefit-icon">
              <Icon aria-hidden="true" />
            </span>
            <span>
              <strong>{title}</strong>
              {text && <small>{text}</small>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SegmentCard({
  segment,
  image,
  onOpen,
}: {
  segment: Segment;
  image?: string;
  onOpen: (segment: Segment) => void;
}) {
  const icon = segmentIconById(segment.rule.icon, segment.rule.name);
  return (
    <button
      type="button"
      className="v2-segment-card"
      onClick={() => onOpen(segment)}
      aria-label={`Ver produtos do segmento ${segment.rule.name}`}
    >
      <span className={image ? 'v2-segment-media' : 'v2-segment-media is-icon'}>
        {image ? (
          <img src={image} alt="" loading="lazy" />
        ) : (
          createElement(icon, { 'aria-hidden': true })
        )}
      </span>
      <span className="v2-segment-body">
        <span className="v2-segment-badge" aria-hidden="true">
          {createElement(icon)}
        </span>
        <strong>{segment.rule.name}</strong>
        <small>{segment.rule.note}</small>
        <span className="v2-segment-more" aria-hidden="true">
          {segment.products.length} produtos <ArrowRight />
        </span>
      </span>
    </button>
  );
}

export function HomeSegments({
  items,
  config,
  style,
}: {
  items: Product[];
  config: CatalogConfig;
  style?: CSSProperties;
}) {
  const segments = useMemo(
    () =>
      buildSegments(items).filter(
        (s) => !s.rule.hidden && s.products.length > 0,
      ),
    [items],
  );
  const [selected, setSelected] = useState<Segment | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!segments.length) return null;
  return (
    <section id="segmentos" className="v2-segments" aria-labelledby="v2-segments-title">
      <div className="v2-container v2-segments-inner">
        <div className="v2-segments-intro">
          <span className="v2-eyebrow">
            <ThemeMark />
            Nossos segmentos
          </span>
          <h2 id="v2-segments-title">Conheça nossos segmentos</h2>
          <p>Atendemos diversos segmentos com um mix completo de produtos.</p>
          {segments.length > 4 && (
            <button
              type="button"
              className="v2-button v2-button-red v2-button-small"
              onClick={() => setShowAll(true)}
            >
              Ver todos os segmentos <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="v2-segments-grid">
          {segments.slice(0, 4).map((s) => (
            <SegmentCard
              key={s.rule.id}
              segment={s}
              image={segmentPhoto(s.rule.id, config.segmentImages)}
              onOpen={setSelected}
            />
          ))}
        </div>
      </div>
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="v2-dialog v2-all-segments" style={style}>
          <DialogHeader>
            <DialogTitle>Todos os segmentos</DialogTitle>
            <DialogDescription>
              {segments.length} segmentos atendidos. Escolha um para ver os
              produtos.
            </DialogDescription>
          </DialogHeader>
          <div className="v2-all-segments-grid">
            {segments.map((s) => (
              <SegmentCard
                key={s.rule.id}
                segment={s}
                image={segmentPhoto(s.rule.id, config.segmentImages)}
                onOpen={(next) => {
                  setShowAll(false);
                  setSelected(next);
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        {selected && (
          <CollectionProducts
            key={selected.rule.id}
            kind="segment"
            name={selected.rule.name}
            items={items}
            groups={selected.groups}
            contact={config}
            style={style}
            modern
          />
        )}
      </Dialog>
    </section>
  );
}

// Carrossel dos painéis azuis (marcas e novidades): setas nas laterais e
// bolinhas embaixo, um grupo de cartões por vez.
function PanelCarousel({
  label,
  itemClass,
  loop,
  children,
}: {
  label: string;
  itemClass: string;
  loop: boolean;
  children: ReactNode[];
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [snap, setSnap] = useState(0);
  const [snaps, setSnaps] = useState(0);
  useEffect(() => {
    if (!api) return;
    const update = () => {
      setSnap(api.selectedScrollSnap());
      setSnaps(api.scrollSnapList().length);
    };
    update();
    api.on('select', update);
    api.on('reInit', update);
    return () => {
      api.off('select', update);
      api.off('reInit', update);
    };
  }, [api]);
  return (
    <>
      <Carousel
        className="v2-panel-carousel"
        setApi={setApi}
        opts={{ align: 'start', slidesToScroll: 'auto', loop }}
        aria-label={`Carrossel de ${label}`}
      >
        <button
          type="button"
          className="v2-carousel-arrow is-prev"
          onClick={() => api?.scrollPrev()}
          aria-label={`Voltar ${label}`}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <CarouselContent className="v2-panel-track">
          {children.map((child, i) => (
            <CarouselItem key={i} className={itemClass}>
              {child}
            </CarouselItem>
          ))}
        </CarouselContent>
        <button
          type="button"
          className="v2-carousel-arrow is-next"
          onClick={() => api?.scrollNext()}
          aria-label={`Avançar ${label}`}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </Carousel>
      {snaps > 1 && (
        <div className="v2-dots">
          {Array.from({ length: snaps }, (_, i) => (
            <button
              key={i}
              type="button"
              className={i === snap ? 'is-active' : undefined}
              aria-label={`Ir para o grupo ${i + 1} de ${snaps}`}
              aria-current={i === snap ? 'true' : undefined}
              onClick={() => api?.scrollTo(i)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Painel de vitrine (novidades e ofertas): mesmo formato do painel das
// marcas, com cartões de produto do tamanho da grade.
function ShowcasePanel({
  id,
  tone,
  eyebrow,
  title,
  label,
  products,
  badge,
  onOpen,
  note,
}: {
  id: string;
  tone: 'blue' | 'red';
  eyebrow: string;
  title: string;
  label: string;
  products: Product[];
  badge: (product: Product) => string;
  onOpen: (product: Product) => void;
  note?: string;
}) {
  return (
    <section
      id={id}
      className="v2-brands-wrap v2-new-wrap"
      aria-labelledby={`${id}-title`}
    >
      <div className="v2-container">
        <div className={`v2-brands v2-new${tone === 'red' ? ' v2-offers' : ''}`}>
          <div className="v2-brands-head">
            <div>
              <span className="v2-eyebrow v2-eyebrow-light">{eyebrow}</span>
              <h2 id={`${id}-title`}>{title}</h2>
            </div>
          </div>
          <PanelCarousel
            label={label}
            itemClass="v2-new-item"
            loop={products.length > 6}
          >
            {products.map((product) => (
              <div className="v2-new-card" key={product.id}>
                <span className="v2-new-badge">
                  <span className="td-badge-icon" aria-hidden="true" />
                  {badge(product)}
                </span>
                <ProductCard product={product} onOpen={onOpen} />
              </div>
            ))}
          </PanelCarousel>
          {note && <p className="v2-panel-note">{note}</p>}
        </div>
      </div>
    </section>
  );
}

export function NewProductsPanel({
  settings,
  items,
  onOpen,
}: {
  settings: ProductShowcase;
  items: Product[];
  onOpen: (product: Product) => void;
}) {
  const shown = useMemo(
    () => (settings.published ? selectNewProducts(items, settings) : []),
    [items, settings],
  );
  if (!shown.length) return null;
  return (
    <ShowcasePanel
      id="novidades"
      tone="blue"
      eyebrow={settings.eyebrow || 'Novidades no catálogo'}
      title={settings.title}
      label="novidades"
      products={shown}
      badge={() => 'Novo'}
      onOpen={onOpen}
    />
  );
}

const shortDate = (date: string) => date.split('-').reverse().slice(0, 2).join('/');

// Ofertas: só aparece com oferta ativa (cadastrada no editor, dentro do
// período). O selo mostra o desconto e o último dia da oferta.
export function OffersPanel({
  settings,
  items,
  onOpen,
  config,
}: {
  settings: ProductShowcase;
  items: Product[];
  onOpen: (product: Product) => void;
  config?: CatalogConfig;
}) {
  const seasonal = activeSeasonalTheme(config);
  const shown = useMemo(
    () =>
      settings.published
        ? selectActiveOffers(items, catalogDateKey(), settings.limit)
        : [],
    [items, settings],
  );
  if (!shown.length) return null;
  return (
    <ShowcasePanel
      id="ofertas"
      tone="red"
      eyebrow={settings.eyebrow || 'Economize agora'}
      title={seasonal?.copy.offers ?? settings.title}
      label="ofertas"
      products={shown}
      badge={(product) => {
        const offer = product.details?.offer;
        if (!offer) return 'Oferta';
        return `${offer.discount}% OFF · até ${shortDate(offer.endsAt)}`;
      }}
      note={OFFERS_NOTICE}
      onOpen={onOpen}
    />
  );
}

export function HomeBrands({
  items,
  config,
  style,
}: {
  items: Product[];
  config: CatalogConfig;
  style?: CSSProperties;
}) {
  const visible = publishedBrands(config.brands);
  // Destaques com logo primeiro; sem destaques, as marcas com logo.
  const withLogo = visible.filter((b) => b.logo);
  const featured = withLogo.filter((b) => b.featured);
  const shown = featured.length ? featured : withLogo.slice(0, 18);
  const counts = useMemo(
    () =>
      items.reduce<Record<string, number>>((a, p) => {
        a[p.brand] = (a[p.brand] ?? 0) + 1;
        return a;
      }, {}),
    [items],
  );
  const [selected, setSelected] = useState<Brand | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!visible.length) return null;
  return (
    <section id="marcas" className="v2-brands-wrap" aria-labelledby="v2-brands-title">
      <div className="v2-container">
        <div className="v2-brands">
          <div className="v2-brands-head">
            <div>
              <span className="v2-eyebrow v2-eyebrow-light">Marcas</span>
              <h2 id="v2-brands-title">Marcas que comercializamos</h2>
              <p>
                Trabalhamos com uma ampla variedade de produtos de marcas
                reconhecidas no mercado, oferecendo qualidade e opções para
                abastecer o seu negócio.
              </p>
            </div>
            <button
              type="button"
              className="v2-link-light"
              onClick={() => setShowAll(true)}
            >
              Ver todas as marcas <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <PanelCarousel
            label="marcas"
            itemClass="v2-brand-item"
            loop={shown.length > 6}
          >
            {shown.map((b) => (
              <button
                key={b.name}
                type="button"
                className="v2-brand-card"
                onClick={() => setSelected(b)}
                aria-label={`Ver produtos da marca ${b.name}`}
              >
                <img src={b.logo} alt={b.name} loading="lazy" />
              </button>
            ))}
          </PanelCarousel>
        </div>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        {selected && (
          <CollectionProducts
            key={selected.name}
            kind="brand"
            name={selected.name}
            logo={selected.logo}
            items={items}
            contact={config}
            style={style}
            modern
          />
        )}
      </Dialog>
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent
          className="all-brands-dialog v2-dialog-products"
          style={style}
        >
          <DialogHeader>
            <DialogTitle>Todas as marcas</DialogTitle>
            <DialogDescription>
              Pesquise uma marca e veja os produtos dela no catálogo.
            </DialogDescription>
          </DialogHeader>
          <AllBrandsList
            brands={config.brands}
            items={items}
            counts={counts}
            contact={config}
            style={style}
            modern
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function HomeFeatured({
  items,
  onOpen,
}: {
  items: Product[];
  onOpen: (product: Product) => void;
}) {
  // A lista já vem com os destaques primeiro; aqui só entram itens com foto.
  const shown = useMemo(
    () => items.filter((p) => p.image && !isRestrictedProduct(p)).slice(0, 12),
    [items],
  );
  if (!shown.length) return null;
  return (
    <section id="catalogo" className="v2-featured" aria-labelledby="v2-featured-title">
      <div className="v2-container">
        <div className="v2-section-head">
          <div>
            <span className="v2-eyebrow">Destaques do catálogo</span>
            <h2 id="v2-featured-title">Produtos em destaque</h2>
            <p>Confira alguns dos produtos que fazem parte do nosso catálogo.</p>
          </div>
          <a className="v2-button v2-button-outline" href="/produtos">
            Ver todo o catálogo <ArrowRight aria-hidden="true" />
          </a>
        </div>
        <div className="v2-product-grid">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContactBand({ config }: { config: CatalogConfig }) {
  const links = contactLinks(config);
  const photo = config.campaign?.enabled
    ? campaignSlides(config.campaign).find((s) => s.image)?.image
    : '';
  const main = links.whatsapp || links.email || links.phone;
  return (
    <section id="contato" className="v2-contact-wrap" aria-labelledby="v2-contact-title">
      <div className="v2-container">
        <div className="v2-contact">
          {photo && (
            <div className="v2-contact-photo" aria-hidden="true">
              <img src={photo} alt="" loading="lazy" />
            </div>
          )}
          <div className="v2-contact-main">
            <span className="v2-contact-icon" aria-hidden="true">
              <Headset />
            </span>
            <div>
              <h2 id="v2-contact-title">Fale com a nossa equipe</h2>
              <p>
                Tire suas dúvidas, solicite condições comerciais e conheça mais
                sobre nossos produtos.
              </p>
              {main && (
                <a
                  className="v2-button v2-button-red v2-button-small"
                  href={main}
                  {...(main.startsWith('https:')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  Fale com a gente <ArrowRight aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
          <ul className="v2-contact-list">
            {config.whatsapp && (
              <li>
                <MessageCircle aria-hidden="true" />
                <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">
                  <strong>{config.whatsapp}</strong>
                  <small>WhatsApp</small>
                </a>
              </li>
            )}
            {config.phone && (
              <li>
                <Phone aria-hidden="true" />
                <a href={links.phone}>
                  <strong>{config.phone}</strong>
                  <small>Telefone</small>
                </a>
              </li>
            )}
            {config.email && (
              <li>
                <Mail aria-hidden="true" />
                <a href={links.email}>
                  <strong>{config.email}</strong>
                  <small>E-mail</small>
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Aviso do rodapé: o site é catálogo informativo, não loja. */
export function CatalogNotice({ className }: { className?: string }) {
  return (
    <div className={className}>
      <strong>Catálogo digital informativo</strong>
      <p>{CATALOG_NOTICE}</p>
    </div>
  );
}

/** Razão social, CNPJ e endereço, quando cadastrados no editor. */
export function companyIdentity(config: CatalogConfig) {
  return [
    config.legalName,
    config.cnpj && `CNPJ ${config.cnpj}`,
    config.address,
  ].filter(Boolean).join(' · ');
}

export function SiteFooter({
  config,
  current,
  hasSegments,
  hasBrands,
  hasOffers,
}: {
  config: CatalogConfig;
  current: NavKey;
  hasSegments: boolean;
  hasBrands: boolean;
  hasOffers: boolean;
}) {
  const links = contactLinks(config);
  const home = current === 'inicio' ? '' : '/';
  return (
    <footer className="v2-footer">
      <div className="v2-container v2-footer-grid">
        <div className="v2-footer-brand">
          <a
            href={current === 'inicio' ? '#inicio' : '/'}
            className="v2-footer-logo"
            aria-label={`${config.name} — início`}
          >
            <img
              src={config.logo || '/distribuidora-laurencini-logo.jpeg'}
              alt={config.name}
            />
          </a>
          {config.footer && <p>{config.footer}</p>}
        </div>
        <nav className="v2-footer-col" aria-label="Institucional">
          <strong>Institucional</strong>
          <a href="#contato">Fale conosco</a>
          <RcaButton config={config} className="v2-footer-link">
            Qual é o RCA da minha região?
          </RcaButton>
        </nav>
        {(config.whatsapp || config.phone || config.email) && (
          <div className="v2-footer-col v2-footer-contact">
            <strong>Atendimento</strong>
            {config.whatsapp && (
              <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" /> {config.whatsapp}
              </a>
            )}
            {config.phone && (
              <a href={links.phone}>
                <Phone aria-hidden="true" /> {config.phone}
              </a>
            )}
            {config.email && (
              <a href={links.email}>
                <Mail aria-hidden="true" /> {config.email}
              </a>
            )}
          </div>
        )}
        <nav className="v2-footer-col" aria-label="Links úteis">
          <strong>Links úteis</strong>
          <a href="/produtos">Catálogo completo</a>
          {hasBrands && <a href={`${home}#marcas`}>Marcas</a>}
          {hasSegments && <a href={`${home}#segmentos`}>Segmentos</a>}
          {hasOffers && <a href={`${home}#ofertas`}>Ofertas</a>}
        </nav>
        {links.rca && (
          <div className="v2-footer-cta">
            <span className="v2-footer-cta-title">
              <MessageCircle aria-hidden="true" />
              <span>
                <strong>Representante da sua região</strong>
                <small>Descubra quem atende a sua cidade</small>
              </span>
            </span>
            <RcaButton
              config={config}
              className="v2-button v2-button-red v2-button-small"
            >
              {config.whatsapp ? 'Falar no WhatsApp' : 'Enviar e-mail'}
            </RcaButton>
          </div>
        )}
      </div>
      <CatalogNotice className="v2-container v2-footer-notice" />
      <div className="v2-container v2-footer-bottom">
        <span>
          © {new Date().getFullYear()} {config.legalName || config.name}. Todos
          os direitos reservados.
          {companyIdentity(config) && (
            <span className="v2-footer-identity">{companyIdentity(config)}</span>
          )}
        </span>
        <span>
          {privacyPolicyReady(config) && (
            <a className="v2-footer-privacy" href={PRIVACY_PATH}>
              Política de Privacidade
            </a>
          )}
          Distribuição • Variedade • Relacionamento
        </span>
      </div>
    </footer>
  );
}
