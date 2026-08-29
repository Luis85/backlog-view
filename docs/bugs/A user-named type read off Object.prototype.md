---
type: Bug
parent: "[[Where new items are filed]]"
order: 40
status: Done
created: 2026-08-01
closed: 2026-08-01
area: domain
source: automated review of PR
files:
  - src/domain/itemTypes.ts
  - src/domain/settings.ts
  - src/view/render/rows.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# A user-named type read off Object.prototype

## What happened

The type-to-folder mapping was a plain object, so a level or extra type named `constructor`,
`toString` or `valueOf` found an **inherited function** rather than nothing. The value is
truthy, so the guard fell straight through and the creation flow took a function for a folder
path, failing on `.trim()`.

## Fix

Fixed three times, which is the interesting part.

The first fix hardened the resolved folder record: null-prototype at the source, a
non-empty-string test at the reader. Review then found the **same bug at the defaults
table**, where `constructor` produced `docs/function Object() { [native code] }` as a
folder that beat the home folder. Fixed again, the same way. Review then found it a
**third** time, at the badge style table in `rows.ts`, where the truthy inherited value
meant `addClass(undefined)` and a badge rendered as `pbl-badge undefined`.

Three tables, one mistake, three separate fixes — because each fix hardened *that table*
rather than the operation. So the operation is now a function:

```ts
export function byTypeName<T>(table: Record<string, T>, typeName: string | null): T | undefined;
```

Every lookup of a user-supplied type name goes through it. Reaching for a bare index is
the thing to notice in review now, rather than reasoning about `Object.prototype` afresh
at each new table. `test/domain/itemTypes.test.ts` ("does not read a type name off
Object.prototype") exercises `byTypeName` through the two folder tables — the resolved
type folders and the defaults table — and would catch a regression in the helper itself.
It does not call the third site directly: `src/view/render/rows.ts` reads
`EXTRA_TYPE_STYLE` through the same `byTypeName`, but nothing renders a row with a
prototype-property type name to check it, so a regression that bypassed the helper only
at that call site would not be caught.

## Lesson

Type names are **user data**, and `table[name]` is not a safe way to read user data — the
inherited hit is truthy, so the usual `if (!found)` guard passes it straight through.

The wider lesson is about how this was fixed rather than what was wrong: three times the
fix was applied where the bug was found, and three times the next table was still open. A
mistake that recurs at a new site is telling you the site is not the unit to fix. This is
the same shape as [Nested extra type lost its pinned rank](Nested%20extra%20type%20lost%20its%20pinned%20rank.md),
whose own lesson — *a rule has to hold wherever it applies, not only where it was noticed*
— described the next two bugs on the branch before they were written.
