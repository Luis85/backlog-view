---
type: Feature
parent: "[[Release Management]]"
order: 32.5
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
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Shipping a release

A release ends. This feature is that moment: its status moves to a released value, and the
day it actually shipped is stamped on it — one small batch against the release note alone.

**The actual date is its own key, and it never touches the target date.** The target is a
plan and the stamp is a record, and [[Product Roadmap]] already decided that a plan may never
overwrite a record — planned dates and transition stamps are different keys there for exactly
this reason. Keeping both is what lets the view say a release shipped eleven days late; one
key would have thrown the question away in the act of answering it.

**Shipping refuses nothing.** [[Release readiness]] says what is not clear and blocks
nothing, and that holds here: a release ships with a criterion outstanding if that is the
decision, and the outstanding count is shown at the moment of the decision rather than used
as a veto. The checklist informs a judgement; it does not make one.

**The unfinished members are reported, and this feature does not move them.** Every tracker
prompts here — Jira offers to push unresolved work to the next version — and the prompt is
the right idea in the wrong place. The write it would perform is the membership write
[[Putting work in a release]] already owns, over the selection [[Bulk edits on a selection]]
already owns; a second path to it would be the register's own "one move, three inputs" rule
broken by the feature that quotes it. So shipping *names* what did not make it — how many
members, and which — and the reader moves them with the action that exists. It costs a second
undo step and buys no new write path, which is the trade this register takes every time.

**A batch spanning the members would also fail in a case that is not rare.** `applySafely`
refuses a whole batch if any write in it targets a note the base excluded, and a base that
hides done work excludes exactly the members a finished release is full of. A carryover batch
would be all-or-nothing against a filter nobody set with it in mind.

**Which values mean released is the vault's, so the view names the key and the list.** A
status key says where the state lives and nothing about which of its values is a shipped one
— the same two-part shape every criterion in [[Release readiness]] uses, and the same answer
when half of it is missing: a key bound with no value list is unconfigured, not empty, and
shipping is not offered at all.

**Outcome** — A release can be closed, the day it closed survives, and nothing about the plan
is lost in the closing.
