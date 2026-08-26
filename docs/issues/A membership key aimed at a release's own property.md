---
type: Issue
order: 500
parent: "[[What is in a release]]"
status: Open
priority: P2
area: domain
created: 2026-08-26
source: review triage of the release-index-design branch, both pairings reproduced 2026-08-25
files:
  - src/domain/releases.ts
  - src/view/release/renderIndex.ts
  - src/storage/createNote.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A membership key aimed at a release's own property

**Bind `membershipProperty` to a key a RELEASE note carries, and every release reports itself
as an item whose membership could not be resolved.**

`membershipTarget` (`src/domain/releases.ts`) is asked of every scannable row, and a release
note is one of them. It reads the membership key off that note's own frontmatter, finds a
value, and then refuses it at `!inPlan(item)` — which rejects a release outright — so the
answer is `UNRESOLVED` rather than "this note claims nothing". The count lands beneath the
index in `drawUnresolved` (`src/view/release/renderIndex.ts`), where it reads as work the
reader has mis-assigned. Nothing on the screen says which notes were counted, so the number is
the whole of the signal and it is pointing at the releases themselves.

## It predates this branch, and needs no new key to happen

Reproduced by the controller against a throwaway spec, both pairings failing identically:

| `membershipProperty` bound to | Spurious unresolved |
| --- | --- |
| the released-date property (new on 2026-08-25) | 1 |
| the STATUS property (shipped 2026-08-22) | 1 |

The second pairing involves nothing this increment added. `version`, `target-date` and
`status` have been exposed to it for as long as the release view has existed, and the
released-date property only joined a list that was already wrong. **The count also scales with
the vault**: every release note in the results contributes one, so a plan with a dozen
releases reports a dozen unresolved items on a base where nothing is mis-assigned at all.

## Why the creation-time guard is the wrong place

`createRelease` (`src/storage/createNote.ts`) keeps a `written` set and throws when two of
this view's options resolve to one key — and `membershipKey` is deliberately absent from it.
That guard's subject is the keys that function WRITES on the release note it is creating, plus
one read binding of that same note; membership is read on WORK ITEMS, a note `createRelease`
never touches. Adding it there would guard the one moment a release is made and say nothing
about a `.base` bound by hand, switched from another view type, or edited after the fact —
which is every other way this configuration arrives.

It is also the wrong SHAPE. The repository's own rule is that a category invariant is checked
at the forbidden thing rather than by listing the places, and a sixth entry in a hardcoded
creation-time list is the listing.

## What would close it

A stated rule — **a membership key must not name a property a release note carries** — checked
where memberships resolve rather than where releases are created, so it holds for every way a
`.base` comes to carry the binding. Two questions have to be answered first, and neither is a
review fix:

- **Is it a refusal or a report?** Refusing to resolve memberships at all puts the whole
  screen behind one mis-binding; reporting it beside the unresolved count leaves the count
  wrong while explaining why. The view's existing answer for a bad configuration is the note
  beneath the list ([[Every release in one list]] 2a), which argues for the second.
- **Which properties count as "a release note's own"?** The resolved keys of this view are the
  obvious set, but a vault can spell a release note with anything, and the check can only see
  what the options name.

Until then the failure is a configuration nobody would choose on purpose, and the reason it is
recorded rather than fixed is that the fix is a decision about
[[The scope of a release as a tree]]'s own vocabulary and not an edit.
