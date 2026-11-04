'use client';

import { useEffect, useState } from 'react';
import { useArena } from '@/deck/useArena';
import { nivelDe } from '@/deck/types';

/** Resumo pessoal depois do quiz. */
export default function Eu() {
  const arena = useArena('player');
  const { eu, placar } = arena;
  const [agora, setAgora] = useState('');
  useEffect(() => setAgora(new Date().toLocaleDateString('pt-BR')), []);

  useEffect(() => { document.body.classList.add('rolavel'); return () => document.body.classList.remove('rolavel'); }, []);

  if (!eu) return <div className="centro"><div className="cartao">Entre pelo quiz primeiro: <a href="/">abrir</a></div></div>;

  const n = nivelDe(eu.xp);
  const posicao = placar.individual.findIndex((p) => p.id === eu.id) + 1;

  return (
    <main style={{ padding: 'var(--e5) var(--e6) var(--e8)' }}>
      <div className="olho">Kahoot · Engenharia de Dados · {agora}</div>
      <h1 className="titulo" style={{ fontSize: 40 }}>{eu.emoji} {eu.nick}</h1>

      <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', margin: 'var(--e3) 0', maxWidth: 820 }}>
        <div className="cartao"><div className="olho">XP</div><strong style={{ fontSize: 30 }}>{eu.xp}</strong></div>
        <div className="cartao"><div className="olho">nível</div><strong style={{ fontSize: 22 }}>{n.patente}</strong></div>
        <div className="cartao"><div className="olho">posição</div><strong style={{ fontSize: 30 }}>{posicao || '—'}º</strong></div>
      </div>

      {(eu.badges?.length ?? 0) > 0 && (
        <>
          <h2 style={{ fontSize: 22, margin: 'var(--e3) 0 var(--e1)' }}>Conquistas</h2>
          <div style={{ display: 'flex', gap: 'var(--e1)', flexWrap: 'wrap' }}>
            {eu.badges!.map((b) => <span key={b} className="chip forte">🏅 {b.replace(/-/g, ' ')}</span>)}
          </div>
        </>
      )}

      <p style={{ marginTop: 'var(--e3)' }}>
        <a className="btn" href="/regras">as regras</a>{' '}
        <a className="btn" href="/">voltar ao quiz</a>
      </p>
    </main>
  );
}
