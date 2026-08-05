---
type: PBI
parent: "[[A browser harness without Obsidian]]"
order: 30
status: Done
priority: P1
created: 2026-08-05
closed: 2026-08-05
files:
  - test/harness/theme.css
  - test/harness/harness.test.ts
---

# The theme stub is checked against the stylesheet

**As** whoever trusts what the harness draws, **I want** the stand-in for Obsidian's
variables held to the stylesheet that reads them, **so that** a variable added to a
partial cannot leave the page quietly drawing it as nothing.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever adds a rule to `styles/` |
| **Trigger** | `npm run check` — the suite, not a step of its own |
| **Preconditions** | The stub defines the Obsidian variables; the plugin's own `--pbl-*` properties are set in code and are not its business |
| **Guarantee** | Every non-`--pbl` `var(--x)` any partial reads has a value in the stub, or the suite fails naming the missing one. |

**Main flow**

1. The test reads every `.css` file in `styles/` and extracts every `var(--x)`.
2. It drops the `--pbl-*` names: those are the plugin's own, set from the view at render
   time, and a stub defining them would be overriding the thing being looked at.
3. Whatever is left must be defined in `test/harness/theme.css`. What is not is the
   failure message.

**Extensions**

- **1a — the instrument matches nothing.** Then the test above passes forever while
  checking nothing, which is the failure this repository has already had twice — a count
  taken with an instrument that could not see the whole set, used as evidence before
  anyone measured a second way. So a second test asserts the scan finds a substantial
  set, finds a variable known to be there, and excludes one known to be a `--pbl`. The
  instrument is checked before its verdict is trusted.
- **2a — the stub is asked to be accurate rather than complete.** It is not, and cannot
  be: no check here can compare a value to the app. The base scale and the named palette
  are Obsidian's own DOCUMENTED defaults for both schemes rather than invented ones,
  which is worth having and is not the same claim — a vault with any theme installed
  replaces exactly those values, and most vaults have one. Completeness is what a check can reach, so completeness is what is claimed.
  The gap is stated in the stub, in the Feature note and in
  [ADR 0020](../adrs/0020-the-browser-harness-draws-it-does-not-assert.md), not narrowed
  by better guesses.
- **3a — the missing variable is added to a list instead.** That is the version this
  refuses. A hand-maintained list of variables is exactly the enumeration that goes stale
  the day a partial changes; the rule is stated at the missing thing.

## Acceptance criteria

- The set is measured off `styles/` on every run, never listed.
- Completeness is asked PER SCHEME, not of the file. The stub carries a light and a dark
  scale now, and a variable set under one of them is missing under the other while a
  search of the text still finds it — so each scheme is resolved as the page resolves it
  (everything outside the two blocks, plus that block), and a name in one and not the
  other fails naming itself.
- The instrument has its own test, and that test would fail if the scan matched nothing.
- Removing a definition from the stub fails the suite naming that variable — watched
  failing, not assumed.
- The stub says in its own header that it is an approximation, so nobody reads a colour
  from the harness as a colour a user sees.

## Where it lives

`test/harness/theme.css` · `test/harness/theme.ts` · `test/harness/harness.test.ts`
