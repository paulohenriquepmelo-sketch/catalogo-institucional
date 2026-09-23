import { useSyncExternalStore } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Estado da conexão, lido uma vez pelo sistema e compartilhado pelo app.
 *
 * Com isto o app sabe na hora que está sem internet: não fica esperando uma
 * requisição falhar (até 30 s) nem tentando baixar imagens que não vão
 * chegar. Componentes só redesenham quando a conexão realmente muda.
 */

type NetworkSnapshot = {
  /** Há conexão com a internet (na dúvida, considera que sim). */
  online: boolean;
  /** Conexão sem custo para o usuário (Wi-Fi/cabo), boa para downloads grandes. */
  unmetered: boolean;
};

let snapshot: NetworkSnapshot = { online: true, unmetered: false };
const listeners = new Set<() => void>();

function fromState(state: NetInfoState): NetworkSnapshot {
  // isInternetReachable vem `null` enquanto o sistema ainda está testando:
  // nesse caso vale só o isConnected, para não mostrar "offline" à toa.
  const online = state.isConnected !== false && state.isInternetReachable !== false;
  const expensive = state.details?.isConnectionExpensive ?? true;
  return { online, unmetered: online && !expensive };
}

NetInfo.addEventListener((state) => {
  const next = fromState(state);
  if (next.online === snapshot.online && next.unmetered === snapshot.unmetered) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
});

export function isOnline() {
  return snapshot.online;
}

export function isUnmetered() {
  return snapshot.unmetered;
}

/** Avisa quando a conexão muda. Devolve a função para cancelar. */
export function onNetworkChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `true` quando há internet; a tela redesenha quando isso muda. */
export function useIsOnline() {
  return useSyncExternalStore(onNetworkChange, isOnline);
}
