---
title: Kindle Clippings Reader
status: current
updated: 2026-08-21
---

# Kindle Clippings Reader

Lê o `My Clippings.txt` do Kindle e transforma aquele arquivo de texto corrido — anexado sem
parar, com duplicatas e caracteres invisíveis — em algo pesquisável, limpo e exportável.

**Nada sai do dispositivo.** O arquivo é lido pelo próprio navegador (`FileReader`), nunca enviado
a servidor nenhum. Não há build, não há dependências, não há requisições externas — nem fontes.

![Interface no desktop](docs/desktop-light.png)

## O problema que ele resolve

Um Kindle grava todo destaque, nota e marcador num único arquivo de texto que:

- é **append-only** — cresce para sempre, sem ordem útil;
- carrega **BOM (`U+FEFF`) no meio do arquivo**, não só no começo, o que parte um mesmo livro em dois;
- acumula **"destaques estendidos"**: cada vez que você arrasta a seleção, uma nova cópia maior é gravada;
- mistura **NFC e NFD** — a mesma palavra em português existe em duas formas de bytes, então busca e
  deduplicação simplesmente não funcionam sem normalizar;
- gruda o aviso `<You have reached the clipping limit for this item>` **no meio do texto real**.

## O que ele faz

- **Limpa por padrão, nunca apaga.** Duplicatas prováveis ficam escondidas atrás de um botão; o
  registro original continua inteiro na memória e reaparece ao ligar *Mostrar ocultos*.
- **Hashtag invisível por livro.** Cada destaque carrega um `#PascalCase` que não aparece na tela,
  mas vai junto ao copiar (seleção normal **ou** botão Copiar) e em todas as exportações — os
  destaques chegam no Obsidian/Notion já marcados.
- **Português é primeira língua.** Interface pt-BR por padrão, busca que ignora acentos
  (`acao` acha `ação`), ordenação com `localeCompare` pt-BR, datas e números pelo `Intl`.
  Um botão alterna para inglês; a hashtag nunca é traduzida.
- **Notas grudam no destaque certo.** O Kindle grava destaque e nota no mesmo segundo, então o
  casamento é por *timestamp idêntico* primeiro, contenção de posição depois, proximidade por último.
- **Exporta** em Markdown (com frontmatter e `tags:`), JSON, CSV, TXT e TSV para Anki.

## Como usar

Abra `index.html` com dois cliques e arraste seu `My Clippings.txt` para a página. Só isso.

Para servir na LAN (mini-PC, Portainer, porta 8099), veja [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

Atalhos: `/` foca a busca, `Esc` fecha o menu e a gaveta de livros.

## Arquitetura

Sem bundler, sem ES modules, sem build. Cada arquivo é uma IIFE pendurada em `window.KC`, carregada
por `<script src>` simples — funciona igual em `file://` e atrás do nginx.

| Arquivo | Papel |
|---|---|
| `js/i18n.js` | catálogos pt-BR/en, `fold()` sem acentos, formatadores `Intl` |
| `js/parser.js` | texto bruto → registros (`KC.parse`) |
| `js/dedupe.js` | union-find sobre sobreposição de posição + contenção de texto |
| `js/clean.js` | normalização, filtros, associação de notas (`KC.clean.process`) |
| `js/tags.js` | livro → `#Hashtag` |
| `js/search.js` | busca por tokens, sem acento |
| `js/exports.js` | md / json / csv / txt / anki + download |
| `js/clipboard.js` | interceptação do evento `copy` + botão por card |
| `js/cards.js` | um card, e a paginação por `IntersectionObserver` |
| `js/ui.js` | sidebar, stat line, estado vazio, toast |
| `js/app.js` | estado, leitura do arquivo, drag & drop, wiring |

Três detalhes que são fáceis de errar e estão resolvidos de propósito:

- o `root` do `IntersectionObserver` é **o painel que rola**, não a viewport — com `root: null` num
  layout de dois painéis o sentinela nunca dispara (ou dispara sempre);
- a chave de reset da paginação é `activeBook | query | showHidden` — **os três**;
- todo DOM derivado do arquivo é construído com `createElement` + `textContent`, nunca `innerHTML`.

## Testes

```powershell
node tests/parser.test.js
```

126 asserções: um fixture sintético que cobre cada caso de borda (BOM no meio, parênteses aninhados,
documento sem autor, destaque/marcador/nota em pt-BR, locale desconhecido, marcador vazio, limite de
recorte colado no texto, duplicata exata, cadeia A⊂B⊂C, data americana de 12 horas, NBSP / aspas
tipográficas / hífen opcional) — mais uma bateria de regressão contra o `My Clippings.txt` real.

O arquivo real é pessoal e está no `.gitignore`; essa parte da suíte se pula sozinha quando ele
não está presente.

Para quem for editar o código (humano ou agente), o [`CLAUDE.md`](CLAUDE.md) tem o mapa de
arquitetura e os detalhes fáceis de quebrar por dentro.

## Fora do escopo por enquanto

Biblioteca persistente (localStorage/IndexedDB), capas de livro via Open Library e virtualização da
lista ficaram para uma etapa posterior.
