'use client';

import { useEffect, useRef, useState } from 'react';
import { useArena } from '@/deck/useArena';
import { SceneRouter } from '@/components/SceneRouter';
import { Encaixe } from '@/components/Encaixe';
import { Icone } from '@/components/Icone';
import { MenuControles } from '@/components/MenuControles';
import { Avatar } from '@/components/Avatar';
import { Ilustra } from '@/components/Ilustra';
import { Tour } from '@/components/Tour';
import { Perfil } from '@/components/Perfil';
import { useTema } from '@/deck/useTema';
import { nivelDe } from '@/deck/types';
import { DECK } from '@/deck/content';
import { CartaoConquista, Confete } from '@/components/Celebracao';
import { prepararFoto } from '@/deck/foto';

import { AVATARES, AVATAR_PADRAO } from '@/deck/avatares';

/**
 * A tela do participante. É o deck, e é a única URL dele no quiz inteiro: as
 * perguntas, as respostas e o pódio acontecem DENTRO do slide.
 *
 * Navegação: por padrão ele segue o apresentador ("ao vivo"). Se quiser olhar
 * um slide anterior, ele navega livremente e um botão grande oferece voltar ao
 * vivo. Sem essa saída, quem perdeu algo fica preso olhando uma tela onde não
 * tem nada para fazer, e foi exatamente isso que aconteceu nos testes de sala.
 */
export default function Player() {
  const arena = useArena('player');
  const { eu, estado, conectado, aviso, entrar } = arena;
  const [nick, setNick] = useState('');
  const [emoji, setEmoji] = useState<string>(AVATAR_PADRAO);
  const [tour, setTour] = useState(false);
  const [perfil, setPerfil] = useState(false);
  /** foto escolhida antes de entrar: dataUrl pronto para enviar */
  const fotaPendente = useRef<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoErro, setFotoErro] = useState<string | null>(null);
  const { tema, trocar } = useTema('claro');
  /** índice da cena que estou olhando por conta própria (null = ao vivo) */
  const [livre, setLivre] = useState<number | null>(null);

  // só para trás: o participante revê o que já passou, mas nunca adianta o
  // que o apresentador ainda não mostrou (o teto é o slide ao vivo)
  const tetoSlide = Math.min(DECK.length - 1, estado.cenaIndex);

  // volta ao vivo quando o apresentador pede, ou quando a sala muda de cena
  useEffect(() => {
    const s = arena.socket;
    const aoVivo = () => setLivre(null);
    s?.on('aovivo', aoVivo);
    return () => { s?.off('aovivo', aoVivo); };
  }, [arena.socket]);

  // envia foto pendente logo após o login ser concluído
  useEffect(() => {
    if (!eu || !fotaPendente.current) return;
    const dataUrl = fotaPendente.current;
    fotaPendente.current = null;
    arena.enviarFoto(dataUrl);
  }, [eu]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.tagName === 'INPUT') return;
      if (e.key === 'Escape') setLivre(null);
      // navegação livre: só com as setas, travada no último slide já mostrado pelo apresentador
      if (e.key === 'ArrowLeft') setLivre((l) => Math.max(0, (l ?? estado.cenaIndex) - 1));
      // → só anda de volta em direção ao ao vivo; chegando nele, volta ao vivo
      if (e.key === 'ArrowRight') setLivre((l) => (l === null || l + 1 >= tetoSlide ? null : l + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [estado.cenaIndex, tetoSlide]);

  if (!eu) {
    const usados = new Set(arena.placar.individual.map((p) => p.emoji));
    if (arena.expulso) {
      return (
        <div className="centro">
          <div className="cartao" style={{ width: 'min(440px, 100%)', display: 'grid', gap: 'var(--e2)', textAlign: 'center' }}>
            <div style={{ display: 'grid', placeItems: 'center' }}><Icone nome="sair" tamanho={40} cor="var(--erro)" /></div>
            <h1 style={{ fontSize: 24 }}>Sua participação foi encerrada</h1>
            <p style={{ color: 'var(--tinta-2)' }}>{arena.expulso}</p>
            <button className="btn" onClick={() => location.reload()}>entrar de novo</button>
          </div>
        </div>
      );
    }
    const doEntrar = () => entrar(nick.trim(), emoji);
    return (
      <div className="centro">
        <div className="cartao" style={{ width: 'min(470px, 100%)', display: 'grid', gap: 'var(--e2)' }}>
          <div className="olho" style={{ display: 'flex', gap: 'var(--e1)', alignItems: 'center' }}>
            <Icone nome="xp" tamanho={16} /> Kahoot · Engenharia de Dados
          </div>
          <h1 className="titulo" style={{ fontSize: 34 }}>Escolha seu nome</h1>
          <input className="btn" style={{ textAlign: 'left', borderColor: arena.nomeRecusado ? 'var(--erro)' : 'var(--borda)' }}
            placeholder="seu nome" value={nick} maxLength={20}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nick.trim()) doEntrar(); }} />

          {arena.nomeRecusado && (
            <div className="cartao" style={{ borderColor: 'var(--erro)', display: 'grid', gap: 'var(--e1)' }}>
              <span style={{ fontSize: 14 }}>
                Já tem alguém chamado <strong>{arena.nomeRecusado.nome}</strong> na sala. Escolha outro para
                ninguém confundir o seu XP com o dele.
              </span>
              {arena.nomeRecusado.sugestoes.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--e1)', flexWrap: 'wrap' }}>
                  {arena.nomeRecusado.sugestoes.map((su) => (
                    <button key={su} className="btn" style={{ padding: 'var(--e1) var(--e2)' }}
                      onClick={() => { setNick(su); entrar(su, emoji); }}>
                      {su}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* foto opcional: aparece como preview e é enviada logo após entrar */}
          <div>
            <div className="olho" style={{ marginBottom: 'var(--e1)' }}>sua foto (opcional)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)' }}>
              {fotoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoPreview} alt="sua foto" width={56} height={56}
                  style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--borda)', flex: 'none' }} />
              ) : (
                <span style={{ fontSize: 36, lineHeight: 1, flex: 'none' }}>{emoji}</span>
              )}
              <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                <label className="btn" style={{ padding: 'var(--e1) var(--e2)', cursor: 'pointer', justifySelf: 'start' }}>
                  {fotoPreview ? 'trocar foto' : 'enviar foto'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      setFotoErro(null);
                      const r = await prepararFoto(f);
                      if ('erro' in r) { setFotoErro(r.erro); return; }
                      fotaPendente.current = r.dataUrl;
                      setFotoPreview(r.dataUrl);
                    }} />
                </label>
                {fotoPreview && (
                  <button className="btn" style={{ padding: 'var(--e1) var(--e2)', justifySelf: 'start' }}
                    onClick={() => { fotaPendente.current = null; setFotoPreview(null); setFotoErro(null); }}>
                    remover foto
                  </button>
                )}
                {fotoErro && <small style={{ color: 'var(--erro)' }}>{fotoErro}</small>}
                {!fotoErro && <small style={{ color: 'var(--tinta-2)' }}>PNG, JPG ou WebP · até 2 MB</small>}
              </div>
            </div>
          </div>

          <div>
            <div className="olho" style={{ marginBottom: 'var(--e1)' }}>
              {fotoPreview ? 'ou escolha um bicho (aparece quando não tem foto)' : `escolha seu bicho (${AVATARES.length} opções${usados.size ? `, ${usados.size} já escolhidos` : ''})`}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
              gap: 'var(--e05)', maxHeight: 210, overflowY: 'auto', padding: 'var(--e05)',
              border: '1px solid var(--borda)', borderRadius: 'var(--r-p)', background: 'var(--papel-2)',
            }}>
              {AVATARES.map((e) => {
                const emUso = usados.has(e);
                return (
                  <button key={e} onClick={() => setEmoji(e)} aria-label={`avatar ${e}`}
                    title={emUso ? 'já escolhido por alguém' : undefined}
                    style={{
                      fontSize: 24, lineHeight: 1, padding: 'var(--e1) 0', cursor: 'pointer',
                      borderRadius: 'var(--r-p)', background: emoji === e ? 'var(--acento-suave)' : 'var(--papel)',
                      border: `1.5px solid ${emoji === e ? 'var(--acento)' : 'transparent'}`,
                      opacity: emUso && emoji !== e ? 0.32 : 1,
                    }}>
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="btn primario" disabled={!nick.trim()} onClick={doEntrar}>
            entrar
          </button>

          <small style={{ color: 'var(--tinta-2)' }}>
            Guardamos só o nome, o bicho e a foto, se você enviar. Tudo é apagado depois do evento.
          </small>
        </div>
      </div>
    );
  }

  const nivel = nivelDe(eu.xp);
  const indiceAtual = livre ?? estado.cenaIndex;
  const cenaVista = livre === null ? arena.cena : DECK[livre];
  return (
    <div className="palco" data-papel="player">
      <Encaixe modo="rolagem" chave={`${cenaVista.id}:${estado.passo}:${estado.fase}`}>
        <SceneRouter
          arena={arena}
          papel="player"
          cenaForcada={livre === null ? undefined : cenaVista}
        />
      </Encaixe>

      {/* fora do ao vivo: faixa grande, impossível de não ver */}
      {livre !== null && (
        <button className="btn primario"
          onClick={() => setLivre(null)}
          style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', gap: 'var(--e1)', alignItems: 'center' }}>
          <Icone nome="tocar" tamanho={16} /> voltar ao vivo (você está olhando sozinho)
        </button>
      )}

      {/* uma linha só: identidade, XP e navegação à mostra; ajuda e tela
          em menus que abrem para cima */}
      <div className="controles">
        <div className="bloco-controle" title={`nível ${nivel.nivel}: ${nivel.patente}`}>
          <Avatar pessoa={eu} tamanho={22} />
          <strong style={{ fontSize: 14, marginLeft: 'var(--e1)' }}>{eu.nick}</strong>
        </div>

        {/* a posição de cada um só aparece no pódio (como no Kahoot); aqui
            fica só o próprio XP e o combo */}
        <div className="bloco-controle" title="seu XP e o combo de acertos seguidos">
          <span className="btn-icone"><Icone nome="xp" tamanho={15} /> {eu.xp}<span className="texto"> XP</span>
            {(eu.combo ?? 1) > 1 && <strong style={{ marginLeft: 'var(--e05)', color: 'var(--acento)' }}>×{eu.combo?.toFixed(1)}</strong>}
          </span>
        </div>

        <div className="bloco-controle">
          <button className="btn-icone" title="olhar o slide anterior"
            disabled={indiceAtual <= 0}
            onClick={() => setLivre((l) => Math.max(0, (l ?? estado.cenaIndex) - 1))}>
            <Icone nome="anterior" tamanho={16} /><span className="texto">voltar</span>
          </button>
          {livre !== null && (
            <button className="btn-icone destaque" onClick={() => setLivre(null)}>
              <Icone nome="tocar" tamanho={16} /><span className="texto">ao vivo</span>
            </button>
          )}
        </div>

        <MenuControles rotulo="ajuda" icone="ajuda">
          <button className="btn-icone" onClick={() => arena.emit('pulso', 'perdi')} title="avisa quem está apresentando, sem custo nenhum">
            <Icone nome="duvida" tamanho={16} /><span className="texto">me perdi</span>
          </button>
          <button className="btn-icone" onClick={() => setTour(true)} title="o que é cada coisa desta tela">
            <Icone nome="info" tamanho={16} /><span className="texto">o que é cada coisa</span>
          </button>
        </MenuControles>

        <MenuControles rotulo="você" icone="ajustes" titulo="seu nome, sua foto e as cores">
          <div className="info-menu">nível {nivel.nivel}: <strong>{nivel.patente}</strong></div>
          <button className="btn-icone" onClick={() => setPerfil(true)} title="trocar seu nome, seu avatar ou sair">
            <Icone nome="nome" tamanho={16} /><span className="texto">nome, avatar e foto</span>
          </button>
          <button className="btn-icone" onClick={() => trocar()} title="alternar entre slide claro e escuro">
            <Icone nome="olho" tamanho={16} /><span className="texto">slide {tema === 'claro' ? 'claro' : 'escuro'}</span>
          </button>
        </MenuControles>

        <div className="estado-faixa">
          {estado.pausado && <span className="chip forte"><Icone nome="pausar" tamanho={14} /> pausado</span>}
          <span className="chip">
            {!conectado ? '🔴 reconectando' : livre === null ? '🟢 ao vivo' : '🟡 olhando sozinho'}
          </span>
        </div>
      </div>

      {tour && <Tour onFechar={() => setTour(false)} />}
      {perfil && <Perfil arena={arena} onFechar={() => setPerfil(false)} />}

      {/*
        Ninguém mexeu há 4 minutos. A tela pergunta se a pessoa está aí e, até
        ela responder, sai da contagem da sala: assim um notebook esquecido
        aberto não impede o quiz de revelar.
      */}
      {arena.ocioso && (
        <div className="nivel-cheio" style={{ animation: 'none', background: 'rgba(250,250,249,.97)' }}>
          <div className="cartao" style={{ textAlign: 'center', display: 'grid', gap: 'var(--e2)', maxWidth: 420 }}>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <Icone nome="duvida" tamanho={44} cor="var(--atencao)" />
            </div>
            <h2 style={{ fontSize: 26 }}>Você ainda está aí?</h2>
            <p style={{ color: 'var(--tinta-2)' }}>
              Faz um tempo que você não mexe. Enquanto isso você fica fora da contagem da sala,
              para não travar a revelação das perguntas. Seu XP está guardado.
            </p>
            <button className="btn primario" onClick={arena.estouAqui}>estou aqui, voltar</button>
          </div>
        </div>
      )}

      {/* avisos */}
      {arena.ganho && (
        <div className="flutuante ganho-flutuante" key={arena.ganho.em}>
          +{arena.ganho.xp} XP{arena.ganho.mult > 1 ? ` ×${arena.ganho.mult}` : ''}
        </div>
      )}
      <CartaoConquista arena={arena} />
      {aviso && <div className="toast">📣 {aviso}</div>}
      {arena.subiuNivel && (
        <div className="nivel-cheio">
          <Confete />
          <div className="nivel-cartao">
            <Ilustra nome="trofeu" tamanho={64} />
            <div className="olho">subiu de nível</div>
            <div style={{ fontSize: 'clamp(32px, 5vw, 64px)', fontWeight: 800 }}>{eu.nick}</div>
            <div className="chip forte grande" style={{ marginTop: 'var(--e2)' }}>{arena.subiuNivel.patente}</div>
          </div>
        </div>
      )}
    </div>
  );
}
