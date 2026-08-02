---
type: Issue
parent: "[[WIP limits]]"
order: 20
status: Open
priority: P2
area: verification
created: 2026-08-02
source: implementation of the per-column agreements increment
files:
  - src/domain/viewOptions.ts
  - src/view/render/board.ts
---

# Smoke test the column agreements

## Why this exists

Two questions about this increment cannot be answered in this repository. Obsidian
does not run here, so the jsdom harness can say what the schema returns and what the
DOM holds, and nothing about what Bases does with either.

## How to check

Run `npm run test-build`, open this repository as a vault, and open
`docs/Product Backlog.base`.

1. **The options menu regenerates.** With a workflow configured, open the view
   options and note the limit and policy boxes. Add a state to
   "Workflow states (in order)" and, **without reopening the view**, open the options
   again. Is there a limit box and a policy box for the new state?
2. **The dense header reads.** Set a limit of 1 on a state holding three cards, then
   type into the quick filter so one card matches. The header shows the pair count
   and the limit together — `1 of 3 / 1`. Is that readable, or does it need a
   separator, a second line, or the limit dropped while a filter is active?
3. **A state name with punctuation keys correctly.** These are the first generated
   option keys built from arbitrary user text — the per-type folder keys came from a
   fixed vocabulary with no whitespace or punctuation in it, so nothing before this
   increment asked the `.base` YAML writer to quote a key like this. Configure a
   state called `In review`, set a limit on it, close and reopen the base: did the
   limit survive the round trip through the `.base` file, whose key now contains a
   space? Then do the same for a state called `Blocked: waiting` (produces the key
   `wipLimit.blocked: waiting` — does the writer quote a colon-space in a mapping
   key?) and one called `Won't fix #123` (a `#` starts a YAML comment unless quoted).
   This matters more than a lost setting: a mis-serialised `.base` is user data, and
   a writer that got a key wrong could corrupt the file's other keys along with it.

## Acceptance criteria

- Question 1 answered yes, or a note recording what the menu actually does and what
  the user has to do to see a new state's boxes.
- Question 2 answered with a verdict, and a follow-up note if the answer is that the
  dense case needs a different layout.
- Question 3 answered yes for all three names, or a bug recording what the `.base`
  file holds and whether any other key was disturbed.

## Outcome

Not yet run.
