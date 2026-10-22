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
  // Higiene pessoal, por uso: bucal, banho (sabonete em barra antes do
  // líquido; desodorantes femininos juntos), barbear, absorvente e fralda,
  // papéis e cuidados.
  ['creme dental', 'escova dental'],
  [
    'sabonete', 'sabonete liq', 'desodorante aero rexona men', 'desodorante aero rexona fem',
    'desodorante aero rexona women', 'desodorante',
  ],
  ['aparelho de barbear', 'lamina de barbear'],
  ['abs', 'fralda'],
  ['papel hig', 'papel interf', 'papel toalha'],
  ['cotonete', 'curativo', 'acetona'],
  // Limpeza, por uso: cozinha (detergente com esponja e palha de aço),
  // roupas (sabão em pó, em barra, amaciante, alvejante e tira manchas),
  // desinfecção e banheiro, superfícies e, por fim, os produtos pesados.
  [
    'detergente', 'esponja', 'bombril', 'desengordurante', 'limpa aluminio',
  ],
  [
    'sabao po', 'sabao', 'amaciante', 'alvejante', 'tira manchas',
  ],
  [
    'agua sanitaria', 'cloro', 'clorolimp', 'desinfetante', 'essencia', 'pastilha', 'pedra',
    'tira limo', 'tira',
  ],
  ['multiuso', 'limpador', 'limpa', 'limpa ceramica', 'limpa vidros', 'limpa pedras'],
  ['alcool', 'soda', 'desengripante'],
  // Utensílios de limpeza (Utilidades): vassouras, rodos, rastelos e pás
  // juntos, depois escovas, panos e sacos de lixo.
  [
    'vassoura', 'vassourao', 'rodo', 'rastelo', 'pa p/ lixo', 'pa para lixo', 'pa (s/cabo)',
    'esfregao', 'escova sanitaria', 'escova', 'flanela', 'pano', 'saco lixo',
  ],
  // Cozinha (Utilidades).
  [
    'panela', 'caldeirao', 'canecao', 'frigideira', 'taboa', 'socador', 'coador',
    'churrasqueira', 'espeto', 'pe de botija',
  ],
  // Bar e mesa (Utilidades).
  [
    'copo americano', 'copo bristol', 'copo nadir', 'copo tulipa', 'porta latinha',
    'porta latao', 'porta litrao', 'porta cerveja', 'porta garrafa', 'cesta 4x4', 'cesta 6x6',
    'porta guardanapo', 'porta guard.', 'porta canudo', 'paliteiro', 'palito', 'saleiro',
    'bisnaga', 'baleiro',
  ],
  // Lavanderia, tabacaria e miudezas (Utilidades).
  ['prendedor', 'corda de varal'],
  ['isqueiro', 'fosforo', 'vela', 'fumo', 'papel p/cigarro'],
  [
    'pilha', 'lampada', 'fita adesiva', 'cola instantanea', 'arame/fecho', 'caneta',
    'papel a4', 'baralho', 'inseticida', 'bola de vidro',
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
