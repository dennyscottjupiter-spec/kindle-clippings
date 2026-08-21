# Building a Single-File Kindle "My Clippings.txt" Web App: Complete Implementation Research

## TL;DR
- A single-file, vanilla HTML/CSS/JS app is fully sufficient: `<input type="file">` + FileReader reads the file client-side (no server, no upload), a regex parser splits records on the exact 10-equals-sign separator, and everything (parse, dedup, tag, filter, export) runs in-browser — no privacy risk, since data NEVER leaves the device.
- For the "invisible hashtag" requirement, the ONLY technique that is both hidden on screen AND survives copy-paste is a `.visually-hidden` (clip-rect/sr-only) span combined with a `copy`-event handler that sets `text/plain` explicitly; `display:none` and `visibility:hidden` are hidden but are NOT copied, so they fail the core requirement.
- Host it on the user mini-PC, running Proxmox and in Portainer. Make it forward compatible to Cloudflare Pages or GitHub Pages over HTTPS (both free) so the async Clipboard API works; opening via `file://` breaks `navigator.clipboard` and is fragile — but the whole app can also just be double-clicked from disk if you rely on the copy-event fallback.

## Key Findings

### The file format is stable and parseable but has real traps
On a modern Kindle Paperwhite (11th gen, 2021+), highlights/notes/bookmarks are logged to `/documents/My Clippings.txt`, accessed by USB. The file is **UTF-8**, records are separated by a line of **exactly ten equals signs (`==========`)**, and each record is a fixed 5-line block. The three biggest traps are: (1) a **UTF-8 BOM (U+FEFF)** that attaches to the first book's title and makes the first book appear twice; (2) **duplicate/overlapping highlights** created when you extend a selection (the file is append-only and never deletes); and (3) **localized metadata lines** — the "Your Highlight on page X | location Y-Z" line is fully translated per device language.

### The invisible-hashtag problem is really a clipboard problem
Browser copy behavior is the deciding constraint. Content hidden with `display:none` or `visibility:hidden` is removed from the render tree and is NOT placed on the clipboard when the user selects and copies. Content hidden with the "clip pattern" (`.sr-only`/`.visually-hidden`) stays in the DOM flow and generally IS copied. The robust, deterministic solution is to intercept the `copy` event and explicitly build the clipboard payload.

### Client-side everything is viable at Kindle-scale volumes
A typical library of a few thousand records is a low-single-digit-MB text file that parses in well under a second, fits in memory easily, and can be searched with plain `String.prototype.includes()` with zero dependencies. Per MDN Web Docs, localStorage is capped at roughly 5 MiB per origin, which is borderline for very large libraries; IndexedDB (disk-proportional, far larger) is the safer persistence choice but often unnecessary.

## Details

### 1. Exact file format (Paperwhite 11th gen and cross-device)

**Byte-level.** The file is UTF-8. There is a well-documented bug where a leading **UTF-8 BOM (U+FEFF, bytes `EF BB BF`)** is prepended to the very first record's title line. This is visible in real parser output as an escaped `\ufeff` in the first `bookName` (e.g. FBoucher's .NET MyClippings-Parser, which explicitly targets the Kindle Paperwhite, emits `"bookName": "\ufeffAnnouncing WSL 2..."`). [docker](https://hub.docker.com/r/fboucher/myclippings-parser) [GitHub](https://github.com/FBoucher/MyClippings-Parser) Because most parsers group/deduplicate by title, `\ufeffTitle` is treated as a different book than a later clean `Title` — this is the classic "first book appears twice" bug. **Always strip a leading U+FEFF before parsing.**

Line endings are **CRLF (`\r\n`)** ("pure DOS .txt format" per long-standing Kindle documentation; [Blogger](https://kindleworld.blogspot.com/2010/01/q-on-kindles-my-clippings-file.html) parsers routinely strip `\r`). The record separator is **exactly ten `=` characters** (confirmed by multiple independent parsers hard-coding `"=========="` and by a Portuguese guide stating entries are separated by "uma linha de dez sinais de igual"). Each record — including the last — is terminated by a separator line, so the file ends with `==========` followed by a trailing newline; splitting on the separator yields a trailing empty element that must be discarded (this is why parsers `.pop()` the last block).

**Record structure (5 logical lines):**
```
<Title> (<Author>)
- Your Highlight on page 12 | location 176-178 | Added on Saturday, 26 March 2016 14:59:39
<blank line>
The actual highlighted text goes here.
==========
```

**Title/author line.** The author is wrapped in the **last** pair of parentheses on line 1. This is the single trickiest parse: titles and authors can themselves contain parentheses. Real breakers include:
- `Indignez-vous ! édition revue et augmentée (Ceux qui marchent contre le vent) (French Edition) (Hessel, Stéphane)` [GitHub](https://github.com/peripatetic/klippy) — three parenthetical groups; only the last is the author.
- `Don Quixote (Em comemoração de seu terceiro centenário) (Thiago e Fernanda)` — parenthetical in the title.
- Personal documents / sideloaded files sometimes have **no author parentheses at all** (title only), so the author must be treated as optional.

**Correct strategy:** match the **last** balanced `(...)` at end of line as author, everything before it (trimmed) as title. A naive "text up to first `(`" splitter (used by some tools like klippy) breaks on all the cases above. Author name order is as stored ("Martin, Robert C." or "Berkun  Scott" [github](https://github.com/willmcneilly/kindleclippings) — note occasional double spaces).

**Metadata line — English variants:**
- `- Your Highlight on page X | location Y-Z | Added on <date>` (page + location) [GitHub](https://github.com/robertmartin8/KindleClippings)
- `- Your Highlight at location Y-Z | Added on <date>` (location only — older/sideloaded) [GitHub](https://github.com/robertmartin8/KindleClippings)
- `- Your Note on page X | location Y | Added on <date>`
- `- Your Bookmark on location Y | Added on <date>` (bookmarks usually have empty content) [GitHub](https://github.com/robertmartin8/KindleClippings)
- `- Your Article Clipping on page X...` (periodicals)

**Metadata line — localized (this changes with device language, and a single file can be mixed-locale if the user switched languages):**

| Locale | Highlight word | "location"/"page" | "Added on" | Real example |
|---|---|---|---|---|
| English | Your Highlight | page / location | Added on | `- Your Highlight on page 92 \| location 1406-1407 \| Added on Saturday, 26 March 2016 14:59:39` [GitHub](https://github.com/robertmartin8/KindleClippings) |
| German | Ihre Markierung | Seite / Position | Hinzugefügt am | `- Ihre Markierung auf Seite 56 \| bei Position 992-993 \| Hinzugefügt am Donnerstag, 27. Oktober 2016 01:37:51` [GitHub](https://github.com/lpuettmann/kindle-to-md/blob/master/My%20Clippings.txt) |
| Spanish | La subrayado | página / posición | Añadido el | `- La subrayado en la página 4 \| posición 60-60 \| Añadido el miércoles, 6 de julio de 2022 06:54:57` [github](https://github.com/samueldg/clippings) [pypi](https://pypi.org/project/clippings) |
| French | (surlignement / votre surlignement) | page / emplacement | Ajouté le | (structure mirrors others) |
| Brazilian Portuguese | Seu destaque | posição | Adicionado: | `- Seu destaque ou posição 93-101 \| Adicionado: segunda-feira, 23 de março de 2015 00:22:06` [PDFCOFFEE.COM](https://pdfcoffee.com/my-clippings-pdf-free.html) |
| Portuguese (bookmark) | Seu marcador | posição | Adicionado: | `- Seu marcador ou posição 3914 \| Adicionado: quarta-feira, 4 de março de 2015 11:44:45` [PDFCOFFEE.COM](https://pdfcoffee.com/my-clippings-pdf-free.html) |
| Japanese | ハイライト (メモ=note, ブックマーク=bookmark) | 位置No. / ページ | 作成日: | `- 位置No. 1009-1010のハイライト \|作成日: 2015年2月16日月曜日 13:10:30` |
| Dutch | Je markering (notitie/bladwijzer) | pagina / positie | Toegevoegd op | `- Je markering op pagina X \| positie Y-Z \| Toegevoegd op <date>` (UI terms confirmed; exact string device-verify) |

Note the Japanese word order is reversed: `位置No. Y-Zのハイライト` = "highlight OF location Y-Z", with `作成日:` as the date label (some firmware uses `追加日`). Portuguese Brazilian uses `ou posição` ("or position") and a colon after `Adicionado`.

**Record-type detection.** Match on the type keyword in the metadata line: Highlight / Note / Bookmark / (Article) Clipping, and their localized equivalents. Bookmarks (and clip-limit records) frequently have empty content. A locale-tolerant approach: (a) detect type by keyword set across languages; (b) extract page/location numbers with a locale-agnostic numeric regex like `/(\d+)(?:-(\d+))?/g` applied to the segment after the type word; (c) treat the date as the trailing portion after the last `|` or after "Added on"/localized equivalent.

**Date/timestamp.** English uses `Saturday, 26 March 2016 14:59:39` (24h in en-GB) or `Thursday, 6 February 2025 09:10:06`; US English can use 12h with AM/PM (`April 18, 2013 3:45:53 PM`). Localized months/day-names vary (`segunda-feira, 23 de março de 2015`; `2015年2月16日月曜日`). Robust parsing: strip the weekday, then try `Date.parse` after normalizing; for non-English, keep the raw date string as a fallback display value and parse numeric components (year/month/day/time) with a per-locale month-name map. Storing the original string guarantees no data loss even when parsing fails.

**Personal docs / sideloaded / PDFs.** These behave the same in `My Clippings.txt` (they're logged identically) but: (a) often lack an author paren; (b) PDF highlights are page-based; (c) crucially, **highlights on Amazon-purchased books can hit the "clipping limit"** — after a publisher-set cap (per Screvi's blog, "usually around 10% of the book"; TextMuncher cites "typically 10–20% of total content," and one documented Kindle app error read "This export will exceed the 15% limit set by the publisher for this book"), content is replaced by `<You have reached the clipping limit for this item>`. Sideloaded/personal-document highlights are the main reason people use the file at all, since those never sync to Amazon's cloud [Textmuncher](https://textmuncher.com/blog/export-kindle-highlights-notes) "Your Notes" page.

### 2. Known noise & edge cases (with solutions)

1. **BOM on first title** → strip leading `\uFEFF` from whole file before splitting.
2. **Empty bookmarks** → keep type=Bookmark but allow empty content; don't render as a highlight.
3. **Clipping-limit sentinel** → detect `<You have reached the clipping limit for this item>` (and localized forms) and drop or flag.
4. **Duplicate / overlapping highlights (the big one).** When you extend a highlight, the append-only file gets two records where one text is a prefix/superset of the other, [GitHub](https://github.com/icyflame/kindle-my-clippings-parser) usually at overlapping locations. [GitHub](https://github.com/mammuth/kindle-clippings/issues/17) Deduplication strategies, in increasing sophistication:
   - **Exact text match** — trivial, catches re-exports/re-imports appending the same entries; misses extensions.
   - **Normalized match** — trim, collapse whitespace, normalize quotes/case before comparing; catches whitespace-only diffs.
   - **Location-range overlap** — group by book, if location ranges overlap keep the most recent (by timestamp) or the longest. This is what fix-kindle-clippings and icyflame's `-remove-duplicates` do (same book+author, same start position, keep newest). [GitHub](https://github.com/icyflame/kindle-my-clippings-parser)
   - **Substring/superset detection** — if one highlight's text contains another's, keep the longest. This is the widely-used approach (Towards Data Science pipeline: `if text in c["text"]: keep longer`). [Towards Data Science](https://towardsdatascience.com/i-built-an-ai-pipeline-for-kindle-highlights/) Best default.
   - **Fuzzy similarity** (Levenshtein/Jaccard) — catches near-duplicates with OCR/typo differences but is O(n²)-ish and risks false merges; overkill for most and adds a dependency.
   
   **Recommended:** combine location-overlap grouping + substring/superset keep-longest, tie-break by newest timestamp. This handles the dominant "extended highlight" case without merging genuinely distinct quotes.
5. **Highlights split across page/location boundaries** → same location-overlap grouping helps; otherwise present as-is.
6. **Whitespace / typography** → normalize non-breaking spaces (U+00A0), smart quotes (" " ' '), ellipsis (…), soft hyphens (U+00AD), zero-width chars, and ligatures with `String.prototype.normalize('NFC')` plus targeted replacements. Keep a display copy and a normalized comparison copy.
7. **Title inconsistency across records** → BOM stripping fixes the classic case; also trim and normalize titles when grouping so `Title` and `Title ` collapse.
8. **Associating Notes with parent Highlights** → a Note and its Highlight share the same or adjacent location and are usually adjacent in the file. Match a Note to the Highlight in the same book with the nearest overlapping/equal location. This is imperfect (Kindle sometimes writes the note before vs after the highlight), [GitHub](https://github.com/rafi007akhtar/kindle-clippings-parser) so surface it as a soft association, not a guarantee (klippy/rafi007akhtar both flag this ambiguity).
9. **Very long files** → split once on `==========`, iterate with a single pass, build an index (Map by book). A few thousand records is trivial; avoid per-record regex backtracking and avoid re-rendering the whole DOM on every keystroke (debounce filter, use documentFragment / virtualized list if >~2000 visible).

### 3. Existing open-source tools to learn from

| Project | Lang / License | Parsing strategy | Edge cases handled |
|---|---|---|---|
| **hadynz/kindle-clippings** | JS/TS, MIT | Locale-aware metadata regex; supports EN/ES/FR (and more) incl. Japanese title example [GitHub](https://github.com/hadynz/kindle-clippings) | Multi-locale, most robust JS regex set |
| **icyflame/kindle-my-clippings-parser** | Go | Split on `==========`; `-remove-duplicates` (same source+start pos, keep newest), `-remove-clipping-limit` [GitHub](https://github.com/icyflame/kindle-my-clippings-parser) | Dupes, clip-limit, Bookcision merge |
| **robertmartin8/KindleClippings** | Python | Split file into blocks, per-block field parse [GitHub](https://github.com/robertmartin8/KindleClippings) | Deleted-but-logged highlights |
| **rccavalcanti/fyodor** | Ruby | "locale agnostic" basic parse, config for language [github](https://github.com/rccavalcanti/fyodor) | Empty/dup removal, note formatting, mixed locales, ordering by location [github](https://github.com/rccavalcanti/fyodor) |
| **samueldg/clippings** | Python, (PyPI) | Pluggable `metadata_parser` for non-English [github](https://github.com/samueldg/clippings) [pypi](https://pypi.org/project/clippings) | Custom locale parsers |
| **lvzon/kindle-clippings** | Python | English regex; issue #2 has FR/ES regexes; [GitHub](https://github.com/lvzon/kindle-clippings) SHA256 partial hash per note [GitHub](https://github.com/lvzon/kindle-clippings) | Personal docs, RST comments |
| **fix-kindle-clippings (MesihK)** | Python | **Location-overlap** dedup, keep last [GitHub](https://github.com/MesihK/fix-kindle-clippings) | Overlap dedup → Markdown |
| **KindleClippingsCleaner (flawnn)** | JS | Overlapping line-region comparison, keep latest [GitHub](https://github.com/flawnn/KindleClippingsCleaner) | Extended-highlight dupes |
| **Bookcision** | JS bookmarklet | Runs on read.amazon.com DOM, exports JSON [GitHub](https://github.com/icyflame/kindle-my-clippings-parser) | Bypasses clip-limit; not file-based |
| **Readwise / Clippings.io / Glasp / Screvi** | SaaS | Auto-dedup on import; multi-locale; note-to-highlight linking | Full-featured references |
| **Obsidian Kindle plugin (hadynz)** | JS | Uses kindle-clippings lib + Amazon cloud scrape | Highlight+note, locations |

The **most robust, locale-tolerant** regex approach in the JS ecosystem is **hadynz/kindle-clippings** (it's the engine behind the Obsidian Kindle plugin and handles EN/ES/FR/DE/PT/JP). For a zero-dependency single file, port its per-language keyword tables rather than a single English regex.

A representative English regex (from the ottsch/kindlehighlight lineage), for reference:
```js
// line 2 (metadata), English:
/^-\s*Your\s+(Highlight|Note|Bookmark)(?:\s+on\s+page\s+([\divxlc]+))?(?:\s*\|\s*)?(?:location\s+)?(\d+)?(?:-(\d+))?\s*\|\s*Added on\s+(.+)$/i
```
Because this is English-only, a locale-tolerant parser should instead detect the type by scanning for any known type keyword, then pull numbers and the trailing date generically.

### 4. The invisible hashtag — recommended technique + reasoning

**Copy-paste behavior is the hard constraint** (well-established across browser bug trackers and specs):
- `display:none` → not rendered, **not copied**, removed from accessibility tree. ❌ fails "present when copied".
- `visibility:hidden` → not copied either (Mozilla bug 39098 confirms hidden/collapsed content handling is inconsistent; modern browsers exclude it from copy). ❌
- `hidden` attribute / `aria-hidden` → same as display:none for copy purposes. ❌ (aria-hidden alone doesn't hide visually and doesn't guarantee copy).
- `opacity:0` / color-matched text / off-screen `position:absolute; left:-10000px` → visually hidden, **remains in DOM and IS copied**. [WebAIM](https://webaim.org/techniques/css/invisiblecontent/) ✅ but opacity/color leave layout space or are selectable oddly.
- **`.visually-hidden` / `.sr-only` clip pattern** → visually hidden, zero layout footprint, remains in DOM, **is included in copied text** in normal selection. ✅ Best passive option.

The canonical clip-pattern class:
```css
.sr-only:not(:focus):not(:active){
  position:absolute; width:1px; height:1px;
  padding:0; margin:-1px; overflow:hidden;
  clip:rect(0 0 0 0); clip-path:inset(50%);
  white-space:nowrap; border:0;
}
```

**However**, relying on selection semantics is fragile: some apps paste `text/plain` derived only from *visible* text, and sr-only inclusion in plain-text copy varies by browser/app. The **deterministic** solution is to **intercept the `copy` event** and build the clipboard payload yourself, adding the hashtag to both MIME types:

```js
document.addEventListener('copy', (e) => {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed) return;
  const tag = deriveTagForSelection(sel);   // e.g. "#AtomicHabits"
  const text = sel.toString();
  e.clipboardData.setData('text/plain', `${text} ${tag}`);
  e.clipboardData.setData('text/html', `${escapeHtml(text)} <span>${tag}</span>`);
  e.preventDefault();
});
```
This is spec-supported (MDN/W3C Clipboard API: a `copy` handler may call `setData` and `preventDefault`), [mozilla](https://developer.mozilla.org/docs/Web/API/Window/copy_event) works from a user's Ctrl/Cmd-C or context-menu copy, needs **no permissions and no secure context** (unlike `navigator.clipboard`), and works even from `file://`.

**Unicode zero-width characters** (ZWSP U+200B, word-joiner U+2060) can encode a hashtag invisibly and DO survive copy-paste, but they are **not human-greppable**, can be silently stripped by some editors, corrupt word-counts/search, and are a known source of "invisible junk" bugs. **Not recommended** as the primary mechanism; acceptable only as an optional experimental mode.

**Recommendation:** Render each entry's tag inside a `.sr-only` span (so it's exportable and present in the DOM for filtering/search), AND install a `copy`-event handler that appends the correct book hashtag to the plain-text clipboard payload. This gives "invisible on screen, reliably present when copied or exported" without depending on the async Clipboard API or a secure context. Also emit the tag explicitly in all file exports (Markdown/JSON/CSV) so it's never dependent on copy at all.

### 5. Slugification / hashtag generation

Best-practice pipeline (zero-dependency, handles Brazilian Portuguese accents):
```js
function toHashtag(title, {style='PascalCase', maxLen=40} = {}){
  // 1. Drop subtitle after colon (keep main title)
  let s = title.split(':')[0];
  // 2. Strip author parens / trailing "(...)"
  s = s.replace(/\s*\([^)]*\)\s*$/, '');
  // 3. NFD + strip combining diacritics (á→a, ç→c, ã→a)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // 4. Handle letters NFD misses
  s = s.replace(/[đĐ]/g,'d').replace(/ß/g,'ss').replace(/[øØ]/g,'o').replace(/[æÆ]/g,'ae');
  // 5. Keep alphanumerics + spaces
  s = s.replace(/[^a-zA-Z0-9\s]/g,' ').trim();
  // 6. Case style
  const words = s.split(/\s+/).filter(Boolean);
  let out;
  if (style==='PascalCase') out = words.map(w=>w[0].toUpperCase()+w.slice(1)).join('');
  else if (style==='kebab-case') out = words.join('-').toLowerCase();
  else if (style==='snake_case') out = words.join('_').toLowerCase();
  else out = words.join('');
  return '#'+out.slice(0,maxLen);
}
```
Key points:
- **`normalize('NFD') + /[\u0300-\u036f]/g` removal** is the standard, robust way to strip accents — critical for Brazilian Portuguese (`Ação`→`Acao`, `Coração`→`Coracao`). NFD only handles Latin diacritics; letters like `đ`, `ß`, `ø` need explicit maps. [DevToys Web Pro](https://devtoys.pro/blog/slugify-guide)
- **Subtitles after `:`** — drop them to keep tags short (`Atomic Habits: An Easy...` → `#AtomicHabits`). Optionally keep as a nested tag.
- **Articles** (The/A/An) — optionally strip leading article for cleaner tags; make it a toggle since it can cause collisions.
- **Case style:** **Obsidian tags cannot contain spaces**; [Obsidian](https://forum.obsidian.md/t/undo-breaking-change-no-space-allowed-in-tags/67721) legal characters are letters, numbers, `_`, `-`, `/` (nested). [GitHub](https://github.com/obsidianmd/obsidian-help/issues/816) Emoji/most punctuation and (since Obsidian 1.4) spaces are disallowed. **CamelCase/PascalCase is the safest cross-tool choice** (`#AtomicHabits`), works in Obsidian and reads as one token; kebab/snake also fine in Obsidian. Notion "tags" are multi-select property values [gumroad](https://mistralcreates.gumroad.com/l/NestedTagSystemforNotion) that DO allow spaces, so a Notion export can use the raw title — but for an inline `#hashtag` token, PascalCase is safest.
- **Length limit:** cap ~40 chars to avoid unwieldy tags.
- **Collision handling:** if two different books slug to the same hashtag, append a short disambiguator — the last author surname or a 2-3 char hash of "title+author" (`#AtomicHabits_Clear`). Maintain a Map of slug→bookKey during parse and only disambiguate on actual collision.

### 6. Single-file HTML constraints & capabilities (2026)

**Reading the file.** Use `<input type="file" accept=".txt">` + `FileReader.readAsText(file, 'UTF-8')` (or the newer `await file.text()`, which defaults to UTF-8). [Uchicago](https://frost.cs.uchicago.edu/ref/JavaScript/developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsText.html) Add drag-and-drop as a convenience (`dragover`/`drop`, read `e.dataTransfer.files[0]`). The **File System Access API** (`showOpenFilePicker`) is nicer for re-saving in place but is Chromium-only and **does not work over `file://`** — not worth the dependency for this use case. **Force UTF-8** explicitly and **strip the BOM in JS** regardless: `text = text.replace(/^\uFEFF/, '')` (FileReader/`file.text()` do NOT reliably strip the BOM — it appears as `\uFEFF` in the resulting string). [GitHub](https://github.com/nodejs/node-v0.x-archive/issues/1918)

**Persistence.**
- **localStorage** — per MDN Web Docs ("Storage quotas and eviction criteria"), "Browsers can store up to 5 MiB of local storage… per origin" (the WHATWG spec calls it "a mostly arbitrary limit of five megabytes per origin"). Synchronous, string-only (JSON.stringify). Fine for a few hundred to low-thousands of highlights, but a large library (5k+ highlights with full text) can exceed 5 MiB and throw `QuotaExceededError`. Also note: localStorage is **per-origin**, so if the app is hosted on a shared origin (e.g. `username.github.io`), it shares storage with every other project under that origin — a real gotcha; namespace your keys and prefer a project subpath or custom domain.
- **IndexedDB** — asynchronous and disk-proportional, so far larger: per MDN, Chrome/Edge allow up to ~60% of total disk per origin, Firefox up to 50% of free disk (max 2 GB per origin), and Safari an initial ~1 GiB before prompting. The right choice if you want to persist a big library reliably. Slightly more code but no dependency needed.
- **Recommendation:** parse fresh from the file each session by default (simplest, most private); offer optional localStorage caching with a size guard, and reach for IndexedDB only if you support persistent multi-session libraries.

**Exporting.** Generate files with Blob + object URL:
```js
function download(filename, text, mime='text/plain'){
  const blob = new Blob([text], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {href:url, download:filename});
  a.click(); URL.revokeObjectURL(url);
}
```
Works over `file://` and `https://`. Support Markdown, JSON, CSV, plain text (all pure string generation).

**Copying to clipboard.** Two paths:
- Async Clipboard API `navigator.clipboard.writeText()` — clean, but **requires a secure context (HTTPS or localhost) AND a user gesture**. [JSGuides](https://jsguides.dev/tutorials/browser-apis/browser-clipboard/) Over plain `file://` or `http://` (non-localhost), `navigator.clipboard` is `undefined` and throws. [Bobby Hadz](https://bobbyhadz.com/blog/navigator-clipboard-is-undefined-in-javascript)
- `copy`-event interception (see §4) + legacy `document.execCommand('copy')` fallback via a temporary textarea — works everywhere including `file://`.
- **Recommendation:** feature-detect `navigator.clipboard && window.isSecureContext`, [Bobby Hadz](https://bobbyhadz.com/blog/navigator-clipboard-is-undefined-in-javascript) else fall back to execCommand. For the invisible-hashtag copy, use the `copy`-event handler which is universal.

**What breaks under `file://`:** `navigator.clipboard` (secure-context gated), some storage edge cases, ES module scripts (`<script type="module">` and `fetch()` of local files are blocked by CORS under `file://` in most browsers), and any `fetch()` to same-directory files. **Mitigations:** inline all JS/CSS in the single HTML file (no modules, no external fetch), use classic `<script>`, and use the copy-event/execCommand path. Then the file genuinely works by double-click. Cover-image fetches to Open Library/Google Books DO work from `file://` (they're cross-origin HTTPS with CORS) unless blocked by a strict CSP.

**Search/filter performance.** For a few thousand records, plain JS is more than enough: pre-lowercase a search-blob per record, filter with `.includes()`, debounce input ~120 ms, and render with a documentFragment or simple virtualization. No fuzzy library needed; if desired, a tiny self-contained fuzzy scorer (subsequence match) can be added in ~20 lines with zero dependencies.

### 7. Hosting options (free, private, low-maintenance)

Because all parsing is client-side, **no host ever sees the user's data** regardless of choice — privacy is a property of the app, not the host. The decision is about ease + HTTPS (needed for the async Clipboard API) + custom domains.

| Option | Cost | HTTPS | Custom domain | Clipboard API / localStorage | Setup for non-Git user | Notes |
|---|---|---|---|---|---|---|
| **Run locally (`file://`)** | Free | n/a (not secure context) | n/a | async Clipboard API ❌ (copy-event fallback ✅); localStorage ✅ | Easiest — double-click | Fully private; no modules/fetch; best paired with copy-event handler |
| **GitHub Pages** | Free | ✅ | ✅ (free) | ✅ / ✅ | Medium — needs a repo; can upload via web UI, no Git CLI required | **Gotcha:** `username.github.io` is one origin → localStorage shared across projects; per GitHub docs, ~100 GB/mo soft bandwidth, ≤1 GB site size, ~10 builds/hr soft limit |
| **Cloudflare Pages** | Free | ✅ | ✅ (free) | ✅ / ✅ | Medium — drag-drop deploy or Git | Per Cloudflare docs: unlimited bandwidth/static requests, 500 builds/mo, 20,000 files, 25 MiB/file on Free — all irrelevant for one HTML file. Best performance |
| **Netlify** | Free | ✅ | ✅ | ✅ / ✅ | Easy — drag-and-drop deploy | Credit-based free tier since 2025 can pause a site [Puter](https://developer.puter.com/blog/cloudflare-pages-alternatives/) if limits blow; fine for low traffic |
| **Vercel** | Free | ✅ | ✅ | ✅ / ✅ | Medium | Overkill for a static file; best for Next.js |
| **Codeberg Pages** | Free | ✅ | ✅ | ✅ / ✅ | Harder — Git-centric | Privacy-friendly, non-profit |
| **Neocities** | Free | ✅ | paid tier for custom domain | ✅ / ✅ | Easiest hosted — web upload, no Git | Great for a non-technical user who wants a URL |

**Recommendation:** For a non-expert who wants free + fast + private + low-maintenance: **Cloudflare Pages** (drag-drop, unlimited bandwidth, HTTPS, custom domain) or **Neocities** (simplest web upload). If they already use GitHub, **GitHub Pages** is fine — just put the app in its own repo and be aware of the shared-origin localStorage gotcha. And because the app can run from `file://` with the copy-event fallback, **"just keep the .html on disk"** is a legitimate zero-hosting option.

### 8. Bonus / optional features

- **Book covers / metadata.** **Open Library Covers API** is free, no key, [Public APIs](https://publicapis.io/open-library-api-api) CORS-friendly: `https://covers.openlibrary.org/b/isbn/<ISBN>-M.jpg` (or by OLID/OCLC/LCCN). [github](https://github.com/Luca3317/OpenLibrary.NET/blob/main/docs/Covers%20API.md) Search by title/author via `https://openlibrary.org/search.json?title=...&author=...` to resolve a cover ID when you have no ISBN. Open Library asks for a descriptive User-Agent [Public APIs](https://publicapis.io/open-library-api-api) and reasonable caching. **Google Books API** also returns `imageLinks` thumbnails [Isbnbarcode](https://isbnbarcode.org/blog/bookcoverapi) and works from the browser; a key is optional for low-volume read requests. Since `My Clippings.txt` has **no ISBN**, you must fuzzy-match title+author → expect some misses; make covers a nice-to-have that degrades gracefully. All of this is optional and needs no server (client-side `fetch`), though it does send the *title* (not the highlights) to a third party — disclose this and make it opt-in to preserve the "nothing leaves the device" promise.
- **Export formats that ingest well:**
  - **Obsidian** — one Markdown file per book, highlights as blockquotes, the book hashtag inline (PascalCase) and/or in YAML frontmatter `tags:`.
  - **Notion** — Markdown or CSV import; put the tag in a multi-select column (spaces allowed there).
  - **Readwise / Clippings.io** — they accept the raw `My Clippings.txt` directly [Clippings](https://docs.clippings.io/importing/importing-your-myclippingstxt-file/) [Readwise Docs](https://help.readwise.io/article/30-how-do-i-import-highlights-from-personal-documents-on-kindle) and auto-dedup; [Clippings](https://docs.clippings.io/importing/importing-your-kindle-highlights/) your cleaned/deduped export also works.
  - **Anki** — tab-separated `.txt` / CSV (front = highlight, back = book+location, or cloze); Kindle Mate and Glasp both demonstrate Anki export. No server required.

## Recommendations

**Build order (staged):**
1. **MVP parser + filter.** Read file (FileReader, force UTF-8, strip BOM), split on `==========`, parse the 5-line block with last-paren author extraction and a locale-tolerant metadata parser (port hadynz/kindle-clippings keyword tables for EN/DE/ES/FR/PT/JP/NL). Group by normalized title. Render a book filter (dropdown or chips) + a debounced substring search. Ship this first; it's the core value.
2. **Cleanup + dedup.** Normalize typography (NFC, smart quotes, NBSP, ellipsis, soft hyphen). Drop clip-limit sentinels and empty bookmarks. Dedup via location-overlap grouping + substring/superset keep-longest, tie-break newest. Associate notes to nearest-location highlight (soft link).
3. **Invisible hashtag.** Generate PascalCase hashtag per book (NFD accent strip, subtitle drop, collision disambiguation). Render as `.sr-only` span per entry; install `copy`-event handler that appends the correct book tag to `text/plain` and `text/html`. Include the tag explicitly in every export.
4. **Export.** Markdown (Obsidian-ready, one-file-per-book option), JSON, CSV, plain text via Blob download. Optional Anki TSV.
5. **Optional polish.** localStorage caching (with size guard) or IndexedDB for persistence; opt-in Open Library covers; virtualized list if libraries exceed ~2000 visible rows.

**Deploy:** inline all CSS/JS into one `.html` (no modules, no external fetch) so it runs from `file://` too. Publish on **Cloudflare Pages** (or Neocities for a non-technical user) over HTTPS so the async Clipboard API also works.

**Thresholds that change the plan:**
- If target files routinely exceed ~5 MiB or ~5k highlights → switch persistence from localStorage to **IndexedDB**, and add list virtualization.
- If users report a book appearing twice → verify BOM stripping and title normalization first.
- If non-English users report unparsed entries → the metadata-keyword table is missing their locale; add it (keep the raw date string as fallback).
- If copy-paste tags fail in a specific target app → rely on the explicit `copy`-event payload and, above all, on **export** (which never depends on copy behavior).

**Top edge cases the final implementation MUST handle:** (1) leading BOM on first title; (2) author in the *last* parenthesis, with parentheses inside title/author and author-less personal docs; (3) localized metadata lines (DE/ES/FR/PT/JP/NL) including reversed Japanese word order; (4) extended-highlight duplicates via location-overlap + superset keep-longest; (5) empty bookmarks; (6) clipping-limit sentinels; (7) CRLF vs LF tolerance and trailing empty block after final separator; (8) typography normalization (NBSP/smart quotes/ellipsis/soft hyphen); (9) note↔highlight soft association; (10) 12h vs 24h and localized month/day names in dates.

## Caveats
- **CRLF is strongly supported but not byte-dump-proven here** for a 2021+ Paperwhite specifically (documentation calls it "DOS format"; parsers strip `\r`). Write the splitter to tolerate both `\r\n` and `\n` regardless — this is the safe, standard practice.
- The **Dutch** metadata-line string is reconstructed from confirmed Kindle Dutch UI vocabulary (markering/notitie/bladwijzer, [Cloudfront](https://d1ergij2b6wmg5.cloudfront.net/kug/kindle_scribe/v1/nl/html/kug.html) pagina, positie, "Toegevoegd op", "Mijn knipsels"); [Cloudfront](https://d1ergij2b6wmg5.cloudfront.net/kug/kindle_scribe/v1/nl/html/kug.html) the exact determiner and location word in the clippings file should be verified against a real Dutch device file. Japanese `メモ`/`ブックマーク` line wrapping is inferred from the confirmed `…のハイライト` pattern.
- **Note↔Highlight association is inherently unreliable** — Kindle sometimes writes the note before and sometimes after its highlight, and location matching is approximate. Present associations as best-effort, never as ground truth.
- **Clipping-limit records mean some highlights are simply not in the file** (Amazon-purchased books past the publisher cap, commonly ~10%). The app cannot recover these from the file; only the on-device notebook export or Bookcision (read.amazon.com) [Readwise](https://readwise.io/bookcision) can.
- **Cover matching without ISBN is lossy**; expect misses and wrong covers for common titles. Keep it optional and opt-in.
- **Copy-paste hidden-text behavior varies** across browsers and destination apps; the `copy`-event interception is the most reliable path, and file export is the guaranteed one. Do not rely on Unicode zero-width tricks.
- Free-hosting terms change (Netlify moved to credit-based limits in 2025); verify current free-tier caps before committing, though a single static HTML file is trivial load for any of them.