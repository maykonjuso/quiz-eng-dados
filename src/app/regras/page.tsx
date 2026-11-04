'use client';

import { NIVEIS } from '@/deck/types';
import { DECK } from '@/deck/content';

const PERGUNTAS = DECK.filter((c) => c.tipo === 'QuizScene').length;

/** Jogo com regra escondida gera reclamação no fim. Esta página fica aberta. */
export default function Regras() {
  return (
    <main style={{ padding: 'var(--e5) var(--e6)', maxHeight: '100vh', overflow: 'auto' }}>
      <div className="olho">Kahoot · Engenharia de Dados na era da IA</div>
      <h1 className="titulo" style={{ fontSize: 40, marginBottom: 'var(--e3)' }}>As regras, todas</h1>

      <div className="grade" style={{ maxWidth: 880 }}>
        <div className="cartao">
          <h2 style={{ fontSize: 22 }}>De onde vem o XP</h2>
          <ul style={{ color: 'var(--tinta-2)', lineHeight: 1.7 }}>
            <li>São <strong>{PERGUNTAS} perguntas</strong>. Cada acerto vale <strong>40 XP</strong>, mais até <strong>30 XP</strong> de bônus por velocidade.</li>
            <li>Acertos seguidos ativam o <strong>combo</strong>: ×1.1 a partir do 2º, ×1.2 a partir do 4º, ×1.3 a partir do 6º.</li>
            <li>Errar ou não responder <strong>não tira XP</strong>: só zera o combo.</li>
            <li>Dá para responder depois que o tempo acaba, até a revelação, mas sem o bônus de velocidade.</li>
          </ul>
        </div>

        <div className="cartao">
          <h2 style={{ fontSize: 22 }}>Níveis</h2>
          <div style={{ display: 'grid', gap: 'var(--e05)', marginTop: 'var(--e1)' }}>
            {NIVEIS.map((n) => (
              <div key={n.nivel} style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center' }}>
                <span className="chip">{n.xp} XP</span>
                <strong>{n.patente}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="cartao">
          <h2 style={{ fontSize: 22 }}>Justiça</h2>
          <ul style={{ color: 'var(--tinta-2)', lineHeight: 1.7 }}>
            <li>A resposta certa fica no servidor: ela não está no código que o navegador baixa.</li>
            <li>As alternativas aparecem na mesma ordem para todo mundo, mas não na ordem em que foram escritas.</li>
            <li>Cada pessoa responde uma vez por pergunta.</li>
            <li>Quem cai da rede volta com o mesmo XP. Quem chega atrasado entra jogando dali para frente.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
