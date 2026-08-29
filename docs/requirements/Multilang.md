---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 10
status: Active
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Multilang

Every string this plugin puts on screen comes out of a catalog keyed by locale, so the
view reads in the language the user already set Obsidian to. Nothing about the backlog
itself changes: the tree, the ranking and the frontmatter are the same in every language.

## Why it exists

Obsidian ships in about thirty languages and tells a plugin which one is active:

```ts
/**
 * Get the ISO code for the currently configured app language. Defaults to 'en'.
 * @since 1.8.7
 */
export function getLanguage(): string;
```

`manifest.json` sets `minAppVersion: 1.12.0`, which is above 1.8.7, so **`getLanguage()`
is available unconditionally** — no feature test, no fallback path, and by the rule in
the root `CLAUDE.md` no shim either. The API is a language *code* and nothing more:
Obsidian translates its own UI and hands a plugin the code to translate its own.

What the plugin does with that today is nothing. A grep for the sites that produce
user-facing text — `setTitle`, `setName`, `setTooltip`, `setPlaceholder`,
`setButtonText`, `new Notice`, `text:`, `aria-label`, `displayName:`, `placeholder:` —
finds **about 141 of them across 15 files**, every one an English literal spelled inline:

| File | Sites |
| --- | --- |
| `domain/viewOptions.ts` | 30 |
| `view/render/toolbar.ts` | 23 |
| `view/render/columns.ts` | 20 |
| `view/interactions/menu.ts` | 16 |
| `ui/prompts.ts` | 13 |
| `view/render/rows.ts` | 11 |
| `view/render/emptyStates.ts` | 8 |
| `view/writeGate.ts` | 5 |
| `view/backlogView.ts` | 3 |
| `view/interactions/{tags,create}.ts` | 3 each |
| `view/interactions/structure.ts`, `commands/scaffold.ts` | 2 each |
| `view/interactions/undo.ts`, `view/host.ts` | 1 each |

That is a count of *call sites*, not of distinct messages — the honest number of catalog
keys is not known until the sweep runs, and the PBI that does it should record what it
actually found.

## The rule the PBIs share: text is not data

A plugin whose data model is frontmatter has two kinds of string, and translating the
second kind corrupts vaults.

**Text** is what the plugin says. `Move up`, `Loading backlog…`, `Nothing to undo.` Free
to change per locale, because nothing reads it back.

**Data** is what the plugin writes, matches or persists:

| Data | Where it is read back |
| --- | --- |
| Type names — the whole shipped vocabulary, `ALL_TYPES`, whatever its length | `type:` frontmatter; matched by `focusTarget`, `isExtraType`, `byTypeName` |
| View-option keys | Persisted in the `.base` file, read by `resolveSettings` |
| `typeFolder.<type>` keys | Derived from the type name — a translated type is a different key |
| State values, done values | The user's own workflow, echoed on the chip |
| Tag text | The user's own vocabulary |
| `.base` contents from the scaffold | `name: Backlog`, the `docs` folder, the `Product Backlog` file name |
| `parent` wikilink targets | File names, which are vault content |

This is written as an invariant rather than a note on one PBI because every way to get it
wrong looks locally reasonable — translating `Epic` is the obviously helpful thing to do
at every single site that renders it. The test when it is not obvious: **ask what breaks
if two people with different Obsidian languages open the same vault.** If the answer is
"one of them sees different words", it is text. If it is "one of them writes notes the
other's view cannot read", it is data.

The corollary is the thing to build: a type name has to be *renderable* without becoming
translatable, which means a display label separate from the stored value. That is
`Type names are data`, and it is the PBI most likely to be got wrong.

## Where the catalog lives

The layer diagram in `CLAUDE.md` has no room for it. `ui/` may import nothing at all
(`forbidden('ui', ['view', 'commands', 'domain', 'storage'])` in `eslint.config.mjs`) and
`ui/prompts.ts` has 13 string sites; `domain/` may not reach view, storage, ui or
commands. So a catalog placed in any existing directory is unreachable from at least one
of its callers.

It has to be a **new leaf below everything** — importable by every layer, importing none
of them. That is the same shape `ui/` has, one level lower, and it needs the same
mechanical statement: a `forbidden` entry listing every other directory, so the leaf
cannot quietly grow an edge back up.

## Order of work

The layer lands whole before the sweep — `Locale resolution and fallback`,
`The string catalog` and `Plurals and interpolation` first. A half-built layer means a
hundred strings get moved against an interface that then changes.

**Those three are done (2026-08-15).** `src/i18n/` is the leaf, with `en.ts` as the
catalog, `locale.ts` as the pure resolution and `t.ts` as the lookup — plus the fixture
catalogs that let a one-locale layer fail a test. Roughly eighteen call sites moved with
it: every inline plural ternary in `src/view/`, and the `' and '` joiner. The remaining
~120 sites were the sweep, which is `Every surface translated` onwards, and the count of
catalog keys at that date was **21**.

**Where the sweep stands (2026-08-20).** `ui/`, `commands/` and
`view/render/emptyStates.ts` are swept and the catalog holds **107** keys — so the two
numbers in the paragraph above are that date's and not this one's, kept because a
statement with a date on it is history and one without is a claim.

What is LEFT cannot honestly be given as one number, and the disagreement is the useful
part. The narrow greps — the setter names and `new Notice`, plus the `text:`/`label:`/
`title:`/`'aria-label':` properties — see 72 and 43 in `view/`, 51 in `domain/`
(`viewOptions.ts`'s `displayName:`, which is that directory's whole shape), and 2 in
`main.ts`. That last one is measured as 3 and is 2: the instrument counts
`name: 'Product Backlog'`, the plugin's own name, which this epic says is never
translated. The AST walk recorded in `Every surface translated` sees 321 prose literals in
`view/render/` alone, because it counts a concatenated sentence's FRAGMENTS. Neither is
wrong; they answer different questions, and a slice is planned by re-deriving with the
instrument that fits it rather than by quoting either.

**Where the sweep stands (2026-08-21).** `ui/`, `commands/`, `view/interactions/`, the
whole of `view/render/`, `view/writeGate.ts`, `view/cardMoves.ts`, `main.ts` and
`domain/viewOptions.ts` are swept, and the catalog holds **476** keys — counted two ways
that day, `Object.keys` at runtime and a tab-aware grep. The line above is 2026-08-20's and
is kept for the reason the previous one is.

What is LEFT is two places and neither is an unfinished sweep. `view/manual/` is authored
long-form prose, and whether it belongs in a message catalog is the open question
`Every surface translated` states rather than work nobody has done. The rest of `domain/`
is `backlogReadme.ts`, which is written INTO the vault — a data question before a text one
— plus `roadmap.ts`'s shelf label, which is one string and is asserted still-English in
`test/i18n/projections.test.ts` so that keying it fails a test.

The branding spike `A bare string cannot reach the UI` asks for has also run, and its
result is recorded there: the design holds unchanged, and no nominal wrapper is needed.

## Definition of done

- No user-facing string is spelled at the place it is used; a bare literal reaching the
  UI fails `npm run check` rather than review.
- A missing key falls back to English and renders, never blanks and never throws.
- Nothing the plugin writes to a note, a `.base` file or a file name changes with the
  locale.
- The suite passes in a locale that is not English, and no assertion depends on English
  wording.
- **English ships alone in this round** — it is the default, the fallback and the only
  catalog. The machinery a second locale would exercise is proven by fixture locales and
  a development-only pseudo-locale instead, so nothing ships untested and no translation
  ships unreviewed. See `English ships alone`.

## Not in scope

- **A language setting of its own.** Obsidian's is the source of truth; a second one is
  a second answer to the same question. Obsidian requires a restart to change language,
  so resolving the locale once at load is correct, not a shortcut.
- **The marketplace description.** `manifest.json` carries one `description` and the
  community list shows it as written. Out of the plugin's hands.
- **Any second language.** A deliberate scope decision rather than an omission, and the
  one PBI most likely to be misread as unfinished — `English ships alone` states it.
- **Note content.** Titles, tags and state values are the user's words already.
- **Translating `docs/`.** This register is the maintainers' working notes, not product.
