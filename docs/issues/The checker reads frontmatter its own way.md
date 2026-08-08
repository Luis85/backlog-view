---
type: Issue
order: 60
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-01
source: 2026-08-01 review of PR #24
files:
  - scripts/docs-check.mjs
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
distinction is documented between them), and it is now **held by a test** rather than by a
comment: `test/docs/checkerRejects.test.ts` plants a bare `parent:` on an ADR and asserts
it is the *only* problem the document produces, so the prohibition cannot silently go back
to reading values. That closes the regression risk on the one known instance and moves
nothing else — the **class** is untouched, because a test that plants what we already know
to look for is the same instrument as the fix it guards. Any other place the two parsers
disagree has the same shape and the same invisibility.

## Why it is deliberate

Sharing one parser would mean importing plugin code into the docs gate. That trades this
problem for worse ones:

- `docs-check.mjs` is plain Node with **no build step** — it runs before and independently
  of `npm run build`, which is why it can report on a repository that does not compile.
- The runtime's reader is built around Obsidian's metadata cache, which does not exist
  outside the app; the fake in `test/helpers/vault.ts` is a test double, not a parser.
- It would invert the split this repository settled on: *a script over markdown checks
  markdown; a test that can load the module asks the module*. Frontmatter is markdown.

## The obvious remedy does not reach it

This note first proposed "a test that imports `noteFields.ts` and asserts the register's
notes parse the way the plugin would read them". **That would not detect this class**, and
saying so is more useful than the proposal was.

`resolveParent` takes an already-parsed `CachedMetadata` — it never sees YAML text. The
harness hands it one built by hand: `FakeVault.addFile` assembles `cache.frontmatter` from
a JavaScript object literal. So the test would assert *interpretation of synthetic cache
data* and pass while the divergence stood, because the divergence lives one step earlier:

| Step | Who does it | Covered by that test? |
| --- | --- | --- |
| `parent:` (bare) → `{ parent: null }` | Obsidian's frontmatter parser | **no** — the fake starts here |
| `parent` key present → `explicitRoot: true` | `resolveParent` | yes |
| `parent:` → "field absent" | `docs-check.mjs` | no |

The bug was in step 1 meeting step 3. A test over step 2 proves the half nobody doubted.

## What would actually lift it

Something has to read the **raw YAML** the register is written in and compare it with what
the checker concludes. Two honest options, neither free:

- **A YAML parser as a devDependency.** `yaml` and `js-yaml` are both already in
  `node_modules` transitively, so it costs a declaration, not a download — and it must be
  declared, since fallow gates dependency hygiene and reaching into an undeclared
  transitive is its own defect. Runtime dependencies stay empty either way
  ([ADR 0005](../adrs/0005-ship-with-no-runtime-dependencies.md) is about what ships).
- **A live-vault pass**, which is the only thing that can answer the question as asked.

The distinction matters and is the reason this is not simply "add the parser": a
third-party YAML parser is a **proxy for Obsidian's, not Obsidian's**. What a devDependency
could verify is *"the checker's reading agrees with a conforming YAML parser"*. What it
cannot verify is *"…agrees with Obsidian"*, and Obsidian is the reader that decides whether
a note is a work item. That second question needs a vault, like every other appearance and
identity check in this register.

## Acceptance criteria

- The register's own notes are parsed by a real YAML parser and the result compared against
  what `docs-check.mjs` concludes about the same keys — at minimum `type`, `parent`,
  `order`, `status`, and the ADR fields.
- The note is explicit that this proves agreement with *a* parser, not with Obsidian's, and
  names the live-vault check as the only thing that closes the remainder.

Raise the priority if a second divergence is found; two would make it a pattern rather than
an instance. Until then the cost is a devDependency and a corpus reader, against one closed
bug — which is the trade, stated so it can be taken knowingly rather than by default.
