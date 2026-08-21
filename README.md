---
title: Kindle Clippings Reader
status: current
updated: 2026-08-21
---

# Kindle Clippings Reader

Reads a Kindle `My Clippings.txt` file and turns that ever-appended wall of text — full of
duplicates and invisible characters — into something searchable, clean, and exportable.

**Nothing leaves the device**, with one opt-in exception. The file is read by the browser itself
(`FileReader`), never sent to any server. No build, no dependencies, no external requests — not even
fonts — until you flip the OFF-by-default *Load covers* switch, which sends each book's title and
author (never highlight text) to openlibrary.org for a cover and a subject.

![Desktop interface](docs/desktop-light.png)

## The problem it solves

A Kindle logs every highlight, note, and bookmark into a single text file that:

- is **append-only** — grows forever, in no useful order;
- carries a **BOM (`U+FEFF`) in the middle of the file**, not just at the start, which splits a
  single book into two;
- accumulates **"extended highlights"**: every time you drag the selection further, a new, larger
  copy gets written;
- mixes **NFC and NFD** — the same word in Portuguese exists in two different byte forms, so search
  and deduplication simply don't work without normalizing first;
- glues the `<You have reached the clipping limit for this item>` warning **into the middle of the
  real text**.

## What it does

- **Cleans by default, never deletes.** Likely duplicates are hidden behind a button; the original
  record stays intact in memory and reappears when you turn on *Show hidden*.
- **Invisible hashtag per book.** Every highlight carries a `#PascalCase` tag that never shows on
  screen, but travels along on copy (plain selection **or** the Copy button) and in every export —
  highlights land in Obsidian/Notion already tagged.
- **Portuguese is a first-class language.** UI defaults to pt-BR, search ignores accents (`acao`
  matches `ação`), sorting uses pt-BR `localeCompare`, dates and numbers go through `Intl`. A button
  switches to English; the hashtag itself is never translated.
- **Notes stick to the right highlight.** Kindle writes a highlight and its note in the same second,
  so matching goes by *identical timestamp* first, position containment second, proximity last.
- **Exports** to Markdown (with frontmatter and `tags:`), JSON, CSV, TXT, and TSV for Anki — plus an
  **Obsidian export**: one note per book, YAML frontmatter, callouts, and blockquotes, ready to drop
  into a vault.
- **Statistics panel.** Totals, a month-by-month timeline (every month drawn, including the empty
  ones, so a gap in your reading actually looks like a gap), a per-year breakdown, most-highlighted
  books, topics, weekday/hour rhythm, streaks, and the odd extreme.
- **Quote cards.** Star any highlight, then render it to a PNG at the exact pixel size of the screen
  you want it on — a Google Nest Hub photo frame, a Full HD or 1440p desktop/TV wallpaper, an iPhone
  or Android lock screen, or a square social post. Three styles (dark, light, paper), tinted by the
  book's topic colour.
- **Opt-in covers and topics.** A single switch fetches each book's cover and Open Library subjects,
  classified into a fixed 15-topic taxonomy. Only the cover *URL* and the subjects are cached in
  `localStorage`, never the image bytes, so a large library never hits the storage quota. Candidates
  are title-checked before they are trusted, and sideloaded PDFs and saved web pages are recognised
  and never looked up. Books with no fetched cover get a generated SVG placeholder in their topic
  color, so the library looks designed from the first load, before you ever flip the switch.
- **A shelf page** (`shelf.html`) shows every known book as a cover card — searchable, filterable by
  topic, click through to reopen that book in the reader. It fills in missing covers itself when the
  switch is on.
- **Sort the reading pane** by file order, newest/oldest, book, or topic (with sticky group headers);
  **sort the book list** by title, highlight count, or most recently highlighted; **resize the
  sidebar** by dragging or with the arrow keys.
- **Works on a phone.** `css/mobile.css` collapses the two-pane layout into a drawer + reading pane.

## Usage

Open `index.html` with a double-click and drag your `My Clippings.txt` onto the page. That's it.

Shortcuts: `/` focuses search, `Esc` closes the menu and the book drawer.

## Deploy on the LAN

The app is served by nginx on port **8099** of the mini-PC, as a Portainer stack. The full
walkthrough (in Portuguese, with the Proxmox layer trap explained) is in
[`deploy/DEPLOY.md`](deploy/DEPLOY.md); the compose file is
[`deploy/docker-compose.yml`](deploy/docker-compose.yml).

The one thing worth knowing before the next section: the stack has **two containers**.

| Container | Image | What it does |
|---|---|---|
| `kindle-clippings-fetch` | `alpine` | Downloads this repo's `main` branch into a Docker volume, then repeats every 5 minutes, forever. It also writes the nginx config. |
| `kindle-clippings` | `nginx:alpine` | Serves that volume, read-only, on port 8099, with `Cache-Control: no-store`. |

The site files therefore live **in a Docker volume**, not in the image. Nothing is ever copied by
`scp`, and no image is rebuilt when the app changes.

## Refreshing the deployed app from the Portainer UI

> Read this part slowly the first time — it explains *why*, so you never have to guess which button
> to press.

### First, the foundation: what "updating" even means here

There are two completely different things that can change, and they need different buttons:

1. **The app changed** — you pushed new HTML/CSS/JS to GitHub. The container images did not change;
   only the *files inside the `site` volume* are stale. → you need `fetch` to run again.
2. **The stack itself changed** — you edited `deploy/docker-compose.yml` (new port, new service,
   new nginx config). → you need Portainer to re-read the compose file and recreate the containers.

Nine times out of ten it's case 1.

### Case 0 — do nothing (the usual answer)

`fetch` re-downloads `main` **every 5 minutes on its own**, and nginx sends
`Cache-Control: no-store`, so no browser — phone, Nest Hub, desktop — keeps an old copy.

**After a `git push`, just wait up to 5 minutes and reload the page.** That's it.

### Case 1 — force the refresh right now (restart `fetch`)

Do this when you don't want to wait the 5 minutes.

1. Open Portainer: `http://<mini-PC-IP>:9000`.
2. Left sidebar → **Containers**.
3. Find the row named **`kindle-clippings-fetch`**. (Tick its checkbox on the left.)
4. Click the **Restart** button in the toolbar above the list.
5. Wait ~15 seconds — it reinstalls `curl`/`tar`, then downloads the branch tarball.
6. Confirm it worked: click the container name **`kindle-clippings-fetch`** → **Logs** (or the
   little "logs" icon on its row). The last line should read:

   ```
   [fetch] site atualizado
   ```

7. Open `http://<mini-PC-IP>:8099` and reload. The new version is there.

**Do not restart the `kindle-clippings` (nginx) container for this** — nginx reads the volume live,
so restarting it changes nothing at all. Restarting `fetch` is what pulls new files.

### Case 2 — the compose file changed (redeploy the stack)

Do this only when `deploy/docker-compose.yml` itself was edited.

1. Portainer → left sidebar → **Stacks**.
2. Click the stack named **`kindle-clippings`**.
3. Scroll to the **Web editor** box — it holds the compose file Portainer is currently using.
4. Select everything in that box and delete it, then paste the **entire new** contents of
   `deploy/docker-compose.yml` from this repo.
5. Below the editor, turn **ON** these two switches:
   - **Re-pull image** — grabs a fresh `alpine` / `nginx:alpine`.
   - **Force redeploy** (sometimes labelled *Re-deploy*) — recreates the containers even if
     Portainer thinks nothing changed. Without this, an edit that only touched the `command:` block
     can be silently ignored.
6. Click **Update the stack** and confirm.
7. Wait for both containers to come back green in **Containers**, then check the app on
   `http://<mini-PC-IP>:8099`.

⚠️ **Updating the stack does NOT wipe the `site` volume** — that's by design (the app keeps serving
the last good copy while `fetch` boots). If you truly want to start from an empty volume, see the
next section.

### Case 3 — the page still shows an old version after all of that

Work down this list; stop at the first one that fixes it.

| Check | Where in Portainer | What you should see |
|---|---|---|
| Is `fetch` actually running? | **Containers** → `kindle-clippings-fetch` | State `running`, not `exited`. If it exited, open **Logs** — usually GitHub was unreachable. |
| Did the download succeed? | that container → **Logs** | A recent `[fetch] site atualizado` line. |
| Is nginx serving the volume? | **Containers** → `kindle-clippings` → **Console** → Connect (`/bin/sh`) | `ls /usr/share/nginx/html` lists `index.html`, `js/`, `css/`. |
| Is it the browser, not the server? | your browser | Open the page in a private window. If the private window is correct, it was a stale tab — hard-reload. |
| Nothing works — nuke the volume | **Stacks** → `kindle-clippings` → **Stop this stack**, then **Volumes** → remove `kindle-clippings_site`, then **Stacks** → **Start this stack** | The stack rebuilds the volume from scratch on the next `fetch` run (~20s). |

Removing the `site` volume is **safe**: it holds nothing but a copy of this public repo. It holds
none of your highlights — `My Clippings.txt` is never uploaded and never reaches the server.

## Architecture

No bundler, no ES modules, no build. Each file is an IIFE hanging off `window.KC`, loaded via a
plain `<script src>` tag — works the same over `file://` and behind nginx. **The order of the
`<script>` tags in `index.html` is the dependency graph.**

| File | Role |
|---|---|
| `js/i18n.js` | pt-BR/en catalogs, accent-free `fold()`, `Intl` formatters |
| `js/store.js` | localStorage prefs + library cache, sessionStorage raw-text cache |
| `js/topics.js` | fixed 15-topic taxonomy, Open Library subject classifier |
| `js/parser.js` | raw text → records (`KC.parse`) |
| `js/dedupe.js` | union-find over position overlap + text containment |
| `js/clean.js` | normalization, filters, note association (`KC.clean.process`) |
| `js/tags.js` | book → `#Hashtag` |
| `js/search.js` | tokenized, accent-insensitive search |
| `js/sort.js` | right-pane ordering (date/book/topic) + group-key assignment |
| `js/covers.js` | opt-in Open Library fetch queue, SVG placeholder covers |
| `js/exports.js` | md / json / csv / txt / anki + download |
| `js/obsidian.js` | Obsidian-native Markdown, one note per book |
| `js/favorites.js` | starred quotes, content-derived keys in localStorage |
| `js/stats.js` | pure statistics — totals, per-book, year/month/weekday/hour, streaks |
| `js/quotecard.js` | canvas quote-card renderer + PNG download, one size per target screen |
| `js/modal.js` | generic overlay dialog — open/close, Esc, backdrop, focus return |
| `js/statsview.js` | statistics panel render (CSS bars/columns, no chart library) |
| `js/quoteview.js` | quote-card gallery — pick, preview, download PNGs |
| `js/cards.js` | single card render + `IntersectionObserver` pagination |
| `js/clipboard.js` | `copy` event interception + per-card copy button |
| `js/sidebar.js` | sidebar render (sort control, topic chips, book rows), drag resizer |
| `js/ui.js` | chrome render — book banner, sort bar, stat line, toast |
| `js/app.js` | state, file loading, drag & drop, wiring |
| `shelf.html` / `js/shelf.js` | standalone cover-shelf page |

Stylesheets load in this order and each assumes the previous ones: `css/tokens.css` (custom
properties, the two-pane body layout) → `chrome.css` → `sidebar.css` → `reader.css` →
`panels.css` (modals, stats, quote cards) → `mobile.css`.

Details that are easy to get wrong and are handled on purpose:

- the `IntersectionObserver`'s `root` is **the scrolling panel**, not the viewport — with
  `root: null` in this two-pane layout the sentinel never fires (or fires immediately);
- the pagination reset key is `activeBook | activeTopic | query | showHidden | sortMode` — **all five**;
- all DOM built from the file's content uses `createElement` + `textContent`, never `innerHTML`;
- anything toggled with the `hidden` attribute needs its show rule written as
  `.selector:not([hidden]) { display: … }` — a bare `display:` rule outranks `[hidden]`.

## Tests

```powershell
node tests/parser.test.js
```

A synthetic fixture covering every edge case (mid-file BOM, nested parentheses, authorless document,
highlight/bookmark/note in pt-BR, unknown locale, empty bookmark, clipping limit glued into the
text, exact duplicate, A⊂B⊂C chain, 12-hour US date, NBSP / typographic quotes / optional hyphen),
the exports, the topic classifier and taxonomy shape, the sort/group logic, the statistics —
plus a `node --check` syntax pass over every file in `js/` and a regression run against the real
`My Clippings.txt`.

The real file is personal and is in `.gitignore`; that part of the suite skips itself when it's
not present.

For anyone editing the code (human or agent), [`CLAUDE.md`](CLAUDE.md) has the architecture map
and the easy-to-break details underneath it.

## Out of scope for now

List virtualization, hand-editing topics, ISBN/Google Books cover fallback, and persisting highlight
text itself in `localStorage` (only the session-scoped raw file text is cached) are left for later.
