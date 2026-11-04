/**
 * As respostas certas do quiz. Só aqui, só no servidor.
 *
 * Se elas morassem no mesmo arquivo de conteúdo que desenha a tela, iriam
 * dentro do pacote JavaScript que o navegador baixa: qualquer pessoa abria as
 * ferramentas de desenvolvedor e lia o gabarito da próxima pergunta.
 *
 * O cliente conhece só as alternativas. Quem decide quem acertou é o
 * servidor, e o apresentador recebe o gabarito por um canal que só ele escuta.
 * O tempo de cada pergunta vem do deck (src/deck/content.ts).
 */
import { DECK } from '../deck/content.ts';

const CORRETAS = {
  // 1 · profissões de dados
  'b1-q1': 'a', 'b1-q2': 'c', 'b1-q3': 'd', 'b1-q4': 'a', 'b1-q5': 'b',
  // 2 · evolução das arquiteturas
  'b2-q1': 'c', 'b2-q2': 'a', 'b2-q3': 'd', 'b2-q4': 'a',
  // 3 · arquitetura batch
  'b3-q1': 'c', 'b3-q2': 'b', 'b3-q3': 'd', 'b3-q4': 'a', 'b3-q5': 'c',
  'b3-q6': 'b', 'b3-q7': 'a', 'b3-q8': 'd', 'b3-q9': 'c',
  // 4 · Databricks na prática
  'b4-q1': 'b', 'b4-q2': 'a', 'b4-q3': 'c', 'b4-q4': 'a', 'b4-q5': 'b', 'b4-q6': 'd',
  // 5 · mão na massa
  'b5-q1': 'b', 'b5-q2': 'a',
};

const XP_BASE = 40;

export const GABARITOS = Object.fromEntries(
  DECK.filter((c) => c.tipo === 'QuizScene').map((c) => {
    if (!CORRETAS[c.id]) throw new Error(`pergunta sem gabarito: ${c.id} (src/server/gabaritos.mjs)`);
    if (!c.alternativas.some((a) => a.id === CORRETAS[c.id])) throw new Error(`gabarito de ${c.id} não é uma das alternativas`);
    return [c.id, { correta: CORRETAS[c.id], segundos: c.segundos, xpBase: XP_BASE }];
  }),
);

export const gabaritoDe = (cenaId) => GABARITOS[cenaId] ?? null;
