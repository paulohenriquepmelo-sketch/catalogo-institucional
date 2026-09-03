export const campaignThemes = [
  {
    id: 'natal',
    name: 'Natal',
    image: '/themes/natal.png',
    color: '#b32336',
    ink: '#172b50',
    background: '#eaf0f8',
    eyebrow: 'Um Natal cheio de possibilidades',
    title: 'Seu negócio pronto para a magia do Natal.',
    description:
      'Encontre no catálogo os produtos para abastecer sua operação nesta época especial.',
  },
  {
    id: 'ano-novo',
    name: 'Ano Novo',
    image: '/themes/ano-novo.png',
    color: '#806019',
    ink: '#17243d',
    background: '#f5f1e7',
    eyebrow: 'Novos ciclos, novas possibilidades',
    title: 'Um novo ano. Muitas oportunidades.',
    description:
      'Comece o próximo ciclo com o mix de produtos que o seu negócio precisa.',
  },
  {
    id: 'black-friday',
    name: 'Black Friday',
    image: '/themes/black-friday.png',
    color: '#a84415',
    ink: '#202128',
    background: '#edebe7',
    eyebrow: 'Prepare sua operação',
    title: 'Seu mix preparado para a Black Friday.',
    description:
      'Planeje o abastecimento e encontre os produtos certos para uma das datas mais movimentadas do varejo.',
  },
  {
    id: 'dia-das-maes',
    name: 'Dia das Mães',
    image: '/themes/dia-das-maes.png',
    color: '#a2305c',
    ink: '#563345',
    background: '#fff0f3',
    eyebrow: 'Carinho em cada detalhe',
    title: 'Um dia especial merece uma seleção especial.',
    description:
      'Prepare o seu negócio para celebrar o Dia das Mães com cuidado em cada escolha.',
  },
  {
    id: 'aniversario',
    name: 'Aniversário da empresa',
    image: '/themes/aniversario.png',
    color: '#c42e42',
    ink: '#193862',
    background: '#edf2fb',
    eyebrow: 'Celebramos nossa história com você',
    title: 'Nossa parceria é motivo de celebração.',
    description:
      'Um aniversário para celebrar clientes, parceiros e tudo o que construímos juntos.',
  },
  {
    id: 'carnaval',
    name: 'Carnaval',
    image: '/themes/carnaval.png',
    color: '#7540a4',
    ink: '#453060',
    background: '#f5eefa',
    eyebrow: 'Mais cor para o seu negócio',
    title: 'Entre no ritmo de novas possibilidades.',
    description:
      'Explore o catálogo e prepare o abastecimento do seu negócio para o Carnaval.',
  },
  {
    id: 'dia-das-criancas',
    name: 'Dia das Crianças',
    image: '/themes/dia-das-criancas.png',
    color: '#126d87',
    ink: '#21475a',
    background: '#edf9fb',
    eyebrow: 'Pequenos momentos, grandes sorrisos',
    title: 'Uma data para colorir de alegria.',
    description:
      'Encontre produtos para preparar o seu negócio para o Dia das Crianças.',
  },
] as const;
export type CampaignThemeId = (typeof campaignThemes)[number]['id'];
export type CampaignSlide = {
  id: string;
  image: string;
  title: string;
  description: string;
  link: string;
  button: string;
  visible: boolean;
};
export type CatalogCampaign = {
  enabled: boolean;
  theme: CampaignThemeId;
  mode: 'theme' | 'image' | 'carousel';
  scope: 'hero' | 'catalog';
  image: string;
  eyebrow: string;
  title: string;
  description: string;
  button: string;
  link: string;
  showStats: boolean;
  autoplay: boolean;
  interval: number;
  overlay: number;
  position: 'center' | 'top' | 'bottom';
  slides: CampaignSlide[];
};
export const defaultCampaign: CatalogCampaign = {
  enabled: true,
  theme: 'natal',
  mode: 'theme',
  scope: 'hero',
  image: '',
  eyebrow: campaignThemes[0].eyebrow,
  title: campaignThemes[0].title,
  description: campaignThemes[0].description,
  button: 'Explorar catálogo',
  link: '#catalogo',
  showStats: true,
  autoplay: true,
  interval: 7,
  overlay: 15,
  position: 'center',
  slides: [],
};
export function campaignPreset(
  theme: CampaignThemeId,
  current: CatalogCampaign,
): CatalogCampaign {
  const preset = campaignThemes.find((p) => p.id === theme)!;
  return {
    ...current,
    enabled: true,
    mode: 'theme',
    theme,
    eyebrow: preset.eyebrow,
    title: preset.title,
    description: preset.description,
  };
}
export function campaignSlides(campaign: CatalogCampaign): CampaignSlide[] {
  if (campaign.mode === 'carousel')
    return campaign.slides.filter((slide) => slide.visible && slide.image);
  const theme =
    campaignThemes.find((p) => p.id === campaign.theme) ?? campaignThemes[0];
  return [
    {
      id: campaign.mode === 'theme' ? theme.id : 'custom',
      image: campaign.mode === 'image' ? campaign.image : theme.image,
      title: campaign.title,
      description: campaign.description,
      link: campaign.link,
      button: campaign.button,
      visible: true,
    },
  ];
}
