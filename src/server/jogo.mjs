/**
 * A camada de jogo: XP, níveis, combos e conquistas.
 *
 * Regra que o código garante: XP nunca diminui. Errar só zera o combo.
 */
import { dao } from './db.mjs';

/** mesma tabela de src/deck/types.ts — mantenha as duas em sincronia */
export const NIVEIS = [
  { nivel: 1, xp: 0, patente: 'Dado bruto' },
  { nivel: 2, xp: 250, patente: 'Bronze' },
  { nivel: 3, xp: 600, patente: 'Silver' },
  { nivel: 4, xp: 1000, patente: 'Gold' },
  { nivel: 5, xp: 1500, patente: 'Lakehouse' },
];

export const BADGES = {
  'chegou-cedo': 'entrou nos 3 primeiros minutos',
  'primeiro-sangue': 'primeiro XP do quiz',
  'pe-de-chumbo': 'combo ×1.3 atingido',
  'mais-rapido': 'a resposta certa mais rápida de uma pergunta',
  lakehouse: 'chegou ao nível 5',
};

/** a versão no endereço faz o navegador buscar a foto nova quando ela muda */
export const enderecoDaFoto = (id, versao) => `/foto/${encodeURIComponent(id)}?v=${versao}`;

export function nivelDe(xp) {
  return NIVEIS.reduce((a, n) => (xp >= n.xp ? n : a), NIVEIS[0]);
}

export function criarJogo({ emitir, emitirPara }) {
  const participantes = new Map();   // id -> estado completo
  const combos = new Map();          // id -> { mult, seguidos }
  let abertoEm = Date.now();

  function recarregarDoBanco() {
    const xps = dao.xpTotais();
    const fotos = dao.versoesDasFotos();
    for (const r of dao.participantes()) {
      participantes.set(r.id, {
        id: r.id, nick: r.nick, emoji: r.emoji, segredo: r.segredo, codigo: r.codigo,
        xp: xps[r.id] ?? 0, nivel: nivelDe(xps[r.id] ?? 0).nivel,
        presenca: 'desconectado', livre: false, visto: r.visto_em,
        badges: dao.badgesDe(r.id),
        foto: fotos[r.id] ? enderecoDaFoto(r.id, fotos[r.id]) : null,
      });
    }
  }

  function publico(p) {
    return {
      id: p.id, nick: p.nick, emoji: p.emoji, foto: p.foto ?? null, xp: p.xp, nivel: p.nivel,
      presenca: p.presenca, livre: p.livre, badges: p.badges,
      combo: combos.get(p.id)?.mult ?? 1,
    };
  }

  /** o placar: só pessoas (o formato com `grupos` é o que o pódio espera) */
  function placar() {
    const individual = [...participantes.values()].map(publico).sort((a, b) => b.xp - a.xp);
    return { individual, grupos: [] };
  }

  /** O único caminho por onde XP entra. O combo é aplicado aqui. */
  function premiar(id, xpBase, tipo, referencia, { usarCombo = false } = {}) {
    const p = participantes.get(id);
    if (!p || xpBase <= 0) return 0;
    const mult = usarCombo ? combos.get(id)?.mult ?? 1 : 1;
    const xp = Math.round(xpBase * mult);
    const ninguemPontuou = [...participantes.values()].every((o) => o.xp === 0);
    dao.lancarXp(id, xp, tipo, referencia);
    const antes = p.nivel;
    p.xp += xp;
    p.nivel = nivelDe(p.xp).nivel;
    emitirPara(id, 'xp', { xp, tipo, referencia, total: p.xp, mult });
    if (p.nivel > antes) {
      emitir('nivel', { id, nick: p.nick, nivel: p.nivel, patente: nivelDe(p.xp).patente });
      if (p.nivel === 5) darBadge(id, 'lakehouse');
    }
    if (ninguemPontuou) darBadge(id, 'primeiro-sangue');
    return xp;
  }

  function darBadge(id, badge) {
    if (!BADGES[badge]) return;
    if (!dao.darBadge(id, badge)) return;
    const p = participantes.get(id);
    if (p) p.badges = dao.badgesDe(id);
    emitir('badge', { id, nick: p?.nick ?? '', badge, descricao: BADGES[badge] });
  }

  function mexerCombo(id, acertou) {
    const c = combos.get(id) ?? { mult: 1, seguidos: 0 };
    if (acertou) {
      c.seguidos += 1;
      c.mult = Math.min(1.3, 1 + Math.floor(c.seguidos / 2) * 0.1);
      if (c.mult >= 1.3) darBadge(id, 'pe-de-chumbo');
    } else {
      c.seguidos = 0;
      c.mult = 1;   // errar nunca tira XP: só zera o combo
    }
    combos.set(id, c);
    emitirPara(id, 'combo', { mult: c.mult, seguidos: c.seguidos });
  }

  /** zera tudo em memória (o banco já foi limpo antes de chamar isso) */
  function reiniciar() {
    participantes.clear();
    combos.clear();
    abertoEm = Date.now();
  }

  return {
    participantes, combos, publico, placar, premiar, darBadge, mexerCombo, recarregarDoBanco, reiniciar,
    get abertoEm() { return abertoEm; },
  };
}
