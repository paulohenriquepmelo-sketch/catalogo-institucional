'use client';
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages -- Logo, fotos e logos de marca já são enviados otimizados (WebP); o site navega com links comuns, como o restante do catálogo. */
import {
  createElement,
  useEffect,
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
  Headset,
  Mail,
  Menu,
  MessageCircle,
  Phone,
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
import type { Product } from '@/lib/catalog-data';
import { buildSegments, type Segment } from '@/lib/segments';
import { segmentIconById } from '@/lib/segment-icons';
import { campaignSlides } from '@/lib/catalog-campaign';
import { CollectionProducts } from './collection-products';
import { AllBrandsList } from './all-brands-dialog';
import { ProductCard } from './product-card';
import { selectNewProducts } from './product-showcase-carousel';

// Layout institucional da página inicial e do catálogo completo, conforme o
// esboço aprovado em 27/10/2026. Os temas especiais (ex.: Black Friday)
// continuam usando o layout anterior, em catalog-app.tsx.

const rcaMessage =
  'Olá! Quero saber qual é o RCA (representante comercial) que atende a minha região. Minha cidade é: ';

export function contactLinks(config: CatalogConfig) {
  const whatsapp = config.whatsapp
    ? `https://wa.me/${whatsappNumber(config.whatsapp)}`
    : '';
  return {
    whatsapp,
    rca: whatsapp
      ? `${whatsapp}?text=${encodeURIComponent(rcaMessage)}`
      : config.email
        ? `mailto:${config.email}?subject=${encodeURIComponent('RCA da minha região')}&body=${encodeURIComponent(rcaMessage)}`
        : '',
    phone: config.phone ? `tel:+${whatsappNumber(config.phone)}` : '',
    email: config.email ? `mailto:${config.email}` : '',
  };
}

export function SiteTopbar({ config }: { config: CatalogConfig }) {
  const links = contactLinks(config);
  return (
    <div className="v2-topbar">
      <div className="v2-container v2-topbar-inner">
        <span className="v2-topbar-message">
          Qualidade, variedade e atendimento para o seu negócio.
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
          {links.rca && (
            <a
              className="v2-topbar-rca"
              href={links.rca}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" /> Fale com o RCA da sua região
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export type NavKey = 'inicio' | 'catalogo';

export function SiteHeader({
  config,
  current,
  hasSegments,
  hasBrands,
  hasOffers,
  showEditorLink,
  onSearch,
  initialQuery = '',
}: {
  config: CatalogConfig;
  current: NavKey;
  hasSegments: boolean;
  hasBrands: boolean;
  hasOffers: boolean;
  showEditorLink: boolean;
  onSearch: (query: string) => void;
  initialQuery?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // A busca ativa chega como valor inicial (o pai troca a key ao mudar).
  const [query, setQuery] = useState(initialQuery);
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
      ? [['Ofertas', '/produtos#ofertas', false] as [string, string, boolean]]
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
          {showEditorLink && (
            <a href="/editor" className="v2-editor-link">
              <Settings2 aria-hidden="true" /> Editor
            </a>
          )}
        </nav>
        <form
          aria-label="Buscar no catálogo"
          className="v2-search"
          onSubmit={(e) => {
            e.preventDefault();
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por produto, marca ou código…"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" aria-label="Buscar">
            <ArrowRight aria-hidden="true" />
          </button>
        </form>
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
  return (
    <section className="v2-hero" aria-labelledby="v2-hero-title">
      <div className="v2-hero-media" aria-hidden="true">
        {photo && <img src={photo} alt="" fetchPriority="high" />}
      </div>
      <div className="v2-container v2-hero-inner">
        <div className="v2-hero-copy">
          <span className="v2-hero-eyebrow">Distribuidora Laurencini</span>
          <h2 id="v2-hero-title">
            Há mais de 30 anos{' '}
            <span className="v2-hero-line">
              atendendo o <span className="v2-red">seu negócio.</span>
            </span>
          </h2>
          <p>
            Com um portfólio completo, trabalhamos para levar qualidade,
            variedade e as melhores marcas para o seu estabelecimento.
          </p>
          <a className="v2-button v2-button-red" href="/produtos">
            Conheça nosso catálogo <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
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
  const images = config.segmentImages ?? {};
  if (!segments.length) return null;
  return (
    <section id="segmentos" className="v2-segments" aria-labelledby="v2-segments-title">
      <div className="v2-container v2-segments-inner">
        <div className="v2-segments-intro">
          <span className="v2-eyebrow">Nossos segmentos</span>
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
              image={images[s.rule.id]}
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
                image={images[s.rule.id]}
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
    <section className="v2-brands-wrap v2-new-wrap" aria-labelledby="v2-new-title">
      <div className="v2-container">
        <div className="v2-brands v2-new">
          <div className="v2-brands-head">
            <div>
              <span className="v2-eyebrow v2-eyebrow-light">
                {settings.eyebrow || 'Novidades no catálogo'}
              </span>
              <h2 id="v2-new-title">{settings.title}</h2>
            </div>
          </div>
          <PanelCarousel
            label="novidades"
            itemClass="v2-new-item"
            loop={shown.length > 6}
          >
            {shown.map((product) => (
              <div className="v2-new-card" key={product.id}>
                <span className="v2-new-badge">Novo</span>
                <ProductCard product={product} onOpen={onOpen} />
              </div>
            ))}
          </PanelCarousel>
        </div>
      </div>
    </section>
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
              <h2 id="v2-brands-title">
                As melhores marcas
                <br /> do nosso catálogo
              </h2>
              <p>Qualidade e confiança que você já conhece.</p>
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
          />
        )}
      </Dialog>
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="all-brands-dialog" style={style}>
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
  const shown = useMemo(() => items.filter((p) => p.image).slice(0, 12), [items]);
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
          {links.rca && (
            <a href={links.rca} target="_blank" rel="noopener noreferrer">
              Qual é o RCA da minha região?
            </a>
          )}
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
          {hasOffers && <a href="/produtos#ofertas">Ofertas</a>}
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
            <a
              className="v2-button v2-button-red v2-button-small"
              href={links.rca}
              target="_blank"
              rel="noopener noreferrer"
            >
              {config.whatsapp ? 'Falar no WhatsApp' : 'Enviar e-mail'}
            </a>
          </div>
        )}
      </div>
      <div className="v2-container v2-footer-bottom">
        <span>
          © {new Date().getFullYear()} {config.name}. Todos os direitos
          reservados.
        </span>
        <span>Distribuição • Variedade • Relacionamento</span>
      </div>
    </footer>
  );
}
