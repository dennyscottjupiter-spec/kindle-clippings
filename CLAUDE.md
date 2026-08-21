# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kindle Clippings Reader — a static, no-build, no-dependency browser app that parses a Kindle
`My Clippings.txt` export into searchable, exportable cards. Everything runs client-side; the file
is read via `FileReader` and never leaves the device (no server, no fetch, no external fonts).

## Commands

Run the full test suite (no npm/build step exists — plain Node):

```powershell
node tests/parser.test.js
```

This runs `syntax.test.js` (`node --check` on every file in `js/`), `fixture.test.js` and
`exports.test.js` (against `tests/fixture-clippings.txt`, a synthetic edge-case fixture), and
`real.test.js` (regression against the user's real `My Clippings.txt` at repo root — gitignored,
personal; that part of the suite self-skips when the file is absent).

To view the app itself: open `index.html` directly (double-click / `file://`), or serve it — there
is no dev server script, any static file server works (e.g. `python -m http.server`).

There is no linter, no formatter, no `package.json` — none configured, don't invent one.

## Architecture

No bundler, no ES modules. Each file in `js/` is an IIFE attached to `window.KC`, loaded in a fixed
order via plain `<script src>` tags in `index.html`. That load order **is** the dependency graph —
a module can only use what a script tag above it already defined:

| File | Role |
|---|---|
| `js/i18n.js` | pt-BR/en catalogs, accent-folding `fold()`, `Intl` formatters |
| `js/parser.js` | raw clippings text → records (`KC.parse`) |
| `js/dedupe.js` | union-find over position overlap + text containment |
| `js/clean.js` | normalization, filters, note association (`KC.clean.process`) |
| `js/tags.js` | book → `#Hashtag` |
| `js/search.js` | tokenized, accent-insensitive search |
| `js/exports.js` | md / json / csv / txt / anki builders + download |
| `js/cards.js` | single card render + `IntersectionObserver` pagination |
| `js/clipboard.js` | `copy` event interception + per-card copy button |
| `js/ui.js` | sidebar, stat line, empty state, toast |
| `js/app.js` | `KC.state`, file loading, drag & drop, all event wiring (loaded last) |

`tests/harness.js` loads a subset of these modules (`i18n`, `parser`, `dedupe`, `clean`, `tags`,
`search`, `exports` — not `cards`/`clipboard`/`ui`/`app`, which touch the DOM) into a bare Node `vm`
context with only a `window` global. Any module loaded by the harness must not touch `document` or
other browser globals at load time, only inside functions called later with a real DOM.

### Three deliberate, easy-to-regress details

- The `root` of the `IntersectionObserver` in `cards.js` must be **the scrolling panel**, not the
  viewport — with `root: null` in this two-pane layout the pagination sentinel either never fires or
  fires immediately.
- The pagination reset key is `activeBook | query | showHidden` — all three, or stale results survive
  a filter change.
- All DOM built from parsed clipping content uses `createElement` + `textContent`, never `innerHTML`
  (clippings text is untrusted user data).

### Source data quirks the parser/clean pipeline exists to handle

`My Clippings.txt` is append-only, mixes NFC/NFD Unicode normalization for the same text, carries a
BOM (`U+FEFF`) mid-file (not just at the start) which can split one book's entries in two, records
"extended highlights" as full duplicate copies each time a selection is dragged further, and
sometimes glues Kindle's clipping-limit warning into the middle of real highlighted text. `dedupe.js`
and `clean.js` are built specifically around these cases — see `tests/fixture-clippings.txt` for the
canonical edge cases they're tested against.

## File headers

Every `js/` file and `tests/` file carries a frontmatter comment block (`purpose` / `exports` /
`depends` / `gotcha`). Keep it in sync when you change a file's exports or dependencies.
