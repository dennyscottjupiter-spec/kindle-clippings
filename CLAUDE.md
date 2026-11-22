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

`tests/parser.test.js` is only the entry point; it runs seven suites in this fixed order, then exits
non-zero if any assertion failed:

| Suite | What it covers |
|---|---|
| `syntax.test.js` | `node --check` on every file in `js/` — including the DOM modules the vm harness cannot load |
| `fixture.test.js` | parser / clean / dedupe / tags against `tests/fixture-clippings.txt` (synthetic edge cases) |
| `exports.test.js` | every export format builds, always carries the hashtag, and TXT + Anki keep attached notes (same fixture) |
| `topics.test.js` | the 15-topic taxonomy + Open Library subject classifier |
| `sort.test.js` | right-pane sort ordering and group-key assignment |
| `stats.test.js` | stats totals, per-book/topic aggregates, time histograms, streaks, the `details()` drill-down data, local-midnight day keys |
| `real.test.js` | regression against the user's real `My Clippings.txt` at repo root — gitignored, personal; self-skips when the file is absent |

Baseline as of this writing: **236 passed, 0 failed** without the real file (`real.test.js` self-skips);
the real file adds ~33 more when present.

To view the app itself: open `index.html` directly (double-click / `file://`), or serve it — there
is no dev server script, any static file server works (e.g. `python -m http.server`).

There is no linter, no formatter, no `package.json` — none configured, don't invent one.

## Architecture

No bundler, no ES modules. Each file in `js/` is an IIFE attached to `window.KC`, loaded in a fixed
order via plain `<script src>` tags in `index.html`. That load order **is** the dependency graph —
a module can only use what a script tag above it already defined:

| File | Role |
|---|---|
| `js/i18n.js` | pt-BR/en catalogs, accent-folding `fold()`, `Intl` formatters, `KC.i18n.add()` |
| `js/i18n-*.js` | per-feature string packs, each calling `KC.i18n.add()` — `anki` · `qc` · `help` · `about` · `topics` · `cardactions` · `favio` · `ux` (back nav, ⋯ panel sections, card tray, stats drill-down). Loaded as a contiguous block right after `i18n.js`, before any consumer |
| `js/icons.js` | the one line-icon set (24-unit grid, `createElementNS`, no `innerHTML`) — `svg(name)`, `hydrate()` fills every empty `[data-icon]` at DOMContentLoaded, `swap()`, `paintTheme()` (moon ↔ sun + label). Loaded right after the i18n packs on BOTH pages |
| `js/store.js` | localStorage prefs + library cache, sessionStorage raw-text cache (all try/catch); `prefs.set` mirrors to IndexedDB and `prefs.hydrate()` unions it back at boot. Drops the retired two-person mode's `kc.profile` key on load |
| `js/persist.js` | IndexedDB — keeps the clippings file on-device between sessions, plus the favourites and prefs mirrors |
| `js/topics.js` | fixed 15-topic taxonomy, Open Library subject classifier |
| `js/parser.js` | raw clippings text → records (`KC.parse`) |
| `js/dedupe.js` | union-find over position overlap + text containment |
| `js/clean.js` | normalization, filters, note association (`KC.clean.process`) |
| `js/tags.js` | book → `#Hashtag` |
| `js/search.js` | tokenized, accent-insensitive search |
| `js/sort.js` | right-pane ordering (date/book/topic) + group-key assignment |
| `js/covers.js` | opt-in Open Library fetch queue, cover caching, SVG placeholder covers |
| `js/exports.js` | md / json / csv / txt / anki builders + download; the Anki TSV's `#`-headers must stay the first lines and every field is quoted |
| `js/anki.js` | wires `#nav-anki` to the shared TSV builder — guarded, the button does not exist on `shelf.html` |
| `js/obsidian.js` | Obsidian-native Markdown, one note per book (YAML frontmatter, callouts, blockquotes) |
| `js/version.js` | `KC.version.CURRENT` + the `RELEASES` array (version/date/i18n keys) — pure data, no DOM |
| `js/favorites.js` | starred "quotes" — content-derived keys (`rec.id` is not stable), written to localStorage **and** the `js/persist.js` IndexedDB mirror; `hydrate()` unions the two at boot, `merge(keys)` is the key-level union the JSON import uses |
| `js/favio.js` | manual favourites backup — builds/downloads the `.json` of starred keys and reads one back (union only, never a replace) |
| `js/stats.js` | pure statistics — totals, per-book, per-year, **dense** month + weekday/hour histograms, streaks, and `details(visible, nowMs)` for the tile drill-downs (length classes, longest, notes list, busiest days, last-30/this-year) (no DOM, no browser globals — the harness loads it) |
| `js/quotecard.js` | canvas quote-card renderer + JPEG blob/download; `SIZES` = nesthub / fhd / qhd / iphone / android / square. Its `THEMES`/`accentOf` colours are literals **mirroring `css/tokens.css`** — a canvas cannot read custom properties, so a repaint must touch both |
| `js/modal.js` | generic overlay dialog — open/close, Esc, backdrop, focus return, body scroll lock. ×/Esc/backdrop go through the overridable `requestClose(id)` |
| `js/statsyears.js` | year picker for the stats timeline |
| `js/statsview.js` | statistics panel render — tappable KPI tiles, month timeline, per-year bars, top books, topics, weekday/hour rhythm, extremes (CSS bars/columns, no chart library); each tile opens a drill-down view (`highlights` / `books` / `notes` / `words`, memory-only `mode()`), wired by its own `install()` |
| `js/quotesort.js` | quote-gallery ordering — newest / oldest / book A-Z / quote A-Z / longest |
| `js/quoteview.js` | quote-card gallery — source toggle, book filter, search, sort, preview, download JPEGs |
| `js/helpview.js` | help panel render (`#help-body`) — eleven `.doc-section`s (the second, `kinds`, explains highlight vs note) built from `i18n-help` keys |
| `js/aboutview.js` | about panel render (`#about-body`) — what the app is, privacy note, `KC.version.RELEASES` changelog |
| `js/cards.js` | single card render (footer = `.meta-info` chips + `.meta-actions` tray; `actBtn()` builds every tray button), group headers, `IntersectionObserver` pagination |
| `js/cardactions.js` | per-card Image + Export tray buttons, and `flash()` (the ✓ "done" morph the copy button reuses). **Wraps `KC.cards.appendPage`** instead of editing `cards.js`, so every 200-card batch gets augmented; each processed `.entry` is marked `[data-ca-done]` |
| `js/clipboard.js` | `copy` event interception + per-card copy button |
| `js/topicfilter.js` | shared topic-chip selection used by BOTH `sidebar.js` and `shelf.js` |
| `js/sidebar.js` | sidebar render (sort control, topic chips, book rows) + drag resizer |
| `js/ui.js` | chrome render — book banner, sort bar, stat line, empty state, toast, `render()` |
| `js/backnav.js` | the ← back button + phone back gesture: a snapshot stack (book, topic, query, open panel, stats view, drawer, scroll) mirrored into `history.pushState`; wraps `KC.modal.open` and replaces `KC.modal.requestClose` at `install()` |
| `js/nav.js` | ⋯ panel disclosure (a dropdown at every width; `[data-keep-open]` controls leave it open) + the brand Home link |
| `js/app.js` | `KC.state`, file loading, drag & drop, all event wiring (loaded last) |
| `shelf.html` / `js/shelf.js` | standalone cover-shelf page; reads the localStorage book/library cache and, with covers on, fetches what is missing (it seeds `KC.state` and a minimal `KC.ui.toast` itself, since `js/app.js` is not loaded there) |

The table order **is** the `<script>` order in `index.html`. `js/shelf.js` is not in that list — it is
loaded only by `shelf.html`, after `i18n` / `i18n-topics` / `i18n-ux` / `icons` / `store` / `topics` / `covers` / `topicfilter`
(and followed there by `nav`).

`tests/harness.js` loads exactly ten modules — its `FILES` array — in this order, into a bare Node
`vm` context whose only globals are `console`, `setTimeout`, `window` and `navigator`:

```
i18n · topics · parser · dedupe · clean · tags · search · sort · stats · exports
```

Note `stats` sits between `sort` and `exports`, and `store` is NOT loaded. Not loaded: `store`, `covers`, `obsidian`, `favorites`, `quotecard`, `modal`, `statsview`, `quoteview`,
`cards`, `clipboard`, `sidebar`, `ui`, `app`, `shelf` — they touch `document` / `localStorage` /
`fetch`. Any module loaded by the harness must not touch `document` or other browser globals at load
time, only inside functions called later with a real DOM. `js/stats.js` is deliberately DOM-free for
this reason — keep it that way or `stats.test.js` dies at load.

### CSS

Nine sheets in `css/`, no build step, class names global across all of them. Load order differs per
page and each page's order is the cascade:

| Page | Order |
|---|---|
| `index.html` | `tokens` → `fonts` → `chrome` → `sidebar` → `reader` → `panels` → `docs` → `mobile` |
| `shelf.html` | `tokens` → `fonts` → `chrome` → `sidebar` → `shelf` → `mobile` |

| Sheet | Owns |
|---|---|
| `tokens.css` | reset, color tokens (light/dark), topic-hue mechanism, type scale, radii, shadows — **loaded first, everyone else assumes its custom properties** |
| `fonts.css` | `@font-face` for the self-hosted variable fonts in `fonts/` — Fraunces (display/serif) and Inter (UI/sans), latin + latin-ext. No network at runtime |
| `chrome.css` | line-icon base (`.ico`), top bar, buttons (incl. `.ghost`), ← back button, desktop `.topnav`, switches, flag button, dropdown menu, the ⋯ panel (tiles, grouped rows, sticky Help/About footer), toast, tooltip, segmented control, covers ring |
| `sidebar.css` | shell grid, resizable sidebar, book rows with spine/badge, topic chip row, scrim |
| `reader.css` | reading pane — dropzone, book banner, sort bar, stat line, cards (note block, info chips, action tray + star/copy animations), group headers |
| `panels.css` | the two overlay dialogs — `.modal` shell, statistics panel (tappable KPI tiles, drill-down `.st-*` views, `.bar-row`, `.cols` histograms) and the quote-card gallery (`.qc-*`) |
| `shelf.css` | the standalone shelf page — page scroll, tools bar, cover cards grid, shelf plank |
| `docs.css` | the two document panels — generic `.doc-*` system (jump nav, sections, term/desc items, callouts, `.doc-kbd`) shared by help and about, plus the `.about-release*` changelog list |
| `mobile.css` | phone/tablet layer — `dvh` height, safe-area insets, 44px touch targets, sidebar drawer, `(hover: none)` reveals, landscape-phone topbar — **must stay last**, it overrides every sheet above it |

### Deliberate, easy-to-regress details

- The `root` of the `IntersectionObserver` in `cards.js` must be **the scrolling panel**, not the
  viewport — with `root: null` in this two-pane layout the pagination sentinel either never fires or
  fires immediately.
- `js/cardactions.js` adds its buttons by **wrapping `KC.cards.appendPage`**, not by editing
  `js/cards.js`. Every path that draws cards (first render, `fillPane()`'s top-up loop, the
  observer) calls that property at call time, so the wrap catches all of them; `[data-ca-done]`
  stops a later batch re-processing an existing card. Reassigning or inlining `appendPage` in
  `cards.js` silently strips the buttons off every card past the first page.
- Every `<script src>` and `<link href>` in `index.html` / `shelf.html` carries `?v=<KC.version.CURRENT>`.
  Bumping `CURRENT` in `js/version.js` without rewriting those query strings (and vice-versa) leaves
  browsers on the old bundle — the deployed nginx sends `Cache-Control: no-store`, but nothing else
  serving these files does. Both pages must be rewritten together, all `css/` and `js/` URLs.
- `icons/icon-192.png`, `icon-512.png` and `apple-touch-icon.png` are rendered from `icons/icon.svg`
  (full-bleed, book inside the 40% maskable safe circle); `favicon.svg` is the same art with rounded
  corners. Android ignores SVG manifest icons for the home screen — change the SVG, re-render the PNGs.
- `js/app.js#applyPrefs()` runs **twice** on a boot that recovered prefs: once synchronously so the
  theme is right on the first painted frame, once after `KC.store.prefs.hydrate()` resolves. The
  second pass only runs when hydrate reports it restored something, and a restored `lang` re-renders
  through `KC.i18n.onChange` — do not add an `applyStrings()` call beside it.
- `KC.store.prefs.hydrate()` merges **key by key, localStorage winning** — the mirror only fills in
  what is missing. Making the mirror win would resurrect a pref the user just changed in another tab.
- `KC.favorites.hydrate()` must resolve **before** the first render in `js/app.js`'s
  `DOMContentLoaded` — it pulls the IndexedDB mirror back into localStorage. Render first and a
  session whose localStorage was cleared paints every highlight unstarred and then saves that empty
  list over the mirror.
- The card export dropdown reuses `chrome.css`'s `.menu-list`, anchored `right: 0`. The Export trigger
  is the LAST button of the card tray, at the card's right edge, so `.ca-menu > .menu-list` keeps
  `right: 0` and opens **upward** on phones — re-anchoring it `left: 0` runs it off the right edge.
- Card / gallery / stats buttons contain an `<svg>` and a label, so a tap's `e.target` is usually a
  child: every delegated click handler resolves its button with `closest('[data-…]')`, never by
  reading attributes off `e.target`.
- An icon placeholder is an EMPTY `<span data-icon="name">`; its label is a sibling
  `<span class="lbl" data-i18n="…">`. Never put `data-i18n` on the button that holds the icon —
  `applyStrings()` sets `textContent` and would wipe the `<svg>`.
- The star's gold lives only on `.act.fav.is-on`; hover is a background wash inside
  `@media (hover: hover) and (pointer: fine)`. A coloured `:hover` sticks after a tap on touch and
  made an un-starred star look starred (fixed in 2.3.0) — don't reintroduce it.
- `js/backnav.js` snapshots state **before** a move (`push()` is called first, then the state
  changes). Book/topic/search/Home/stats-book jumps call it explicitly; panels are covered by its
  wrap of `KC.modal.open`. User closes (× / Esc / backdrop / scrim) must go through
  `KC.modal.requestClose` / `KC.backnav.requestCloseDrawer` so the browser history steps back too;
  programmatic closes (`KC.modal.close`) deliberately do not. `restore()` sets `restoring()` so a
  re-open never pushes again, and `statsview.open()` keeps the restored drill-down mode only then.
- A `[data-topic]` hue rule is `hsl(var(--h) …)`, and `"uncategorized"` has no `--h`. Every theme
  layer that redefines `[data-topic]` (light base, system-dark, `[data-theme="dark"]`) needs its own
  `[data-topic="uncategorized"]` fallback at equal-or-higher specificity right after it — otherwise
  `--topic-edge` is invalid, the browser drops the whole `border-left` shorthand, and every card
  loses its rail (notes their gold one). This was broken in dark mode until 2.3.1.
- Every export that writes a record's text must also write its attached `rec.note` (md, json, csv,
  txt, anki, obsidian all do; `exports.test.js` asserts txt + anki) — a dropped note is lost user data.
- `KC.stats` day keys are UTC-based integers; turn one back into a timestamp with `dayStartMs()`
  (local midnight), never `day * DAY` — that is UTC midnight and shows as the previous day in UTC−3.
- The pagination reset key is `activeBook | activeTopic | query | showHidden | sortMode` — all five,
  or stale results survive a filter/sort change.
- All DOM built from parsed clipping content uses `createElement` + `textContent`, never `innerHTML`
  (clippings text is untrusted user data).
- Any element toggled with the `hidden` attribute (`#book-banner`, `#sortbar`, `.topic-row`,
  `.shelf-card`, `#shelf-empty`, `.seg`, `.scrim`, `#statline`, `.more-panel`, the `.modal` dialogs,
  and `#nav-back` — whose rule is `.btn.back-btn[hidden]` to outrank the later `.btn.icon`) must keep
  its show rule written as `.selector:not([hidden]) { display: … }` — a bare `display:` rule outranks
  `[hidden]` at equal specificity. (`.covers-ring` takes the other valid form: an explicit
  `.covers-ring[hidden] { display: none }` after the base rule.) This bites in `panels.css` too: the
  stats and quotes modals are shown/hidden purely by the attribute via `js/modal.js`.
- Class names are global across the seven sheets and there is no build step to catch a collision:
  `.flag` belongs to the language button's `<img>` in `chrome.css`, so the card badges in
  `reader.css` (which loads later and would win) are `.card-flag` — note `.flag-dup` /
  `.flag-trunc` / `.flag-near` are modifiers *of* `.card-flag`, not of `.flag`.
- `tokens.css` locks `body` to `height:100%; overflow:hidden; display:flex` for the reader's two-pane
  layout. `shelf.html` is a normal scrolling document, so `body.shelf-page` in `shelf.css` must undo
  all three — without that override the shelf cannot scroll at all. `mobile.css` re-asserts it
  (`body.shelf-page { height:auto; min-height:100dvh }`), which only works because it loads last.
- Never write `overflow-x: hidden` on `html`/`body` in `mobile.css` — it makes `body` a scroll
  container and silently degrades every `position: sticky` descendant (`.topbar`, `.group-head`) to
  `relative`. Use `overflow-x: clip`, as `body.shelf-page` already does.
- `js/stats.js` emits `byMonth` **dense**: every month between the first and last is present, zero
  months included (`monthSpan()`, guarded at 1200 iterations). `statsview.js` therefore slices the
  last `MONTHS_SHOWN = 36` and ticks every January plus column 0 — never assume `byMonth` only holds
  months that have highlights, and never re-derive gaps yourself. `.cols { justify-content:
  flex-start }` in `panels.css` exists so a two-month library does not paint two half-page slabs.
- `byYear` is a sorted **ascending** array (`{year, count, words, books}`); `statsview` walks it
  backwards to show newest first, and only renders the section when `byYear.length > 1`. The
  per-year `words` is accumulated from the loop variable `w`, which is only assigned for highlight
  records — keep the `isHighlight` guard around the year bucket or `words` picks up a stale count.
- `js/quotecard.js` derives **all** type and padding from `base = Math.min(w, h)`, never from `h`.
  The SIZES list is now mixed landscape *and* portrait (iPhone 1290×2796, Android 1080×2400), so any
  new metric written against `h` gives a portrait card absurd fonts. `padY`, `titleSize`, the quote
  glyph and the min/max fit range all go through `base` — follow that.
- The quote-card size is **not persisted**: `js/quoteview.js` holds `view.sizeId` in memory only
  (default `'nesthub'`), and `sizeOf()` falls back to `SIZES[0]` for an unknown id. If a size id is
  ever removed from `SIZES`, nothing stale can be read back from storage — but if size ever *does*
  get persisted, that fallback is the only thing preventing a dead id from blanking the gallery.
- `js/app.js#fillSizes()` populates `#qc-size` from `KC.quotecard.SIZES` at boot, so the `<select>`
  in `index.html` is intentionally empty markup — adding a hardcoded `<option>` there will desync it.

### Source data quirks the parser/clean pipeline exists to handle

`My Clippings.txt` is append-only, mixes NFC/NFD Unicode normalization for the same text, carries a
BOM (`U+FEFF`) mid-file (not just at the start) which can split one book's entries in two, records
"extended highlights" as full duplicate copies each time a selection is dragged further, and
sometimes glues Kindle's clipping-limit warning into the middle of real highlighted text. `dedupe.js`
and `clean.js` are built specifically around these cases — see `tests/fixture-clippings.txt` for the
canonical edge cases they're tested against.

## File headers

Every `js/`, `tests/` and `css/` file carries a frontmatter comment block (`purpose` / `exports` /
`depends` / `gotcha`; the CSS ones use `/* --- … --- */` and have no `exports`). Keep it in sync when
you change a file's exports, dependencies or load position — a stale header is a bug.
