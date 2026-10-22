/**
 * Ordem por semelhança dentro de uma categoria do catálogo: produtos do mesmo
 * tipo ficam juntos e tipos parecidos ficam vizinhos (farinha de trigo →
 * polvilho → mistura para bolo; milho verde → ervilha; aparelho → lâmina de
 * barbear). O tipo sai do começo do nome do produto.
 *
 * Cada família é uma lista de começos de nome (sem acento, minúsculo), na
 * ordem em que devem aparecer. Vale o começo mais longo que casar. Nomes
 * que não casam com nenhuma família vão depois, agrupados pela primeira
 * palavra.
 */
const FAMILIES: string[][] = [
  // Panificação: farinha de trigo → polvilho → mistura para bolo (pedido do
  // cliente), depois o que acompanha.
  [
    'farinha de trigo', 'polvilho', 'fecula', 'tapioca', 'mistura bolo', 'mistura p/ bolo',
    'mist. prep', 'mistura p/ pao', 'mistura p panif', 'mistura', 'fermento', 'reforcador',
    'amido', 'trigo', 'farinha de milho', 'farinha rosca', 'farinha mandioca', 'farinha',
    'farofa', 'aveia', 'canjica', 'xarope', 'acucar', 'sache acucar', 'adocante',
  ],
  // Confeitaria: chocolates, coberturas, recheios, cremes e decoração.
  [
    'chocolate em po', 'chocolate creme', 'chocolate', 'choc.', 'cobertura', 'recheio',
    'creme de confeiteiro', 'chantilly', 'sob.lactea', 'doce leite', 'doce de leite',
    'goiabada', 'doce goiabada', 'coco ralado', 'coco', 'aroma', 'corante', 'gelatina',
    'bolinho', 'panettone', 'pessego',
  ],
  // Leites e derivados.
  [
    'leite po', 'leite cond', 'leite de coco', 'leite', 'creme de leite', 'creme culinario', 'creme culinaria',
    'achocolatado', 'vitamina',
  ],
  // Óleos e gorduras.
  ['oleo', 'azeite', 'gordura', 'gordurina', 'margarina', 'banha'],
  // Conservas de vegetais.
  [
    'milho verde', 'ervilha', 'seleta', 'palmito', 'azeitona', 'cebolinha', 'pepininho',
    'pepino', 'pimenta biquinho', 'cogumelo', 'tomate seco', 'alho conserva', 'alho frito',
    'condimento uva passa', 'extrato tomate', 'conserva lata atum', 'conserva lata sardinha',
    'conserva',
  ],
  // Molhos, condimentos e temperos.
  [
    'molho tomate', 'molho pizza', 'catchup', 'maionese', 'mostarda', 'molho', 'sache',
    'vinagre', 'tempero', 'temp.', 'caldo', 'grill', 'condimento', 'mais sabor', 'toque',
  ],
  // Batatas, salgadinhos e pipoca.
  [
    'batata em flocos', 'batata palha', 'batata', 'chips', 'salgadinho', 'milho p/pipoca',
    'pipoca', 'pururuca', 'torresmo', 'amendoim',
  ],
  // Bebidas em pó e café.
  ['cafe', 'refresco', 'suco'],
  // Frios e embutidos.
  ['mortadela', 'linguica', 'salsicha', 'charque', 'feijoada'],
  // Higiene pessoal.
  [
    'aparelho de barbear', 'lamina de barbear', 'creme dental', 'escova dental', 'cotonete',
    'sabonete liq', 'sabonete', 'desodorante', 'abs', 'fralda', 'papel hig',
    'papel interf', 'papel toalha', 'curativo', 'acetona',
  ],
  // Limpeza.
  [
    'detergente', 'sabao', 'amaciante', 'alvejante', 'agua sanitaria', 'cloro', 'clorolimp',
    'desinfetante', 'multiuso', 'limpa', 'limpador', 'desengordurante', 'desengripante',
    'alcool', 'soda', 'tira', 'essencia', 'pastilha', 'pedra', 'esponja', 'bombril',
  ],
  // Descartáveis.
  [
    'copo', 'prato', 'garfo', 'faca', 'colher', 'mexedor', 'pazinha', 'canudo', 'guardanapo',
    'tampa', 'garrafa', 'luva', 'touca', 'mascara', 'avental',
  ],
];

export const normalizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const PREFIXES = FAMILIES.flatMap((family, f) =>
  family.map((prefix, p) => ({ prefix, rank: f * 1000 + p })),
).sort((a, b) => b.prefix.length - a.prefix.length);

const UNKNOWN = Number.MAX_SAFE_INTEGER;

/** Posição do tipo do produto; o mesmo número = mesmo tipo. */
export function familyRank(name: string) {
  const text = normalizeName(name);
  // O começo precisa terminar numa palavra inteira: "mist. prep" casa com
  // "mist. prep. bisc", "trigo" não casa com "trigoso".
  for (const { prefix, rank } of PREFIXES)
    if (text.startsWith(prefix) && !/[a-z0-9]/.test(text.charAt(prefix.length) || ' '))
      return rank;
  return UNKNOWN;
}

/** Chave do tipo do produto: produtos com a mesma chave são do mesmo tipo. */
export function familyKey(name: string) {
  const rank = familyRank(name);
  return rank === UNKNOWN ? `?${normalizeName(name).split(' ')[0]}` : String(rank);
}

/** Compara dois nomes da mesma categoria: tipo, depois nome. */
export function compareBySimilarity(a: string, b: string) {
  const ra = familyRank(a);
  const rb = familyRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === UNKNOWN) {
    // Sem família conhecida: junta pela primeira palavra.
    const wa = normalizeName(a).split(' ')[0];
    const wb = normalizeName(b).split(' ')[0];
    if (wa !== wb) return wa.localeCompare(wb, 'pt-BR');
  }
  return a.localeCompare(b, 'pt-BR');
}
