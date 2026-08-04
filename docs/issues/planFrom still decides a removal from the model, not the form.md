---
type: Issue
order: 10
parent: "[[Horizon and dates from the row]]"
status: Open
priority: P2
area: defect
created: 2026-08-04
source: final whole-branch review, 2026-08-04
files:
  - src/view/interactions/plan.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - docs/requirements/Horizon and dates from the row.md
---

# planFrom still decides a removal from the model, not the form

## The defect

`planFrom` in `src/view/interactions/plan.ts` plans a removal whenever
`reading.invalid`, unconditionally:

```ts
if (reading.value !== null || reading.invalid) plan[field] = null;
```

`scheduleFields` prefills an unreadable end (`start: soon`, say) as a blank input, since
the field asks for a date and an unreadable value is not one. So saving the entry after
editing only the *other* field — never touching the unreadable one — deletes it, because
the field arrived blank and `reading.invalid` is still true against the ITEM the entry
was opened with. If another editor corrected the value while the dialog sat open, their
correction is what gets deleted. It is undoable, and `announceScheduleMove` does name
the loss (`destinationWords` reports an unreadable-end removal same as any other), so it
is not silent to a screen-reader user — it is silent to everyone else, who sees a field
they never touched simply vanish along with whatever the other editor just typed.

## Why it is worth recording

`reading` is a **model-time** read — `item.plannedStart` / `item.plannedTarget`, as they
stood when the row was last rendered, not as the note is right now. This increment's
central decision, stated repeatedly in `src/domain/CLAUDE.md`'s roadmap section, is that
the planner stops deciding from the model because the model can be a refresh behind:
`computeScheduleWrites` "states what was requested and claims nothing about what the note
holds... because both are questions about the note RIGHT NOW and the row that planned
the write can be a refresh behind it." `refusesAxis` / `staleBase` in
`storage/frontmatter.ts` carry that decision all the way to the write boundary for every
other date path.

`|| reading.invalid` in `planFrom` is the one surviving exception. It is model-time by
construction — nothing between opening the dialog and pressing Save re-reads the note —
and the concurrency case above is a symptom of that, not a separate bug: the same
staleness that a stale drag or a stale slide is refused for is, on this one path, acted
on instead.

## Two candidate fixes

**(a) Decide the removal from the FORM.** A field states a removal iff it *arrived*
non-blank (a real prior value or an unreadable one) and was submitted blank.
`scheduleFields` already computes the prefill — whether the field started blank because
the key is absent, or blank because the reader refused a value that is there — so
`planFrom` can be handed that arrival state directly instead of re-deriving intent from
`item.plannedStart` / `item.plannedTarget`.

- Smaller fix: nothing in `storage/` changes, and it collapses two rules
  (`reading.value !== null`, the ordinary blank-removes-a-stated-value case, and
  `reading.invalid`, the unreadable-end mirror) into one — "arrived non-blank, submitted
  blank" — stated once.
- Costs: `test/view/plan.test.ts`'s *"still clears a date the note does state when its
  field is emptied"* asserts today's model-time behaviour and would need to change to
  assert the form-time version instead. And clearing an unreadable end *alone* from the
  dialog stops being possible on its own: **Unschedule** still removes it, but Unschedule
  removes both ends together, so on a two-ended note "just the unreadable one" becomes
  two actions and spends two undo slots instead of one.

**(b) Carry an expectation the writer can refuse.** The shape `staleBase` already checks
against — does not work today. `AxisWrite.from` has two expressible expectations (`null`
= expected absent, a date string = expected this value) over three live states a
reading can actually be in (absent, a value, unreadable), so there is no way to say "I
expected this end to be unreadable" and have the writer refuse when it turns out not to
be. Building this needs a third state in `from` plus a `staleBase` branch for it — a
change to the write contract that reaches into `domain/` (`AxisWrite`) and `storage/`
(`refusesAxis` / `staleBase`), not just the view.

## The register ambiguity that let this drift

[[Horizon and dates from the row]] extensions 4d and 4e can both be read as governing
this exact input, and they disagree.

Extension 4d: *"the note states a date the reader refuses. Its field arrives blank
rather than holding the unreadable value, so confirming replaces it instead of writing
it back."*

Extension 4e: *"a field arrived blank and is confirmed unchanged. Nothing is written,
even where the key exists holding an empty value — the stub the backfill creates
([[Backfill missing properties]]). A blank field removes what the note *states*, and a
field that arrived blank states nothing; deleting the key for pressing Save would spend
the undo slot on a change nobody made. **Unschedule** stays the deliberate way to take a
key away, and still removes an empty one."*

An unreadable field arrives blank. Read 4d alone, the current code is right: an
unreadable value's field arrives blank and confirming "replaces" it — which for a field
still blank at submit time means removing it. Read 4e alone, the current code is wrong:
a field that arrived blank and is submitted unchanged should write nothing, and 4e
states the general rule ("a field that arrived blank states nothing") without carving
out the unreadable case 4d describes.

Whichever fix above is chosen, one of the two extensions has to be narrowed so they stop
contradicting each other on this input — 4d gains a clause distinguishing "confirmed
unchanged" from "confirmed after editing the other field", or 4e gains an exception for
the unreadable-arrives-blank case 4d already carves out.

## Acceptance criteria

None; this note records a review finding for a decision, not a scheduled fix. Resolving
it needs: picking (a) or (b) above, updating `test/view/plan.test.ts`'s assertion to
match whichever is chosen, and narrowing whichever of 4d/4e loses the reading.
