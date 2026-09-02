---
type: PBI
parent: "[[Putting work in a release]]"
order: 40
status: Open
created: 2026-09-02
source: user request — automatic dates on release assignment, 2026-09-02
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Joining a release dates the work

**As** a backlog owner, **I want** an item I put in a release to take a start and a due date
from that act, **so that** committing work to a version shows it on the roadmap instead of
leaving me to open the item and type two dates.

**Nothing yet.** [[Setting an item's release]] writes the membership link and nothing beside
it — `computeReleaseWrites` copies no timeframe, which its own note records as the difference
from [[An iteration's timeframe schedules its items]]. The consequence is the one this note
is about: an item committed to a release draws no bar on the dated axis
([[Bars from two dates]]), so the release's scope is invisible on the one screen that shows
time.

This is that difference closed, and it closes it **asymmetrically** rather than by copying the
sprint's rule. An iteration is a time box and imposes both of its ends; a release is a
deadline and states one date. So the due date comes off the release note and the start comes
off the clock, and neither overwrites anything the item already holds.

**It costs no new view option.** The backlog view already names the release note's date
itself, as `releaseDateProperty` — the key the roadmap positions a release marker at. That
option is read and never written, and this use case does not change that: it writes the
ITEM's own two date keys from a value read through it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Picking a release from `Set release` on a row or a card, by pointer or from the keyboard |
| **Preconditions** | The membership property is configured, and the item is plan work the Base returned. The two date properties and the release date property are **not** preconditions: an unconfigured key is skipped, as everywhere else |
| **Guarantee** | One batch through one gate, taken back by one undo. No date the item already holds is ever changed, and no start is ever written later than the due date the item ends up with — **both decided against the note as it stands when the write lands**, never against the row that planned it. No state key is named in the plan, whatever the item held and whatever it joins. |

**Main flow**

1. The user picks a release for the item.
2. The plan carries the **link** — a wikilink to that note, spelled from the editing note's
   own path — exactly as it does today.
3. It carries **due**, the release's own date, when the item has no readable due of its own.
4. It carries **start**, today, when the item has no readable start of its own and today is
   not later than the due the item will end up with.
5. `applySafely` applies the one batch, and one undo takes the whole commitment back
   ([[Undo and redo]]).
6. The item now draws on the dated axis ([[Bars from two dates]]).

   It is **not** claimed to appear in the release's own summary. That screen resolves its own
   membership key, which [[Setting an item's release]] allows to be bound at a different
   property than this write uses, so the outcome would hold in some vaults and not others —
   and [[Summing up a release]]'s date figures are unbuilt in every vault today.

**Extensions**

- **2a — the pick does not change the link** (the item is already in that release). The plan
  is **empty**, and no date is written. **Asked twice**: at plan time, so a re-pick costs
  nothing and the menu's checkmark stays honest; and again inside the write, against the
  membership the note actually holds, because another view can join the item to this same
  release while the submenu sits open — the link write would then change nothing while the
  dates still landed, which is exactly the top-up this extension forbids (Codex, PR #242). The dates ride the join and only the join, so a member
  that joined before this shipped has no top-up path and is filled by hand. Decided by the
  user on 2026-09-02 over a re-sync variant. The cost of the variant is what decided it:
  [[An iteration's timeframe schedules its items]] 3a had to narrow the register's checkmark
  rule to the plan's LINK component to stay true, and this refusal keeps
  [[Setting an item's release]]'s own rule whole — an entry is checked exactly when picking it
  would write nothing, asked of the entire plan.
- **3a — the item already holds a due date.** It is **left alone**. Not overwritten, not
  compared, not deleted. **Asked of the note as the write lands**, not of the row that planned
  it — see 6c, which is where that question is answered and why it cannot be answered here. A
  release states when the version ships, not when each item in it is answerable; an item with
  a date somebody chose has a truer answer than the release's. Decided by the user on
  2026-09-02 against the sprint's overwrite rule, which is a time BOX imposing its ends and is
  not what a deadline does.
- **3b — the release states no date**, or its date property is unconfigured, or the value is
  unreadable. Nothing is written under the due key and nothing is deleted — the item keeps
  what it had. `undefined` leaves a key alone where `null` would delete it, and a release with
  no date has no deadline to impose.
- **4a — the item already holds a start.** It is **left alone**, for 3a's reason: an item
  already scheduled or already begun started when it started, not when it was filed into a
  version. Asked at the same place and the same moment 3a is.
- **4b — a candidate would reverse the span against the end that stands.** It is **not
  written**, and the other end still is. One rule in both directions, asked of the live note:

  - Today is later than the due that stands (the item's own where 3a kept it, otherwise the
    release's) — **no start**. A release whose target date has passed gets its due copied and
    no start invented.
  - The release's date is earlier than a start that stands (4a kept it, and the item has no
    due) — **no due**. The item keeps its own coherent plan and takes no deadline from this
    release.

  The second direction was missing until 2026-09-02 and manufactured the exact outcome this
  extension exists to prevent: 3a wrote the earlier due, 4a kept the later start, and the
  `AxisWrite` states no `ends`, so the writer's reversed-span guard did not run on it either
  (Codex, PR #242). Decided by the user the same day, symmetric with the first direction
  rather than as a second rule.

  This is a deliberate departure from [[An iteration's timeframe schedules its items]], whose
  own comment accepts a reversed span and leaves the shelf to report it: there both dates come
  off one note and are coherent by construction, here one comes off a clock and one off
  another note, so a write that ignored the order would MANUFACTURE the reversed span rather
  than pass one through.
- **4c — no due date stands at all** (the item had none and 3b applied). Today is written as
  the start, whatever it is. There is nothing for it to be later than, and an item with a start and no due is
  a shape the roadmap already draws.
- **4d — either date property is unconfigured.** Nothing is written under it, and the link
  still lands. Absence is a value, and an unconfigured key is never written. A vault with no
  date properties gets membership and no scheduling, which is coherent rather than degraded.
- **5a — the user picks "no release".** The key is removed and **the dates stay**. Leaving a
  release is not a reschedule, and deleting two date keys on the way out is a decision nobody
  made. [[An iteration's timeframe schedules its items]] 3b, inherited unchanged.
- **5b — no state is written, on any of these paths.** Not on joining, not on moving from one
  release to another, not on "no release". A category invariant, so it is asked of the planner
  every entry point routes through rather than by driving the paths someone thought of.
- **5c — the item is a context row** (outside the Base's filter). `Set release` is not offered
  and no date reaches it. The context-row rule is inherited whole and restated nowhere.
- **5d — the write takes the item out of the base**, because the base's filter names one of
  the date properties. The item leaves in silence, as it already does on every other write
  path. The open question is recorded rather than reopened
  ([[The outcome report was built from one sentence]]).
- **6a — a note is created into a release** ([[Adding work from a release's scope]]). It
  carries the membership and **no dates**. That create happens in the release view, which
  declares no start or target key of its own; giving it these dates would mean two new options
  there and a second setup step for a vault that already bound them on the backlog view.
  Decided by the user on 2026-09-02, and stated here rather than left as a hole:
  [[An iteration's timeframe schedules its items]] 5a does not transfer, because an iteration
  board is a projection of the view that owns those keys and a release screen is not.
- **6b — a later path writes the membership** — [[Trying a scope change]] and
  [[Moving a card between slices]], both still design. They inherit this by calling the one
  host method, which is the register's own rule for a projection's moves rather than a second
  one here. Nothing is written for them now.
- **6c — the note changes between the row being drawn and the pick being applied**, by hand,
  by another view, or by an earlier write in this same batch. Every rule above still holds,
  because **the planner decides none of them**. On a join it carries both candidates
  unconditionally — the release's own date, and today — and whether the link is changing; the
  write then decides, against the frontmatter as it stands, which of the two land.

  **The planner carrying a candidate is not the planner offering it.** An end the planner
  filtered out is an end the writer cannot reinstate, and the live reading is exactly what may
  have moved: a captured due in the past suppresses the start, and if that due is removed or
  moved forward before the batch lands, a pre-filtered plan has no start left to write (Codex,
  PR #242). So the plan carries every configured candidate and the write suppresses; the
  reverse order cannot be made correct.

  A planner that decided from the model would also silently replace a date somebody had just
  typed: `applyAxis` reads the live value only to skip an equal civil date, and overwrites
  anything else.

  This is the register's own rule — *write the guarantee to the check, never ahead of it* —
  and the codebase already keeps it one function over: the stub loop in `applyInto` asks
  `rawValueOf(fm, key).present` at the live note, with the reason stated there in the same
  words. Found by review on this note (Codex, PR #242), which read the guarantee against
  `applyAxis` and reported that nothing could keep it.

  **It is a flag on the write, never a change to `applyAxis`'s default.** That function is
  shared with the horizon drag, the timeline resize and the iteration join, and the iteration
  join OVERWRITES always ([[An iteration's timeframe schedules its items]] 2a). A writer that
  learned "fill only if empty" as a habit would silently retire that rule.

## Acceptance criteria

- Picking a release plans the link and the two dates in **one** batch through `applySafely`,
  and one undo takes the whole batch back — checked by joining and asserting all three keys
  are back, never by reading a list.
- A date the item already holds is never written — asserted for each end independently, with
  the other end empty, so a rule that reads both together fails it.
- **"Already holds" means a readable date, not a present key.** A note carrying `start: ''`
  and `due: ''` — which is what ✨ Assign missing properties leaves on every eligible note —
  is filled. A test drives a backfilled fixture, because asking key presence would make this
  feature write nothing in the vaults most likely to have it.
- The due written is the release note's own date, read through the backlog view's
  `releaseDateProperty`; a release with no readable date writes and deletes nothing at that
  end.
- The start is today, and is absent from the plan whenever today is later than the due the
  item ends up with — checked against **both** sources of that due: the item's own kept date,
  and the release's.
- With no due standing at all, the start is still written.
- Picking the release the item is already in plans **nothing**, so the menu's checkmark keeps
  asking the whole plan and no date is written on a re-pick.
- Picking "no release" removes the membership key alone and leaves both dates.
- **No plan this module produces ever names a state key** — asserted of the planner, so it
  holds for entry points not yet written.
- A context row is never a write target on any of these paths.
- **The plan carries both candidates on every join, unfiltered** — asserted of the planner
  against an item whose captured dates would suppress each end in turn, so a planner that
  filtered fails here rather than in a race.
- **Three storage-level races, each plan-then-edit-then-apply.** A due typed onto the note
  after the row was drawn stands, and no start lands after it. A captured past due that is
  removed before the batch lands still gets today as a start — the end a pre-filtering planner
  would have dropped. A membership joined by another view before the batch lands leaves the
  dates unwritten, because the pick is no longer a join.
- **Neither end is written where it would reverse the span against the end that stands** —
  both directions, each with the other end empty: today after a due that stands, and the
  release's date before a start that stands. This is the criterion the
  planner cannot carry, and it is checked at the writer for that reason.
- **The horizon drag, the timeline resize and the iteration join still overwrite.** Asserted by
  driving each against a note that already holds the end being written, so a fill-only rule
  leaking into `applyAxis`'s default fails here rather than in a vault.
- **Today is passed into the planner, never read inside it.** Asserted by driving the plan
  with a fixed date and getting a fixed batch; a planner that read a clock could not be
  checked this way at all.

## Where it lives

The plan is `computeReleaseWrites` in `src/domain/writePlan.ts`, which is where the
state-key invariant is asserted because every entry point routes through it. It already takes
the release as a `BacklogItem` rather than a `TFile`, so the date it needs is in hand: the
release item carries it from `readReleaseDate` in `src/domain/readItems.ts`, gated on
`isReleaseType` and read with `readSoleDate` through `BacklogSettings.releaseDateKey`
(`src/domain/settingsResolve.ts`, from the `releaseDateProperty` option in
`src/domain/viewOptions.ts`). That option's own comment — read and never written — stays true:
what this writes are the item's `startKey` and `targetKey`, and the release's key is only ever
read. No option is added, and `PROPERTY_TABLE` is not touched.

Today comes in as an argument. `src/domain/writePlan.ts` is pure domain and reads no clock;
the precedent is `promptCreateItem` in `src/view/interactions/create.ts` and `renderRoadmap`
in `src/view/render/projections.ts`, both of which pass `todayCivil()`
(`src/domain/noteFields.ts`) in from the caller. The caller here is
`src/view/interactions/labels.ts`, whose `addReleaseItems` builds the entries, and
`performReleaseMove` on `src/view/host.ts`, implemented in `src/view/cardMoves.ts`.

The two dates ride the same `ItemWrite` as the link, as an `AxisWrite` — the shape
`computeIterationWrites` already uses, and the reason is the same: two records naming one file
would capture two inverses, and an undo could then return the link and keep the dates. It
states no `ends`, so the writer's reversed-span guard (`refusesAxis` in
`src/storage/frontmatter.ts`) does not run on it — which is correct here because extension 4b
makes the pair coherent rather than leaving the writer to refuse a legitimate join.

**Extension 6c puts emptiness, the ordering and the join test in `applyAxis`**, in the same
`processFrontMatter` call that lands the write, beside the `sameCivil` skip it already makes
there. It is reached by a flag the `AxisWrite` carries, so the horizon drag, the timeline
resize and the iteration join keep overwriting; the flag is not an `AxisField`, so
`axisEntries` in `src/storage/writeKeys.ts` neither emits it as an entry nor lets it disturb
`touchedKeys`.

**What stays in the planner is the two VALUES and nothing else** — the release's own date and
today, neither of which the writer can know. It carries both on every join, unfiltered. Which
of them land is three live questions, all asked at the write: does the note still hold that
end, does writing it reverse the span against the end that stands, and is this pick still a
join. The last needs the membership read BEFORE `applyLinks` writes it, the way `leaving`
already captures the state before it is replaced. Applying it is `src/storage/frontmatter.ts` through `axisEntries` in
`src/storage/writeKeys.ts`, which carries the "unconfigured key dropped, `null` deletes" rule
this note leans on and is already captured for undo; the membership key is already in
`touchedKeys` beside it.

`src/view/interactions/labels.ts` needs one comment corrected rather than one rule changed:
it currently states that this plan has ONE component and that the checkmark can therefore ask
the whole plan. The first half stops being true and the second half stays true, because
extension 2a keeps an unchanged link planning nothing at all.

Driven in `test/domain/releaseWrites.test.ts`, which already owns this planner, with the
entry points in `test/view/contextRowWrites.test.ts` and
`test/view/contextCardWrites.test.ts`, and the batch's own undo in
`test/storage/restore.test.ts`. Extension 6c is driven at the writer instead — the plan is
built, the note is edited underneath it, and the batch is then applied — which is the only
place that window exists to be tested at all.
