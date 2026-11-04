/**
 * O quiz inteiro contra um servidor real: três pessoas entram, o apresentador
 * percorre o deck, cada um responde, e o teste confere XP, revelação
 * automática, pódio e que o gabarito não chega para quem não é apresentador.
 *
 * Uso: npm run teste   (sobe o servidor numa porta própria, com banco temporário)
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { DECK } from '../src/deck/content.ts';
import { GABARITOS } from '../src/server/gabaritos.mjs';

const PORTA = 3917;
const URL = `http://localhost:${PORTA}`;
const pasta = mkdtempSync(join(tmpdir(), 'kahoot-teste-'));
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const servidor = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: String(PORTA), ARENA_DB: join(pasta, 'arena.db'), NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((pronto, falhou) => {
  servidor.stdout.on('data', (d) => { if (String(d).includes('participantes')) pronto(); });
  servidor.on('exit', (c) => falhou(new Error(`servidor saiu com ${c}`)));
});

const conectar = () => new Promise((r) => { const s = io(URL, { path: '/rt', transports: ['websocket'] }); s.on('connect', () => r(s)); });
const pedir = (s, ev, ...a) => new Promise((r) => s.emit(ev, ...a, r));

try {
  const host = await conectar();
  ok(await pedir(host, 'host:entrar', '1991'), 'apresentador entra com o PIN');
  ok(!(await pedir(await conectar(), 'host:entrar', 'errado')), 'PIN errado é recusado');

  const pessoas = [];
  for (const nick of ['Ana', 'Bruno', 'Carla']) {
    const s = await conectar();
    let gabaritoVisto = false;
    s.on('gabaritos', () => { gabaritoVisto = true; });
    const r = await pedir(s, 'entrar', { nick, emoji: '🦊' });
    pessoas.push({ s, eu: r.eu, xp: 0, viuGabarito: () => gabaritoVisto });
    s.on('xp', ({ total }) => { pessoas.find((p) => p.s === s).xp = total; });
  }
  ok(pessoas.every((p) => p.eu), 'três pessoas entram');
  const repetido = await pedir(await conectar(), 'entrar', { nick: 'ana', emoji: '🐙' });
  ok(repetido.erro === 'nome-em-uso', 'nome repetido é recusado');

  const perguntas = DECK.map((c, i) => [c, i]).filter(([c]) => c.tipo === 'QuizScene');
  ok(perguntas.length === Object.keys(GABARITOS).length, `toda pergunta tem gabarito (${perguntas.length})`);

  // a primeira pergunta, em detalhe
  const [q1, i1] = perguntas[0];
  const certa = GABARITOS[q1.id].correta;
  const errada = q1.alternativas.find((a) => a.id !== certa).id;
  await pedir(host, 'host:ir', { cenaIndex: i1, cenaId: q1.id, passo: 0, fase: 'idle' });
  const cedo = await pedir(pessoas[0].s, 'responder', { cenaId: q1.id, alternativa: certa });
  ok(!cedo.ok, 'não dá para responder antes de liberar as opções');

  const revelou = new Promise((r) => pessoas[2].s.once('revelacao', r));
  host.emit('host:fase', { fase: 'aberta', segundos: q1.segundos, cenaId: q1.id });
  await esperar(150);
  ok((await pedir(pessoas[0].s, 'responder', { cenaId: q1.id, alternativa: certa })).ok, 'Ana responde certo');
  ok(!(await pedir(pessoas[0].s, 'responder', { cenaId: q1.id, alternativa: errada })).ok, 'Ana não responde duas vezes');
  await esperar(1100);
  await pedir(pessoas[1].s, 'responder', { cenaId: q1.id, alternativa: certa });
  await pedir(pessoas[2].s, 'responder', { cenaId: q1.id, alternativa: errada });
  const rev = await Promise.race([revelou, esperar(3000).then(() => null)]);
  ok(rev?.correta === certa, 'revela sozinha quando todos respondem');
  await esperar(200);
  ok(pessoas[0].xp > 40 && pessoas[0].xp >= pessoas[1].xp, `quem respondeu antes ganhou mais (Ana ${pessoas[0].xp}, Bruno ${pessoas[1].xp})`);
  ok(pessoas[2].xp === 0, 'quem errou fica com 0 XP');
  ok(pessoas.every((p) => !p.viuGabarito()), 'gabarito nunca chega a quem não é apresentador');

  // o resto do deck: todo mundo acerta, e o apresentador revela à mão
  for (const [q, i] of perguntas.slice(1)) {
    await pedir(host, 'host:ir', { cenaIndex: i, cenaId: q.id, passo: 0, fase: 'idle' });
    host.emit('host:fase', { fase: 'aberta', segundos: q.segundos, cenaId: q.id });
    await esperar(60);
    await pedir(pessoas[0].s, 'responder', { cenaId: q.id, alternativa: GABARITOS[q.id].correta });
    host.emit('host:revelar', { cenaId: q.id });
    await esperar(60);
  }
  ok(pessoas[0].xp > perguntas.length * 40, `quem acertou tudo passa de ${perguntas.length * 40} XP (${pessoas[0].xp})`);

  const fim = DECK.findIndex((c) => c.tipo === 'Scoreboard');
  const placar = new Promise((r) => pessoas[1].s.once('placar', r));
  await pedir(host, 'host:ir', { cenaIndex: fim, cenaId: DECK[fim].id, passo: 0, fase: 'idle' });
  const p = await placar;
  ok(p.individual[0]?.nick === 'Ana', 'pódio final com Ana em primeiro');
} finally {
  servidor.kill();
  rmSync(pasta, { recursive: true, force: true });
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
