'use client';

import { useEffect, useRef, useState } from 'react';
import type { Arena } from '@/deck/useArena';
import { Icone } from './Icone';
import { Avatar } from './Avatar';
import { Ilustra } from './Ilustra';

/**
 * Celebração: o pódio animado (como o placar do Kahoot entre as perguntas),
 * as conquistas e o confete.
 *
 * O pódio aparece depois de toda pergunta. Ele mostra o placar geral e,
 * ao lado de cada nome, quanto a pessoa ganhou naquela rodada. É esse "+57" que
 * faz o jogo ser sentido: o placar sozinho muda devagar demais para alguém
 * perceber que o próprio esforço moveu alguma coisa.
 */

// ─────────────────────────── XP no começo de cada cena ──────────────────────
/** o servidor manda, junto com o placar, o XP de cada um no começo da cena */
function baseDa(arena: Arena, cenaId: string) {
  const b = arena.placar.base;
  return b && b.cenaId === cenaId ? b : null;
}

// ───────────────────────────────── contagem ─────────────────────────────────
/** número que sobe contando até o valor, em ~900ms */
function useContagem(valor: number, atraso = 0) {
  const [atual, setAtual] = useState(0);
  const quadro = useRef<number | null>(null);
  useEffect(() => {
    const inicio = performance.now() + atraso;
    const passo = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - inicio) / 900));
      // desacelera no fim, como um contador de verdade
      setAtual(Math.round(valor * (1 - Math.pow(1 - p, 3))));
      if (p < 1) quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
    return () => { if (quadro.current) cancelAnimationFrame(quadro.current); };
  }, [valor, atraso]);
  return atual;
}

function Numero({ valor, atraso = 0 }: { valor: number; atraso?: number }) {
  return <>{useContagem(valor, atraso)}</>;
}

// ─────────────────────────────────── pódio ──────────────────────────────────
interface Linha { chave: string; nome: string; avatar: string; foto?: string | null; xp: number; ganho: number; cor?: string; eu: boolean }

function linhasDo(arena: Arena, cenaId: string): Linha[] {
  const base = baseDa(arena, cenaId);
  // quem saiu da sala não aparece no ranking (o XP continua guardado e volta
  // com a pessoa); a própria pessoa sempre se vê
  return arena.placar.individual.filter((p) => p.presenca !== 'desconectado' || p.id === arena.eu?.id).map((p) => ({
    chave: p.id, nome: p.nick, avatar: p.emoji, foto: p.foto, xp: p.xp,
    ganho: Math.max(0, p.xp - (base?.ind[p.id] ?? p.xp)),
    eu: p.id === arena.eu?.id,
  }));
}

/**
 * O pódio. `compacto` é a versão de lista (cabe ao lado da resposta do quiz);
 * a cheia tem os três degraus subindo.
 */
export function Podio({
  arena, titulo, compacto = false, suspense = false, inicio = 0,
}: {
  arena: Arena; titulo?: string; compacto?: boolean;
  /** pódio final: revela do 3º para o 1º com pausas, "e o primeiro é…" e confete */
  suspense?: boolean;
  /** atraso (ms) antes de este pódio começar, para revelar um lado depois do outro */
  inicio?: number;
}) {
  const linhas = linhasDo(arena, arena.cena.id);
  const minha = linhas.findIndex((l) => l.eu);
  const top = linhas.slice(0, compacto ? 5 : 3);
  // os 5 que vêm depois do pódio: quem está chegando também aparece
  const resto = compacto ? [] : linhas.slice(3, 8);

  if (!linhas.length) return <p className="corpo-p">ninguém pontuou ainda.</p>;

  // a ordem visual do pódio é 2º, 1º, 3º (o primeiro no meio, mais alto)
  const degraus = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <div className="podio" data-compacto={compacto}>
      {titulo && <div className="olho"><Icone nome="troféu" tamanho={15} /> {titulo}</div>}

      {!compacto && (
        <div className="degraus">
          {suspense && top[0] && (
            <div className="rufar" style={{ ['--atraso' as string]: `${inicio + 3000}ms` }}>e o primeiro lugar é…</div>
          )}
          {suspense && top[0] && <Confete atraso={inicio + 5500} quantidade={28} />}
          {degraus.map((l) => {
            const pos = top.indexOf(l);
            // o 3º aparece primeiro, o 1º por último; no final, com pausas longas
            const atraso = inicio + (suspense ? [5000, 2200, 800][pos] : (2 - pos) * 350);
            return (
              <div key={l.chave} className="coluna-podio" data-pos={pos + 1} data-eu={l.eu}
                style={{ ['--atraso' as string]: `${atraso}ms` }}>
                <div className="quem">
                  {pos === 0 && <span className="coroa"><Ilustra nome="trofeu" tamanho={40} /></span>}
                  <span className="avatar" style={l.cor ? { background: l.cor, color: '#fff' } : l.foto ? { padding: 0, overflow: 'hidden' } : undefined}>{l.foto ? <Avatar pessoa={{ emoji: l.avatar, foto: l.foto }} tamanho={64} /> : l.avatar}</span>
                  <strong className="nome">{l.nome}{l.eu ? ' (você)' : ''}</strong>
                  <span className="pontos"><Numero valor={l.xp} atraso={atraso + 300} /> XP</span>
                  {l.ganho > 0 && <span className="ganho">+{l.ganho} nesta rodada</span>}
                </div>
                {/* o degrau desenhado: alturas diferentes, cor de medalha e o número */}
                <div className="degrau"><span>{pos + 1}</span></div>
              </div>
            );
          })}
        </div>
      )}

      {(compacto ? top : resto).length > 0 && (
        <ol className="ranking" start={compacto ? 1 : 4}>
          {(compacto ? top : resto).map((l, i) => (
            // os 5 seguintes entram antes do pódio, do 8º para o 4º
            <li key={l.chave} data-eu={l.eu} style={{ ['--atraso' as string]: `${inicio + (suspense ? (4 - i) * 120 : i * 90 + (compacto ? 0 : 700))}ms` }}>
              <span className="posicao">{(compacto ? 1 : 4) + i}º</span>
              <span className="nome"><span className="avatar-p" style={l.cor ? { background: l.cor, color: '#fff' } : undefined}>{l.foto ? <Avatar pessoa={{ emoji: l.avatar, foto: l.foto }} tamanho={22} /> : l.avatar}</span> {l.nome}</span>
              {l.ganho > 0 && <span className="ganho">+{l.ganho}</span>}
              <span className="pontos"><Numero valor={l.xp} /> XP</span>
            </li>
          ))}
        </ol>
      )}

      {/* quem não está no topo também se vê: é o que mantém a pessoa no jogo */}
      {minha >= (compacto ? 5 : 8) && (
        <div className="minha-posicao">
          você está em <strong>{minha + 1}º</strong> com <strong>{linhas[minha].xp} XP</strong>
          {linhas[minha].ganho > 0 && <> · ganhou <strong>+{linhas[minha].ganho}</strong> agora</>}
        </div>
      )}
    </div>
  );
}

/**
 * O placar como slide inteiro, depois de cada pergunta (e no fim do quiz):
 * o pódio desenhado, os cinco seguintes e quanto cada um ganhou na rodada.
 */
export function PodioDaCena({ arena, titulo, olho = 'placar · depois da', final = false }: { arena: Arena; titulo: string; olho?: string; final?: boolean }) {
  const pessoas = linhasDo(arena, arena.cena.id);
  const eu = pessoas.find((l) => l.eu);
  return (
    <div className="cena cena-podio" data-modulo={arena.cena.modulo}>
      <div className="cabecalho">
        <div className="moldura"><Ilustra nome="trofeu" tamanho="100%" /></div>
        <div className="textos">
          <div className="olho">{olho}</div>
          <h2 className="titulo-cena">{titulo}</h2>
        </div>
      </div>
      {eu && eu.ganho > 0 && (
        <div className="faixa-ganho">
          <Icone nome="xp" tamanho={20} />
          <span>você ganhou <strong>+<Numero valor={eu.ganho} /> XP</strong></span>
        </div>
      )}
      <Podio arena={arena} suspense={final} />
    </div>
  );
}

// ───────────────────────────────── conquistas ───────────────────────────────
/** nome de vitrine de cada badge (as chaves vêm de src/server/jogo.mjs) */
const NOME_DA_CONQUISTA: Record<string, string> = {
  'chegou-cedo': 'Chegou cedo', 'primeiro-sangue': 'Primeiro XP', 'pe-de-chumbo': 'Pé de chumbo',
  'mais-rapido': 'Mais rápido', lakehouse: 'Lakehouse',
}

/** confete em CSS puro: 18 tiras caindo, cada uma com cor, posição e atraso próprios */
export function Confete({ atraso = 0, quantidade = 18 }: { atraso?: number; quantidade?: number }) {
  const cores = ['var(--acento)', 'var(--ok)', 'var(--atencao)', '#e11d48', '#7c3aed', '#f2c94c'];
  return (
    <div className="confete" aria-hidden>
      {Array.from({ length: quantidade }).map((_, i) => (
        <span key={i} style={{
          left: `${(i * 37) % 100}%`, background: cores[i % cores.length],
          animationDelay: `${atraso + (i % 8) * 110}ms`, ['--giro' as string]: `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
        }} />
      ))}
    </div>
  );
}

/**
 * Conquista desbloqueada: cartão que entra pela lateral com a medalha girando.
 * Quando é de outra pessoa da sala, aparece menor e mais discreto (é bom saber
 * que os outros estão conquistando coisas, mas o destaque é de quem conquistou).
 */
export function CartaoConquista({ arena }: { arena: Arena }) {
  const b = arena.badge;
  if (!b) return null;
  const minha = b.nick === arena.eu?.nick;
  return (
    <div key={`${b.nick}:${b.badge}`} className="conquista" data-minha={minha}>
      {minha && <Confete />}
      <span className="medalha-giro"><Ilustra nome="medalha" tamanho={minha ? 44 : 28} /></span>
      <span>
        <span className="olho">{minha ? 'conquista desbloqueada' : `${b.nick} conquistou`}</span>
        <strong>{NOME_DA_CONQUISTA[b.badge] ?? b.badge.replace(/-/g, ' ')}</strong>
        {b.descricao && <span className="apoio" style={{ display: 'block' }}>{b.descricao}</span>}
      </span>
    </div>
  );
}
