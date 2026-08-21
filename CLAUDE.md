# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kindle Clippings Reader — a static, no-build, no-dependency browser app that parses a Kindle
`My Clippings.txt` export into searchable, exportable cards. Everything runs client-side; the file
is read via `FileReader` and never leaves the device. The one exception: an opt-in, OFF-by-default
switch (`js/covers.js`) that sends each book's title and author to openlibrary.org to fetch a cover
and topic — no highlight text is ever sent, and the app stays fully offline until the user flips it.

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
| `js/store.js` | localStorage prefs + library cache, sessionStorage raw-text cache (all try/catch) |
| `js/topics.js` | fixed 15-topic taxonomy, Open Library subject classifier |
| `js/parser.js` | raw clippings text → records (`KC.parse`) |
| `js/dedupe.js` | union-find over position overlap + text containment |
| `js/clean.js` | normalization, filters, note association (`KC.clean.process`) |
| `js/tags.js` | book → `#Hashtag` |
| `js/search.js` | tokenized, accent-insensitive search |
| `js/sort.js` | right-pane ordering (date/book/topic) + group-key assignment |
| `js/covers.js` | opt-in Open Library fetch queue, cover caching, SVG placeholder covers |
| `js/exports.js` | md / json / csv / txt / anki builders + download |
| `js/cards.js` | single card render, group headers, `IntersectionObserver` pagination |
| `js/clipboard.js` | `copy` event interception + per-card copy button |
| `js/sidebar.js` | sidebar render (sort control, topic chips, book rows) + drag resizer |
| `js/ui.js` | chrome render — book banner, sort bar, stat line, empty state, toast, `render()` |
| `js/app.js` | `KC.state`, file loading, drag & drop, all event wiring (loaded last) |
| `shelf.html` / `js/shelf.js` | standalone cover-shelf page; reads the localStorage book/library cache and, with covers on, fetches what is missing (it seeds `KC.state` and a minimal `KC.ui.toast` itself, since `js/app.js` is not loaded there) |

`tests/harness.js` loads a subset of these modules (`i18n`, `topics`, `parser`, `dedupe`, `clean`,
`tags`, `search`, `sort`, `exports` — not `store`/`covers`/`cards`/`clipboard`/`sidebar`/`ui`/`app`/
`shelf`, which touch `document`/`localStorage`/`fetch`) into a bare Node `vm` context with only a
`window` global. Any module loaded by the harness must not touch `document` or other browser globals
at load time, only inside functions called later with a real DOM.

### Three deliberate, easy-to-regress details

- The `root` of the `IntersectionObserver` in `cards.js` must be **the scrolling panel**, not the
  viewport — with `root: null` in this two-pane layout the pagination sentinel either never fires or
  fires immediately.
- The pagination reset key is `activeBook | activeTopic | query | showHidden | sortMode` — all five,
  or stale results survive a filter/sort change.
- All DOM built from parsed clipping content uses `createElement` + `textContent`, never `innerHTML`
  (clippings text is untrusted user data).
- `css/` (`tokens.css` / `chrome.css` / `sidebar.css` / `reader.css` / `shelf.css`, loaded in that
  order — `tokens.css` first, everyone else assumes its custom properties) replaced the old single
  `styles.css`. Any element toggled with the `hidden` attribute (`#book-banner`, `#sortbar`,
  `.topic-row`, `.shelf-card`, `#shelf-empty`, `#covers-ring`, plus the pre-existing
  `#statline`/`.scrim`) must keep its show rule written as `.selector:not([hidden]) { display: … }`
  — a bare `display:` rule outranks `[hidden]` at equal specificity.
- Class names are global across the five sheets and there is no build step to catch a collision:
  `.flag` belongs to the language button's `<img>` in `chrome.css`, so the card badges in
  `reader.css` (which loads later and would win) are `.card-flag`.
- `tokens.css` locks `body` to `height:100%; overflow:hidden; display:flex` for the reader's two-pane
  layout. `shelf.html` is a normal scrolling document, so `body.shelf-page` in `shelf.css` must undo
  all three — without that override the shelf cannot scroll at all.

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
