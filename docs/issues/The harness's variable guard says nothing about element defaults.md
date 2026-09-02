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
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
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

## A second instance, and what it shows (2026-08-15)

The dialog was drawn in a hand-written `.pbl-harness-modal-box` while app.css's `.modal`
was in the vendored file, resolving, and matching nothing — a guessed baseline beside a
real one, found by reading rather than by any check. Handing the mock's `modalEl` to the
harness fixes that instance and demonstrates the shape of the gap this note is about: the
reduction keeps what the harness was DRIVEN through, so `.modal-container`, `.modal-bg`,
`.modal-title` and `.modal-content` were never kept, and the dialog's title and content
pane now read unstyled — and whatever widens a settings dialog was not kept either, so the
manual clips its prose at `--dialog-width` on a desktop. That absence is at least loud. The one this note is filed about —
a default the vendored sheet still states at an old value — stays silent, and nothing here
changes that.

The instrument sketched below has a cheaper half than the one described: comparing the
selectors the vendored sheet defines against the elements and classes the harness actually
puts on the page would not catch staleness, but it would have named `.modal-title` and
`.modal-content` as drawn-but-unstyled without anyone reading the CSS.

## The cheaper half is built (2026-09-02)

`test/harness/vendoredCoverage.test.ts` asks the question the section above sketched:
which classes the harness draws has the vendored sheet no rule for. It names
`.modal-title` and `.modal-content` as predicted, and four more nobody had —
`.extra-setting-button`, `.mod-dim`, `.setting-item-control`, `.setting-item-info` — out
of 21 Obsidian classes drawn across all four projections, three axes, the knobs and the
three dialogs. The six are RECORDED rather than filled: guessing values into `theme.css`
is what this file's own header refuses, and filling them is a re-derivation against a
local install. See [[Name the vendored sheet's gaps instead of guessing them]].

**This note stays Open**, on the half that is not lifted: nothing notices when Obsidian
changes a default the vendored file still states at the old value, and nothing sees an
element default carried by no class at all — a bare `<button>`, which is the episode this
note was filed about.

## Impact

Three real defects shipped past `npm run harness` and were only caught because the owner
ran the feature in a live vault. Until this is lifted, an element-default regression in
this class — a chrome reset that stops matching a real element, a spacing rule that relies
on a default the vendored sheet no longer states — has the same blind spot the disclosure
did: green harness, wrong vault.
