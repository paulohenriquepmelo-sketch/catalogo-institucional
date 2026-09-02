export type SegmentInput = { name: string; description: string; department: string; section: string; category: string; specs?: string[] };

const segmentRules = [
  { name: 'Corporativo', words: ['escritório', 'ergonomia', 'reunião', 'executivo', 'colaboração', 'trabalho', 'cabos'] },
  { name: 'Hotelaria', words: ['hotel', 'lobby', 'recepção', 'espera', 'durável', 'impermeável', 'acolhedor'] },
  { name: 'Gastronomia', words: ['restaurante', 'café', 'bar', 'gastronomia', 'pendente', 'operação'] },
  { name: 'Residencial', words: ['residencial', 'sala', 'casa', 'estar', 'conforto', 'madeira', 'bouclé'] },
];

export function classifySegment(input: SegmentInput) {
  const source = `${input.name} ${input.description} ${input.department} ${input.section} ${input.category} ${(input.specs ?? []).join(' ')}`.toLowerCase();
  const ranked = segmentRules.map((rule) => ({ name: rule.name, score: rule.words.reduce((total, word) => total + (source.includes(word) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
  const segment = ranked[0].score > 0 ? ranked[0].name : 'Residencial';
  return { segment, confidence: Math.min(98, 62 + ranked[0].score * 9), signals: segmentRules.find((rule) => rule.name === segment)?.words.filter((word) => source.includes(word)) ?? [] };
}
