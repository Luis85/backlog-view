---
type: Issue
order: 10
parent: "[[The theme stub is checked against the stylesheet]]"
status: Open
priority: P3
area: verification
created: 2026-08-08
source: Card children expansion increment, task-10-report.md and task-12 findings
files:
  - test/harness/harness.test.ts
  - test/harness/obsidian.css
  - test/harness/theme.css
---

# The harness's variable guard says nothing about element defaults

## The limitation

[[The theme stub is checked against the stylesheet]] mechanically guards one half of
harness fidelity: `test/harness/harness.test.ts` scans every partial in `styles/` for
`var(--x)` and fails the suite when the stub does not define it. That is a guard over
**variables**. There is no equivalent guard over **element defaults** — what a bare
`<button>`, `<input>` or any other element looks like before the plugin's own rules touch
it. Nothing in the suite noticed that the harness's `theme.css` carried no `button` rule
at all, which is why all three of the card-children smoke test's real defects — button
chrome on the toggle and its entries, too little spacing, centre-aligned entries — were
invisible to `npm run harness` and had to be found by a human in a real vault. See
[[Smoke test the card children in a live vault]] for the run that found them.

## Why it is deliberate

Vendoring the real `app.css` into the harness (`a686c3d`, `test/harness/obsidian.css`)
closes the gap for the element defaults it defines *now* — a bare `button`'s chrome,
`button:not(.clickable-icon)`, `button:hover`, and everything else the harness loads
before the plugin's own stylesheet. That is a fidelity fix, not a check: nothing asserts
that the vendored file stays complete or stays current, the way `variablesUsed`/
`variablesDefined` asserts the variable stub does. ADR 0020 already narrows what the
harness draws (it draws, it does not assert), and this is the same limitation restated for
this one, later-added file.

## What would lift it

No mechanism is proposed here. The open question is whether anything **prevents this
reopening** — the vendored sheet was reduced afterward (`4332ec7`) to keep only the rules
the harness's own driven states actually reach, so a default outside that reduced set is
exactly as invisible as it was before vendoring; and an Obsidian upgrade can change a
default the vendored file still states the old value for, with nothing to notice the
drift. A check equivalent to `variablesUsed`/`variablesDefined` would need to know which
elements and pseudo-classes the harness's fixture actually renders and compare that against
what the vendored sheet defines for them — that is a harder instrument than a `var(--x)`
regex, and building it is future work, not something to invent inside this note.

## Impact

Three real defects shipped past `npm run harness` and were only caught because the owner
ran the feature in a live vault. Until this is lifted, an element-default regression in
this class — a chrome reset that stops matching a real element, a spacing rule that relies
on a default the vendored sheet no longer states — has the same blind spot the disclosure
did: green harness, wrong vault.
