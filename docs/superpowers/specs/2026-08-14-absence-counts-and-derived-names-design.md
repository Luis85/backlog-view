# Absence counts on the band header, and derived absence names — design

**Date** 2026-08-14 · **Feature** [[Resource absences]] on the resources axis of the roadmap

## The request

Two asks, both about the same friction: an absence costs attention to record and gives
back nothing scannable.

1. **A readout beside the resource's name** counting the absences that are upcoming or
   currently running — in the shape `2 items / 2 absences`.
2. **The title generated**, so recording an absence asks for the dates and nothing else.

## What the register said first, and why this still ships

`docs/requirements/Resource absences.md` records a refusal, not a gap. Under **The band
header carries NO glyph saying the band holds an absence**, a header indicator was built
on 2026-08-14 and removed the same day from the vault it was built for, on two reasons:
the stretch's own hatched row sits directly beneath the header so the `0` is never read
alone, and a fourth `user-x` in one lead competed with the Add absence button that reveals
on hover in the same place. It ends: *do not add it back without a reason the row below
does not already give.*

The request clears that bar, and the two reasons are why — stated here because a later
reader will find the refusal before they find this note:

- **"Upcoming or active" is a filter on today, and the rows below carry no such filter.**
  `ResourceLane.absences` holds every stretch a resource has ever had. The band draws them
  all, which leaves the reader comparing each hatch against the today line one at a time.
  A finished absence is exactly the one the reader does not want counted.
- **A collapsed band draws no absence at all.** `laneEntries` skips the whole band, so on
  a folded roster — which is what folding is for on a long one — the header is the only
  surface left. The removed glyph had this property too; nothing in the removal reasoning
  weighed it, because the reason for wanting it had not been stated yet.

And the request's own shape sidesteps the removal's second reason: **words are not a
fourth glyph.** `2 items / 1 absence` reads in the lead's text run and never competes with
the hover-revealed Add absence button.

**The glyph stays refused.** What ships is a labelled count. The amended paragraph has to
keep both halves, or the next reader takes the words as permission for the mark.

## What was refused

- **A band-height indicator, or anything measured.** Same answer the wash already gave: a
  band has no container element, so its top and height are knowable only by measuring
  after the render — the layout read `src/view/CLAUDE.md` forbids.
- **A third fit mechanism.** The label is much wider than today's bare number, in a lead
  column the user resizes (`renderLeadResize`). Shortening the label under pressure would
  need a threshold in TS or CSS beside `columnFit` and `syncToolbarFit`. Refused: the name
  ellipsizes into the label instead, which is one CSS declaration and is what
  `.pbl-lane-name` already does.
- **Dropping the absence half first under pressure.** It is the fact the change exists to
  surface.
- **A "was this still the generated name" test before renaming.** See §8 — a hand rename
  does not survive the next edit, and that is recorded rather than engineered around.
- **Regenerating names for absences that already exist.** Nothing is retroactive.

Not re-derived, because the register settles them: an absence is never a `BacklogItem`; it
draws in one row and nowhere else; both dates are required; the band's count is RESULT bars
and stays so; an absence is never counted and never shelved.

## 1. The count — `src/domain/absences.ts`

One pure function beside `crossedAbsences`:

```ts
export function pendingAbsences(absences: Absence[], today: CivilDate): number {
	return absences.filter((absence) => daysBetween(today, absence.target) >= 0).length;
}
```

**"Upcoming or currently active" is one comparison, not two**: a stretch whose target is
today or later either has not started or has not finished, and no third case exists. That
is the sentence to keep at the declaration — written as two conditions it invites a
reader to "fix" the missing start comparison.

Inclusive at today, matching `crossedAbsences`' own boundary rule, so one absence does not
mean two different things on one row.

Two rules it inherits rather than restates:

- `today` is a **parameter**. Nothing under `domain/` reads a clock — `todayCivil()` is
  computed in the view and injected, which is what keeps every date test able to say which
  day today is.
- It counts from **dates, never geometry**, `crossedAbsences`' recorded rule read again: a
  stretch outside the drawn window still counts, or the number would change as the reader
  scrolls.

## 2. The label — `src/view/render/lanes.ts`

`renderLaneHead` takes `today`, which `drawEntries` already holds on `pass.drawing` — the
one object that walk carries so a field added to it is not a sixth argument.

`.pbl-lane-count` becomes:

```
1 item                      ← no pending absence
2 items / 1 absence
2 items / 3 absences
```

The absence half appears **only when the count is positive**. `0 absences` reports nothing
the reader needed and would sit on nearly every band.

The item half is unchanged in MEANING — still `lane.bars.length`, still result bars, so a
context row and an absence both stay uncounted, the rule a bucket's count already keeps.
Only its spelling changes, and the code comment stating that rule stays where it is.

Plurals inline (`count === 1 ? … : …`), which is this codebase's idiom — there is no
shared plural helper and eleven call sites spell it this way. Adding one for two words is
the abstraction to refuse.

Sentence case, the marketplace rule `npm run lint` and review both enforce.

## 3. The style — `styles/lanes.css`

`.pbl-lane-count` gains `flex: 0 0 auto` and `white-space: nowrap`.

That is the whole of "the name truncates first": `.pbl-lane-name` already carries
`overflow: hidden; text-overflow: ellipsis` and shrinks at the flex default, so refusing to
shrink the label is all the label has to say. No breakpoint, no measurement, no third fit
mechanism.

## 4. The collapsed band, and the legend's opposite rule

**A collapsed band draws the count**, and the distinction is worth stating because the two
rules look alike and point opposite ways. `DrawnColors.absence` keys what this pass
PAINTED, so a collapsed band must not key the `Unavailable` swatch — that is the
drawn-versus-model rule `resourceAbsences.test.ts` already pins. The header's count is a
fact about the BAND, and the header is drawn whether the band is open or shut; a folded
roster is the case this change exists for.

The dated axis has no band and no header, so the question does not arise there.

## 5. The derived name — `src/domain/absences.ts`

Beside `readAbsence`, since this is what an absence IS rather than how one is written:

```ts
export function absenceTitle(facts: AbsenceFacts): string {
	return `${facts.resource} away ${facts.start} → ${facts.target}`;
}
```

The one producer, so the create path and the edit path cannot come to disagree about what
an absence is called — the same reason the two acts already share one form, one validator
and one set of refusals.

Both dates in the name, so two stretches of one resource over DIFFERENT days read apart:
`Evi away 1` and `Evi away 2` are two names that say nothing apart, and a filename is read
in the explorer, in search and in a link, where no row is there to supply the dates. Not
"never collides" — the same resource over the same days derives the same name, and so does
a note already sitting at it, so `uniqueNotePath` still appends a number sometimes. `sanitizeTitle` replaces `\/:*?"<>|#^[]` only, so both the dates and the arrow
survive to disk unchanged — checked, not assumed.

It takes `AbsenceFacts`, which already exists and is already exactly these three fields for
already the right reason: *what an absence says*, split from what decides where the note is.
It lives in `src/storage/absenceNotes.ts` today, and `domain/` may not import `storage/` —
so **the interface moves to `src/domain/absences.ts` and `storage/` imports it**, rather
than the shape being restated here as a structural type. A type belongs with the code that
produces it, and what an absence IS is defined in this layer; `absenceNotes.ts` already
imports `domain/settings.ts` and `domain/typeVocabulary.ts`, so the direction is the one the
layer rule already has it running.

## 6. The form — `src/ui/prompts.ts`

`AbsenceResult` loses `title`; `AbsencePromptOptions.editing` becomes
`{ start, target }`. The Title field goes.

**Start takes the autofocus.** It was the title's (`submitOnEnter`'s third argument,
`key === 'title'`), on the reasoning that the resource above it was already answered by the
row — which now points at the start date, the first thing the user has to answer.

`absenceProblem` in `src/view/interactions/absences.ts` loses its
`'Give the absence a title.'` rule: three fields, three refusals, and 2a and 2b unchanged.

## 7. The two acts — `src/view/interactions/absences.ts`

`writeAbsence` and `editAbsence` each derive the name from the facts they are about to
write. `AbsenceSpec` still carries a `title`, and `createAbsenceNote`,
`updateAbsenceNote`, `renameAbsenceNote` and `deleteAbsenceNote` are **untouched** — the
derivation is upstream of the boundary, which is where a decision about what a note is
called belongs.

**The frontmatter-before-rename order is unchanged and still load-bearing.** A rename that
landed first and then failed would leave a note named for a stretch it does not hold; this
way the worst outcome is the right dates under the old name — visible, and fixable from the
same menu. What changes is only the premise of the test that drives it: "an edit that also
changes the title" and "an edit that changes the dates" are now the same edit.

**An edit that renames nothing.** `renameAbsenceNote` returns early where the title already
resolves to the note's own path. That guard was a comparison of `sanitizeTitle(title)` with
the basename when this was written, and it was not enough once the name became derived: a
note that had landed at `X 1` derives `X` for ever after, so the guard could no longer fire
and each edit ratcheted the suffix. It is now one comparison of the resolved PATH, with the
note's own path counted free (`uniqueNotePath`'s `self`). A re-confirmed edit renames
nothing, collided name or not.

## 8. Three consequences, stated rather than solved

- **A hand rename does not survive the next edit.** Rename
  `Evi away 2026-08-10 → 2026-08-14` to `Evi at the offsite` in Obsidian, then change the
  end date: the note takes the derived name back. That is what "the name is a function of
  the facts" costs, and it is the accepted cost rather than a defect — the alternative is a
  "was this still the generated name" comparison, a second rule whose failure mode is a
  note that silently stops following its own dates. Recorded in the register, at the
  extension.
- **Existing absences keep their names.** Only a create or an edit derives; reading is
  untouched, and `readAbsence` never consults the basename except to report it as
  `Absence.title`. `demoVault()`'s `Dana is at the offsite` stays as it is, which keeps the
  fixture honest about a vault holding both kinds.
- **The row's lead now reads the long derived name** and ellipsizes at a narrow lead width.
  Nothing is lost — `renderLaneAbsence` already tooltips the title, and the dates are on
  the bar, in its tooltip and in the row's accessible name — but it is three statements of
  the same dates on one row. If it reads badly in a vault, the fix is `absenceTitle`, one
  pure function, and not a second rule about what the row draws: *an absence's title is its
  basename and nothing else* is the rule the edit path is built on.

## 9. The fixture

One line in `demoVault()` (`test/helpers/fixtures.ts`): a **past** absence. Today's two are
Dana's (2026-08-10 → 2026-08-14, running) and Sam's (2026-09-01 → 2026-09-18, upcoming), so
both count and nothing in the repository shows the filter doing its job — in the harness or
in a reader's head.

## The checks, and what each reaches

**Node** (`test/domain/absences.test.ts`):

- `pendingAbsences` — ends yesterday not counted, ends today counted, wholly future
  counted, empty list zero. The boundary day is the one that would silently drift.
- `absenceTitle` — the shape, and that `readAbsence` still reads a hand-named note back
  (the name is derived on write and never required on read).

**View** (`test/view/resourceAbsences.test.ts`, the file that owns this subject):

- the header reads `1 item / 1 absence`;
- a band whose only absence has ENDED reads `1 item` — the filter, driven;
- a **collapsed** band still reads the absence half, which is the fact this change exists
  for and therefore a test rather than a comment;
- submitting the prompt with a resource and both dates writes a note at the derived name;
- editing the dates renames the note to the newly derived name;
- an edit whose frontmatter write fails leaves the old name (the existing test, with its
  premise moved from the title to the dates).

**Existing assertions to move**, four of them, from the bare number to the label:
`test/view/resourceLanes.test.ts` (×3), `test/view/resourceAbsences.test.ts`,
`test/view/contextCardWrites.test.ts`. `laneCountOf` in `test/helpers/roadmap.ts` returns
the element's text and needs no change — which is the point of it having been a helper.

**What none of these reach**, stated so the guarantee is not read wider than the check: no
test here says what the header LOOKS like, whether the label crowds the name at the
default lead width, or whether the ellipsis lands somewhere legible.

`npm run check` must pass, all five steps. Coverage thresholds only rise, and the figure
recorded is what the FINISHED increment measures.

## The register

- `docs/requirements/Resource absences.md`:
  - **the refusal paragraph is amended, not deleted** — the glyph stays refused for its own
    reason, and the words are admitted with the two reasons above;
  - **extension 4i is amended**: the title is no longer a field, so "changing the TITLE
    renames the note" becomes "changing the facts renames the note";
  - **two new extensions**: the derived name with its hand-rename cost, and the header's
    labelled count;
  - acceptance criteria: the two about a blank title collapse into one about three fields;
  - `files:` gains nothing — every module touched is already listed.
- `docs/requirements/Showing a resources axis on the roadmap.md`: `## Where it lives`
  gains the count's new wording, since the header and its count are that PBI's.
- `ADR 0028` is untouched: the reserved *type* name is not what changed.
- `CHANGELOG.md` `[Unreleased]`: two entries.
- `docs/tests/suites/Smoke test the roadmap.md`: the live-vault rows below.

## What a live vault still owes

jsdom paints nothing and `npm run harness` draws Obsidian's DEFAULT colours only:

- whether the label crowds the resource name at the default lead width on a real roster,
  and where the ellipsis falls when it does;
- whether the long derived name reads as noise in the absence row's own lead, beside the
  dates the bar already states;
- whether a screen reader reads the labelled count usefully, given the header claims no
  role of its own and labels its rows by proximity alone.

The harness answers the first two at default colours against `demoVault()`, which will
then carry a running absence, an upcoming one, a past one, and a hand-named note beside
derived ones.
