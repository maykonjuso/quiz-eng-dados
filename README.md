# Kahoot · Engenharia de Dados na era da IA

Quiz ao vivo, no estilo Kahoot, sobre o workshop **Engenharia de Dados na era da
IA** (Estevão Lins Maia). São **26 perguntas** em 5 blocos, na mesma ordem da
agenda dos slides:

| Bloco | Tema | Perguntas |
|---|---|---|
| 1 | Profissões de dados e onde a IA entra | 5 |
| 2 | Data Warehouse, Data Lake, Lakehouse · Inmon vs Kimball | 4 |
| 3 | Arquitetura batch: cron, OLTP/OLAP, ETL/ELT, orquestração, Lambda, Kafka, CDC | 9 |
| 4 | Databricks: Unity Catalog, Delta Lake, time travel, medalhão, dbt | 6 |
| 5 | Mão na massa: validar antes da Gold, consumir no Genie | 2 |

Veio do motor de quiz do projeto Linux Day, sem o resto (terminal, labs,
equipes, roleta e eventos).

## Como rodar

```bash
npm install
npm start
```

Precisa do **Node 22.18 ou mais novo** (`node:sqlite` e leitura do deck em
TypeScript sem build). O `npm start` refaz o build antes de subir; se o build já
está atual, `npm run start:rapido` pula essa etapa.

| Papel | URL |
|---|---|
| participante | `http://<seu-ip>:3000` (é o QR code) |
| projetor | `http://localhost:3000/screen` |
| apresentador | `http://localhost:3000/host`, PIN `1991`, **só no computador do servidor** |
| endereço + QR | `http://localhost:3000/ip` |
| extras | `/regras` · `/me` (resumo pessoal) |

Para abrir o painel de outro aparelho: `ARENA_HOST_REMOTO=1 PIN_HOST=<seu pin> npm start`.

Para zerar o XP entre ensaios: `npm run limpar` (ou "reiniciar quiz" no painel).

## O ritmo de cada pergunta

O apresentador só aperta **→** (ou espaço):

1. a sala vê **só o enunciado** (dá para comentar o slide correspondente);
2. **liberar opções**: aparecem as quatro alternativas e o tempo começa;
3. **revelar resposta**: mostra quantos votaram em cada uma e a explicação.
   Revela sozinha quando todos respondem ou quando o tempo acaba;
4. **mostrar pódio**: o placar com quanto cada um ganhou na rodada;
5. **próxima cena**.

Outros atalhos no painel: `←` volta · `A` libera · `R` revela · `P` pausa ·
`V` traz todos ao vivo · `S` lista de pessoas.

## Pontuação

- Acerto: **40 XP + até 30 XP** de bônus por velocidade.
- Combo de acertos seguidos: ×1.1, ×1.2, ×1.3. Errar só zera o combo, nunca tira XP.
- Níveis: Dado bruto → Bronze (250) → Silver (600) → Gold (1000) → Lakehouse (1500).

## Mudar as perguntas

- Enunciado, alternativas, tempo e explicação: [src/deck/content.ts](src/deck/content.ts).
- Resposta certa: [src/server/gabaritos.mjs](src/server/gabaritos.mjs). Ela fica
  só no servidor para não ir no JavaScript do navegador. O servidor não sobe se
  alguma pergunta ficar sem gabarito.

## Teste

```bash
npm run teste
```

Sobe um servidor com banco temporário, entra com três pessoas e percorre as 26
perguntas: confere bônus por velocidade, revelação automática, resposta única,
que o gabarito não chega a quem não é apresentador e o pódio final.

## Estrutura

```
server.mjs                 Next + Socket.IO num processo: estado do quiz, timer, revelação
src/server/db.mjs          SQLite embutido (node:sqlite); XP é livro-caixa append-only
src/server/jogo.mjs        XP, níveis, combo, conquistas
src/server/gabaritos.mjs   as respostas certas
src/deck/content.ts        o deck: capas dos blocos, perguntas e pódio final
src/components/            SceneRouter (capa, pergunta, pódio) · Celebracao · Perfil · Tour
src/app/                   / (participante) · /screen · /host · /ip · /regras · /me
testes/quiz.mjs            o quiz inteiro contra um servidor real
```
