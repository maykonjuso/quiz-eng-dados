'use client';

import { Icone, type NomeIcone } from './Icone';

/**
 * "O que é cada coisa desta tela."
 * Esta janela explica a interface sozinha e fica a um clique o quiz inteiro.
 */
export const ITENS: { icone: NomeIcone; titulo: string; texto: string }[] = [
  { icone: 'xp', titulo: 'XP', texto: 'Seus pontos. Nunca diminuem: acertou, ganhou. Quanto mais rápido, mais XP.' },
  { icone: 'alvo', titulo: 'Combo', texto: 'Acertos seguidos multiplicam o XP, até ×1.3. Errar só zera o combo.' },
  { icone: 'troféu', titulo: 'Pódio', texto: 'Depois de cada pergunta aparece o pódio, com quanto cada um ganhou naquela rodada.' },
  { icone: 'anterior', titulo: 'Voltar', texto: 'Reveja as perguntas que já passaram, só para ler. O botão "ao vivo" traz você de volta.' },
  { icone: 'duvida', titulo: 'Me perdi', texto: 'Avisa quem está apresentando. Não custa nada e a turma não vê.' },
]

export function Tour({ onFechar }: { onFechar: () => void }) {
  return (
    <div onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,11,12,.5)', zIndex: 58, display: 'grid', placeItems: 'center', padding: 'var(--e3)' }}>
      <div className="cartao" onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(760px, 100%)', maxHeight: '82vh', overflow: 'auto', display: 'grid', gap: 'var(--e2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e1)' }}>
          <Icone nome="info" />
          <strong style={{ fontSize: 20 }}>O que é cada coisa desta tela</strong>
          <button className="btn" style={{ marginLeft: 'auto', padding: 'var(--e1) var(--e2)' }} onClick={onFechar}>fechar</button>
        </div>
        <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {ITENS.map((i) => (
            <div key={i.titulo} style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'flex-start' }}>
              <div style={{ width: 38, height: 38, borderRadius: 'var(--r-p)', display: 'grid', placeItems: 'center', background: 'var(--papel-2)', flex: 'none' }}>
                <Icone nome={i.icone} tamanho={19} cor="var(--acento)" />
              </div>
              <div>
                <strong style={{ fontSize: 15 }}>{i.titulo}</strong>
                <p style={{ fontSize: 14, color: 'var(--tinta-2)', marginTop: 'var(--e1)' }}>{i.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
