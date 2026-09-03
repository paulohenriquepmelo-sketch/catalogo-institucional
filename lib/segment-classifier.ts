import { defaultConfig, normalize, type SegmentRule } from './catalog-config';
export type SegmentInput = {
  name: string;
  description: string;
  department: string;
  section: string;
  category: string;
  specs?: string[];
};
const compiledRules = new WeakMap<
  SegmentRule[],
  { name: string; words: { word: string; pattern: RegExp }[] }[]
>();
function compile(rules: SegmentRule[]) {
  let compiled = compiledRules.get(rules);
  if (compiled) return compiled;
  compiled = rules.map((rule) => ({
    name: rule.name,
    words: [...new Set(rule.keywords.map(normalize))]
      .filter(Boolean)
      .map((word) => ({
        word,
        pattern: new RegExp(
          `(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          'i',
        ),
      })),
  }));
  compiledRules.set(rules, compiled);
  return compiled;
}
export function classifySegment(
  input: SegmentInput,
  rules: SegmentRule[] = defaultConfig.segments,
) {
  const source = normalize(
    `${input.name} ${input.description} ${input.department} ${input.section} ${input.category} ${(input.specs ?? []).join(' ')}`,
  );
  const category = normalize(input.category);
  const name = normalize(`${input.name} ${input.description}`);
  const ranked = compile(rules)
    .map((rule) => {
      const matched = rule.words.filter(({ pattern }) => pattern.test(source));
      const signals = matched.map(({ word }) => word);
      const score = matched.reduce(
        (total, { pattern }) =>
          total + (pattern.test(category) ? 3 : pattern.test(name) ? 2 : 1),
        0,
      );
      return { name: rule.name, signals, score };
    })
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const review = !best?.score || best.score === ranked[1]?.score;
  return {
    segment: review ? 'Sem classificação' : best.name,
    signals: best?.signals ?? [],
    review,
    candidates: ranked.filter((r) => r.score > 0).map((r) => r.name),
  };
}
