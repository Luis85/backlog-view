---
type: Bug
parent: "[[Where new items are filed]]"
order: 40
status: Done
closed: 2026-08-01
source: automated review of PR #22
---

# Type folder read off Object.prototype

## What happened

The type-to-folder mapping was a plain object, so a level or extra type named `constructor`,
`toString` or `valueOf` found an **inherited function** rather than nothing. The value is
truthy, so the guard fell straight through and the creation flow took a function for a folder
path, failing on `.trim()`.

## Fix

Both ends, deliberately:

- **The source** builds a null-prototype record, so such a name is a plain key — and a
  mapping for `__proto__` becomes storable at all, where a plain object silently dropped it.
- **The reader** requires a non-empty *string*, which makes it total for any record a caller
  constructs rather than only the ones this module builds. A type test rather than an
  own-property dance, because "a folder is a non-empty string" is the actual invariant.
