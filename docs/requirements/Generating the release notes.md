---
type: PBI
parent: "[[Release notes from its own scope]]"
order: 10
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Generating the release notes

**As** someone who has just shipped, **I want** the release's members written out as a Markdown
note grouped by type, **so that** I can hand out what shipped without retyping the backlog.

Nothing yet. The work reuses the generated-file shape [[A README in the backlog folder]] built:
one file the plugin owns, written whole.

## Use case

| | |
| --- | --- |
| **Actor** | Someone who has just shipped |
| **Trigger** | Choosing to generate the release notes for the open release |
| **Preconditions** | The membership property and the output folder are configured |
| **Guarantee** | One note is written whole, derived from the members and from nothing stored. It is never read back by any figure in this view, and no other note is touched. |

**Main flow**

1. The view collects the members of the open release.
2. It groups them by each note's own type, using the type vocabulary the view already reads.
3. Within each group it orders them by `order`, so the notes and the backlog tell the same
   story in the same sequence.
4. It writes one note into the configured folder, named for the release, opening with a line
   saying it is generated and that edits to it do not survive.
5. It opens the note, so the result is looked at rather than reported.

**Extensions**

- **1a — the release has no members.** The note is still written and says the release contained
  nothing, rather than being absent. An empty release notes file is a fact; a missing one is
  ambiguous.
- **1b — a member is outside the Base's filter.** It is left out, and the note says how many
  were left out. The view reports what the Base returned, and it says when that is less than
  the whole.
- **2a — a member's type is not in the vocabulary.** It is grouped under an "other" heading
  rather than dropped, because a note that quietly omits work is worse than an untidy heading.
- **4a — a note of that name already exists in the folder.** It is overwritten whole. That is
  the point of a generated file, and it is why the file says so at its top.
- **4b — the note that exists is not one this plugin generated** — no generated marker at its
  top. It is not overwritten; the action refuses and names the file, because a whole-file write
  over somebody's prose cannot be undone by the undo slot.
- **4c — the output folder is unconfigured.** The action is not offered, and it says which
  option to bind rather than choosing a folder on the user's behalf.
- **4d — the folder does not exist, or the write fails.** The failure is reported with the path
  it tried, and nothing partial is left behind.
- **5a — the note cannot be opened.** It has still been written; opening is a convenience, not
  part of the guarantee.

## Acceptance criteria

- The generated note contains exactly the members, grouped by type, ordered by `order` within
  each group.
- Its first lines say it is generated and that edits do not survive regeneration.
- Regenerating twice over an unchanged release produces a byte-identical file.
- A file at that path carrying the generated marker is overwritten; one without it is refused
  and named.
- No figure anywhere in this view is computed from the generated file.
- With the output folder unconfigured, the action is absent and names the option.

## Where it lives

The text is composed in `src/domain/`, beside `src/domain/readmeText.ts` and shaped like it,
from the model in `src/domain/model.ts` and the vocabulary in
`src/domain/typeVocabulary.ts`. The marker that tells a generated file from a hand-written one
is `src/domain/readmeMarker.ts`. The file is written by a new module in `src/storage/`, beside
`src/storage/readmeFile.ts` — the only directory that may put bytes in the vault — and the
output folder is declared in `src/domain/viewOptions.ts`.
