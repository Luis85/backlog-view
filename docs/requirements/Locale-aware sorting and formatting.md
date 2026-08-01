---
type: PBI
parent: "[[Data is never translated]]"
order: 30
status: Open
---

# Locale-aware sorting and formatting

The places where the *locale* changes an ordering or a rendering even though no string is
being translated. Small, easy to miss, and nothing else in the epic will surface them.

## Where they are

Three `localeCompare` calls, all currently locale-less:

| Site | Sorts |
| --- | --- |
| `ui/prompts.ts:58` | Folder paths in the folder suggest |
| `domain/model.ts:495` | `observedStates` — the state vocabulary offered in the menu |
| `domain/model.ts:512` | The tag vocabulary |

Called with no locale argument, `localeCompare` uses the *host's* default, which is the
operating system's language rather than Obsidian's. So a user running Obsidian in one
language on a system set to another already gets a collation neither of them chose — a
bug that exists today and that this PBI is the natural place to fix.

Formatting is the other half: `columns.ts:276` renders `${done}/${total}` and
`columns.ts:280` a bare descendant count. Both are numbers shown to a person.

## Acceptance criteria

- Every `localeCompare` in `src/` passes the resolved locale explicitly. A bare
  `localeCompare(b)` is a lint-visible mistake, the way `processFrontMatter` outside
  `storage/` already is.
- Counts and ratios shown to the user go through `Intl.NumberFormat` for the resolved
  locale.
- Sorting affects **presentation only**. `order` is a fractional rank and
  `entryIndex` is the Bases result order; neither is touched by collation, and no write
  path may depend on a locale-sorted list. The state and tag vocabularies are sorted for
  the menu — what gets *written* is the value the user picked.
- Dates, if any are ever rendered, use `obsidian.moment`, which Obsidian has already
  configured, rather than a second date stack.
