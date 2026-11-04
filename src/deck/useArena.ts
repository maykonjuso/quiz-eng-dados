'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { DECK } from './content';
import type { EstadoEvento, Papel, Participante } from './types';

/** o pódio ainda aceita equipes no formato; neste quiz a lista vem vazia */
export interface GrupoPublico {
  nome: string; cor: string; capacidade: number; media: number; xp: number; ordem: number;
  membros: Participante[];
}

export interface Placar {
  individual: Participante[]; grupos: GrupoPublico[];
  /** XP no começo da cena da vez (o servidor guarda), para o "+X nesta rodada" */
  base?: { cenaId: string; ind: Record<string, number>; grp: Record<string, number> } | null;
}

const CHAVE = 'kahoot:eu';
/** 4 minutos sem tocar em nada = provavelmente saiu da frente do computador */
const LIMITE_OCIOSO = 4 * 60_000;

/**
 * Conexão única com o servidor.
 * O estado do quiz NUNCA é calculado aqui: o cliente só desenha o que o
 * servidor manda. É isso que faz uma aba recarregada voltar exatamente para
 * onde estava — cena, tempo e XP.
 */
export function useArena(papel: Papel) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conectado, setConectado] = useState(false);
  const [estado, setEstado] = useState<EstadoEvento>({ cenaIndex: 0, passo: 0, fase: 'idle', pausado: false, restante: null });
  const [eu, setEu] = useState<Participante | null>(null);
  const [placar, setPlacar] = useState<Placar>({ individual: [], grupos: [] });
  const [presenca, setPresenca] = useState<Participante[]>([]);
  const [revelacao, setRevelacao] = useState<{ cenaId: string; correta: string; distribuicao: Record<string, number> } | null>(null);
  /** quantas pessoas já responderam a cena da vez */
  const [respostas, setRespostas] = useState<{ cenaId: string; total: number; esperados: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [badge, setBadge] = useState<{ nick: string; badge: string; descricao: string } | null>(null);
  const [subiuNivel, setSubiuNivel] = useState<{ nick: string; patente: string } | null>(null);
  const [ganho, setGanho] = useState<{ xp: number; mult: number; em: number } | null>(null);
  /** gabaritos do quiz: o servidor só manda para o apresentador autenticado */
  const [gabaritos, setGabaritos] = useState<Record<string, { correta: string; segundos: number; xpBase: number }>>({});
  /** ninguém mexeu há muito tempo: a tela pergunta se a pessoa ainda está aí */
  const [ocioso, setOcioso] = useState(false);
  const ultimaInteracao = useRef(Date.now());
  /** nome recusado por já estar em uso, com sugestões livres */
  const [nomeRecusado, setNomeRecusado] = useState<{ nome: string; sugestoes: string[] } | null>(null);
  /** código de retorno: recupera a conta em outro aparelho */
  const [codigo, setCodigo] = useState<string | null>(null);
  /** o apresentador removeu esta pessoa da sala */
  const [expulso, setExpulso] = useState<string | null>(null);

  /** um timeout por tipo de aviso, sempre cancelando o anterior */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const efemero = useCallback(<T,>(chave: string, set: (v: T | null) => void, valor: T, ms: number) => {
    clearTimeout(timers.current[chave]);
    set(valor);
    timers.current[chave] = setTimeout(() => set(null), ms);
  }, []);

  useEffect(() => {
    const s = io({ path: '/rt', transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setConectado(true);
      if (papel !== 'player') return;
      const salvo = typeof window !== 'undefined' ? localStorage.getItem(CHAVE) : null;
      if (salvo) {
        const { id, nick, emoji, segredo } = JSON.parse(salvo);
        s.emit('entrar', { id, nick, emoji, segredo }, (r: { eu?: Participante; segredo?: string; codigo?: string; erro?: string }) => {
          if (!r.eu) { localStorage.removeItem(CHAVE); setEu(null); return; }
          setEu(r.eu);
          if (r.codigo) setCodigo(r.codigo);
          localStorage.setItem(CHAVE, JSON.stringify({ id: r.eu.id, nick: r.eu.nick, emoji: r.eu.emoji, segredo: r.segredo ?? segredo }));
        });
      }
    });
    s.on('disconnect', () => setConectado(false));
    s.on('estado', (e: EstadoEvento) => { setEstado(e); setRevelacao(null); });
    s.on('tempo', (restante: number) => setEstado((e) => ({ ...e, restante })));
    s.on('placar', setPlacar);
    s.on('presenca', setPresenca);
    s.on('revelacao', setRevelacao);
    s.on('respostas', setRespostas);
    s.on('gabaritos', setGabaritos);
    s.on('aviso', (t: string) => efemero('aviso', setAviso, t, 10_000));
    s.on('xp', ({ total, xp, mult }: { total: number; xp: number; mult: number }) => {
      setEu((p) => (p ? { ...p, xp: total } : p));
      efemero('ganho', setGanho, { xp, mult, em: Date.now() }, 2200);
    });
    s.on('combo', ({ mult }: { mult: number }) => setEu((p) => (p ? { ...p, combo: mult } : p)));
    s.on('nivel', ({ nick, patente, id }: { nick: string; patente: string; id: string }) => {
      setEu((p) => (p && p.id === id ? { ...p, nivel: p.nivel + 1 } : p));
      efemero('nivel', setSubiuNivel, { nick, patente }, 2600);
    });
    s.on('badge', (b: { nick: string; badge: string; descricao: string }) => efemero('badge', setBadge, b, 5000));
    s.on('expulso', ({ motivo }: { motivo: string }) => {
      localStorage.removeItem(CHAVE);
      setEu(null);
      setExpulso(motivo || 'o apresentador encerrou a sua participação');
    });
    s.on('reiniciado', () => {
      localStorage.removeItem(CHAVE);
      window.location.reload();
    });

    /** presença por interação de verdade: quem saiu para o café não trava a revelação */
    const marcar = () => {
      const antes = Date.now() - ultimaInteracao.current > LIMITE_OCIOSO;
      ultimaInteracao.current = Date.now();
      if (antes) { setOcioso(false); s.emit('voltei'); }
    };
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
      window.addEventListener(ev, marcar, { passive: true });
    }

    const batida = setInterval(() => {
      const inativoMs = Date.now() - ultimaInteracao.current;
      s.emit('batida', { inativoMs });
      setOcioso(inativoMs > LIMITE_OCIOSO);
    }, 15_000);
    return () => {
      clearInterval(batida);
      for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
        window.removeEventListener(ev, marcar);
      }
      Object.values(timers.current).forEach(clearTimeout);
      s.close();
      setSocket(null);
    };
  }, [papel, efemero]);

  const entrar = useCallback((nick: string, emoji: string) => {
    const s = socketRef.current;
    if (!s) return;
    const salvo = localStorage.getItem(CHAVE);
    const sessao = salvo ? JSON.parse(salvo) : {};
    s.emit('entrar', { id: sessao.id, nick, emoji, segredo: sessao.segredo }, (r: { eu?: Participante; segredo?: string; codigo?: string; erro?: string; nome?: string; sugestoes?: string[] }) => {
      if (r?.erro === 'nome-em-uso') {
        setNomeRecusado({ nome: r.nome ?? nick, sugestoes: r.sugestoes ?? [] });
        return;
      }
      if (!r?.eu) return;
      setNomeRecusado(null);
      setEu(r.eu);
      if (r.codigo) setCodigo(r.codigo);
      localStorage.setItem(CHAVE, JSON.stringify({ id: r.eu.id, nick: r.eu.nick, emoji: r.eu.emoji, segredo: r.segredo }));
    });
  }, []);

  /** troca o próprio nome (e o avatar), mantendo o XP */
  const renomear = useCallback((nick: string, emoji?: string) =>
    new Promise<{ ok: boolean; erro?: string }>((resolver) => {
      socketRef.current?.emit('renomear', { nick, emoji }, (r: { eu?: Participante; codigo?: string; erro?: string; nome?: string; sugestoes?: string[] }) => {
        if (r?.erro === 'nome-em-uso') {
          setNomeRecusado({ nome: r.nome ?? nick, sugestoes: r.sugestoes ?? [] });
          return resolver({ ok: false, erro: 'nome-em-uso' });
        }
        if (r?.eu) {
          setEu(r.eu);
          if (r.codigo) setCodigo(r.codigo);
          setNomeRecusado(null);
          const anterior = JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
          localStorage.setItem(CHAVE, JSON.stringify({ id: r.eu.id, nick: r.eu.nick, emoji: r.eu.emoji, segredo: anterior.segredo }));
        }
        resolver({ ok: !!r?.eu, erro: r?.erro });
      });
    }), []);

  /** envia a foto já reduzida (src/deck/foto.ts), ou `null` para voltar ao bicho */
  const enviarFoto = useCallback((dataUrl: string | null) =>
    new Promise<{ ok: boolean; erro?: string }>((resolver) => {
      socketRef.current?.emit('perfil:foto', dataUrl, (r: { ok?: boolean; foto?: string | null; erro?: string }) => {
        if (r?.ok) setEu((p) => (p ? { ...p, foto: r.foto ?? null } : p));
        resolver({ ok: !!r?.ok, erro: r?.erro });
      });
    }), []);

  /** sair: limpa este navegador; o servidor bloqueia a reentrada pelo id */
  const sair = useCallback(() => {
    localStorage.removeItem(CHAVE);
    socketRef.current?.emit('sair');
    setEu(null);
    setNomeRecusado(null);
  }, []);

  /** a pessoa confirma que está aí e volta para a contagem da sala */
  const estouAqui = useCallback(() => {
    ultimaInteracao.current = Date.now();
    setOcioso(false);
    socketRef.current?.emit('voltei');
  }, []);

  const cena = useMemo(() => DECK[Math.min(estado.cenaIndex, DECK.length - 1)], [estado.cenaIndex]);

  return {
    socket, conectado, estado, cena, eu, placar, presenca, revelacao, respostas,
    aviso, badge, subiuNivel, ganho, ocioso, gabaritos, nomeRecusado, expulso, codigo,
    entrar, renomear, enviarFoto, sair, estouAqui,
    emit: (ev: string, ...args: unknown[]) => socketRef.current?.emit(ev, ...args),
  };
}

export type Arena = ReturnType<typeof useArena>;
