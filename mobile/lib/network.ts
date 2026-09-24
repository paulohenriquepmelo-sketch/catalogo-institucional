import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Estado da conexão, lido uma vez pelo sistema e compartilhado pelo app.
 *
 * Com isto o app sabe na hora que está sem internet: não fica esperando uma
 * requisição falhar (até 30 s) nem tentando baixar imagens que não vão
 * chegar.
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

// Ao entrar/sair do modo avião ou com sinal fraco, o sistema costuma
// oscilar (online → offline → online) em menos de um segundo. Só aceitamos a
// mudança depois que ela se mantém por um instante; assim o app não
// redesenha e não tenta sincronizar a cada piscada da conexão.
const SETTLE_MS = 1_500;
let pending: ReturnType<typeof setTimeout> | null = null;
let firstReading = true;

NetInfo.addEventListener((state) => {
  const next = fromState(state);
  if (pending) clearTimeout(pending);
  pending = null;
  if (next.online === snapshot.online && next.unmetered === snapshot.unmetered) {
    firstReading = false;
    return;
  }
  const apply = () => {
    pending = null;
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  // A primeira leitura (app abrindo) vale na hora: se já abriu sem internet,
  // nenhuma tela deve tentar a rede nesse meio-tempo.
  if (firstReading) {
    firstReading = false;
    apply();
    return;
  }
  pending = setTimeout(apply, SETTLE_MS);
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
