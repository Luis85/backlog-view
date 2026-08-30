---
type: PBI
parent: "[[Release notes from its own scope]]"
order: 10
status: Active
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: 2026-08-29
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Generating the release notes

**As** someone who has just shipped, **I want** the release's members written out as a Markdown
note grouped by type, **so that** I can hand out what shipped without retyping the backlog.

Built on 2026-08-29, reusing the generated-file shape [[A README in the backlog folder]]
built: one file the plugin owns, written whole. **Active rather than Done**: what a live
vault has to confirm is the file as Obsidian renders it, including whether the marker
comment is invisible in reading view.

## Use case

| | |
| --- | --- |
| **Actor** | Someone who has just shipped |
| **Trigger** | Choosing to generate the release notes for the open release |
| **Preconditions** | The membership property and the output folder are configured, and the view's configuration holds no problems |
| **Guarantee** | One note is written whole, through the same `configProblems` gate as every other write path, derived from the members and from nothing stored. It is never read back by any figure in this view, and no other note is touched. |

**Main flow**

1. The view collects the members of the open release.
2. It groups them by each note's own type, using the type vocabulary the view already reads.
3. Within each group it keeps **the order the scope tree draws them in**, so the file and the
   screen tell the same story in the same sequence. It reads no ordering key of its own: the
   sequence is one the release view has already derived, and a second key here could disagree
   with the tree the reader just looked at.
4. It writes one note into the configured folder, named for the release, opening with a line
   saying it is generated and that edits to it do not survive.
5. It opens the note, so the result is looked at rather than reported.

**Extensions**

- **1a — the release has no members.** The note is still written and says the release contained
  nothing, rather than being absent. An empty release notes file is a fact; a missing one is
  ambiguous.
- **1b — a note the Base excluded names this release.** It is not in the file, and **the file
  does not say how many such notes there are**, because nothing can count them: membership
  lives on the item, so an excluded item is invisible to the view, and one that surfaces as a
  context row is barred from being a source of any figure derived from the results. Instead
  the file states its own population once — that it lists what this Base returned — which is
  a promise the view can keep, where a count of the unseen is not.
- **2a — a member's type is not in the vocabulary.** It is grouped under an "other" heading
  rather than dropped, because a note that quietly omits work is worse than an untidy heading.
- **4a — a note of that name already exists in the folder and its marker names this release.**
  It is overwritten whole. That is the point of a generated file, and it is why the file says
  so at its top.
- **4b — the note that exists is not one this plugin generated** — no generated marker at its
  top. It is not overwritten; the action refuses and names the file, because a whole-file write
  over somebody's prose cannot be undone by the undo slot.
- **4c — the note that exists is generated, but its marker names a different release.** Also
  refused, and for the same reason: Obsidian allows two notes in different folders to share a
  basename, so two releases can want one output name, and "it carries a marker" would let the
  second silently destroy the first's notes. **The marker identifies the release it was
  generated from**, which is what makes a regeneration tell itself from a collision.
- **4d — the output folder is unconfigured, or the view's configuration holds a problem.** The
  action is not offered, and it says what to fix rather than choosing a folder on the user's
  behalf or writing under a configuration the gate refuses. Generation is a write path, so it
  is gated like every other one — not merely on the two keys it reads.
- **4e — the folder does not exist, or the write fails.** The failure is reported with the path
  it tried, and nothing partial is left behind.
- **5a — the note cannot be opened.** It has still been written; opening is a convenience, not
  part of the guarantee.

## Acceptance criteria

- The generated note contains exactly the members the Base returned, grouped by type, in the
  sequence [[The scope of a release as a tree]] draws them within each group, and it names that
  population in its own text.
- Remapping the vault's order property changes the file's sequence and the tree's together,
  because both read one derivation — nothing here reads a property named `order` directly.
- A fixture whose release has a member the Base excludes produces a file that neither lists it
  nor counts it, and adding a context row to the fixture changes no line of the output.
- Its first lines say it is generated and that edits do not survive regeneration.
- Regenerating twice over an unchanged release produces a byte-identical file.
- A file at that path whose marker names this release is overwritten; one with no marker, and
  one whose marker names another release, are both refused and named.
- With a configuration problem outstanding, the action is not offered and nothing is written,
  even with both its own keys bound.
- No figure anywhere in this view is computed from the generated file.
- With the output folder unconfigured, the action is absent and names the option.

## Where it lives

The text is composed in `src/domain/releaseNotesText.ts`, beside `src/domain/backlogReadme.ts`
and shaped like it, from the scope rows the screen already derived and the vocabulary in
`src/domain/typeVocabulary.ts`. Nothing dated goes in its body, which is what makes a
regeneration over an unchanged release byte-identical — the easy thing to get wrong, since
the action beside it exists to write today's date. The marker that tells a generated file
from a hand-written one is `src/domain/readmeMarker.ts`, whose `joinSource` names THREE parts
here — base, view and the release's own PATH — so a regeneration can be told from a collision
between two releases that share a basename.

The file is written by `src/storage/releaseNotesFile.ts`, which decides where it goes and
whether it may be written at all. What it shares with the README is `writeGeneratedFile` in
`src/storage/readmeFile.ts` — the read-then-`process` race close, the BOM and carriage-return
trim, and the five outcomes — over one `mismatch` flag, because the two callers answer
differently about a generated file naming another source: the README REPLACES one (a renamed
base or view leaves it behind, and regenerating is the repair), and these notes REFUSE it (a
whole-file write over another release's notes is in no undo slot and cannot be taken back).
The output folder is declared in `src/domain/releaseOptions.ts`.
✨ binds it since
2026-08-30, which it could not before: a folder is not a property, so Obsidian's picker can
never offer one, and a vault that had bound everything the picker COULD offer still had no
route to this action. The candidate is in `RELEASE_SUGGESTED_VALUES`
(`src/view/release/init.ts`), the offer that decides whether the empty state's ✨ is drawn at
all is `anythingToBind` (`src/view/release/initControl.ts`), and `boundKeys` in
`src/view/release/newRelease.ts` is what reports the press as a change — it read property
keys alone, so a press whose only work was this folder compared equal, said it bound nothing
and skipped the redraw that would have drawn this very button.

The button and its gate are in `src/view/release/releaseClose.ts`, beside the other closing
action. The write takes the plugin-wide lock for its whole duration through
`src/view/writeGate.ts` — reading the lock is not taking one, and a sibling batch starting
mid-write would land this file from a membership that has since changed.

**A correction to extension 4e.** It lists "the folder does not exist" as a failure to
report; the folder is CREATED instead, because every write path in this plugin makes its own.
What holds of 4e is its second half: a write that fails reports the path it tried and leaves
nothing partial behind.
