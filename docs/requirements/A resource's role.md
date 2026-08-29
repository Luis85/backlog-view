---
type: PBI
parent: "[[What a resource carries]]"
order: 0
status: Open
created: 2026-08-20
source: user request
files:
  - src/domain/settings.ts
  - src/domain/settingsResolve.ts
  - src/domain/optionalProperties.ts
  - src/domain/viewOptions.ts
  - src/domain/readItems.ts
  - src/view/render/lanes.ts
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

# A resource's role

**As** a delivery lead, **I want** a resource to say what they do, **so that** a roster of
twenty names reads as a team rather than as a list of strangers, and the row I am about to
drop work into says whether that work is theirs to do.

One free string on the resource's note, drawn beside their name. **Not a vocabulary**, and
that is a decision rather than a shortcut: a role is a fact about a person that the vault
already knows how to write, and the plugin's one argument for declaring a vocabulary — that
something has to be assignable from a menu of legal values — does not apply, because nothing
writes a role. It is read and shown.

That is the same reasoning [[Setting the assignee on an item]] used for a name and the
opposite of [[Setting the risk on an item]]'s: risk is a short list a reader writes down once
and picks from; a role is written on the note by whoever knows it.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Opening the roadmap on the resources axis |
| **Preconditions** | The role key is configured |
| **Guarantee** | The role is read and drawn, never written and never validated. Whatever the note says is what appears |

**Main flow**

1. The user names a role property in the view options.
2. Each `Resource` note carries a string on that key.
3. The resource's row shows the role beside the name, subordinate to it — the name is what
   the row is, the role is what it adds.

**Extensions**

- **1a — the key is not configured.** Nothing is read and nothing is drawn.
- **2a — the note carries nothing on that key.** The row shows the name alone, with no empty
  space held for a role nobody stated.
- **2b — two resources carry the same role.** Nothing happens. Roles do not group, sort or
  lane the rows: that would be a different projection, and inventing it here would make a
  read-only string into an axis nobody asked for.
- **3a — the role is long.** It is truncated in the row and stays reachable, the same way
  every other caption in this view handles text longer than its room. A row is a fixed height
  and a role must not be able to change that.

## Acceptance criteria

- One key, one string, read as written. No vocabulary, no menu, no write path.
- With the key unconfigured, nothing is read or drawn.
- A resource with no role draws its name alone, and the row is the same height as every
  other.
- The role never groups, sorts, filters or lanes anything.
- A long role does not change the row's height, and is not the reason a name gets truncated
  first.
- The key joins the optional properties the toolbar's setup action binds and backfills
  ([[Backfill missing properties]]).

## Where it lives

**Nothing yet — this note is design.** It is the same shape as the capacity beside it, over a
string instead of a number.

`src/domain/settings.ts`, `src/domain/settingsResolve.ts` and `src/domain/viewOptions.ts`
carry the key · `src/domain/optionalProperties.ts` holds the suggested name and the backfill ·
`src/domain/readItems.ts` reads the string · `src/view/render/lanes.ts` draws it in the row
caption, where the truncation rule lives.
