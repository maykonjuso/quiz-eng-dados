/**
 * Trava do painel do apresentador.
 *
 * O PIN padrão está no README, então qualquer pessoa na mesma rede abriria
 * /host. Por padrão o painel só aceita o próprio computador do servidor; pela
 * rede, só com ARENA_HOST_REMOTO=1 E um PIN definido em PIN_HOST.
 */

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export const ehLocal = (endereco) => LOOPBACK.has(String(endereco ?? ''));

/**
 * Quem pode entrar no painel. Devolve `null` quando pode, ou o motivo.
 * `pinDefinido` diz se o PIN veio do ambiente (e não é o padrão do README).
 */
export function podeSerApresentador({ endereco, remotoLiberado, pinDefinido }) {
  if (ehLocal(endereco)) return null;
  if (!remotoLiberado) return 'o painel só abre no computador que roda o servidor (ARENA_HOST_REMOTO=1 libera pela rede)';
  if (!pinDefinido) return 'para abrir o painel pela rede, defina um PIN próprio em PIN_HOST';
  return null;
}

/** no máximo `limite` tentativas por endereço a cada `janelaMs` */
export function criarLimitador({ limite = 5, janelaMs = 60_000, agora = () => Date.now() } = {}) {
  const tentativas = new Map();
  return (chave) => {
    const t = agora();
    const recentes = (tentativas.get(chave) ?? []).filter((x) => t - x < janelaMs);
    if (recentes.length >= limite) { tentativas.set(chave, recentes); return false; }
    recentes.push(t);
    tentativas.set(chave, recentes);
    return true;
  };
}
