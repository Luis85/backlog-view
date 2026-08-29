---
type: Issue
order: 530
parent: "[[Resource Management]]"
status: Done
priority: P3
area: storage
created: 2026-08-29
source: Codex review, PR #207
files:
  - src/storage/absenceNotes.ts
  - src/storage/frontmatter.ts
started: 2026-08-29
finished: 2026-08-29
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

**Fixed 2026-08-29.** Both writers now ask `refusesLiveAssignee` (`storage/frontmatter.ts`)
about `spec.resource` before anything is written — the ONE guard `applyWrites` already asked
it with, exported rather than restated. One and not two because it is one question asked of
one thing: an absence's resource and an item's assignee are the same link, to the same
`settings.assigneeKey`, about a note that may have been retyped out of `Resource` since the
form captured its roster. Two guards would be two places to keep the two cache rules below
in step, and neither writer has a better view of either than that function does.

What differs between the two paths is only what a refusal COSTS the caller, so only that is
spelled per path. `createAbsenceNote` returns `null` and nothing is created. `updateAbsenceNote`
returns which of three things happened (`AbsenceEdit`), because two different notes can move
under one open modal — the CARRIER retyped into a `Resource` (its existing refusal) or the
TARGET retyped out of one — and `editAbsence` must skip the rename under either: the title
spells the resource's name, so a rename after a refusal names the note for a fact never
written. Both target refusals report `absence.resourceMissing`, the sentence the roster race
already used: the reader's fact is the same either way, and the two differ only in which
index noticed.

**The guard is asked at the LAST moment before the write, not at the top of the function**,
and the first cut got that wrong — found by automated review on PR #209. Both writers await
before they write (`processFrontMatter` resolves its own I/O before running the callback;
`createAbsenceNote` awaits `ensureFolder`), so a synchronous check ahead of those awaits is a
check with a gap after it, and a retype landing in the gap writes the very link the guard
exists to refuse. The edit path asks inside the callback beside the carrier's own question;
the create path asks on the line before `vault.create`, which is as late as a caller can get.
That is `applyWrites`' own argument reached from the other side: it asks inside the callback
because that is where the value is READABLE, and this asks there because that is where the
answer is still TRUE.

**One ceiling remains and is stated rather than papered over.** `vault.create` takes no
callback, so a retype landing INSIDE that call is unreachable for any caller-side check. A
refusal on the create path can also leave behind the absence folder `ensureFolder` just made
— the folder the next absence would create anyway, and the accepted price of one check
instead of two.

**Below the register's own line about what jsdom reaches.** `test/view/absenceEditing.test.ts`
drives both paths with no `refresh` between the retype and the submit, so the MODEL still
lists the resource and only the vault knows — which is the state the guard exists for and the
one the earlier roster tests could not reach. A third test asks the un-indexed window through
`FakeVault.unindex` and expects the write to LAND, so the "no cache is no answer" rule has a
check rather than a comment. Two more retype DURING the write rather than before the submit,
through `FakeVault.beforeWrite` — fired by `processFrontMatter` on the edit path and by
`createFolder` on the create path, which is the await `createAbsenceNote` sits behind, and
which the fake had to learn to hook. All five were watched failing: the two refusals with the
guard call removed, the un-indexed one with `refusesLiveAssignee` reading a missing cache as
`true`, and the two interleaving ones with both guards back at the top of their functions.

The five live in `test/view/absenceRaces.test.ts` — a suite of their own since the split the
450-line budget forced, holding every refusal both flows make when the world moves under an
open form, with the three form gestures in `test/helpers/absences.ts` rather than copied.

**Not a regression, and it was not fixed at the time.** The absence writers never asked, before or after
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
