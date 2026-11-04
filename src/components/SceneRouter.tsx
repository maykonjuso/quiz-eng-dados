'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Arena } from '@/deck/useArena';
import type { Cena, Papel } from '@/deck/types';
import { Icone } from './Icone';
import { Ilustra, IlustraDestaque, type NomeIlustra } from './Ilustra';
import { Texto } from './Texto';
import { Cabecalho } from './Cabecalho';
import { ITENS as CONTROLES } from './Tour';
import { liberada, encerrada } from '@/deck/liberada';
import { embaralhar } from '@/deck/embaralhar';
import { PodioDaCena } from './Celebracao';

/**
 * Uma cena, três projeções. O conteúdo é o mesmo objeto; quem muda é o papel:
 *  - screen  → projetor (gigante, sem interação)
 *  - player  → celular ou notebook do participante (é onde ele responde)
 *  - host    → sua tela (resposta certa, progresso, controles)
 */
export function SceneRouter({
  arena, papel, cenaForcada,
}: {
  arena: Arena; papel: Papel; cenaForcada?: Cena;
}) {
  // no modo livre o participante olha outra cena sem tirar a sala do lugar
  const cena = cenaForcada ?? arena.cena;

  // no quiz o pódio é o passo depois da resposta, como no Kahoot
  if (!cenaForcada && arena.estado.fase === 'revelada' && arena.estado.cenaId === cena.id
      && cena.tipo === 'QuizScene' && arena.estado.passo >= 1) {
    return <PodioDaCena arena={arena} titulo={cena.titulo} />;
  }

  // pergunta que já passou: aparece para rever, mas travada
  if (cena.tipo === 'QuizScene' && encerrada(arena, cena, papel)) {
    return (
      <div className="so-leitura">
        <div className="faixa-leitura"><Icone nome="cadeado" tamanho={15} /> pergunta encerrada: só para rever</div>
        {/* inert: nada aqui dentro recebe clique, foco ou digitação */}
        <div inert style={{ display: 'contents' }}>{desenhar(cena)}</div>
      </div>
    );
  }
  return desenhar(cena);

  function desenhar(cena: Cena) {
    switch (cena.tipo) {
      case 'ModuleCover': return <Capa cena={cena} />;
      case 'Controles': return <Controles cena={cena} />;
      case 'QuizScene': return <Quiz cena={cena} arena={arena} papel={papel} />;
      case 'Scoreboard': return <PodioDaCena arena={arena} titulo={cena.titulo} olho="resultado final" final />;
    }
  }
}

type C<T extends Cena['tipo']> = Extract<Cena, { tipo: T }>;

/** ilustração padrão de cada bloco, quando a cena não escolhe a sua */
const ILUSTRA_DO_MODULO: NomeIlustra[] = ['grafico', 'pessoas', 'mapa', 'cronometro', 'servidor', 'ferramenta', 'trofeu'];

const ilustraDa = (cena: { ilustra?: string; modulo: number }): NomeIlustra =>
  (cena.ilustra as NomeIlustra) ?? ILUSTRA_DO_MODULO[cena.modulo] ?? 'grafico';

/**
 * O que a turma vê enquanto a cena ainda não foi liberada. Para quem
 * apresenta aparece o contrário: um aviso de que aquilo é só prévia.
 */
export function Aguardando({ papel, oque }: { papel: Papel; oque: string }) {
  if (papel === 'host') {
    return (
      <div className="chip" style={{ justifySelf: 'start' }}>
        <Icone nome="olho" tamanho={15} /> prévia: a turma ainda não vê {oque}. Avance para liberar.
      </div>
    );
  }
  return (
    <div className="cartao aguardando" style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center' }}>
      <Icone nome="relogio" tamanho={26} cor="var(--acento)" />
      <span className="corpo-p">
        Leia o enunciado com calma. {oque[0].toUpperCase() + oque.slice(1)} {/^(as|os) /.test(oque) ? 'aparecem' : 'aparece'} quando a gente liberar, e só aí o tempo começa.
      </span>
    </div>
  );
}

/** os atalhos de teclado do participante, os mesmos de src/app/page.tsx */
const TECLAS: { tecla: string; faz: string }[] = [
  { tecla: '←', faz: 'rever as perguntas que já passaram' },
  { tecla: 'Esc', faz: 'voltar ao vivo, para a pergunta da turma' },
];

function Controles({ cena }: { cena: C<'Controles'> }) {
  return (
    <div className="cena" data-modulo={cena.modulo}>
      <Cabecalho ilustra={ilustraDa(cena)} olho="antes de começar" titulo={cena.titulo} />
      <div className="cartao" style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'flex-start' }}>
        <Ilustra nome="ideia" tamanho={26} />
        <p className="corpo-p"><Texto>{cena.legenda}</Texto></p>
      </div>
      <div className="grade-controles">
        {CONTROLES.map((i) => (
          <div key={i.titulo} className="item-controle">
            <span className="icone"><Icone nome={i.icone} tamanho={20} cor="var(--acento)" /></span>
            <span><strong>{i.titulo}</strong>{i.texto}</span>
          </div>
        ))}
      </div>
      <div className="grade-teclas">
        {TECLAS.map((t) => (
          <span key={t.tecla} style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center' }}>
            <code className="kbd">{t.tecla}</code><span className="apoio">{t.faz}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Capa({ cena }: { cena: C<'ModuleCover'> }) {
  return (
    <div className="cena" data-modulo={cena.modulo}>
      <div style={{ display: 'flex', gap: 'var(--e4)', alignItems: 'center', flexWrap: 'wrap' }}>
        <IlustraDestaque nome={ilustraDa(cena)} />
        <div className="grade" style={{ gap: 'var(--e2)' }}>
          <div className="olho">{cena.olho ?? `bloco ${cena.modulo}`}</div>
          <h1 className="titulo">{cena.titulo}</h1>
          <p className="corpo"><Texto>{cena.pergunta}</Texto></p>
          <div className="chip forte" style={{ justifySelf: 'start' }}>
            <Icone nome="xp" tamanho={15} /> {cena.xpDoModulo} XP em jogo
          </div>
        </div>
      </div>
    </div>
  );
}

function Quiz({ cena, arena, papel }: { cena: C<'QuizScene'>; arena: Arena; papel: Papel }) {
  const [escolha, setEscolha] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);
  const { estado, revelacao, emit } = arena;
  useEffect(() => { setEscolha(null); setRecusa(null); }, [cena.id]);

  const revelado = revelacao?.cenaId === cena.id;
  const total = Object.values(revelacao?.distribuicao ?? {}).reduce((s, n) => s + n, 0) || 1;
  const respostas = Object.values(revelacao?.distribuicao ?? {}).reduce((s, n) => s + n, 0);
  const acertos = revelacao?.correta ? revelacao.distribuicao?.[revelacao.correta] ?? 0 : 0;
  // a mesma ordem em todas as telas (a semente é a cena), mas não a do autor
  const alternativas = useMemo(() => embaralhar(cena.alternativas, cena.id), [cena.alternativas, cena.id]);
  const aberta = estado.fase === 'aberta' || estado.fase === 'encerrada';
  const daVez = !estado.cenaId || estado.cenaId === cena.id;
  const podeResponder = papel === 'player' && !escolha && aberta && daVez && !revelado;
  const tempoEsgotado = estado.fase === 'encerrada' && !revelado;

  const contagem = arena.respostas?.cenaId === cena.id ? arena.respostas : null;
  const faltam = contagem ? Math.max(0, contagem.esperados - contagem.total) : null;
  // Kahoot: primeiro só o enunciado; as opções aparecem quando o apresentador libera
  const mostrarOpcoes = liberada(arena, cena, papel);
  const passou = encerrada(arena, cena, papel);

  return (
    <div className="cena" data-modulo={cena.modulo}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)', flexWrap: 'wrap' }}>
        <div className="olho"><Ilustra nome={ilustraDa(cena)} tamanho={18} /> {cena.titulo}</div>
        {estado.restante !== null && !revelado && (
          <span className="chip forte grande">
            <Icone nome="relogio" tamanho={18} /> {estado.restante}s
          </span>
        )}
        {contagem && !revelado && (
          // curto de propósito: o texto longo quebrava a linha e empurrava as opções
          <span className="chip grande" title={`${contagem.total} de ${contagem.esperados} responderam${faltam ? `, faltam ${faltam}` : ''}`}>
            <Icone nome="pessoas" tamanho={18} /> {contagem.total}/{contagem.esperados}
          </span>
        )}
      </div>
      <h2 className="titulo pergunta-quiz" key={`p-${cena.id}`} style={{ fontSize: 'var(--t2)' }}><Texto>{cena.pergunta}</Texto></h2>
      {/* a barra de tempo encolhendo, como no Kahoot */}
      {estado.restante !== null && !revelado && mostrarOpcoes && (
        <div className="barra-tempo" aria-hidden>
          <span style={{ width: `${(estado.restante / cena.segundos) * 100}%` }} data-pouco={estado.restante <= 5} />
        </div>
      )}

      {!mostrarOpcoes && <Aguardando papel={papel} oque="as opções" />}
      {papel === 'host' && estado.fase === 'idle' && <Aguardando papel={papel} oque="as opções" />}

      {mostrarOpcoes && <div className="alternativas kahoot">
        {alternativas.map((a, i) => {
          const votos = revelacao?.distribuicao?.[a.id] ?? 0;
          return (
            <button
              key={a.id}
              className="alt"
              data-cor={i % 4}
              style={{ ['--ordem' as string]: i }}
              data-escolhida={escolha === a.id}
              data-estado={revelado ? (a.id === revelacao?.correta ? 'certa' : 'errada') : undefined}
              disabled={!podeResponder}
              onClick={() => {
                setEscolha(a.id);
                arena.socket?.emit('responder', { cenaId: cena.id, alternativa: a.id },
                  (r: { ok: boolean; motivo?: string }) => {
                    if (!r?.ok) { setEscolha(null); setRecusa(r?.motivo === 'já respondeu' ? 'você já respondeu esta pergunta' : 'a pergunta não está aberta'); }
                  });
              }}
            >
              {/* forma + letra: a cor ajuda, mas quem não distingue cores se guia pela forma */}
              <span className="letra" aria-label={`alternativa ${String.fromCharCode(65 + i)}`}>{['▲', '◆', '●', '■'][i % 4]}</span>
              <span style={{ flex: 1 }}>{a.texto}</span>
              {revelado && (
                <span className="votos-alt">
                  <strong className="numero-votos">{votos}</strong>
                  <span className="barra-votos" style={{ width: `${(votos / total) * 90}px` }} />
                </span>
              )}
              {papel === 'host' && a.id === arena.gabaritos[cena.id]?.correta && (
                <strong style={{ color: 'var(--ok)' }} title="resposta certa (só você vê)">✓</strong>
              )}
            </button>
          );
        })}
      </div>}

      {revelado && (
        <div className="acertos-quiz" data-acao="acertos">
          <strong>{acertos}</strong>
          <span>de {respostas} {respostas === 1 ? 'pessoa acertou' : 'pessoas acertaram'}</span>
        </div>
      )}

      {/* o momento Kahoot de quem respondeu: acertou ou não, em letras grandes */}
      {revelado && papel === 'player' && (
        <div className="veredito" data-certo={escolha === revelacao?.correta} key={`v-${cena.id}`}>
          {escolha === revelacao?.correta
            ? <><Icone nome="feito" tamanho={28} /> Acertou!{arena.ganho ? ` +${arena.ganho.xp} XP` : ''}</>
            : escolha
              ? (() => {
                  // a forma sozinha ("a certa era a ■") não dizia nada: vai a forma
                  // na cor do botão e o texto da alternativa certa
                  const i = alternativas.findIndex((a) => a.id === revelacao?.correta);
                  return (
                    <>
                      <Icone nome="erro" tamanho={26} />
                      <span>Não foi dessa vez. A certa era</span>
                      <span className="certa-veredito">
                        <span className="forma" data-cor={i % 4} aria-hidden>{['▲', '◆', '●', '■'][i % 4]}</span>
                        <span>{alternativas[i]?.texto}</span>
                      </span>
                    </>
                  );
                })()
              : <><Icone nome="relogio" tamanho={28} /> Você não respondeu a tempo</>}
        </div>
      )}
      {(revelado || passou) && (
        <div className="cartao" style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'flex-start' }}>
          <Ilustra nome="ideia" tamanho={30} />
          <p className="corpo-p"><Texto>{cena.explicacao}</Texto></p>
        </div>
      )}
      {papel === 'player' && escolha && !revelado && <div className="chip forte">resposta enviada · segure a ansiedade</div>}
      {papel === 'player' && !escolha && tempoEsgotado && (
        <div className="chip"><Icone nome="tempo" tamanho={15} /> o tempo acabou, mas você ainda pode responder (sem o bônus de velocidade)</div>
      )}
      {papel === 'player' && !daVez && (
        <div className="chip"><Icone nome="olho" tamanho={15} /> você está olhando outra cena. Volte ao vivo para responder.</div>
      )}
      {recusa && <div className="chip forte">{recusa}</div>}
    </div>
  );
}
