import type { Alternativa, Cena, CenaQuiz } from './types';

/**
 * O DECK do Kahoot de Engenharia de Dados.
 *
 * As perguntas saem dos slides do workshop "Engenharia de Dados na era da IA"
 * (Estevão Lins Maia) e seguem a mesma agenda: profissões, evolução das
 * arquiteturas, arquitetura batch, Databricks na prática e mão na massa.
 *
 * Ritmo do Kahoot, em toda pergunta: o primeiro avanço mostra só o enunciado,
 * o segundo libera as opções e começa o tempo, o terceiro revela a resposta e
 * o quarto mostra o pódio. A pergunta revela sozinha quando todos respondem.
 *
 * A resposta certa de cada pergunta NÃO fica aqui: ela vive em
 * src/server/gabaritos.mjs, que nunca vai para o navegador. Ao criar ou mudar
 * uma pergunta, atualize os dois arquivos.
 */

/** atalho para as quatro alternativas, na ordem a, b, c, d */
const alts = (...textos: string[]): Alternativa[] =>
  textos.map((texto, i) => ({ id: 'abcd'[i], texto }));

let numero = 0;
/** monta uma pergunta numerada; o título vira "Pergunta N" */
function q(c: Omit<CenaQuiz, 'tipo' | 'passos' | 'minutos' | 'titulo' | 'segundos'> & { segundos?: number }): CenaQuiz {
  numero += 1;
  return { tipo: 'QuizScene', passos: 1, minutos: 1.25, segundos: 20, titulo: `Pergunta ${numero}`, ...c };
}

export const DECK: Cena[] = [
  // ════════════════════════════ ABERTURA ════════════════════════════════════
  {
    id: 'abertura', ilustra: 'grafico', tipo: 'ModuleCover', modulo: 0, passos: 1, minutos: 1,
    olho: 'quiz · Estevão Lins Maia', titulo: 'Engenharia de Dados na era da IA',
    pergunta: 'Do **dado bruto** até o valor: vamos ver o que ficou do workshop.',
    xpDoModulo: 1800,
  },
  {
    id: 'controles', ilustra: 'computador', tipo: 'Controles', modulo: 0, passos: 1, minutos: 1.5,
    titulo: 'Como funciona',
    legenda: 'Em toda pergunta, primeiro aparece **só o enunciado**. Quando a gente libera as opções, o tempo começa a contar, e quem responde **mais rápido ganha mais XP**. Acertar em sequência ativa o combo.',
  },

  // ═══════════════════ 1 · PROFISSÕES DE DADOS ══════════════════════════════
  {
    id: 'b1-capa', ilustra: 'pessoas', tipo: 'ModuleCover', modulo: 1, passos: 1, minutos: 0.5,
    titulo: 'Profissões de dados',
    pergunta: 'Quem faz o quê, e **onde a IA entra** no ciclo.',
    xpDoModulo: 350,
  },
  q({
    id: 'b1-q1', ilustra: 'engrenagem', modulo: 1,
    pergunta: 'Qual profissão responde à pergunta **"O dado chega confiável e no horário?"**',
    alternativas: alts('Engenharia de Dados', 'Análise de Dados', 'Ciência de Dados', 'Analytics Engineering'),
    explicacao: 'É a **Engenharia de Dados**: pipelines, tabelas e qualidade, com Spark, SQL, Airflow e Databricks.',
  }),
  q({
    id: 'b1-q2', ilustra: 'ferramenta', modulo: 1,
    pergunta: 'Que ferramentas o slide associa à **Analytics Engineering**?',
    alternativas: alts('MLflow · Serving · Vector Search', 'Spark · Airflow · Databricks', 'dbt · SQL · Git', 'Python · notebooks · MLflow'),
    explicacao: 'Analytics Engineering responde "como modelar para o negócio entender?", com **dbt, SQL e Git**.',
  }),
  q({
    id: 'b1-q3', ilustra: 'robo', modulo: 1,
    pergunta: 'No ciclo de IA, monitorar um modelo em produção é, em boa parte…',
    alternativas: alts('retreinar o modelo todo dia', 'monitorar o uso de GPU', 'ajustar o prompt', 'monitorar dados'),
    explicacao: 'Monitorar um modelo é, em boa parte, **monitorar dados**. Treino, RAG e avaliação são tão bons quanto o dado que chega.',
  }),
  q({
    id: 'b1-q4', ilustra: 'ideia', modulo: 1,
    pergunta: 'Qual destes é **"dados para IA"**, e não "IA para dados"?',
    alternativas: alts('Embeddings atualizados por jobs', 'Assistente que escreve SQL e PySpark', 'Perguntas em linguagem natural', 'Documentação gerada automaticamente'),
    explicacao: '**Embeddings atualizados por jobs** preparam dado para a IA. Os outros três são a IA ajudando quem trabalha com dados.',
  }),
  q({
    id: 'b1-q5', ilustra: 'cadeado', modulo: 1,
    pergunta: 'No slide das profissões, o que é o **harness** de um modelo?',
    alternativas: alts('O hardware onde ele treina', 'O que envolve o modelo: ferramentas, contexto, testes e guardrails', 'Planejar, versionar, testar, revisar, implantar e monitorar', 'O conjunto de dados de treino'),
    explicacao: 'Harness é **o que envolve o modelo**: ferramentas, contexto, testes e guardrails. "Planejar, versionar, testar…" é o SDLC.',
  }),

  // ═══════════════ 2 · EVOLUÇÃO DAS ARQUITETURAS ════════════════════════════
  {
    id: 'b2-capa', ilustra: 'mapa', tipo: 'ModuleCover', modulo: 2, passos: 1, minutos: 0.5,
    titulo: 'Evolução das arquiteturas',
    pergunta: 'Data Warehouse, Data Lake e Lakehouse · **Inmon vs Kimball**.',
    xpDoModulo: 280,
  },
  q({
    id: 'b2-q1', ilustra: 'alerta', modulo: 2,
    pergunta: 'Qual é o **limite** do Data Lake, segundo o slide?',
    alternativas: alts('Só aceita dados estruturados', 'É caro para armazenar', 'Não tem transações e fica sujeito a inconsistências', 'Não serve para ML'),
    explicacao: 'O Data Lake guarda qualquer formato em armazenamento barato, mas **sem transações**. E o BI ainda pede um DW à parte.',
  }),
  q({
    id: 'b2-q2', ilustra: 'casa', modulo: 2,
    pergunta: 'O que faz um Data Lake virar um **Lakehouse**?',
    alternativas: alts('Uma camada transacional, como Delta Lake, Iceberg ou Hudi', 'Trocar o object storage por um banco relacional', 'Um cluster Hadoop maior', 'Um software de BI por cima'),
    explicacao: 'Armazenamento barato **mais uma camada transacional**: ACID, time travel e governança. Aí BI, IA e streaming usam a mesma base.',
  }),
  q({
    id: 'b2-q3', ilustra: 'arvore', modulo: 2,
    pergunta: 'Na abordagem de **Inmon**, como é modelado o EDW central?',
    alternativas: alts('Esquema estrela', 'Documentos JSON', 'Data marts independentes', 'Normalizado, na 3ª forma normal (3FN)'),
    explicacao: 'Inmon é top-down: um **EDW corporativo normalizado (3FN)**, e os marts saem dele. Kimball começa pelos marts em estrela.',
  }),
  q({
    id: 'b2-q4', ilustra: 'estrela', modulo: 2,
    pergunta: 'No lakehouse, a camada **Gold** entrega modelos no espírito de quem?',
    alternativas: alts('Kimball, com modelos dimensionais', 'Inmon, com o modelo normalizado', 'Lambda, com batch e streaming', 'Nenhum dos dois'),
    explicacao: 'A Silver integra os dados no espírito de Inmon, e a **Gold entrega modelos dimensionais, no espírito de Kimball**.',
  }),

  // ═══════════════════ 3 · ARQUITETURA BATCH ════════════════════════════════
  {
    id: 'b3-capa', ilustra: 'cronometro', tipo: 'ModuleCover', modulo: 3, passos: 1, minutos: 0.5,
    titulo: 'Arquitetura batch',
    pergunta: 'Agendamento, OLTP e OLAP, ETL e ELT, **orquestração** e streaming.',
    xpDoModulo: 630,
  },
  q({
    id: 'b3-q1', ilustra: 'relogio', modulo: 3, segundos: 30,
    pergunta: 'Quando roda um job com o agendamento `0 22 * * 1-5`?',
    alternativas: alts('A cada 22 minutos, do dia 1 ao 5', 'Todo dia às 0h22', 'Às 22h, de segunda a sexta-feira', 'No dia 22, de janeiro a maio'),
    explicacao: 'Minuto **0**, hora **22**, qualquer dia do mês, qualquer mês, dia da semana **1-5**: às 22h, de segunda a sexta.',
  }),
  q({
    id: 'b3-q2', ilustra: 'certo', modulo: 3,
    pergunta: 'Uma ingestão **idempotente** é aquela que…',
    alternativas: alts('lê só o que mudou', 'pode rodar 2× sem duplicar', 'é particionada por data de carga', 'nunca falha'),
    explicacao: 'Idempotente: **rodar duas vezes dá o mesmo resultado**, sem duplicar. Ler só o que mudou é ser incremental.',
  }),
  q({
    id: 'b3-q3', ilustra: 'grafico', modulo: 3,
    pergunta: 'Qual destas perguntas é típica de um sistema **OLAP**?',
    alternativas: alts('Qual o status deste pedido?', 'O cliente 42 trocou de endereço?', 'Este pagamento foi aprovado?', 'Quanto vendemos por região no trimestre?'),
    explicacao: 'OLAP faz **leituras grandes de histórico**, colunar e agregável. "Qual o status deste pedido?" é OLTP: o dado atual de uma transação.',
  }),
  q({
    id: 'b3-q4', ilustra: 'elo', modulo: 3,
    pergunta: 'No **ELT**, onde o dado é transformado?',
    alternativas: alts('Depois de carregado, dentro do destino (warehouse ou lakehouse)', 'Antes de sair da origem', 'Num servidor intermediário, antes da carga', 'Na tela do dashboard'),
    explicacao: 'No ELT o dado é **extraído, carregado e só então transformado**, já no destino. No ETL a transformação acontece antes da carga.',
  }),
  q({
    id: 'b3-q5', ilustra: 'engrenagem', modulo: 3,
    pergunta: 'Qual destas tarefas **não** é do orquestrador?',
    alternativas: alts('Reexecutar o que falhou', 'Fazer backfill de datas', 'Guardar os dados em formato colunar', 'Respeitar as dependências entre tarefas'),
    explicacao: 'O orquestrador **comanda, sincroniza e checa**: agenda, respeita dependências, reexecuta, faz backfill e alerta. Guardar dado é papel do armazenamento (Delta, Parquet).',
  }),
  q({
    id: 'b3-q6', ilustra: 'fogo', modulo: 3,
    pergunta: 'Qual é o **custo** da arquitetura Lambda?',
    alternativas: alts('Não reprocessa o histórico', 'Duas lógicas a manter, a de batch e a de streaming', 'Só funciona com Kafka', 'Os dados chegam em horas'),
    explicacao: 'Lambda põe batch (completo e reprocessável) e streaming (rápido, visão parcial) lado a lado. O preço é **manter duas lógicas**.',
  }),
  q({
    id: 'b3-q7', ilustra: 'livro', modulo: 3,
    pergunta: 'No Kafka, o que é o **offset**?',
    alternativas: alts('A posição de cada evento no log', 'Um fluxo nomeado de eventos', 'Um grupo de leitores que divide o trabalho', 'Por quanto tempo o log fica guardado'),
    explicacao: 'Offset é **a posição do evento no log**. Fluxo nomeado é o tópico; leitores que dividem o trabalho, o consumer group; tempo guardado, a retenção.',
  }),
  q({
    id: 'b3-q8', ilustra: 'foguete', modulo: 3, segundos: 30,
    pergunta: 'O que `.trigger(availableNow=True)` faz num job de streaming?',
    alternativas: alts('Processa cada evento em menos de um segundo', 'Apaga o checkpoint antes de começar', 'Fica rodando para sempre', 'Roda como batch agendado: lê o que chegou e para'),
    explicacao: 'Com `availableNow`, **o mesmo código streaming roda como batch agendado**: lê o que chegou desde o último checkpoint e para.',
  }),
  q({
    id: 'b3-q9', ilustra: 'pacote', modulo: 3,
    pergunta: 'MongoDB serve a aplicação, o lakehouse serve análise e IA. Como o dado do Mongo chega na **Bronze**?',
    alternativas: alts('Exportando planilhas toda semana', 'Trocando o MongoDB pelo lakehouse', 'Com CDC (captura de mudanças)', 'Consultando o Mongo direto no dashboard'),
    explicacao: 'Os dois convivem: **CDC** leva as mudanças do Mongo até a Bronze, e cada um faz o que faz melhor.',
  }),

  // ═══════════════════ 4 · DATABRICKS NA PRÁTICA ════════════════════════════
  {
    id: 'b4-capa', ilustra: 'servidor', tipo: 'ModuleCover', modulo: 4, passos: 1, minutos: 0.5,
    titulo: 'Databricks na prática',
    pergunta: 'Delta Lake, Spark e a **arquitetura medalhão**.',
    xpDoModulo: 420,
  },
  q({
    id: 'b4-q1', ilustra: 'chave', modulo: 4,
    pergunta: 'Na pilha do Databricks, quem cuida de **permissões, linhagem e auditoria**?',
    alternativas: alts('Delta Lake', 'Unity Catalog', 'Lakeflow Jobs', 'Apache Spark'),
    explicacao: 'O **Unity Catalog** atravessa a pilha inteira: permissões, linhagem, catálogo e auditoria.',
  }),
  q({
    id: 'b4-q2', ilustra: 'arquivo', modulo: 4,
    pergunta: 'Uma tabela **Delta Lake** é, por baixo…',
    alternativas: alts('arquivos Parquet + um log de transações', 'arquivos CSV + um índice', 'um banco relacional em memória', 'documentos JSON num MongoDB'),
    explicacao: 'Delta é **Parquet + `_delta_log`**: o log de transações é o que dá ACID, time travel e schema enforcement.',
  }),
  q({
    id: 'b4-q3', ilustra: 'relogio', modulo: 4, segundos: 25,
    pergunta: 'Que recurso do Delta Lake é usado em `SELECT * FROM vendas VERSION AS OF 12`?',
    alternativas: alts('MERGE e upserts', 'Schema enforcement', 'Time travel', 'Particionamento'),
    explicacao: '**Time travel**: consultar (ou restaurar) a tabela como ela estava numa versão antiga.',
  }),
  q({
    id: 'b4-q4', ilustra: 'pasta', modulo: 4,
    pergunta: 'Qual camada guarda o dado **sem alteração**, append-only, com origem e horário de ingestão?',
    alternativas: alts('Bronze', 'Silver', 'Gold', 'Nenhuma: o dado bruto é descartado'),
    explicacao: 'A **Bronze** recebe e preserva: conteúdo bruto, origem e horário, para rastrear e reprocessar o histórico.',
  }),
  q({
    id: 'b4-q5', ilustra: 'lupa', modulo: 4,
    pergunta: 'Tipar, deduplicar e tirar nulos e registros inválidos acontece em qual camada?',
    alternativas: alts('Bronze', 'Silver', 'Gold', 'No dashboard'),
    explicacao: 'A **Silver** é o tratamento e a limpeza. A Gold agrega e modela para BI, ML e IA.',
  }),
  q({
    id: 'b4-q6', ilustra: 'elo', modulo: 4,
    pergunta: 'No paralelo entre medalhão e **dbt**, a camada Silver corresponde a…',
    alternativas: alts('Landing', 'Mart', 'Seed', 'Intermediate'),
    explicacao: 'Bronze ↔ Landing, **Silver ↔ Intermediate** (lógica reutilizável, calculada uma vez) e Gold ↔ Mart.',
  }),

  // ═══════════════════════ 5 · MÃO NA MASSA ═════════════════════════════════
  {
    id: 'b5-capa', ilustra: 'ferramenta', tipo: 'ModuleCover', modulo: 5, passos: 1, minutos: 0.5,
    titulo: 'Mão na massa',
    pergunta: 'Do dado bruto ao Gold, **em um job agendado**.',
    xpDoModulo: 140,
  },
  q({
    id: 'b5-q1', ilustra: 'certo', modulo: 5,
    pergunta: 'No mão na massa, o que acontece **antes de publicar a Gold**?',
    alternativas: alts('O dashboard é atualizado', 'As regras de qualidade são validadas, como CHECK (valor > 0)', 'A Bronze é apagada', 'O job é agendado para o dia seguinte'),
    explicacao: 'O passo 4 é **validar**: regras de qualidade antes de publicar a Gold. Só depois vem agendar o job e consumir.',
  }),
  q({
    id: 'b5-q2', ilustra: 'robo', modulo: 5,
    pergunta: 'Onde a turma faz **perguntas em linguagem natural** sobre as tabelas `gold.*`?',
    alternativas: alts('No Genie', 'No Unity Catalog', 'No Lakeflow Jobs', 'No Kafka'),
    explicacao: 'O **Genie** responde perguntas em linguagem natural sobre a Gold. É o passo 6: consumir.',
  }),

  // ═════════════════════════════ ENCERRAMENTO ═══════════════════════════════
  {
    id: 'fim-placar', ilustra: 'trofeu', tipo: 'Scoreboard', modulo: 6, passos: 1, minutos: 2,
    titulo: 'Pódio final',
  },
];

/** Minutos planejados do quiz inteiro. */
export const MINUTOS_TOTAIS = DECK.reduce((s, c) => s + c.minutos, 0);

/** Minutos planejados ANTES da cena `i` começar: o painel compara com o relógio. */
export function minutosAte(i: number): number {
  return DECK.slice(0, i).reduce((s, c) => s + c.minutos, 0);
}

/** Primeira cena de cada bloco, para o "ir para" do painel do apresentador. */
export const INICIO_DOS_MODULOS = DECK.reduce<Record<number, number>>((acc, c, i) => {
  if (!(c.modulo in acc)) acc[c.modulo] = i;
  return acc;
}, {});

/** Nome de cada bloco, para o "ir para" e para a capa. */
export const NOME_DO_BLOCO: Record<number, string> = {
  0: 'abertura', 1: 'profissões de dados', 2: 'evolução das arquiteturas',
  3: 'arquitetura batch', 4: 'Databricks na prática', 5: 'mão na massa', 6: 'pódio final',
};
