---
type: Test suite
order: 34
status: Open
created: 2026-08-22
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test the message catalog

Every surface of the plugin now takes its words from `src/i18n/en.ts` — 519 keys across
the tree, both boards, the roadmap, every menu and dialog, the view options and the two
palette commands. None of it has been seen in a real Obsidian.

**Outcome** — **Never run.** The epic shipped across eight pull requests between
2026-08-15 and 2026-08-22 with the live-vault check owed at every one of them, and each
said so rather than claiming a green build covered it.

**Read this before running it: most of this work is invisible in a vault, and that is by
design.** English is the only catalog that ships (`English ships alone`), so every key
resolves from the same catalog whatever language Obsidian is in. Nothing on this list can
show you a translation. What it can show you is that the machinery underneath one does not
break, and that the handful of things which genuinely changed in English read correctly.

Set the vault up with `npm run test-build` — it bundles into `.obsidian/plugins/` with the
repository itself as the vault, so opening this folder in Obsidian and then
`docs/Product Backlog.base` puts the plugin in front of its own register.

## Use cases

- [[The plugin under a non-English Obsidian]] — the one assumption nothing anywhere has
  tested, because the jsdom harness mocks the call it rests on. **Never checked.**

- [[The lists Intl.ListFormat joins]] — the three surfaces where three items now read
  `A, B, and C`, and the different route each one actually needs: only the backfill's
  outcome notice is ordinary visible text. **Never checked.**

- [[One configuration warning, two shapes]] — one fragment behind one lead, on surfaces
  that deliberately do not all say the same thing. **Never checked.**

- [[The view options menu at its own labels]] — the densest text surface the plugin has,
  read at width and at its minimum. **Never checked.**

- [[The estimation view's refusals end as sentences]] — a terminal period, and a problem
  block that replaces the table rather than sitting above it. **Never checked.**

- **Nothing regressed in the ordinary surfaces.** The sweep touched every rendering module
  without changing what any of them does, which is the claim the other five suites in this
  folder are the checklist for. Re-running
  [[Smoke test the tree]], [[Smoke test the board]] and [[Smoke test the roadmap]] is what
  turns "nothing reads differently in English" from an intention into a check. **Never
  checked against the swept tree.**

## What this suite cannot reach

Stated so nobody reads a clean run as wider than it is.

- **Anything about how a translated catalog reads.** Layout under a longer language,
  right-to-left, plural forms in a language with more than two — all of it waits on a
  second catalog existing, which `English ships alone` defers deliberately.
- **The mixed-catalog hazard.** A catalog with a gap can split one sentence between two
  languages, reproduced and recorded on `Catalogs stay complete`. It is unreachable while
  one catalog ships and cannot be checked here.
- **One string is guarded by nothing**, named in `test/i18n/projections.test.ts`:
  `progressNote`'s rollup note. If a bar's screen-reader text reads `1 items` on a
  single-child parent with no workflow configured, that is the one to report.
