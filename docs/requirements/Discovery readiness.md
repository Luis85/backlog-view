---
type: Feature
parent: "[[Product Discovery]]"
order: 70
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Discovery readiness

A checklist against the opportunity in hand: is the problem defined, the target user
identified, evidence attached, assumptions captured, validation complete, the expected
outcome stated. Each answer is derived from properties and links the vault already has;
none of it is a score, and nothing is refused for failing it.

**Each check states its input and what passes it**, because "is the problem defined" is a
question two implementations answer differently. Five of the six are the same shape: the
check names one key this view configures — problem, target user, evidence, assumptions,
expected outcome — and **passes when that key holds a non-empty value**, which for a link
property means at least one link, resolving or not. Whitespace is empty; a broken link is
still an answer, since the checklist reports what somebody wrote and repairing links is
another view's job. A key nobody configured makes its check **unconfigured, not failed** —
the same distinction [[Rules that say what is wrong]] draws, and for the same reason.

**Validation complete is the one that is not a presence test**, so it is stated separately.
It reads the assumptions linked from this opportunity, the validation state key and the
values that count as **settled** — both named by this view — and passes when every linked
assumption holds one of them. One unsettled assumption fails it, which is the whole point of
capturing them. An opportunity with **no** assumptions linked does not pass it: nothing was
checked, so the check reads as unanswered beside the assumptions check that already failed,
and never as a tick earned by an empty list.

**Outcome** — Someone deciding whether to promote an opportunity can see what is still
missing rather than guessing.
