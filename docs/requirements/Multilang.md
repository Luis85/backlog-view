---
type: Epic
order: 30
status: Open
area: i18n
created: 2026-08-01
---

# Multilang

Every string this plugin puts on screen comes out of a catalog keyed by locale, so the
view reads in the language the user already set Obsidian to. Nothing about the backlog
itself changes: the tree, the ranking and the frontmatter are the same in every language.

This epic is the whole translation problem — the mechanism, the sweep over the surfaces,
the line between text and data, and what keeps a new string from shipping untranslated.

## Why it exists

Obsidian ships in about thirty languages and tells a plugin which one is active:

```ts
/**
 * Get the ISO code for the currently configured app language. Defaults to 'en'.
 * @since 1.8.7
 */
export function getLanguage(): string;
```

`manifest.json` sets `minAppVersion: 1.10.2`, which is above 1.8.7, so **`getLanguage()`
is available unconditionally** — no feature test, no fallback path, and by the rule in
the root `CLAUDE.md` no shim either. The API is a language *code* and nothing more:
Obsidian translates its own UI and hands a plugin the code to translate its own.

What the plugin does with that today is nothing. A grep for the sites that produce
user-facing text — `setTitle`, `setName`, `setTooltip`, `setPlaceholder`,
`setButtonText`, `new Notice`, `text:`, `aria-label`, `displayName:`, `placeholder:` —
finds **about 141 of them across 14 files**, every one an English literal spelled inline:

| File | Sites |
| --- | --- |
| `domain/viewOptions.ts` | 30 |
| `view/render/toolbar.ts` | 23 |
| `view/render/columns.ts` | 20 |
| `view/interactions/menu.ts` | 16 |
| `ui/prompts.ts` | 13 |
| `view/render/rows.ts` | 11 |
| `view/render/emptyStates.ts`, `view/backlogView.ts` | 8 each |
| `view/interactions/{tags,create}.ts` | 3 each |
| `view/interactions/structure.ts`, `commands/scaffold.ts` | 2 each |
| `view/interactions/undo.ts`, `view/host.ts` | 1 each |

That is a count of *call sites*, not of distinct messages — the honest number of catalog
keys is not known until the sweep runs, and the first feature to do it should record what
it actually found.

## The decision that shapes everything under it

A plugin whose data model is frontmatter has two kinds of string, and translating the
second kind corrupts vaults:

**Text** is what the plugin says. `Move up`, `Loading backlog…`, `Show completed items`,
`Nothing to undo.` Every one of these is free to change per locale, because nothing reads
them back.

**Data** is what the plugin writes, matches or persists, and it is *not* English — it is
the vocabulary this plugin and the user's notes agree on:

- The type names. `type: Epic` goes into frontmatter (`storage/frontmatter.ts`) and is
  matched case-insensitively coming back out (`focusTarget`, `isExtraType`,
  `byTypeName`). A German vault whose notes say `Epos` is a different vault.
- Every view-option `key` in `domain/viewOptions.ts`. The file already says it: *"Every
  `key` here is PERSISTED in the user's `.base` file … Renaming one silently resets that
  option for everyone."* A locale-dependent key would do that on every language switch.
- The values inside those options — `stateValues: "Open, Active, Done"` and
  `doneValues` in `docs/Product Backlog.base` are the user's own workflow states, echoed
  back on the state chip.
- What the scaffold writes to disk: `name: Backlog` inside the generated `.base`
  (`storage/baseFile.ts`), the `Product Backlog` file name, the `docs` folder default.
  A vault should not be shaped differently depending on the locale of whoever ran
  **Create backlog**.

`Data is never translated` is the feature that holds this line, and it is the one to
read first when anything here looks ambiguous.

## Definition of done, for anything under this epic

- No user-facing string is spelled at the place it is used; a bare literal reaching the
  UI fails `npm run check` rather than review.
- A missing key falls back to English and renders, never blanks and never throws.
- Nothing the plugin writes to a note, a `.base` file or a file name changes with the
  locale.
- The suite passes in a locale that is not English, and no assertion depends on English
  wording.
- At least one non-English catalog ships, because machinery with a single locale has
  never been exercised.

## Not in scope

- **A language setting of its own.** Obsidian's is the source of truth; a second one is
  a second answer to the same question. Obsidian requires a restart to change language,
  so resolving the locale once at load is correct, not a shortcut.
- **The marketplace description.** `manifest.json` carries one `description` and the
  community list shows it as written. Out of the plugin's hands.
- **Note content.** Titles, tags and state values are the user's words in the user's
  language already.
- **Translating `docs/`.** This register is the maintainers' working notes, not product.
