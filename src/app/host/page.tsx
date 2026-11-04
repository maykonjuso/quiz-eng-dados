'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useArena } from '@/deck/useArena';
import { SceneRouter } from '@/components/SceneRouter';
import { Encaixe } from '@/components/Encaixe';
import { useTema } from '@/deck/useTema';
import { DECK, INICIO_DOS_MODULOS, MINUTOS_TOTAIS, NOME_DO_BLOCO, minutosAte } from '@/deck/content';
import { Icone } from '@/components/Icone';
import { MenuControles } from '@/components/MenuControles';

const ROTULO_DA_CENA: Record<string, string> = {
  ModuleCover: 'capa', Controles: 'como funciona', QuizScene: 'pergunta', Scoreboard: 'pódio final',
};
const FASE_EM_PORTUGUES: Record<string, string> = {
  idle: 'só o enunciado', aberta: 'aberta para a turma', encerrada: 'tempo esgotado', revelada: 'resposta / pódio',
};
const FASE_CURTA: Record<string, string> = { idle: 'enunciado', aberta: 'aberta', encerrada: 'esgotado', revelada: 'revelada' };

/**
 * Painel do apresentador. Mesma cena, projeção `host`: você vê a resposta
 * certa, o progresso da sala e os controles.
 *
 * Atalhos: → avança · ← volta · A libera as opções (liga o timer)
 * R revela e pontua · P pausa · V todos ao vivo · S a lista de pessoas.
 */
export default function Host() {
  const arena = useArena('host');
  const { estado, cena, presenca, emit } = arena;
  const [pin, setPin] = useState('');
  const [ok, setOk] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const entrarNoPainel = () => emit('host:entrar', pin, (r: boolean) => { setOk(r); setRecusado(!r); });
  const [pulsos, setPulsos] = useState(0);
  /** o que está na tela do apresentador: o slide ou a lista de pessoas */
  const [vista, setVista] = useState<'slide' | 'pessoas'>('slide');
  /** pessoa com a expulsão aguardando confirmação */
  const [confirmarSaida, setConfirmarSaida] = useState<string | null>(null);
  const [recado, setRecado] = useState('');
  const [nota, setNota] = useState<string | null>(null);
  const { tema, trocar } = useTema('claro');
  /** dupla confirmação para reiniciar o jogo do zero */
  const [confirmaReiniciar, setConfirmaReiniciar] = useState(false);

  const ehQuiz = cena.tipo === 'QuizScene';
  const segundos = cena.tipo === 'QuizScene' ? cena.segundos : null;

  /**
   * Um timeout por aviso, cancelando o anterior. Sem o cancelamento, o timer
   * de um aviso antigo apagava o aviso novo antes da hora — o bug clássico de
   * toast que "pisca e desaparece".
   */
  const timerNota = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = useCallback((t: string) => {
    if (timerNota.current) clearTimeout(timerNota.current);
    setNota(t);
    timerNota.current = setTimeout(() => setNota(null), 6000);
  }, []);

  /**
   * Ritmo do Kahoot: toda cena chega FECHADA. Nas cenas em que a turma age
   * (quiz, exercício, lab, jogo) a sala vê só o enunciado, e quem apresenta
   * explica; o avançar seguinte libera as opções e só aí o tempo começa.
   * Enquanto está fechada, o participante não vê opção nenhuma para clicar
   * (ver src/deck/liberada.ts), então não existe o "cliquei e nada aconteceu".
   */
  const ir = useCallback((i: number) => {
    const alvo = Math.min(Math.max(0, i), DECK.length - 1);
    const c = DECK[alvo];
    emit('host:ir', { cenaIndex: alvo, cenaId: c.id, passo: 0, fase: 'idle', segundos: null });
  }, [emit]);

  /**
   * Relógio do quiz: começa quando o apresentador sai da abertura e fica
   * guardado no navegador, para sobreviver a um recarregar da página. O painel
   * compara com os minutos planejados de cada cena (content.ts).
   */
  const [inicio, setInicio] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    try { const v = Number(localStorage.getItem('kahoot:inicio')); if (v) setInicio(v); } catch { /* aba privada */ }
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (inicio || estado.cenaIndex === 0) return;
    const v = Date.now();
    setInicio(v);
    try { localStorage.setItem('kahoot:inicio', String(v)); } catch { /* aba privada */ }
  }, [estado.cenaIndex, inicio]);
  const zerarRelogio = () => {
    setInicio(null);
    try { localStorage.removeItem('kahoot:inicio'); } catch { /* aba privada */ }
  };
  const decorrido = inicio ? Math.round((agora - inicio) / 60000) : 0;
  const planejado = Math.round(minutosAte(estado.cenaIndex));
  const atraso = decorrido - planejado;

  const abrir = useCallback(
    () => { if (cena.tipo === 'QuizScene') emit('host:fase', { fase: 'aberta', segundos, cenaId: cena.id }); },
    [emit, segundos, cena],
  );

  /**
   * Um botão só, que faz a coisa certa para cada tipo de cena:
   *  - pergunta: enunciado → opções → revela → pódio → próxima cena
   *  - resto:    vai para a próxima cena
   */
  const avancar = useCallback(() => {
    if (cena.tipo === 'QuizScene') {
      // já revelou: primeiro o pódio (passo 1), depois a próxima cena
      if (estado.fase === 'revelada' && estado.passo < 1) return emit('host:passo', 1);
      if (estado.fase === 'revelada') return ir(estado.cenaIndex + 1);
      // nunca abriu: abre
      if (estado.fase === 'idle') return abrir();
      // aberta OU com o tempo esgotado: revela.
      // (antes, "encerrada" caía no abrir() e o avançar ficava reabrindo a
      //  pergunta para sempre, que era o "não passa de pergunta")
      return emit('host:revelar', { cenaId: cena.id });
    }
    if (estado.passo + 1 < cena.passos) return emit('host:passo', 1);
    return ir(estado.cenaIndex + 1);
  }, [cena, estado.fase, estado.passo, estado.cenaIndex, emit, ir, abrir]);

  /** "me perdi" chega da turma; o `off` evita contar o mesmo clique várias vezes */
  useEffect(() => {
    const s = arena.socket;
    if (!ok || !s) return;
    const aoSePerder = () => setPulsos((n) => n + 1);
    s.on('pulso', aoSePerder);
    return () => { s.off('pulso', aoSePerder); };
  }, [ok, arena.socket]);

  useEffect(() => {
    if (!ok) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); avancar(); }
      else if (e.key === 'ArrowLeft') {
        // volta o passo interno; se já está no primeiro, volta uma cena
        if (estado.passo > 0) emit('host:passo', -1);
        else ir(estado.cenaIndex - 1);
      }
      else if (k === 'a') abrir();
      else if (k === 'r' && cena.tipo === 'QuizScene') emit('host:revelar', { cenaId: cena.id });
      else if (k === 'p') emit('host:pausar', !estado.pausado);
      else if (k === 'v') emit('host:aovivo');
      else if (k === 's') setVista((v) => (v === 'pessoas' ? 'slide' : 'pessoas'));
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [ok, avancar, abrir, emit, cena, estado.pausado, estado.passo, estado.cenaIndex, ir]);

  if (!ok) {
    return (
      <div className="centro">
        <div className="cartao" style={{ display: 'grid', gap: 'var(--e2)', width: 'min(360px, 100%)' }}>
          <div className="olho">painel do apresentador</div>
          <input className="btn" style={{ textAlign: 'left' }} placeholder="PIN" value={pin} type="password"
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') entrarNoPainel(); }} />
          <button className="btn primario" onClick={entrarNoPainel}>entrar</button>
          {recusado && (
            <small role="alert" style={{ color: 'var(--erro)' }}>
              PIN errado, ou este computador não pode abrir o painel. O painel abre no computador que roda o
              servidor; pela rede, só com ARENA_HOST_REMOTO=1 e um PIN_HOST próprio.
            </small>
          )}
        </div>
      </div>
    );
  }

  const ativos = presenca.filter((p) => p.presenca === 'ativo').length;
  const corPresenca = (p: string) => (p === 'ativo' ? 'var(--ok)' : p === 'ocioso' ? 'var(--atencao)' : 'var(--borda)');

  return (
    <div className="palco" data-papel="host">
      {vista === 'pessoas' ? (
        <div className="cena" style={{ gap: 'var(--e2)', justifyContent: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 className="titulo" style={{ fontSize: 'clamp(20px, 2.2vw, 32px)', display: 'flex', gap: 'var(--e1)', alignItems: 'center' }}>
              <Icone nome="pessoas" tamanho={28} /> Pessoas na sala
            </h2>
            <span className="chip">{ativos} ativas de {presenca.length}</span>
            <span className="apoio">S volta para o slide</span>
          </div>
          <div className="checklist" style={{ maxHeight: '64vh', overflowY: 'auto' }}>
            {presenca.length === 0 && <div className="item-check"><span className="marca">—</span><span>ninguém entrou ainda</span><span /></div>}
            {[...presenca].sort((a, b) => b.xp - a.xp).map((p) => (
              <div key={p.id} className="item-check" style={{ alignItems: 'center', gridTemplateColumns: 'auto 1fr auto' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--e1)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: corPresenca(p.presenca), flex: 'none' }} title={p.presenca} />
                  <span style={{ fontSize: 22 }}>{p.emoji}</span>
                </span>
                <span className="texto-item">
                  <strong>{p.nick}</strong>
                  <small style={{ color: 'var(--tinta-2)', fontFamily: 'var(--mono)', fontSize: 12 }}>{p.xp} XP · {p.presenca}</small>
                </span>
                {confirmarSaida === p.id ? (
                  <span style={{ display: 'flex', gap: 'var(--e05)' }}>
                    <button className="btn-icone destaque" style={{ background: 'var(--erro)' }}
                      onClick={() => { emit('host:expulsar', { id: p.id }, (r: { nick: string }) => avisar(`${r?.nick ?? p.nick} saiu da sala`)); setConfirmarSaida(null); }}>
                      confirmar
                    </button>
                    <button className="btn-icone" onClick={() => setConfirmarSaida(null)}>não</button>
                  </span>
                ) : (
                  <button className="btn-icone" title="tirar da sala (o XP fica guardado)" onClick={() => setConfirmarSaida(p.id)}>
                    <Icone nome="sair" tamanho={16} cor="var(--erro)" /><span className="texto">expulsar</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Encaixe modo="rolagem" chave={`${cena.id}:${estado.passo}:${estado.fase}`}>
          <SceneRouter arena={arena} papel="host" />
        </Encaixe>
      )}

      {/*
        Controles em grupos por função, com ícone e rótulo. Antes eram doze
        botões numa fila única: no meio de uma apresentação ninguém acha o que
        precisa, e no notebook os últimos saíam da tela.
      */}
      <div className="controles">
        <div className="bloco-controle">
          <span className="rotulo">slides</span>
          <button className="btn-icone" onClick={() => ir(estado.cenaIndex - 1)} title="cena anterior (←)">
            <Icone nome="anterior" tamanho={17} /><span className="texto">voltar</span>
          </button>
          <button className="btn-icone destaque" onClick={avancar} title="avançar (→ ou espaço)">
            <Icone nome={ehQuiz && (estado.fase === 'aberta' || estado.fase === 'encerrada') ? 'olho' : ehQuiz && estado.fase === 'idle' ? 'tocar' : 'proximo'} tamanho={17} />
            <span className="texto">
              {ehQuiz && estado.fase === 'idle' ? 'liberar opções'
                : ehQuiz && (estado.fase === 'aberta' || estado.fase === 'encerrada') ? 'revelar resposta'
                : ehQuiz && estado.fase === 'revelada' && estado.passo < 1 ? 'mostrar pódio'
                : 'próxima cena'}
            </span>
          </button>
          <select className="btn-icone" value="" title="ir direto para um bloco"
            onChange={(e) => { if (e.target.value) { ir(Number(e.target.value)); e.currentTarget.blur(); } }}>
            <option value="">ir para…</option>
            {Object.entries(INICIO_DOS_MODULOS).map(([m, i]) => <option key={m} value={i}>{m}. {NOME_DO_BLOCO[Number(m)] ?? `bloco ${m}`}</option>)}
          </select>
        </div>

        <MenuControles rotulo="sala" icone="pessoas">
          {ehQuiz && (
            <button className="btn-icone" onClick={abrir} title="libera as opções e começa o tempo (A)">
              <Icone nome="tocar" tamanho={17} /><span className="texto">liberar opções</span>
            </button>
          )}
          {ehQuiz && (
            <button className="btn-icone" onClick={() => emit('host:revelar', { cenaId: cena.id })} title="revela a resposta e pontua (R)">
              <Icone nome="olho" tamanho={17} /><span className="texto">revelar agora</span>
            </button>
          )}
          <button className="btn-icone" onClick={() => emit('host:pausar', !estado.pausado)} title="congela o cronômetro (P)">
            <Icone nome={estado.pausado ? 'tocar' : 'pausar'} tamanho={17} />
            <span className="texto">{estado.pausado ? 'retomar' : 'pausar'}</span>
          </button>
          <button className="btn-icone" onClick={() => emit('host:aovivo')} title="traz de volta quem navegou sozinho (V)">
            <Icone nome="pessoas" tamanho={17} /><span className="texto">todos ao vivo</span>
          </button>
          <button className="btn-icone" onClick={() => setVista((v) => (v === 'pessoas' ? 'slide' : 'pessoas'))}
            title="quem está na sala, com o XP de cada um (S)"
            style={{ background: vista === 'pessoas' ? 'var(--tinta)' : undefined, color: vista === 'pessoas' ? 'var(--papel)' : undefined }}>
            <Icone nome="checklist" tamanho={17} /><span className="texto">{vista === 'pessoas' ? 'ver slide' : 'pessoas'}</span>
          </button>
          <button className="btn-icone" onClick={() => trocar()} title="alternar claro e escuro nesta tela">
            <Icone nome="olho" tamanho={17} /><span className="texto">{tema === 'claro' ? 'claro' : 'escuro'}</span>
          </button>
          <input className="btn-icone" style={{ width: 150, border: '1px solid var(--borda)' }} placeholder="recado para a sala" value={recado}
            onChange={(e) => setRecado(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && recado.trim()) { emit('host:aviso', recado.trim()); setRecado(''); avisar('recado enviado'); } }} />
          {!confirmaReiniciar
            ? <button className="btn-icone" style={{ color: 'var(--erro, #dc2626)' }} title="apaga tudo e volta para o slide 0 — pede confirmação"
                onClick={() => setConfirmaReiniciar(true)}>
                <Icone nome="apagar" tamanho={17} /><span className="texto">reiniciar quiz</span>
              </button>
            : <button className="btn-icone" style={{ color: 'var(--erro, #dc2626)', fontWeight: 700 }} title="confirmar reinício — apaga XP e respostas e volta ao slide 0"
                onClick={() => { setConfirmaReiniciar(false); emit('host:reiniciar', null, (r: { ok: boolean }) => avisar(r?.ok ? 'reiniciando…' : 'erro ao reiniciar')); }}>
                <Icone nome="apagar" tamanho={17} /><span className="texto">⚠ confirmar reinício</span>
              </button>}
        </MenuControles>

        <div className="estado-faixa">
          {/*
            Chips curtos, com o texto inteiro no title. Por extenso ("pergunta ·
            pódio / resposta", "0/2 responderam · faltam 2") eles esticavam a
            barra e apertavam a área do slide onde ficam as opções do quiz.
          */}
          <span className="chip" data-chip="fase"
            title={`${ROTULO_DA_CENA[cena.tipo] ?? cena.tipo} · ${FASE_EM_PORTUGUES[estado.fase] ?? estado.fase}`}>
            {ehQuiz ? cena.titulo.toLowerCase() : ROTULO_DA_CENA[cena.tipo] ?? cena.tipo}
            {ehQuiz ? ` · ${FASE_CURTA[estado.fase] ?? estado.fase}` : ''}
          </span>
          {estado.restante !== null && <span className="chip forte" title="tempo que falta"><Icone nome="relogio" tamanho={14} /> {estado.restante}s</span>}
          {cena.tipo === 'QuizScene' && arena.respostas?.cenaId === cena.id && (
            <span className="chip forte" data-chip="respostas"
              title={`${arena.respostas.total} de ${arena.respostas.esperados} responderam${arena.respostas.total < arena.respostas.esperados ? `, faltam ${arena.respostas.esperados - arena.respostas.total}` : ''}`}>
              <Icone nome="pessoas" tamanho={14} /> {arena.respostas.total}/{arena.respostas.esperados}
            </span>
          )}
          {pulsos > 0 && (
            <button className="chip" title="quem clicou em 'me perdi'. Clique para zerar"
              onClick={() => setPulsos(0)} style={{ cursor: 'pointer' }}>
              😵 {pulsos}
            </button>
          )}
        </div>

        {/* o que se consulta de vez em quando: cena, relógio, quantos ativos, terminais */}
        <MenuControles rotulo={`${estado.cenaIndex + 1}/${DECK.length}`} icone="tempo" lado="direita"
          titulo="cena, relógio do plano e pessoas ativas" destaque={atraso > 3 ? `+${atraso}` : null}>
          <span className="chip">cena {estado.cenaIndex + 1}/{DECK.length}</span>
          <button className="chip" title={`planejado até esta cena: ${planejado} min de ${Math.round(MINUTOS_TOTAIS)}. Clique para zerar o relógio.`}
            onClick={zerarRelogio}
            style={{ cursor: 'pointer', borderColor: atraso > 3 ? 'var(--erro)' : undefined, color: atraso > 3 ? 'var(--erro)' : undefined }}>
            <Icone nome="tempo" tamanho={14} />
            {inicio ? `${decorrido} min · plano ${planejado}${atraso > 1 ? ` · ${atraso} atrasado` : atraso < -1 ? ` · ${-atraso} adiantado` : ''}` : `plano: ${Math.round(MINUTOS_TOTAIS)} min`}
          </button>
          <span className="chip"><Icone nome="pessoas" tamanho={14} /> {ativos}/{presenca.length} ativos</span>
        </MenuControles>
      </div>

      {nota && <div className="toast">{nota}</div>}
    </div>
  );
}
