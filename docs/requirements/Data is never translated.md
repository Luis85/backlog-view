---
type: Feature
parent: "[[Multilang]]"
order: 30
status: Open
---

# Data is never translated

The line between what the plugin *says* and what the plugin *writes, matches or
persists*. Text may change with the locale. Data may not, ever.

This is the feature that makes the epic safe rather than the one that makes it work, and
it is written as an invariant for the same reason the context-row rule is: every way to
get this wrong looks locally reasonable. Translating `Epic` is the obviously helpful
thing to do at every single site that renders it.

## The rule

**A string that any code reads back, matches on, or writes to disk is data.** That
covers, concretely:

| Data | Where it is read back |
| --- | --- |
| Type names (`Epic`, `Feature`, `PBI`, `Task`, `Issue`, `Bug`) | `type:` frontmatter; matched by `focusTarget`, `isExtraType`, `byTypeName` |
| View-option keys | Persisted in the `.base` file, read by `resolveSettings` |
| `typeFolder.<type>` keys | Derived from the type name — a translated type is a different key |
| State values, done values | The user's own workflow, echoed on the chip |
| Tag text | The user's own vocabulary |
| `.base` contents from the scaffold | `name: Backlog`, the `docs` folder, the `Product Backlog` file name |
| `parent` wikilink targets | File names, which are vault content |

The corollary is the thing to build: a type name has to be *renderable* without becoming
translatable, which means a display label separate from the stored value.

## How to tell, when it is not obvious

Ask what breaks if two people with different Obsidian languages open the same vault. If
the answer is "one of them sees different words", it is text. If the answer is "one of
them writes notes the other's view cannot read", it is data.
