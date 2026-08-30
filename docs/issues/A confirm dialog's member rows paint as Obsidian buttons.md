---
type: Issue
order: 300
parent: "[[Codebase health]]"
status: Done
priority: P2
area: styling
created: 2026-08-30
closed: 2026-08-30
source: Looking at the release view in the browser harness after the closing increment merged; the confirm dialog was the one control on that screen nobody had drawn
files:
  - styles/modals.css
  - test/ui/confirmDialog.test.ts
  - test/harness/mountRelease.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A confirm dialog's member rows paint as Obsidian buttons

## The limitation

`.pbl-confirm-link` — the row a reader may open before answering a confirmation, drawn by
`src/ui/confirmDialog.ts` — is a bare class at specificity `(0,1,0)`. Obsidian's own
`app.css` carries `button:not(.clickable-icon)` at `(0,1,1)`, declaring `color`,
`background-color: var(--interactive-normal)` and `box-shadow: var(--input-shadow)`.
`(0,1,1)` wins regardless of source order, so **all three** of the rule's own declarations
that name those properties never applied.

Measured in headless Chromium on 2026-08-30, against the real vendored `app.css`, on the
release harness's own confirmation: the row computed `background-color: rgb(51, 51, 51)`
and `color: rgb(218, 218, 218)` with an inset ring — Obsidian's filled, boxed default
button — where the rule asks for a transparent, accent-coloured link. Every unfinished
member in the `Mark as released` dialog read as a disabled input rather than as something
to open.

The exact defect [[Four other controls still lose to Obsidian's button rule]] closed for
five controls, and [[The release index rows paint as Obsidian buttons]] closed for a
sixth, arriving on a seventh. The comment above the rule states the reason each of its
declarations is there — "a bare `<button>` inherits none of the list appearance it needs,
the mistake `test/harness/theme.css` recorded on 2026-08-08" — and cites the very episode
whose fix it did not apply. A confident paragraph is evidence of intent and of nothing
else.

## Why it is deliberate

It is not — a plain defect — but the reason no check saw it is worth stating, and it is
the same one every note above gives. jsdom computes no styles, so no `test/` suite can
evaluate a cascade; the browser harness draws the real view against the real vendored
`app.css` but asserts nothing by design (ADR 0020). What is new here is the second half:
the dialog had **no way to be looked at**. `test/harness/release.ts` reaches the index and
the scope screen by URL, and the confirmation opens only on a press, so drawing it needed
an uncommitted `mock.ts` entry that clicks the button. The rule shipped, was reviewed, and
passed a clean Codex round in that blind spot.

`test/harness/mountRelease.ts` had a second gap in the same place: its `full` variant
spread `RELEASE_CONFIG`, which omits `releaseNotesFolder` on purpose (the suite's default
is the unbound case), so the paragraph claiming that variant "binds every key" was false
for `Generate release notes` — the one control the closing increment added. With a folder
being a folder rather than a property, nothing on the page offers to bind one, so that
button was undrawable here at all.

## What would lift it

Element-qualify the selector so the plugin's reset ties Obsidian's rule at `(0,1,1)` and
wins on source order — the `button.pbl-card-kids-toggle` pattern `styles/cardChildren.css`
established — **and add the `:focus-visible` outline the qualification then costs**, which
is the trap every fix in the four-controls note had to close beside its own: the reset's
`box-shadow: none` also ties Obsidian's `button:focus-visible` ring and wins on order, so
without an explicit indicator, focus goes invisible rather than merely losing its fill.
This rule had no focus indicator of its own, on the one control in the dialog that exists
to be tabbed to.

## Impact

Every row in every confirm dialog this plugin opens — the shared `ui/confirmDialog.ts`,
not the release view's alone — painted Obsidian's filled, boxed button chrome instead of
the accent link the design asks for, in any vault. The rows still worked, and were still
real tab stops; they did not read as openable.

## Outcome

Fixed. `styles/modals.css` now spells the reset at `button.pbl-confirm-link`, tying
Obsidian's `(0,1,1)` and winning on source order, and carries a
`button.pbl-confirm-link:focus-visible` outline — `1px solid var(--interactive-accent)`,
the one every control under the notes above uses.

Verified the same two ways those fixes were. `test/ui/confirmDialog.test.ts` checks the
partial as written still spells the reset at the compound selector and still carries the
outline; both cases were watched failing, one per reverted half. Headless Chromium against
the real vendored `app.css`, on the release harness's own confirmation — before:
`rgb(51, 51, 51)` / `rgb(218, 218, 218)` / an inset ring; after: `rgba(0, 0, 0, 0)` /
`rgb(166, 138, 249)` / `box-shadow: none`, with a `1px solid rgb(138, 92, 245)` outline on
focus. The test is narrower than the claim, and says so where it is written: it guards the
SHAPE in the partial, never a specificity computed against a sheet no test loads.

`mountRelease.ts` gained a `FULL` constant — `RELEASE_CONFIG` plus the notes folder — so
the harness's own default now binds every key and `Generate release notes` is drawable.
`RELEASE_CONFIG` itself is untouched: the suite's unbound default is deliberate, and
`releaseNotes.test.ts` asserts the "bind the folder" note against it.

**Not verified in a live vault.** A themed vault can style `button` harder than this
repository's harness baseline, so whether the row reads correctly against a real theme's
accent is open the same way it is for every fix under the notes above — and it belongs on
the same checklist as the closing increment's own three
([[Shipping a release]], [[Release notes from its own scope]]).
