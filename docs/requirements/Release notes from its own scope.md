---
type: Feature
parent: "[[Release Management]]"
order: 80
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

# Release notes from its own scope

The members of a release are already a list of what shipped, grouped by a type each note
already declares. This feature turns that into Markdown the team can hand out — a note in the
vault, generated from the membership property and regenerated whenever it is asked for.

It is the most native thing in this epic. Jira, YouTrack, Azure DevOps and GitHub all draft
release notes from the work items and hand back HTML or Markdown to paste somewhere else;
here the paste target *is* the product, so the draft is simply a note.

**It writes a note the plugin owns, not a section of the release note.** The generated file
is written whole and overwritten whole, which is the shape [[A README in the backlog folder]]
already established for generated prose in this vault, and it is the shape that cannot eat
anybody's writing: there are no markers to parse, no boundary to drift, and no hand-written
paragraph inside the region the generator replaces. It says at its top that it is generated
and that edits to it do not survive, because with a whole-file write they do not. A team that
wants to add prose keeps it in the release note beside the link, where nothing regenerates.

**That is why the epic's own rule needed rewording rather than an exception.** *Nothing is
duplicated into the release* is a rule about **membership** — no list of members is ever
stored as the truth of what is in a release, because the property on the item is that truth.
A generated artifact is the opposite direction: it is derived from the property, it is
written and never read back, and no figure in this view is ever computed from it. Delete it
and nothing is lost but the file.

**Grouping is by the item's own type, and the order is the register's own.** Types come from
the type vocabulary the view already reads rather than a second list configured here, and
within a group the items are in `order`, so a release note and the backlog it came from tell
the same story in the same sequence.

**The output location is a key this view names for itself** — where the file goes, like every
other key this view reads ([[Settings scoped to their view]]). Unconfigured, the action is not
offered and says which key to bind, rather than picking a folder on the user's behalf.

**Outcome** — What shipped can be handed to somebody outside the vault without anybody
retyping the backlog.
