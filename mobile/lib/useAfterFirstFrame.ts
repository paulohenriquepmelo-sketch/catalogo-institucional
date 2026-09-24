import { useEffect, useState } from 'react';

/**
 * Fica `true` logo depois que a tela aparece pela primeira vez.
 *
 * Telas com listas grandes usam isto para desenhar primeiro o topo (título,
 * contagem) e só então montar a lista: o toque na aba responde na hora e o
 * trabalho pesado vem no quadro seguinte, em vez de congelar a troca de tela.
 * Em telas pré-carregadas em segundo plano, já chega `true` quando o usuário
 * abre a aba.
 */
export function useAfterFirstFrame() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Dois quadros: o primeiro garante que o topo foi desenhado na tela.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  return ready;
}
