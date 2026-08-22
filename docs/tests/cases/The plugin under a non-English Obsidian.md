---
type: Test case
order: 10
parent: "[[Smoke test the message catalog]]"
status: Open
priority: P1
area: verification
cadence: release
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

# The plugin under a non-English Obsidian

A verification to run.

## Why this exists

`initLocale()` in `src/i18n/locale.ts` reads Obsidian's language once at `onload`, and the
jsdom harness mocks that call — so **no run of the suite has ever exercised the real one**.
Everything else in `src/i18n/` is checked against a mock returning what the typings say it
returns. This is the one assumption nothing anywhere has tested.

It is worth its own check even though English ships alone: a throw here takes the whole
view down, and the language a vault is in is not something the plugin can choose.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

Set Obsidian to a non-English language in **Settings → About → Language**, then **restart
Obsidian** — the plugin reads the language once and never re-reads it, so a reload of the
view is not enough.

Open `docs/Product Backlog.base` and walk the projections: tree, both boards, the roadmap
on each configured axis, the view options panel, a row's context menu, and the estimation
view.

- **Every surface should render English.** English is the only catalog that ships, so a
  resolution that falls back correctly looks exactly like no change at all.
- **The developer console should be clean.** A throw out of `getLanguage()` is the failure
  this exists to find.
- **No label should be blank, and no label should render as its own key** (`count.items`
  rather than `3 items`).

Repeat once with a right-to-left language if one is available. Nothing in the plugin is
mirrored yet — see [[Nothing pins a physical side]] — so a broken layout here is expected
and is worth writing down rather than reporting as a regression.

## Acceptance criteria

- One non-English language checked end to end, with the console read rather than assumed.
- Whichever of the three failure shapes appeared, if any, recorded by surface.
- Nothing yet checked; the real `getLanguage()` has never run.
