import type { Product } from '@/lib/api';
import { normalize, sizeOf, wordStartPattern } from '@/lib/segments';

/**
 * Produtos que ACOMPANHAM o item (receita ou uso junto): macarrão pede molho
 * de tomate, café pede açúcar e copo, vassoura pede pá e saco de lixo.
 *
 * Só aparecem quando faltam produtos parecidos. Cada regra diz quando vale
 * (`when`, palavras do nome) e o que sugerir, em ordem de importância; o app
 * pega um item de cada sugestão por vez, para não mostrar só molhos.
 * Palavras casam pelo início, sem acento/maiúscula (igual aos segmentos).
 */
type ComplementRule = {
  when: string[];
  suggest: { keywords: string[]; exclude?: string[] }[];
};

const RULES: ComplementRule[] = [
  // Massas e molhos
  {
    when: ['mac ', 'mac.', 'macarrao', 'espaguete', 'lasanha', 'talharim', 'parafuso', 'penne'],
    suggest: [
      { keywords: ['molho tomate', 'molho de tomate'] },
      { keywords: ['extrato tomate', 'extrato de tomate'] },
      { keywords: ['cond oregano', 'oregano'] },
      { keywords: ['azeite'], exclude: ['sache'] },
    ],
  },
  {
    when: ['molho tomate', 'molho de tomate', 'extrato tomate', 'extrato de tomate', 'polpa tomate'],
    suggest: [
      { keywords: ['mac ', 'macarrao', 'espaguete'], exclude: ['instant'] },
      { keywords: ['lasanha'] },
      { keywords: ['cond oregano'] },
    ],
  },
  // Panificação e confeitaria
  {
    when: ['far trigo', 'farinha de trigo'],
    suggest: [
      { keywords: ['fermento'] },
      { keywords: ['margarina'] },
      { keywords: ['acucar'], exclude: ['sache', 'catchup', 'zero', 'suco', 'goma', 'bala'] },
      { keywords: ['oleo'], exclude: ['sardinha', 'sab'] },
    ],
  },
  {
    when: ['fermento', 'fermix'],
    suggest: [
      { keywords: ['far trigo'] },
      { keywords: ['margarina'] },
      { keywords: ['acucar'], exclude: ['sache', 'catchup', 'zero', 'suco', 'goma', 'bala'] },
    ],
  },
  {
    when: ['mistura p/ bolo', 'mistura bolo', 'mistura p/bolo'],
    suggest: [
      { keywords: ['emb bolo', 'emba. bolo', 'emb. bolo'] },
      { keywords: ['cobertura'] },
      { keywords: ['granulado', 'confeito'], exclude: ['brinq'] },
      { keywords: ['margarina'] },
    ],
  },
  {
    when: ['emb bolo', 'emba. bolo', 'emb. bolo', 'leva doce'],
    suggest: [
      { keywords: ['mistura p/ bolo', 'mistura bolo'] },
      { keywords: ['cobertura'] },
      { keywords: ['chantil'] },
      { keywords: ['recheio'] },
    ],
  },
  {
    when: ['leite cond', 'leite condensado'],
    suggest: [
      { keywords: ['creme de leite'] },
      { keywords: ['achocolatado em po', 'choco em po', 'chocolate em po'] },
      { keywords: ['granulado'], exclude: ['brinq'] },
      { keywords: ['coco ralado'] },
    ],
  },
  {
    when: ['granulado', 'choco em po', 'chocolate em po', 'cobertura'],
    suggest: [
      { keywords: ['leite cond', 'leite condensado'] },
      { keywords: ['creme de leite'] },
      { keywords: ['emb bolo', 'emba. bolo'] },
    ],
  },
  {
    when: ['margarina', 'banha', 'gordura'],
    suggest: [
      { keywords: ['far trigo'] },
      { keywords: ['fermento'] },
      { keywords: ['polvilho'], exclude: ['bisc'] },
    ],
  },
  {
    when: ['polvilho', 'mist. prep. pao de queijo'],
    suggest: [
      { keywords: ['oleo'], exclude: ['sardinha', 'sab'] },
      { keywords: ['margarina'] },
      { keywords: ['banha'] },
    ],
  },
  // Cozinha salgada
  {
    when: ['arroz'],
    suggest: [
      { keywords: ['feijao'] },
      { keywords: ['oleo'], exclude: ['sardinha', 'sab'] },
      { keywords: ['tempero alho', 'alho e sal', 'tempero'] },
    ],
  },
  {
    when: ['feijao', 'feijoada', 'charque'],
    suggest: [
      { keywords: ['arroz'] },
      { keywords: ['farinha mandioca', 'farofa'] },
      { keywords: ['linguica', 'linguiça', 'calabresa'] },
      { keywords: ['caldo'] },
    ],
  },
  {
    when: ['pururuca', 'torresmo'],
    suggest: [
      { keywords: ['cerveja'], exclude: ['porta'] },
      { keywords: ['molho pimenta'] },
      { keywords: ['refri'] },
    ],
  },
  // Lanches
  {
    when: ['catchup', 'maionese', 'mostarda'],
    suggest: [
      { keywords: ['salsicha'] },
      { keywords: ['batata palha'] },
      { keywords: ['hamburgueira', 'papel p/hamburg', 'sacola p/hamburg'] },
      { keywords: ['guardanapo'], exclude: ['porta'] },
    ],
  },
  {
    when: ['salsicha', 'hot dog'],
    suggest: [
      { keywords: ['catchup'] },
      { keywords: ['mostarda'] },
      { keywords: ['batata palha'] },
      { keywords: ['sacola p/cachorro', 'marmitex hot dog'] },
    ],
  },
  {
    when: ['hamburgueira', 'papel p/hamburg', 'sacola p/hamburg'],
    suggest: [
      { keywords: ['catchup'] },
      { keywords: ['maionese'] },
      { keywords: ['guardanapo'], exclude: ['porta'] },
      { keywords: ['sacola kraft', 'sacola papel'] },
    ],
  },
  // Pizza
  {
    when: ['pizza', 'disco pizza'],
    suggest: [
      { keywords: ['molho pizza', 'ajuda pizza'] },
      { keywords: ['far trigo p/pizza', 'far trigo profissional', 'far trigo res especial'] },
      { keywords: ['cond oregano'] },
      { keywords: ['azeitona'] },
      { keywords: ['molho tomate'] },
    ],
  },
  // Bebidas e petiscos
  {
    when: ['cerveja', 'chopp'],
    suggest: [
      { keywords: ['amendoim'], exclude: ['chocolate', 'colorido', 'doce'] },
      { keywords: ['chips', 'batata ond', 'salg torcida'] },
      { keywords: ['porta latinha', 'porta latao', 'porta cerveja'] },
    ],
  },
  {
    when: ['vodka', 'ag ', 'cachaca', 'whisky', 'rum', 'bacardi', 'conhaque'],
    suggest: [
      { keywords: ['energetico'] },
      { keywords: ['refri'] },
      { keywords: ['copo americano', 'copo desc'] },
    ],
  },
  {
    when: ['refri', 'suco', 'agua mineral', 'energetico'],
    suggest: [
      { keywords: ['copo desc', 'copo transp'] },
      { keywords: ['canudo'] },
      { keywords: ['chips', 'salg torcida'] },
    ],
  },
  {
    when: ['chips', 'salg ', 'salgadinho', 'batata ond', 'pipoca'],
    suggest: [
      { keywords: ['refri'] },
      { keywords: ['cerveja'], exclude: ['porta'] },
      { keywords: ['suco'] },
    ],
  },
  // Café
  {
    when: ['cafe '],
    suggest: [
      { keywords: ['acucar'], exclude: ['catchup', 'zero', 'suco', 'goma', 'bala'] },
      { keywords: ['adocante'] },
      { keywords: ['copo desc'] },
      { keywords: ['mexedor'], exclude: ['canudo'] },
    ],
  },
  // Embalagens e descartáveis
  {
    when: ['marmitex', 'marmita'],
    suggest: [
      { keywords: ['garfo', 'talher'] },
      { keywords: ['sacola camis', 'sacola cam', 'sacola p/viagem', 'sacola kraft', 'sacola papel'],
        exclude: ['talher'] },
      { keywords: ['guardanapo'], exclude: ['porta'] },
      { keywords: ['sache'], exclude: ['sabao', 'canudo', 'garfo', 'faca', 'colher', 'milho', 'ervilha'] },
    ],
  },
  {
    when: ['copo desc', 'copo transp', 'copo termico'],
    suggest: [
      { keywords: ['tampa copo', 'tampa t', 'tampa bolha'] },
      { keywords: ['canudo'] },
      { keywords: ['mexedor'] },
    ],
  },
  {
    when: ['pote pet', 'pote polipapel', 'pote termico', 'pote transp', 'po p/sorvete'],
    suggest: [
      { keywords: ['colher'] },
      { keywords: ['cobertura'] },
      { keywords: ['granulado'], exclude: ['brinq'] },
    ],
  },
  // Limpeza e higiene
  {
    when: ['vassoura', 'rodo'],
    suggest: [
      { keywords: ['pa p/', 'pa (s/cabo)', 'pa para'] },
      { keywords: ['saco lixo'] },
      { keywords: ['pano'] },
      { keywords: ['desinfetante'] },
    ],
  },
  {
    when: ['detergente'],
    suggest: [{ keywords: ['esponja'] }, { keywords: ['pano'] }, { keywords: ['bombril'] }],
  },
  {
    when: ['sabao po', 'sabao em po', 'lava roupas'],
    suggest: [{ keywords: ['amaciante'] }, { keywords: ['alvejante', 'agua sanitaria'] }],
  },
  {
    when: ['desinfetante', 'agua sanitaria', 'multiuso', 'cloro'],
    suggest: [{ keywords: ['pano'] }, { keywords: ['rodo'] }, { keywords: ['saco lixo'] }],
  },
  {
    when: ['creme dental'],
    suggest: [{ keywords: ['escova dental'] }, { keywords: ['enxaguante'] }],
  },
  {
    when: ['escova dental'],
    suggest: [{ keywords: ['creme dental'] }, { keywords: ['enxaguante'] }],
  },
  {
    when: ['papel hig'],
    suggest: [{ keywords: ['sabonete', 'sab.'] }, { keywords: ['desinfetante'] }],
  },
];

const compiled = RULES.map((rule) => ({
  when: wordStartPattern(rule.when)!,
  suggest: rule.suggest.map((s) => ({
    keywords: wordStartPattern(s.keywords)!,
    exclude: s.exclude ? wordStartPattern(s.exclude) : null,
  })),
}));

const PACKAGING_CATEGORIES = new Set(
  [
    'descartaveis',
    'eps (isopor)/bandejas aluminio',
    'potes redondo / retangular',
    'sacolas/ bobinas/ sacos pp',
  ].map((category) => normalize(category)),
);

type Indexed = { product: Product; name: string; size: number | null };
const indexCache = new WeakMap<Product[], Indexed[]>();

function indexOf(products: Product[]) {
  let index = indexCache.get(products);
  if (!index) {
    index = products
      .filter((p) => p.published !== false)
      .map((product) => {
        const name = ` ${normalize(product.name ?? '')} `;
        return { product, name, size: sizeOf(name) };
      });
    indexCache.set(products, index);
  }
  return index;
}

/**
 * Até `limit` produtos que acompanham `product`, ignorando os de `skipIds`
 * (ele mesmo e os parecidos já mostrados). Vazio quando nenhuma regra vale.
 */
export function complementProducts(
  products: Product[],
  product: Product,
  limit: number,
  skipIds: Set<number>,
): Product[] {
  if (limit <= 0) return [];
  const name = ` ${normalize(product.name ?? '')} `;
  const rule = compiled.find((r) => r.when.test(name));
  if (!rule) return [];

  // Embalagem grande (food service) sugere embalagem grande, e vice-versa. Quem
  // compra embalagem/descartável é um negócio: também prefere o tamanho grande.
  const bigSize = (size: number | null) => size !== null && size >= 900;
  const wantBig = bigSize(sizeOf(name)) || PACKAGING_CATEGORIES.has(normalize(product.category ?? ''));
  const index = indexOf(products);

  const lists = rule.suggest.map((s) =>
    index
      .filter(
        (row) =>
          !skipIds.has(row.product.id) &&
          row.product.id !== product.id &&
          !rule.when.test(row.name) &&
          s.keywords.test(row.name) &&
          !s.exclude?.test(row.name),
      )
      .sort(
        (a, b) =>
          Number(bigSize(b.size) === wantBig) - Number(bigSize(a.size) === wantBig) ||
          a.product.name.localeCompare(b.product.name, 'pt-BR'),
      ),
  );

  // Um de cada sugestão por vez (molho, extrato, orégano, azeite, molho...).
  const picked: Product[] = [];
  const seen = new Set<number>();
  for (let round = 0; picked.length < limit; round++) {
    let added = false;
    for (const list of lists) {
      const row = list[round];
      if (!row || seen.has(row.product.id)) continue;
      seen.add(row.product.id);
      picked.push(row.product);
      added = true;
      if (picked.length === limit) break;
    }
    if (!added && lists.every((list) => round >= list.length)) break;
  }
  return picked;
}
