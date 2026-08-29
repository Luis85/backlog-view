---
type: Bug
parent: "[[Horizons or dates]]"
order: 20
status: Done
created: 2026-08-02
closed: 2026-08-02
area: domain
source: audit during PR
files:
  - src/domain/model.ts
  - src/domain/noteFields.ts
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

# An axis property named off Object.prototype reads as unreadable

## What happens

The roadmap's axis fields are read by key from the note's frontmatter:

```ts
return key ? read(fm?.[key]) : absentReading();
```

`key` is whatever the user named in the view options. `__proto__`, `constructor`,
`toString` and `valueOf` are all legal frontmatter property names, and on a note that
does **not** own the key that lookup returns the inherited value from `Object.prototype`
— a function — rather than nothing.

What makes this worse here than everywhere else the same lookup appears is what the
axis readers do with it. `readString`, `readNumber` and `readTags` return null or an
empty list for anything they do not recognize, so the state, type, order and tag reads
survive an inherited function by accident: "unrecognized" and "absent" are the same
answer to them. The axis readers deliberately tell those apart — that distinction is
the whole point of `FieldReading` — so they classify a function as **refused**:

| Reader | Inherited `toString` yields |
| --- | --- |
| `readString` | `null` — absent |
| `readNumber` | `null` — absent |
| `readTags` | `[]` — absent |
| `readPlacement` | `{ value: null, invalid: true }` — **refused** |
| `readDate` | `{ value: null, invalid: true }` — **refused** |

So a user whose horizon property is named `toString` gets every note lacking that own
property shelved as unreadable, with the reason shown, rather than treated as not yet
planned — which is exactly the difference [[The unplaced shelf]] exists to draw.

Measured, not reasoned: the table above is the output of calling each reader with
`({})['toString']`.

## Why it is filed rather than fixed

Found while auditing `src/storage/frontmatter.ts` during the Product Kanban increment
that added the transition stamps. The storage side is fixed there — every read of a
configured key goes through `ownValue` and every write through `setOwn` — but this
occurrence is in `domain/`, in code that increment never touched, and the roadmap work
was landing on `main` several times an hour while it was open. Widening a board PR into
an actively-edited domain file, for an input this exotic, buys a merge conflict and no
safety.

## Fix

The same answer this repository has already reached three times, most recently in
[[A user-named type read off Object.prototype]]: make the operation a function rather
than a rule to remember. `axisReading` should take the note's OWN value —
`Object.prototype.hasOwnProperty.call(fm, key) ? fm[key] : undefined` — before handing
it to the reader. That is one line and it fixes both axis readers at once, because they
share the call site.

Worth doing at the same time: the other `fm?.[settings.…]` reads in `model.ts` are
correct only by luck, since their readers happen to answer "absent" for a function.
Routing them through the same helper costs nothing and removes the luck.

Fixed as described, in `src/domain/noteFields.ts`, with the private twin in
`src/storage/frontmatter.ts` deleted rather than left as a second statement. The rule had
four homes and one of them was wrong; it now has one. The test that fails without it is
"a horizon property named off Object.prototype" in `test/domain/prototypeKeys.test.ts`, watched
failing before the fix landed.

## Evidence it is real

Reproduced by calling the readers directly, not by reading them. Nothing in the vault
is required — `({})['toString']` is the inherited function, and the readers do the rest.

## Acceptance

- An axis property named `toString`, `constructor`, `valueOf` or `__proto__` reads as
  **absent** on a note that does not own it, so the item is unplaced rather than
  shelved as unreadable.
- A note that genuinely owns such a key still reads its value.
- The other configured-key reads in `model.ts` go through the same helper, so the
  correct-by-luck cases stop depending on luck.
