/**
 * Servidor único: Next.js + Socket.IO no mesmo processo.
 * Roda tudo numa máquina só, na rede local da sala, sem nuvem.
 *
 * O estado do quiz vive AQUI e é a única fonte de verdade: o cliente nunca
 * calcula cena, tempo nem XP. Quem reconectar pede o estado inteiro de volta e
 * cai exatamente no lugar onde estava.
 */
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import next from 'next';
import { Server } from 'socket.io';

import { dao } from './src/server/db.mjs';
import { criarJogo, enderecoDaFoto } from './src/server/jogo.mjs';
import { validarFoto } from './src/server/fotos.mjs';
import { descreverRede, enderecosDaRede } from './src/server/rede.mjs';
import { podeSerApresentador, criarLimitador } from './src/server/guarda.mjs';
import { GABARITOS, gabaritoDe } from './src/server/gabaritos.mjs';
// o Node 22.18+ lê TypeScript sem build (remove os tipos); o deck é o mesmo do navegador
import { DECK } from './src/deck/content.ts';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);
const PIN_HOST = process.env.PIN_HOST ?? '1991';
const HOST_REMOTO = process.env.ARENA_HOST_REMOTO === '1';
const tentarPin = criarLimitador({ limite: 5, janelaMs: 60_000 });
const tentarCodigo = criarLimitador({ limite: 8, janelaMs: 60_000 });
const segredoNovo = () => randomBytes(32).toString('base64url');
const segredoIgual = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

/** compara nomes sem acento, espaço nem maiúscula: "Ana" e "ana " são o mesmo */
const formaDoNome = (nick = '') => String(nick)
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const app = next({ dev });
const handle = app.getRequestHandler();
const server = createServer((req, res) => {
  // a página /ip pergunta em que endereço o servidor está (só o servidor sabe)
  if (req.url === '/api/rede') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(descreverRede({ porta: port })));
    return;
  }
  // a foto de cada pessoa sai daqui, e não do placar (ver src/server/fotos.mjs)
  const foto = /^\/foto\/([^/?]+)/.exec(req.url ?? '');
  if (foto) {
    const r = dao.foto(decodeURIComponent(foto[1]));
    if (!r) { res.writeHead(404).end(); return; }
    res.writeHead(200, {
      'Content-Type': r.mime, 'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'",
    });
    res.end(Buffer.from(r.dados));
    return;
  }
  return handle(req, res);
});
const io = new Server(server, { path: '/rt', cors: { origin: '*' }, maxHttpBufferSize: 1e6 });

// ───────────────────────────── estado do evento ─────────────────────────────
const estado = dao.getEstado('evento') ?? { cenaIndex: 0, maxCenaIndex: 0, passo: 0, fase: 'idle', pausado: false, restante: null, cenaId: null };
// um deck mais curto que o banco salvo não pode deixar a sala fora do deck
estado.cenaIndex = Math.min(estado.cenaIndex ?? 0, DECK.length - 1);
estado.maxCenaIndex = Math.min(Math.max(estado.maxCenaIndex ?? 0, estado.cenaIndex), DECK.length - 1);
estado.restante = null;

/** código de retorno: recupera a conta num outro aparelho */
const codigoNovo = () => randomBytes(6).toString('base64url').toUpperCase();
const codigoDe = (id) => jogo.participantes.get(id)?.codigo ?? '';

const jogo = criarJogo({
  emitir: (ev, dados) => io.emit(ev, dados),
  emitirPara: (id, ev, dados) => io.to(`p:${id}`).emit(ev, dados),
});
jogo.recarregarDoBanco();
for (const p of jogo.participantes.values()) {
  if (!p.codigo) { p.codigo = codigoNovo(); dao.salvarParticipante(p); }
}

/**
 * XP de cada pessoa no começo da cena da vez. Vai junto com o placar para o
 * pódio mostrar quanto cada um ganhou NAQUELA pergunta.
 */
let baseDaCena = null;
function fotografarCena(cenaId) {
  const p = jogo.placar();
  baseDaCena = { cenaId, ind: Object.fromEntries(p.individual.map((x) => [x.id, x.xp])), grp: {} };
}
const emitirPlacar = () => io.emit('placar', { ...jogo.placar(), base: baseDaCena });
const emitirPresenca = () => io.emit('presenca', [...jogo.participantes.values()].map(jogo.publico));
const salvarEstado = () => dao.setEstado('evento', { ...estado, restante: null });

let timer = null;
/**
 * O quiz da vez. Guardado no servidor para que a revelação possa acontecer
 * sozinha, igual ao Kahoot: quando todo mundo responde, ou quando o tempo acaba.
 */
let quizAtual = null;   // { cenaId, correta, xpBase, segundos }

/** ids de quem saiu por vontade própria ou foi expulso: não pode reentrar com o mesmo id */
const saiuPorVontade = new Set();

function pararTimer() { if (timer) clearInterval(timer); timer = null; }
function iniciarTimer(segundos) {
  pararTimer();
  estado.restante = segundos;
  timer = setInterval(() => {
    if (estado.pausado) return;
    estado.restante = Math.max(0, (estado.restante ?? 0) - 1);
    io.emit('tempo', estado.restante);
    if (estado.restante === 0) {
      pararTimer();
      estado.fase = 'encerrada';
      io.emit('estado', estado);
      // tempo esgotado: revela na hora, como no Kahoot
      if (quizAtual && quizAtual.cenaId === estado.cenaId) revelarQuiz(quizAtual);
    }
  }, 1000);
}

/** quantas pessoas estão na sala e quantas já responderam a cena da vez */
function contagemDeRespostas(cenaId) {
  // só conta quem está acompanhando: uma aba esquecida não trava a revelação
  const esperados = [...jogo.participantes.values()].filter((p) => p.presenca === 'ativo').length;
  const total = dao.respostasDaCena(cenaId).length;
  return { cenaId, total, esperados };
}
const emitirContagem = () => { if (estado.cenaId) io.emit('respostas', contagemDeRespostas(estado.cenaId)); };

/** Revelação: pontua quem acertou (com bônus por velocidade) e mostra o gráfico. */
function revelarQuiz({ cenaId, correta, xpBase = 40, segundos = 20 }) {
  if (estado.fase === 'revelada' && estado.cenaId === cenaId) return;
  const distribuicao = {};
  let maisRapido = null;
  for (const r of dao.respostasDaCena(cenaId)) {
    distribuicao[r.alternativa] = (distribuicao[r.alternativa] ?? 0) + 1;
    if (r.alternativa !== correta) { jogo.mexerCombo(r.participante_id, false); continue; }
    // quem responde mais rápido ganha mais, igual ao Kahoot
    const bonus = Math.round(30 * ((r.restante ?? 0) / segundos));
    jogo.premiar(r.participante_id, xpBase + bonus, 'quiz', cenaId, { usarCombo: true });
    jogo.mexerCombo(r.participante_id, true);
    if (!maisRapido || (r.restante ?? 0) > (maisRapido.restante ?? 0)) maisRapido = r;
  }
  if (maisRapido) jogo.darBadge(maisRapido.participante_id, 'mais-rapido');
  pararTimer();
  estado.fase = 'revelada';
  salvarEstado();
  io.emit('estado', estado);
  io.emit('revelacao', { cenaId, correta, distribuicao });
  emitirPlacar();
}

// ──────────────────────────────── sockets ───────────────────────────────────
io.on('connection', (socket) => {
  let eu = null;
  let host = false;
  /** envolve um handler que só o apresentador pode disparar */
  const soHost = (fn) => (...a) => { if (host) return fn(...a); };

  socket.emit('estado', estado);
  socket.emit('placar', { ...jogo.placar(), base: baseDaCena });

  /** O nome é único na sala, senão ninguém sabe de quem é o XP. */
  function nomeOcupado(nick, meuId) {
    const alvo = formaDoNome(nick);
    return [...jogo.participantes.values()].some((p) => p.id !== meuId && formaDoNome(p.nick) === alvo);
  }
  function sugerirNomes(nick, meuId) {
    const base = String(nick).trim();
    const sugestoes = [];
    for (let n = 2; n <= 40 && sugestoes.length < 3; n++) {
      const tentativa = `${base} ${n}`;
      if (!nomeOcupado(tentativa, meuId)) sugestoes.push(tentativa);
    }
    return sugestoes;
  }

  function registrar({ id, nick, emoji, codigo, segredo }, ack) {
    // identidade é PROVADA (id + segredo deste navegador, ou o código de
    // retorno), nunca digitada: entrar com o nome de outra pessoa não herda o XP
    if (id && saiuPorVontade.has(id)) {
      return ack?.({ erro: 'nome-em-uso', nome: String(nick).trim(), sugestoes: [] });
    }
    if (codigo && !tentarCodigo(socket.handshake.address)) return ack?.({ erro: 'muitas-tentativas' });
    const porCodigo = !id && codigo
      ? [...jogo.participantes.values()].find((p) => codigoDe(p.id) === String(codigo).trim().toUpperCase())
      : null;
    if (codigo && !porCodigo) return ack?.({ erro: 'codigo-invalido' });
    const porId = id && jogo.participantes.get(id);
    if (porId && !segredoIgual(segredo, porId.segredo)) return ack?.({ erro: 'sessao-invalida' });
    const existente = porId || porCodigo;

    if (nomeOcupado(nick, existente?.id)) {
      return ack?.({ erro: 'nome-em-uso', nome: String(nick).trim(), sugestoes: sugerirNomes(nick, existente?.id) });
    }
    if (existente) {
      eu = existente;
      if (porCodigo) {
        eu.segredo = segredoNovo();
        io.in(`p:${eu.id}`).disconnectSockets(true);
      }
      eu.presenca = 'ativo';
      eu.visto = Date.now();
    } else {
      const novoId = randomBytes(16).toString('base64url');
      eu = {
        id: novoId, nick: String(nick || 'anônimo').slice(0, 20), emoji: emoji || '🦊',
        xp: 0, nivel: 1, segredo: segredoNovo(), codigo: codigoNovo(),
        presenca: 'ativo', livre: false, visto: Date.now(), badges: [],
      };
      jogo.participantes.set(eu.id, eu);
      dao.salvarParticipante(eu);
      if (Date.now() - jogo.abertoEm < 3 * 60_000) jogo.darBadge(eu.id, 'chegou-cedo');
    }
    socket.join(`p:${eu.id}`);
    dao.salvarParticipante(eu);
    ack?.({ eu: jogo.publico(eu), segredo: eu.segredo, codigo: codigoDe(eu.id), estado, placar: jogo.placar() });
    emitirPresenca();
    emitirPlacar();
    emitirContagem();
  }

  socket.on('entrar', registrar);

  /** a batida carrega há quanto tempo a pessoa não interage */
  socket.on('batida', ({ inativoMs = 0 } = {}) => {
    if (!eu) return;
    const antes = eu.presenca;
    eu.visto = Date.now();
    eu.presenca = inativoMs > 4 * 60_000 ? 'ocioso' : 'ativo';
    if (antes !== eu.presenca) { emitirPresenca(); emitirContagem(); }
  });
  socket.on('voltei', () => {
    if (!eu) return;
    eu.presenca = 'ativo';
    eu.visto = Date.now();
    emitirPresenca(); emitirContagem();
  });
  socket.on('livre', (v) => { if (eu) { eu.livre = !!v; emitirPresenca(); } });

  /** enviar a própria foto (data URL já reduzida no navegador), ou `null` para tirar */
  socket.on('perfil:foto', (dataUrl, ack) => {
    if (!eu) return ack?.({ erro: 'entre primeiro' });
    if (dataUrl === null) {
      dao.apagarFoto(eu.id);
      eu.foto = null;
    } else {
      const v = validarFoto(dataUrl);
      if (v.erro) return ack?.({ erro: v.erro });
      eu.foto = enderecoDaFoto(eu.id, dao.salvarFoto(eu.id, v.mime, v.dados));
    }
    ack?.({ ok: true, foto: eu.foto });
    emitirPlacar(); emitirPresenca();
  });

  // ─────────────────────────────── quiz ────────────────────────────────────
  socket.on('responder', ({ cenaId, alternativa }, ack) => {
    // aceita até a revelação, mesmo com o tempo esgotado: quem responde tarde
    // perde o bônus de velocidade, não o direito de responder
    if (!eu) return ack?.({ ok: false, motivo: 'entre primeiro' });
    if (estado.cenaId && cenaId !== estado.cenaId) return ack?.({ ok: false, motivo: 'essa não é a pergunta da vez' });
    if (estado.fase === 'revelada') return ack?.({ ok: false, motivo: 'a resposta já foi revelada' });
    if (estado.fase === 'idle') return ack?.({ ok: false, motivo: 'a pergunta ainda não abriu' });
    const chave = `${cenaId}:${eu.id}`;
    if (!dao.registrarResposta(chave, cenaId, eu.id, alternativa, estado.restante ?? 0)) {
      return ack?.({ ok: false, motivo: 'já respondeu' });
    }
    ack?.({ ok: true });
    const contagem = contagemDeRespostas(cenaId);
    io.emit('respostas', contagem);
    // todo mundo respondeu: revela na hora, sem esperar o cronômetro
    if (quizAtual && quizAtual.cenaId === cenaId && contagem.total >= contagem.esperados) {
      setTimeout(() => revelarQuiz(quizAtual), 400);
    }
  });

  socket.on('renomear', ({ nick, emoji }, ack) => {
    if (!eu) return ack?.({ erro: 'entre primeiro' });
    const novo = String(nick ?? '').trim().slice(0, 20);
    if (!novo) return ack?.({ erro: 'escolha um nome' });
    if (nomeOcupado(novo, eu.id)) {
      return ack?.({ erro: 'nome-em-uso', nome: novo, sugestoes: sugerirNomes(novo, eu.id) });
    }
    eu.nick = novo;
    if (emoji) eu.emoji = emoji;
    dao.salvarParticipante(eu);
    ack?.({ eu: jogo.publico(eu), codigo: codigoDe(eu.id) });
    emitirPresenca();
    emitirPlacar();
  });

  /** sair é permanente: a pessoa sai da sala e o id fica bloqueado */
  socket.on('sair', (_, ack) => {
    if (!eu) return ack?.({ ok: true });
    const quem = eu.id;
    saiuPorVontade.add(quem);
    jogo.participantes.delete(quem);
    eu = null;
    socket.leave(`p:${quem}`);
    ack?.({ ok: true });
    emitirPresenca(); emitirPlacar(); emitirContagem();
  });

  socket.on('pulso', (valor) => io.to('host').emit('pulso', { valor }));

  // ───────────────────────────────── host ──────────────────────────────────
  socket.on('host:entrar', (pin, ack) => {
    const endereco = socket.handshake.address;
    const recusa = podeSerApresentador({ endereco, remotoLiberado: HOST_REMOTO, pinDefinido: !!process.env.PIN_HOST });
    if (recusa) { console.warn('[host] recusado de', endereco, '-', recusa); return ack?.(false); }
    if (!tentarPin(endereco)) return ack?.(false);
    host = pin === PIN_HOST;
    if (host) {
      socket.join('host');
      // só o apresentador recebe os gabaritos, e só depois do PIN
      socket.emit('gabaritos', GABARITOS);
    }
    ack?.(host);
  });

  socket.on('host:ir', soHost(({ cenaIndex, cenaId = null, passo = 0, fase = 'idle', segundos = null }, ack) => {
    const alvo = Math.min(Math.max(0, Number(cenaIndex) || 0), DECK.length - 1);
    const maxCenaIndex = Math.max(estado.maxCenaIndex ?? 0, alvo);
    // voltar para a mesma cena não refaz a foto (senão o ganho da rodada some)
    if (cenaId && baseDaCena?.cenaId !== cenaId) { fotografarCena(cenaId); emitirPlacar(); }
    Object.assign(estado, { cenaIndex: alvo, maxCenaIndex, cenaId, passo, fase });
    pararTimer(); estado.restante = null;
    const gab = cenaId ? gabaritoDe(cenaId) : null;
    quizAtual = gab ? { cenaId, ...gab } : null;
    if (segundos && fase === 'aberta') iniciarTimer(segundos);
    salvarEstado();
    io.emit('estado', estado);
    emitirContagem();
    ack?.({ ok: true });
  }));
  socket.on('host:passo', soHost((d) => { estado.passo = Math.max(0, estado.passo + d); salvarEstado(); io.emit('estado', estado); }));
  socket.on('host:fase', soHost(({ fase, segundos = null, cenaId = null }) => {
    estado.fase = fase;
    if (cenaId) estado.cenaId = cenaId;
    const gab = estado.cenaId ? gabaritoDe(estado.cenaId) : null;
    if (gab) quizAtual = { cenaId: estado.cenaId, ...gab };
    if (fase === 'aberta' && segundos) iniciarTimer(segundos);
    else { pararTimer(); if (fase === 'idle') estado.restante = null; }
    salvarEstado();
    io.emit('estado', estado);
    emitirContagem();
  }));

  /** o apresentador pede para revelar; o gabarito sai do servidor */
  socket.on('host:revelar', soHost(({ cenaId } = {}) => {
    const alvo = cenaId ?? estado.cenaId;
    const gab = gabaritoDe(alvo);
    if (gab) revelarQuiz({ cenaId: alvo, ...gab });
  }));

  /** expulsar: a pessoa volta para a tela de entrada; o XP fica no banco */
  socket.on('host:expulsar', soHost(({ id, motivo = '' }, ack) => {
    const p = jogo.participantes.get(id);
    if (!p) return ack?.({ erro: 'não encontrei essa pessoa' });
    saiuPorVontade.add(id);
    jogo.participantes.delete(id);
    io.to(`p:${id}`).emit('expulso', { motivo: String(motivo).slice(0, 140) });
    ack?.({ ok: true, nick: p.nick });
    emitirPresenca(); emitirPlacar(); emitirContagem();
  }));

  socket.on('host:pausar', soHost((v) => { estado.pausado = !!v; salvarEstado(); io.emit('estado', estado); }));
  socket.on('host:aviso', soHost((t) => io.emit('aviso', String(t).slice(0, 200))));
  socket.on('host:aovivo', soHost(() => {
    for (const p of jogo.participantes.values()) p.livre = false;
    io.emit('aovivo'); emitirPresenca();
  }));

  /** reinicia o quiz do zero: zera o banco, volta ao slide 0 e desconecta todos */
  socket.on('host:reiniciar', soHost((_, ack) => {
    dao.zerarJogo();
    jogo.reiniciar();
    saiuPorVontade.clear();
    baseDaCena = null;
    quizAtual = null;
    pararTimer();
    Object.assign(estado, { cenaIndex: 0, maxCenaIndex: 0, passo: 0, fase: 'idle', pausado: false, restante: null, cenaId: null });
    salvarEstado();
    io.emit('reiniciado');
    setTimeout(() => io.disconnectSockets(), 300);
    ack?.({ ok: true });
  }));

  /** fechou o navegador: sai da contagem na hora; o XP fica guardado */
  socket.on('disconnect', () => {
    if (!eu) return;
    eu.presenca = 'desconectado';
    dao.salvarParticipante(eu);
    emitirPresenca();
    emitirContagem();
  });
});

/** quem sumiu sem o navegador avisar sai da contagem depois de 70s sem batida */
setInterval(() => {
  const agora = Date.now();
  let mudou = false;
  for (const p of jogo.participantes.values()) {
    if (p.presenca !== 'desconectado' && p.visto && agora - p.visto > 70_000) {
      p.presenca = 'desconectado';
      mudou = true;
    }
  }
  if (mudou) { emitirPresenca(); emitirContagem(); }
}, 15_000);

app.prepare().then(() => {
  server.listen(port, '0.0.0.0', () => {
    const ip = enderecosDaRede()[0]?.ip ?? 'localhost';
    const l = (t) => console.log('  │ ' + t.padEnd(56) + '│');
    console.log('\n  ┌' + '─'.repeat(57) + '┐');
    l('Kahoot · Engenharia de Dados na era da IA');
    l('');
    l(`participantes   http://${ip}:${port}`);
    l(`projetor        http://localhost:${port}/screen`);
    l(`apresentador    http://localhost:${port}/host   (PIN ${PIN_HOST})`);
    l(`endereço + QR   http://localhost:${port}/ip`);
    console.log('  └' + '─'.repeat(57) + '┘\n');
  });
});
