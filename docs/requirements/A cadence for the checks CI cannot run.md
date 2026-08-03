---
type: PBI
parent: "[[Verifications a device has to answer]]"
order: 10
status: Open
area: verification
created: 2026-08-03
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
   **re-runnable** verifications in `docs/issues/`.
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
  and limitations too — and `area: verification` is broader still, labelling records like
  [[A comment that states a rule is not a check]] that no device can run.

  **The shape already distinguishes them, and `docs/README.md` already documents it:** a
  verification-to-run is the Issue written as `Why this exists` · `How to check` ·
  `Acceptance criteria` · `Outcome`, and **`## How to check` is carried by that kind and no
  other**. Measured: it selects **18** notes where `area: verification` selects 26. So the
  query is the documented shape, needs no new frontmatter field, and cannot drift from the
  convention because it *is* the convention.
- **2c — the count is written into a note.** Deliberately not. A first draft said "18 of
  20", and a note added in the same commit made it 19 of 20 before anyone read it — the
  staleness this round is about, committed inside the note complaining of it.
  `docs/README.md` already states the habit: *"A count belongs here only as long as it
  takes to go stale."* The figure above belongs to this note's evidence for choosing the
  query, not to the checklist, which asks the register every time.
- **3a — a verification fails.** It becomes a bug note with what was seen, and the release
  decision is the maintainer's. The sweep reports; it does not block by itself.
- **3b — a verification has caught nothing across two releases.** That is evidence to
  retire it, and retiring it is a recorded decision rather than a lapse. A checklist nobody
  believes is worse than a shorter one.
- **4a — the sweep is proposed as automation instead.** Refused, and the reason is worth
  keeping: driving a real Obsidian from a browser harness would be a second test system
  with its own failures, gating releases on an app this repository does not ship, to
  replace a checklist that takes under an hour. The things it would check — appearance,
  base identity, whether a long press opens a menu — are the things such a harness is worst
  at.

## Acceptance criteria

- `RELEASING.md` names the sweep, and names it before the tag rather than after.
- The set is **derived, not listed**: the sweep names the query — Issues carrying
  `## How to check` — so a verification added tomorrow is in it without anyone editing a
  checklist. `RELEASING.md` must not contain an enumeration of the notes.
- Every verification note states whether it is re-runnable or conditional, and a note that
  carries `## How to check` without saying which fails the sweep rather than being guessed
  at.
- The conditional ones are absent from the release checklist and present in their own
  trigger's wording.
- No automation is added by this note.

## Where it lives

`RELEASING.md` · `docs/issues/` · `test-build.mjs` · `docs/README.md` (the `Issue` shapes)
