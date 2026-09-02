export type Product = {
  id: number;
  name: string;
  code: string;
  department: string;
  section: string;
  category: string;
  segment: string;
  brand: string;
  description: string;
  image: string;
  featured?: boolean;
  specs: string[];
};

export const products: Product[] = [
  {
    id: 1,
    name: 'Cadeira Aurora',
    code: 'MO-1048',
    department: 'Mobiliário',
    section: 'Escritório',
    category: 'Cadeiras',
    segment: 'Corporativo',
    brand: 'Linea',
    description: 'Ergonomia e conforto para rotinas de trabalho intensas, com ajustes intuitivos e acabamento durável.',
    image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=85',
    featured: true,
    specs: ['Encosto respirável', 'Ajuste de altura', 'Base em alumínio'],
  },
  {
    id: 2,
    name: 'Luminária Orbe',
    code: 'IL-2084',
    department: 'Iluminação',
    section: 'Decorativa',
    category: 'Mesa',
    segment: 'Hotelaria',
    brand: 'Nord',
    description: 'Luz quente e difusa para compor ambientes acolhedores com desenho minimalista.',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85',
    featured: true,
    specs: ['LED integrado', 'Luz 3000K', 'Cúpula em vidro'],
  },
  {
    id: 3,
    name: 'Poltrona Nômade',
    code: 'MO-3021',
    department: 'Mobiliário',
    section: 'Estar',
    category: 'Poltronas',
    segment: 'Residencial',
    brand: 'Forma',
    description: 'Poltrona compacta com linhas envolventes, pensada para salas, recepções e lounges.',
    image: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=85',
    featured: true,
    specs: ['Tecido bouclé', 'Espuma de alta densidade', 'Pés em madeira'],
  },
  {
    id: 4,
    name: 'Mesa Atlas',
    code: 'MO-4110',
    department: 'Mobiliário',
    section: 'Reunião',
    category: 'Mesas',
    segment: 'Corporativo',
    brand: 'Linea',
    description: 'Superfície ampla e estrutura leve para reuniões, projetos colaborativos e salas executivas.',
    image: 'https://images.unsplash.com/photo-1538688423619-a81d3f23454b?auto=format&fit=crop&w=900&q=85',
    specs: ['Tampo laminado', 'Passagem de cabos', '8 lugares'],
  },
  {
    id: 5,
    name: 'Pendente Íris',
    code: 'IL-5027',
    department: 'Iluminação',
    section: 'Decorativa',
    category: 'Pendente',
    segment: 'Gastronomia',
    brand: 'Nord',
    description: 'Pendente escultural para criar pontos focais em restaurantes, cafés e áreas sociais.',
    image: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=900&q=85',
    specs: ['Cabo regulável', 'Alumínio pintado', 'Soquete E27'],
  },
  {
    id: 6,
    name: 'Sofá Horizonte',
    code: 'MO-6073',
    department: 'Mobiliário',
    section: 'Estar',
    category: 'Sofás',
    segment: 'Hotelaria',
    brand: 'Forma',
    description: 'Módulos generosos que se adaptam a lobbies, salas de espera e espaços residenciais.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=85',
    specs: ['Sistema modular', 'Tecido impermeável', 'Estrutura em madeira'],
  },
];

export const segments = [
  { name: 'Corporativo', note: 'Produtividade e colaboração', count: 2 },
  { name: 'Hotelaria', note: 'Conforto e permanência', count: 2 },
  { name: 'Residencial', note: 'Bem-estar cotidiano', count: 1 },
  { name: 'Gastronomia', note: 'Atmosfera e operação', count: 1 },
];
