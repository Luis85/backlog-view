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

Open `docs/Product Backlog.base` and walk **all six** projections — each has labels of its
own, so a projection skipped is a set of strings unchecked. The board scope picker is what
reaches three of them:

- the **tree**;
- the **Product board**, the **Deliverables board** and an **iteration board**, all through
  the scope picker;
- the **Test catalog**;
- the **roadmap**, on each configured axis.

Then the view options panel, a row's context menu, and the estimation view.

- **Every catalog SENTENCE should render English.** English is the only catalog that ships,
  so a resolution that falls back correctly leaves the words unchanged.
- **Numbers are the deliberate exception and must not be reported as a defect.** They follow
  the USER's locale, not the catalog's: `activate()` builds `Intl.NumberFormat` from the
  language Obsidian is in and `fill()` applies it to **every numeric parameter**
  (`src/i18n/t.ts`) — not only counts. A confidence-adjusted value in the estimation panel,
  a WIP limit and its overage on a board, and a rollup's figures are all in scope. So under
  a locale with its own numeral conventions any of those may render with different digits or
  a different group separator inside an otherwise English sentence. That is the design
  (grammar follows the catalog, data presentation follows the user) and it is most visible in
  the right-to-left run below.
- **The developer console should be clean.** A throw out of `getLanguage()` is the failure
  this exists to find.
- **No label should be blank, and no label should render as its own key** — `count.items`
  where a count and a noun belong.

Repeat once with a right-to-left language if one is available. Nothing in the plugin is
mirrored yet — see [[Nothing pins a physical side]] — so a broken layout here is expected
and is worth writing down rather than reporting as a regression.

## Acceptance criteria

- One non-English language checked end to end, with the console read rather than assumed.
- Whichever of the three failure shapes appeared, if any, recorded by surface.
- Nothing yet checked; the real `getLanguage()` has never run.
