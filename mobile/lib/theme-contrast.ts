/** Calcula a luminância relativa de uma cor hexadecimal opaca. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const expanded = value.length === 3
    ? value.split('').map((character) => character + character).join('')
    : value;

  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0]! * 0.2126
    + channels[1]! * 0.7152
    + channels[2]! * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Preserva a cor proposta quando ela atende ao contraste de texto normal. */
export function readableColor(foreground: string, background: string): string {
  if (contrastRatio(foreground, background) >= 4.5) return foreground;
  return contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
    ? '#ffffff'
    : '#000000';
}

/**
 * O painel usa um véu de 94%. Calculamos o caso mais claro possível,
 * considerando uma região completamente branca da arte por baixo dele.
 */
export function panelAccent(accent: string, dark: string): string {
  const channels = [0, 2, 4].map((offset) =>
    parseInt(dark.slice(1 + offset, 3 + offset), 16),
  );
  const background = '#' + channels
    .map((channel) => Math.round(channel * 0.94 + 255 * 0.06)
      .toString(16).padStart(2, '0'))
    .join('');

  const original = [0, 2, 4].map((offset) =>
    parseInt(accent.slice(1 + offset, 3 + offset), 16),
  );

  // Clareia somente o texto; fotos e logos nunca recebem tratamento de cor.
  for (let step = 0; step <= 20; step += 1) {
    const amount = step / 20;
    const candidate = '#' + original
      .map((channel) => Math.round(channel + (255 - channel) * amount)
        .toString(16).padStart(2, '0'))
      .join('');
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }

  return '#ffffff';
}
