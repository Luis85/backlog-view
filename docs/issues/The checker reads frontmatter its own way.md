---
type: Issue
order: 50
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-01
source: 2026-08-01 review of PR #24
files:
  - docs-check.mjs
  - src/domain/noteFields.ts
---

# The checker reads frontmatter its own way

## The limitation

`docs-check.mjs` parses frontmatter with its own regexes. The plugin parses it through
`src/domain/noteFields.ts` and Obsidian's metadata cache. **Nothing connects the two**, so
the validator can be confident about a note the runtime would read differently, and neither
side can see the disagreement.

## Evidence

A bare `parent:` — the key with nothing after it — is:

- **an absent field** to the checker, whose `field()` requires a value; and
- **an explicit root** to the runtime, where `resolveParent` returns
  `explicitRoot: keyPresent` (`src/domain/noteFields.ts:35`).

So the ADR prohibition *"an ADR carries no `parent` and no `type`"* passed for the one form
of the mistake that needs no typo at all — the form an editor, a template or an abandoned
edit leaves behind. Found by a reviewer reading both files and comparing them; invisible
from inside either.

That instance is fixed (`fm.has` tests the key, `fm.field` tests the value, and the
distinction is documented between them). The **class** is not: any other place the two
parsers disagree has the same shape and the same invisibility.

## Why it is deliberate

Sharing one parser would mean importing plugin code into the docs gate. That trades this
problem for worse ones:

- `docs-check.mjs` is plain Node with **no build step** — it runs before and independently
  of `npm run build`, which is why it can report on a repository that does not compile.
- The runtime's reader is built around Obsidian's metadata cache, which does not exist
  outside the app; the fake in `test/helpers/vault.ts` is a test double, not a parser.
- It would invert the split this repository settled on: *a script over markdown checks
  markdown; a test that can load the module asks the module*. Frontmatter is markdown.

## What would lift it

Move the frontmatter questions to the other side of the split — a test that imports
`noteFields.ts` and asserts the register's notes parse the way the plugin would read them.
That is the same move that retired the TypeScript-scanning half of this checker, and it is
the right shape. It is filed rather than done because the one known divergence is closed
and a second has not been observed: building a second corpus reader to find hypothetical
disagreements is how a validator grows a maintenance burden nobody is paying for.

## Acceptance criteria

None yet. Raise the priority and take the test above if a second divergence is found — two
would make it a pattern rather than an instance.
