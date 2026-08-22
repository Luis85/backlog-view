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

- **`getLanguage()` returns what its typings promise.** This is the one assumption nothing
  anywhere has tested: `initLocale()` reads Obsidian's language at `onload`, and the jsdom
  harness mocks that call, so no run of the suite has ever exercised the real one. Set
  Obsidian to a non-English language, restart it (the plugin reads the language once and
  never re-reads it), and open a base. **Every surface should render English, and the
  developer console should be clean.** A thrown error, a blank label or a key rendered as
  its own name are the three failures worth looking for. **Never checked.**

- **The two re-joined lists read correctly.** These changed in English and nobody has seen
  either: `Intl.ListFormat` replaced fixed separators, so three items now read
  `A, B, and C` where they read `A, B, C`. Both are on the roadmap — a row's
  **prerequisites**, in the lead cell's tooltip on the dated axis with three or more
  dependencies, and a **resource's absences** on the resources axis. Check the joining, the
  spacing and that neither runs a full stop into a conjunction. **Never checked.**

- **The configuration warning reads as one sentence.** The toolbar's warning chip, the
  refusal that gates a write and the readme command all state a bad configuration the same
  way now. Point two view options at one property — parent and order at the same key is the
  quickest — and read all three surfaces. With two collisions it should read
  `Fix the view options first: the parent and order properties share the key "rank", and
  the …` rather than running whole sentences together. **Never checked.**

- **The view options menu survives its own labels.** Every group name, option name and
  prose placeholder comes from the catalog now. Open the options panel and check that no
  label is clipped, no group heading wraps oddly, and the `Open the note in` dropdown shows
  its three choices — those were English literals until 2026-08-22 and are keyed now.
  Partly answerable in English only: a longer translated label is the case this cannot
  reach. **Never checked.**

- **The estimation view's refusals end as sentences.** `Fix the estimation model first: …`
  gained a terminal period on 2026-08-22 after a merge left it without one. Bind two
  estimation slots to the same property and press the guided setup: the notice should end
  in a full stop, and the problem block above the table should list each fault as its own
  line under its lead. **Never checked.**

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
