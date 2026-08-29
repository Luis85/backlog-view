---
type: Issue
order: 530
parent: "[[Resource Management]]"
status: Open
priority: P3
area: storage
created: 2026-08-29
source: Codex review, PR #207
files:
  - src/storage/absenceNotes.ts
  - src/storage/frontmatter.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# An absence names a resource nobody revalidates

`applyWrites` asks the LIVE type about an assignee target (`refusesLiveAssignee`), because
the plan carries a `TFile` its picker was built from and a note can be retyped between the
pick and the write. The absence writers ask nothing: `writeAbsence` and the edit path both
serialize the chosen resource unconditionally, so an absence written across that same
window links to an ordinary note and then draws in no lane at all — the form restricted the
choice to `Resource` notes and the result names one that is not.

**Not a regression, and not fixed here.** The absence writers never asked, before or after
[[An absence names its resource by link]]; the link only changed what gets written, not
what gets checked. Left open rather than folded into that increment, which was already the
third of three coupled use cases.

**What the fix has to know before it is written.** `refusesLiveAssignee` reads a MISSING
cache as no answer rather than the wrong one, because Obsidian fills the metadata cache
after `vault.create` resolves — a guard that reads `null` as "not a Resource" refuses every
freshly created note. Any check added here inherits that rule, and `FakeVault.create`
indexes synchronously, so the suite cannot meet the window by accident: `FakeVault.unindex`
is how a test asks for it.

**Cost while open.** A dead absence note, not a corrupt one: nothing else reads the link,
and retyping the note back makes the absence draw again.
