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

**The iteration board needs setting up first, and this repository does not have it.** The
picker's iteration section is gated on `settings.iterationKey`, `docs/Product Backlog.base`
names no iteration property, and no note here carries `type: Iteration` — so with nothing
done the picker offers neither an iteration nor the `New iteration…` action, and a runner
following the list would inspect five projections while reporting six. Set it up in this
order, before starting the walk:

1. Bind the iteration property in the view options.
2. Create an iteration.
3. Pick the item you will commit and **write down its `start` and `due` now, before
   committing it.** Committing copies the sprint's dates over them, so after the commit there
   is nothing left to read: those two values are the only way to put the item back. The undo
   slot cannot serve — it is `lastUndo` on a `WriteLock` built at `onload`, and this case
   restarts Obsidian at least twice, once to enter the language and once more for the
   right-to-left repeat, each restart throwing the batch away.
4. Commit that item to the iteration.

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

**Then take the iteration back out, and put the language back last.** The setup above is the
only part of this case that changes the vault, and it changes the ROADMAP:
`iterationsOnTimeline` defaults on, so an iteration left behind draws on both grid axes and
`Smoke test the roadmap` would be re-run against a timeline this case built. Each release run
would leave another.

Four steps, and none of the first three is the obvious action:

1. **Restore the item's `start` and `due` by hand**, to the values written down at setup —
   editing the note is the only way, since every restart in this case has already cleared the
   undo slot.
2. **Set the item's iteration to None**, which is exactly what that pick is for: it removes
   the link and nothing else ("leaving a sprint is not a reschedule",
   `computeIterationWrites`), so it must be paired with step 1 rather than trusted to undo the
   join. Either order works, but both are needed — on its own, step 2 leaves the item
   scheduled to a sprint that no longer exists.
3. **Delete the iteration note**, then **remove the `iterationProperty` line from
   `docs/Product Backlog.base`** in a text editor. Clearing the option in the picker is not
   the same thing: `adoptCandidates` skips a property whose option is `!== undefined`, and a
   cleared option is defined-and-empty, so the line would sit there permanently stopping ✨
   from ever adopting the iteration property on this view again.
4. **Now set the language back and restart.** This case is the one place in the sweep where a
   broken layout is the accepted answer, and every check after it — the view options at width
   in this suite, the whole appearance suite at order 40 — reads a broken layout as a
   regression. Left in a right-to-left locale, this case hands the rest of the sweep a screen
   it has already agreed to excuse.

## Acceptance criteria

- One non-English language checked end to end, with the console read rather than assumed.
- Whichever of the three failure shapes appeared, if any, recorded by surface.
- Obsidian restored to the runner's own language and restarted, so the rest of the sweep
  judges layout against a locale it is allowed to fail in.
- The item's dates restored and its iteration cleared, the iteration note deleted and the
  `iterationProperty` line gone from the `.base`, so the roadmap suite is judged on the
  timeline it had before this case ran and the committed item keeps its own dates.
- Nothing yet checked; the real `getLanguage()` has never run.
