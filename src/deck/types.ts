/**
 * O deck é uma máquina de estados de cenas e passos.
 * Uma cena = um slide. O apresentador só aperta "próximo"; quem sabe o que
 * isso significa é a cena.
 */

export type Papel = 'screen' | 'player' | 'host';

export type FaseCena = 'idle' | 'aberta' | 'encerrada' | 'revelada';

export interface Alternativa {
  id: string;
  texto: string;
}

interface CenaBase {
  id: string;
  /** bloco do workshop (0 = abertura), o mesmo número da agenda dos slides */
  modulo: number;
  titulo: string;
  /** ilustração da cena (arquivo em public/ilustra, ver src/components/Ilustra) */
  ilustra?: string;
  /** quantos avanços esta cena consome antes de passar para a próxima */
  passos: number;
  /** minutos planejados: o painel mostra se a sala está adiantada ou atrasada */
  minutos: number;
}

/** capa: abre o quiz e cada bloco de perguntas */
export interface CenaCapa extends CenaBase {
  tipo: 'ModuleCover';
  pergunta: string;
  xpDoModulo: number;
  /** texto pequeno acima do título (padrão: "bloco N") */
  olho?: string;
}

/** como usar a tela: cada controle, onde fica e o que faz */
export interface CenaControles extends CenaBase {
  tipo: 'Controles';
  legenda: string;
}

export interface CenaQuiz extends CenaBase {
  tipo: 'QuizScene';
  pergunta: string;
  alternativas: Alternativa[];
  segundos: number;
  explicacao: string;
  /**
   * A resposta certa NÃO vem para o cliente: ela vive em
   * src/server/gabaritos.mjs. No navegador ela estaria dentro do pacote
   * JavaScript, e qualquer pessoa leria o gabarito nas ferramentas de
   * desenvolvedor. O cliente descobre a resposta quando o servidor revela.
   */
}

export interface CenaPlacar extends CenaBase {
  tipo: 'Scoreboard';
}

export type Cena = CenaCapa | CenaControles | CenaQuiz | CenaPlacar;

/** Estado sincronizado do evento — a única fonte de verdade, no servidor. */
export interface EstadoEvento {
  cenaIndex: number;
  /** maior índice de slide já mostrado pelo apresentador */
  maxCenaIndex?: number;
  /** id da cena da vez: usado para validar resposta de quiz no servidor */
  cenaId?: string | null;
  passo: number;
  fase: FaseCena;
  pausado: boolean;
  /** segundos restantes quando a cena tem timer, ou null */
  restante: number | null;
}

export interface Participante {
  id: string;
  nick: string;
  emoji: string;
  /** endereço da foto enviada (/foto/<id>?v=…), ou null para usar o emoji */
  foto?: string | null;
  xp: number;
  nivel: number;
  presenca: 'ativo' | 'ocioso' | 'desconectado';
  /** se navegou sozinho: saiu do "ao vivo" */
  livre: boolean;
  badges?: string[];
  combo?: number;
}

/** Mesma tabela do servidor (src/server/jogo.mjs) — mantenha as duas em sincronia. */
export const NIVEIS = [
  { nivel: 1, xp: 0, patente: 'Dado bruto' },
  { nivel: 2, xp: 250, patente: 'Bronze' },
  { nivel: 3, xp: 600, patente: 'Silver' },
  { nivel: 4, xp: 1000, patente: 'Gold' },
  { nivel: 5, xp: 1500, patente: 'Lakehouse' },
] as const;

export function nivelDe(xp: number): (typeof NIVEIS)[number] {
  let atual: (typeof NIVEIS)[number] = NIVEIS[0];
  for (const n of NIVEIS) if (xp >= n.xp) atual = n;
  return atual;
}
