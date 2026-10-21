import { normalize, type TaxonomyPath } from './catalog-config';

/**
 * Correções aplicadas aos dados que vêm do ERP. A importação sobrescreve nome
 * e hierarquia com a planilha; estas regras são aplicadas de novo em toda
 * importação (e, sob demanda, aos produtos já cadastrados), então a correção
 * não se perde. O código do produto nunca muda.
 */
export type ErpAbbreviation = {
  /** Como vem do ERP: "MAC", "MAC.", "FAR TRIGO". Acentos e caixa são ignorados. */
  from: string;
  /** Como deve ficar: "MACARRÃO", "FARINHA DE TRIGO". */
  to: string;
  /** Só nestas categorias (vazio = todas). Evita "ESCOVA ... MAC." (macia). */
  categories: string[];
  /** Só como primeira palavra do nome: "COND ACAFRAO" sim, "LEITE COND." não. */
  startOnly: boolean;
};
export type ErpProductFix = {
  code: string;
  /** Nome fixo para o produto (vazio = nome do ERP com as abreviações). */
  name: string;
  /** Hierarquia correta (vazia = a do ERP). */
  department: string;
  section: string;
  category: string;
};
export type ErpFixes = {
  abbreviations: ErpAbbreviation[];
  products: ErpProductFix[];
  /** Códigos que a lista de suspeitos não deve mais mostrar. */
  ignored: string[];
};
export type ErpFields = {
  code: string;
  name: string;
  department: string;
  section: string;
  category: string;
};

const MAX_ABBREVIATIONS = 300;
const MAX_PRODUCT_FIXES = 1500;
const MAX_IGNORED = 3000;

const rule = (
  from: string,
  to: string,
  categories: string[],
  startOnly = true,
): ErpAbbreviation => ({ from, to, categories, startOnly });

// Ponto de partida conferido no catálogo publicado (out/2026). Cada regra fica
// presa às categorias onde a abreviação aparece com esse sentido.
export const defaultErpFixes: ErpFixes = {
  abbreviations: [
    rule('MAC', 'MACARRÃO', ['1.4-MASSAS', '1.6-SANTA AMALIA']),
    rule('STA', 'SANTA', ['1.6-SANTA AMALIA'], false),
    rule('FAR TRIGO', 'FARINHA DE TRIGO', [], false),
    rule('D.BENTA', 'DONA BENTA', [], false),
    rule('PIR', 'PIRULITO', ['2.3-PIRULITOS']),
    rule('REF', 'REFRESCO', ['1.2-MERCEARIA']),
    rule('COND', 'CONDIMENTO', ['1.5-CONDIMENTOS GUARANA', '1.1-FOOD SERVICE', '1.2-MERCEARIA']),
    rule('BISC', 'BISCOITO', ['1.3-BISCOITOS', '1.1-FOOD SERVICE']),
    rule('RECH.', 'RECHEADO', ['1.3-BISCOITOS'], false),
    rule('REFRI', 'REFRIGERANTE', ['3.1-SUCOS', '3.2-REFRIGERANTES']),
    rule('BRINQ', 'BRINQUEDO', ['2.5-DOCES / BRINQUEDOS']),
    rule('SALG', 'SALGADINHO', ['2.6-SALGADINHOS / PIPOCAS / CHIPS']),
    rule('AG', 'AGUARDENTE', ['4.2-DESTILADOS']),
    rule('EMB', 'EMBALAGEM', ['POTES REDONDO / RETANGULAR', 'EPS (ISOPOR)/BANDEJAS ALUMINIO']),
    rule('EMBA', 'EMBALAGEM', ['POTES REDONDO / RETANGULAR', 'EPS (ISOPOR)/BANDEJAS ALUMINIO']),
    rule('CAMIS', 'CAMISETA', ['SACOLAS/ BOBINAS/ SACOS PP'], false),
    rule('CAM', 'CAMISETA', ['SACOLAS/ BOBINAS/ SACOS PP'], false),
    rule('DESOD', 'DESODORANTE', ['HIGIENE PESSOAL']),
    rule('SAB', 'SABONETE', ['HIGIENE PESSOAL']),
    rule('APAR. BARB', 'APARELHO DE BARBEAR', ['HIGIENE PESSOAL']),
    rule('MAND', 'MANDIOCA', ['1.1-FOOD SERVICE'], false),
  ],
  products: [],
  ignored: [],
};

// Categorias do ERP às vezes vêm com espaço duplo ("POTES REDONDO /  RETANGULAR").
const categoryKey = (category: string) => normalize(category).replace(/\s+/g, ' ');
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Sem acento e em maiúsculas, mantendo o tamanho de cada letra: assim a
// posição encontrada no texto simplificado vale para o nome original.
const plain = (text: string) =>
  // Por unidade UTF-16 (não por caractere): as posições batem com String#slice.
  text
    .split('')
    .map((ch) => (ch.normalize('NFD').replace(/[̀-ͯ]/g, '') || ch).toUpperCase()[0])
    .join('');

type Compiled = { rule: ErpAbbreviation; pattern: RegExp; categories: Set<string> };
const compiledCache = new WeakMap<ErpAbbreviation[], Compiled[]>();
function compile(abbreviations: ErpAbbreviation[]) {
  let compiled = compiledCache.get(abbreviations);
  if (compiled) return compiled;
  compiled = abbreviations.map((r) => {
    const from = plain(r.from.trim()).replace(/\s+/g, ' ');
    // "MAC" também leva o ponto de "MAC." (senão sobraria "MACARRÃO.").
    // Com ponto, a palavra seguinte pode vir colada ("MAC.INSTANT").
    const end = from.endsWith('.') ? '' : '(?:\\.|(?![A-Z0-9]))';
    const words = from.split(' ').map(escapeRegExp).join('\\s+');
    return {
      rule: r,
      pattern: new RegExp(
        `${r.startOnly ? '^' : '(?<![A-Z0-9])'}${words}${end}`,
        'g',
      ),
      categories: new Set(r.categories.map(categoryKey)),
    };
  });
  compiledCache.set(abbreviations, compiled);
  return compiled;
}

/** Aplica as abreviações ao nome e arruma espaços repetidos. */
export function expandName(
  name: string,
  category: string,
  abbreviations: ErpAbbreviation[],
) {
  let result = name.replace(/\s+/g, ' ').trim();
  const key = categoryKey(category);
  for (const { rule: r, pattern, categories } of compile(abbreviations)) {
    // Linha ainda em edição no editor (sem abreviação ou sem texto novo).
    if (!r.from.trim() || !r.to.trim()) continue;
    if (categories.size && !categories.has(key)) continue;
    const simple = plain(result);
    let out = '';
    let last = 0;
    for (const match of simple.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      const next = result[end] ?? '';
      out += result.slice(last, start) + r.to.trim();
      // "MAC.INSTANT" vira "MACARRÃO INSTANT".
      if (next && /[\p{L}\p{N}]/u.test(next)) out += ' ';
      last = end;
    }
    if (last) result = (out + result.slice(last)).replace(/\s+/g, ' ').trim();
  }
  return result;
}

/** Nome e hierarquia corrigidos de um produto (o código nunca muda). */
export function applyErpFixes<T extends ErpFields>(product: T, fixes: ErpFixes): T {
  const fix = fixes.products.find((f) => f.code === product.code.trim());
  const path = fix?.category
    ? { department: fix.department, section: fix.section, category: fix.category }
    : {
        department: product.department,
        section: product.section,
        category: product.category,
      };
  const name = fix?.name.trim()
    ? fix.name.trim()
    : expandName(product.name, path.category, fixes.abbreviations);
  return { ...product, ...path, name };
}

export type ErpSuspect = {
  code: string;
  name: string;
  current: TaxonomyPath;
  suggested: TaxonomyPath;
  /** Quantos produtos da mesma família estão na categoria sugerida / total. */
  evidence: string;
};

const pathKey = (p: TaxonomyPath) =>
  `${p.department}\u0000${p.section}\u0000${p.category}`;

/**
 * Produtos que parecem estar na categoria errada: a "família" (duas primeiras
 * palavras do nome já corrigido, ex.: "macarrao ovos") está quase toda em
 * outra categoria. É só uma sugestão para revisão, nunca aplicada sozinha.
 */
export function findErpSuspects(
  products: ErpFields[],
  fixes: ErpFixes,
): ErpSuspect[] {
  const fixed = products.map((p) => applyErpFixes(p, fixes));
  const family = (name: string) =>
    normalize(name).split(/[^a-z0-9]+/).filter(Boolean).slice(0, 2).join(' ');
  const groups = new Map<string, Map<string, { path: TaxonomyPath; count: number }>>();
  for (const p of fixed) {
    const f = family(p.name);
    if (!f.includes(' ')) continue;
    const paths = groups.get(f) ?? new Map();
    const key = pathKey(p);
    const entry = paths.get(key) ?? {
      path: { department: p.department, section: p.section, category: p.category },
      count: 0,
    };
    entry.count++;
    paths.set(key, entry);
    groups.set(f, paths);
  }
  // Food Service x Mercearia é tamanho de embalagem (galão, bag), não erro.
  const sizeSplit = new Set(['1.1-food service', '1.2-mercearia']);
  const ignored = new Set(fixes.ignored);
  const corrected = new Set(fixes.products.filter((f) => f.category).map((f) => f.code));
  const suspects: ErpSuspect[] = [];
  for (const p of fixed) {
    if (ignored.has(p.code) || corrected.has(p.code)) continue;
    const paths = groups.get(family(p.name));
    if (!paths) continue;
    const entries = [...paths.values()];
    const total = entries.reduce((n, e) => n + e.count, 0);
    const top = entries.reduce((a, b) => (b.count > a.count ? b : a));
    const mine = paths.get(pathKey(p))?.count ?? 0;
    if (
      total >= 3 &&
      top.count / total >= 0.7 &&
      mine / total <= 0.25 &&
      categoryKey(top.path.category) !== categoryKey(p.category) &&
      !(sizeSplit.has(categoryKey(top.path.category)) && sizeSplit.has(categoryKey(p.category)))
    )
      suspects.push({
        code: p.code,
        name: p.name,
        current: { department: p.department, section: p.section, category: p.category },
        suggested: top.path,
        evidence: `${top.count} de ${total} produtos “${family(p.name).toUpperCase()}…”`,
      });
  }
  return suspects.sort((a, b) => a.name.localeCompare(b.name));
}

const text = (value: unknown, label: string, max: number, optional = false) => {
  if (typeof value !== 'string') throw new Error(`Revise ${label}.`);
  const v = value.replace(/\s+/g, ' ').trim();
  if ((!optional && !v) || v.length > max) throw new Error(`Revise ${label}.`);
  return v;
};
const list = (value: unknown, max: number, label: string) => {
  if (!Array.isArray(value)) throw new Error(`Revise ${label}.`);
  if (value.length > max) throw new Error(`Use no máximo ${max} ${label}.`);
  return value as unknown[];
};

export function validateErpFixes(value: unknown, taxonomy: TaxonomyPath[]): ErpFixes {
  if (!value || typeof value !== 'object') throw new Error('Correções inválidas.');
  const v = value as Record<string, unknown>;
  const abbreviations = list(v.abbreviations, MAX_ABBREVIATIONS, 'abreviações').map(
    (item) => {
      const a = (item ?? {}) as Record<string, unknown>;
      return {
        from: text(a.from, 'a abreviação', 40),
        to: text(a.to, 'o texto por extenso', 80),
        categories: [
          ...new Set(
            list(a.categories, 40, 'categorias').map((c) => text(c, 'a categoria', 80)),
          ),
        ],
        startOnly: a.startOnly === true,
      };
    },
  );
  const seen = new Set<string>();
  for (const a of abbreviations) {
    const key = `${plain(a.from)}|${[...a.categories].sort().join('|')}`;
    if (seen.has(key)) throw new Error(`Abreviação repetida: ${a.from}.`);
    seen.add(key);
  }
  const known = new Set(taxonomy.map(pathKey));
  const codes = new Set<string>();
  const products = list(v.products, MAX_PRODUCT_FIXES, 'correções de produto').map(
    (item) => {
      const p = (item ?? {}) as Record<string, unknown>;
      const fix = {
        code: text(p.code, 'o código', 180),
        name: text(p.name ?? '', 'o nome', 180, true),
        department: text(p.department ?? '', 'o departamento', 80, true),
        section: text(p.section ?? '', 'a seção', 80, true),
        category: text(p.category ?? '', 'a categoria', 80, true),
      };
      if (codes.has(fix.code)) throw new Error(`Código repetido: ${fix.code}.`);
      codes.add(fix.code);
      if (fix.category && !known.has(pathKey(fix)))
        throw new Error(`Escolha uma hierarquia cadastrada para ${fix.code}.`);
      if (!fix.category && (fix.department || fix.section))
        throw new Error(`Escolha a categoria de ${fix.code}.`);
      return fix;
    },
  );
  const ignored = [
    ...new Set(list(v.ignored ?? [], MAX_IGNORED, 'itens ignorados').map((c) => text(c, 'o código', 180))),
  ];
  return { abbreviations, products, ignored };
}
