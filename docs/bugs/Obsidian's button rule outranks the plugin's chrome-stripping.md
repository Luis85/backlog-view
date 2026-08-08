---
type: Bug
parent: "[[Children on the card]]"
order: 20
status: Done
area: styling
priority: P2
created: 2026-08-08
closed: 2026-08-08
source: Card children expansion increment, verified in the harness against the real
  Obsidian stylesheet (test/harness/obsidian.css), task-10-report.md
files:
  - styles/cardChildren.css
  - styles/columns.css
  - styles/tags.css
  - styles/cards.css
  - test/harness/obsidian.css
---

# Obsidian's button rule outranks the plugin's chrome-stripping

## What happened

`test/harness/obsidian.css`'s `button:not(.clickable-icon)` rule — Obsidian's own real
`app.css`, vendored for the harness — carries:

    button:not(.clickable-icon) { background-color: var(--interactive-normal); box-shadow: var(--input-shadow); }
    @media (hover: hover) { button:hover { background-color: var(--interactive-hover); box-shadow: var(--input-shadow-hover); } }

`:not()` takes the specificity of its own argument rather than contributing nothing, so
`button:not(.clickable-icon)` is `(0,1,1)`, and so is `button:hover` inside the media query
— a media query adds no specificity of its own. The plugin strips chrome from its own
controls with bare class selectors, `.pbl-card-kids-toggle` and `.pbl-card-kid` among them,
which are `(0,1,0)`. `(0,1,1) > (0,1,0)`, so Obsidian's rule wins **regardless of source
order** — the plugin's sheet loading last does not save it, because source order only
breaks a tie and there was none. The card-children disclosure's own
`background-color: transparent` and `box-shadow: none` had therefore never applied in a
real vault: a `<button>` with none of these classes still painted Obsidian's filled,
boxed button chrome underneath them.

Verified two ways: the specificity computed by hand against the selectors above, and
empirically — Chromium via Playwright, driven through `npm run harness` with the real
`obsidian.css` loaded before the plugin's own sheet, reading the toggle's and the child
row's computed `background-color` and `box-shadow`. Before the fix below, both were
Obsidian's filled values; after, both were the plugin's transparent ones.

**The same shape lives in four other controls, verified live and deliberately left
unfixed here:** `.pbl-state-chip` and `.pbl-horizon-chip` (`styles/columns.css`),
`.pbl-tag-remove` (`styles/tags.css`) and `.pbl-card-match` (`styles/cards.css`) are all
real `<button>`s carrying none of `.clickable-icon`, styled with the same bare-class
shape, so the same `(0,1,0)` loss applies to each. Two controls that look like the same
family are not affected, for two different reasons — and `.pbl-add` is not even one shape:
the column header's (`header.createDiv({ cls: 'pbl-add clickable-icon' })` in
`src/view/render/columns.ts`) is a `<div>`, so none of Obsidian's `button…` rules can match
it at all, while the tree row's own (`row.createEl('button', { cls: 'pbl-add
clickable-icon' })`, `src/view/render/rows.ts:275`) is a real `<button>`, safe for the same
reason as `.pbl-bucket-add` below rather than for being a div. `.pbl-bucket-add`
(`styles/roadmap.css`) is a real `<button>` but carries `.clickable-icon` itself, which the
`:not()` excludes, leaving only the bare `button` rule at `(0,0,1)` — already beaten by the
plugin's own `(0,1,0)`.

The reason the other four were not fixed alongside the disclosure: the right result is not
obviously "make it transparent" the way it is for a disclosure that wants no button look at
all. `.pbl-state-chip` and `.pbl-horizon-chip` deliberately paint a chip background, and
`.pbl-card-match` has its own `justify-content` question the fix below never had to answer.
Each needs its own decision about what it should look like, and folding four of those into
the card-children fix would have been a repo-wide restyle nobody reviewed.

**No committed test catches either the defect or the fix.** The verification above was a
Playwright script run against the harness and read from scratchpad screenshots and JSON
dumps, not a check in `test/`. `test/harness/harness.test.ts` guards the harness's stub
against a missing CSS *variable*, not against a missing element default — see
[[The harness's variable guard says nothing about element defaults]], opened for exactly
this gap.

## Fix

`styles/cardChildren.css`: qualify the affected selectors with the element —
`button.pbl-card-kids-toggle`, `button.pbl-card-kid` — which ties Obsidian's `(0,1,1)` and
then wins because the plugin's sheet loads last, which is the tie source order actually
breaks. That alone is not enough: CSS resolves the winning declaration **per property**,
not per rule, so a base rule winning at rest says nothing about which rule wins the
hover-only fill declared in Obsidian's separate, media-query-nested `button:hover` rule.
The two hover rules therefore restate `background-color: transparent` and
`box-shadow: none` explicitly rather than relying on the base rule's win to carry over —
see [[The disclosure's hover still painted a button fill]] for what happens when that
second half is skipped.

## Lesson

**A class-only selector cannot out-rank a host application's own element-plus-class rule,
no matter what loads last.** `:not()` inherits the specificity of its argument rather than
adding nothing, which makes `button:not(.clickable-icon)` a stronger rule than it reads as
at a glance — the obvious reading is "an exclusion, so weaker", and the CSS spec says the
opposite. Any control that means to strip a host's default chrome from a real `<button>`
has to match the element too, or the two selectors are never actually competing on source
order in the first place.
