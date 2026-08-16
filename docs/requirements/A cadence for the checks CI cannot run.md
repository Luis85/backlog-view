---
type: PBI
parent: "[[Verifications a device has to answer]]"
order: 10
status: Done
area: verification
created: 2026-08-03
closed: 2026-08-03
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
---

# A cadence for the checks CI cannot run

**As** whoever cuts a release, **I want** the verifications this repository cannot run to
have a point at which they are run, **so that** they are a checklist rather than a folder
that grows.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever cuts a release |
| **Trigger** | Preparing a tag |
| **Preconditions** | `npm run test-build` installs the plugin into this repository as a vault, which is what makes each run cheap |
| **Guarantee** | Every verification is either run, or explicitly on a different trigger and says so. None is simply pending. |

**Main flow**

1. `RELEASING.md` names the sweep as a step before the tag.
2. The maintainer runs `npm run test-build`, opens the repository as a vault, and walks the
   **re-runnable** verifications in `docs/tests/cases/`.
3. Each note's `Outcome` is dated with what was seen.
4. The tag goes out.

**Extensions**

- **2a — the verification is conditional, not periodic.** It stays out of the sweep and
  keeps its own trigger. [[Verify base identity in a live vault]] is the case: it passed on
  2026-08-01 and asks to be repeated only **after an Obsidian or bundler upgrade**. Folding
  it in would silently replace the cadence its own outcome specifies with a more frequent
  one that is less likely to find anything — a check run at the wrong moment is not a
  stricter check.
- **2b — "every note of the verification kind" is not something the register can answer.**
  It has to be, or the sweep is a hand-maintained list that misses the next check while
  satisfying every criterion below. `type: Issue` is too broad — the kind covers decisions
  and limitations too, and covered the verification kind as well until the 2026-08-11
  migration gave verifications their own type, `Test case` — and `area: verification` is
  broader still, labelling records like [[A comment that states a rule is not a check]]
  that no device can run.

  **The shape distinguishes them, but only after three notes are normalized.**
  `docs/README.md` documented a verification-to-run as `Why this exists` · `How to check` ·
  `Acceptance criteria` · `Outcome` — that shape is `Test case`'s now, with a
  `Preconditions` line the 2026-08-11 migration added to it — and `## How to check` was
  carried by that kind and no other. Matched **as a whole heading line**, it selected a
  strict subset of what `area: verification` labels — **but three verifications did not
  use it.** [[Smoke test the board in a live vault]],
  [[Smoke test the folder note layout in a live vault]] and
  [[Smoke test the visual changes]] head that section `## What to look at` instead, so the
  query as first written would have silently dropped them.

  That is not a hypothetical loss. The board note is the one that **owns the mobile drag
  verdict** — the item [[Smoke test the touch paths on a phone]] deliberately delegates to
  it. A release sweep built on the unnormalized query would omit precisely the check
  another note points at, which is worse than no query: it looks complete.

  **So the three headings are normalized to `## How to check` as part of this work**, and
  the note says why the alternative was refused: teaching the query both spellings makes
  the set depend on a list of synonyms that grows every time someone invents a fourth.
- **2c — the heading is matched as a prefix.** Then it is the wrong query. A prefix match
  picks up `## How to check, properly` in a note about a CI gate that never ran — an
  investigation, not a live-vault verification — and an implementer chasing the resulting
  count either sweeps a check no device can run or hunts one that does not exist. Match the
  whole heading line. This was found the third time the set was counted, after two earlier
  counts were quoted as evidence.
- **2d — the normalized convention drifts again.** It could, and when this note shipped
  nothing stopped it: `docs-check.mjs` gated the use-case and ADR shapes and not the
  `Issue` shapes. Stated rather than hidden — the query rested on a convention, and a
  convention with no checker is what this whole round is about. The follow-up was
  deliberately not smuggled in here; it landed separately as
  [[The sweep query rests on a checked convention]], which holds the heading and the
  cadence to each other. What that gate does *not* reach is recorded there and in
  [[The documented Issue shapes are not the ones in the folder]].
- **2e — the count is written into a note.** Deliberately not. A first draft said "18 of
  20", and a note added in the same commit made it 19 of 20 before anyone read it — the
  staleness this round is about, committed inside the note complaining of it. A later draft
  then said "18 of 21" and was wrong again, for the prefix reason above.
  `docs/README.md` already states the habit: *"A count belongs here only as long as it
  takes to go stale."* The figure above belongs to this note's evidence for choosing the
  query, not to the checklist, which asks the register every time.
- **2f — the query is scoped by type or heading and not by folder.** Then it sweeps notes
  that do not exist. The plans under `docs/superpowers/` quote draft notes *verbatim* —
  `type: Issue` frontmatter and `## How to check` heading included — so
  `2026-08-02-per-column-agreements.md` carries a whole-line match for a note that also
  exists for real, now as `type: Test case` in `docs/tests/cases/` since the 2026-08-11
  test catalog migration moved it (the draft's own quoted frontmatter is frozen and still
  reads `Issue`). A query matching on heading alone returns the same verification twice,
  once at a path nobody can date an `Outcome` on. Found while running the query this note
  specifies, not while writing it: extensions 2b and 2c were both discovered by counting,
  and this one only by executing.
- **2g — the query is quoted rather than run.** Every note in this backlog is titled in
  prose, so every path holds spaces, and `grep -rlx ... | xargs grep -l ...` splits
  `Board card moves.md` into four missing files. The first version written into
  `RELEASING.md` did exactly that; it printed errors and a plausible-looking result. The
  fix is `-Z`/`-0`, and the lesson is the one this round keeps relearning — a documented
  command is a claim, and a claim gets executed before it is committed.
- **3a — a verification fails.** It becomes a bug note with what was seen, and the release
  decision is the maintainer's. The sweep reports; it does not block by itself.
- **3b — a verification has caught nothing across two releases.** That triggers a review of
  it, not its retirement. A quiet check is the *expected* result for a check CI cannot run:
  it exists because nothing else watches that behaviour, so two clean runs say the
  behaviour has not regressed yet, and nothing at all about whether it can. What retires
  one is that the thing it watches is gone, or that an automated test now watches it —
  evidence about the check's subject, never about its hit rate. The review is a recorded
  decision either way, because a checklist nobody believes is worse than a shorter one, and
  a check dropped for finding nothing is how a sweep empties itself while reading as
  disciplined.
- **4a — the sweep is proposed as automation instead.** Refused, and the reason is worth
  keeping: driving a real Obsidian from a browser harness would be a second test system
  with its own failures, gating releases on an app this repository does not ship, to
  replace a checklist that takes under an hour. The things it would check — appearance,
  base identity, whether a long press opens a menu — are the things such a harness is worst
  at.

## Acceptance criteria

- `RELEASING.md` names the sweep, and names it before the tag rather than after.
- The three notes heading their section `## What to look at` are normalized to
  `## How to check` **before** the query is relied on.
- The query matches the **whole heading line**, so `## How to check, properly` in a
  non-verification note is not swept in. No case needs planting:
  [[A gate that did not run looks like one that passed]] heads a section exactly that way
  and is a real `Issue`. It left the folder `RELEASING.md`'s grep reads when extension 2f
  narrowed that to `docs/tests/cases/`, so it is no longer what keeps the release sweep's
  own grep honest — but `docs-check.mjs`'s convention gate reads every `Issue` and `Test
  case` regardless of folder ([[The sweep query rests on a checked convention]]), and a
  prefix match there would still wrongly demand a `cadence:` of a note that has no
  business carrying one. The counterexample is load-bearing tree there rather than a
  fixture a later cleanup could delete as unused.
- After normalizing, a fresh count is taken and agrees with the register — not with any
  figure quoted while this note was being written, two of which were wrong.
- The set is **derived, not listed**: the sweep names the query — the notes in
  `docs/tests/cases/` carrying `## How to check` — so a verification added tomorrow is in
  it without anyone editing a checklist. `RELEASING.md` must not contain an enumeration of
  the notes.
- Every verification note states whether it is re-runnable or conditional, and a note that
  carries `## How to check` without saying which fails the sweep rather than being guessed
  at.
- The conditional ones are absent from the release checklist and present in their own
  trigger's wording.
- No automation is added by this note.

## Where it lives

`RELEASING.md` · `docs/tests/cases/` · `test-build.mjs` · `docs/README.md` (the `Test case`
shape)
