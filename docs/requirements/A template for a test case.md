---
type: PBI
parent: "[[A catalog of tests]]"
order: 30
status: Open
priority: P3
created: 2026-08-08
source: user request
---

# A template for a test case

**As** someone writing an end-to-end test, **I want** a new case to arrive with the shape a
test needs and open ready to write, **so that** the instructions get written while I am
thinking about them instead of being a blank note I meant to come back to.

Almost nothing here is new. [[Item Templates]] already specifies a per-type template keyed
by `templateForKey`, and a `Test case` is one more type that vocabulary covers with no
change — **that feature is design, not built** (`status: Open`), so this PBI is downstream
of it and cannot land first. What this note adds on top of it is one behaviour and one
skeleton.

The behaviour: [[New item flow]] deliberately does **not** open a created note, because
adding several items in a row is the common case. A `Test case` is the exception, and for
the reason [[Adding templates from the plugin]] already gives about a template — the body
*is* the item. A case whose steps are never written is not a test.

The skeleton, which a vault holds in its own template note rather than in this plugin:

```markdown
**Preconditions** — what must be true before the first step.

## Steps

1. …

**Expected result** — what the user should see when the last step is done.
```

## Use case

| | |
| --- | --- |
| **Actor** | Whoever maintains the test catalog |
| **Trigger** | Creating a `Test case` from a suite's **+**, or from the toolbar |
| **Preconditions** | None. A configured template changes what the note contains, never whether it can be created |
| **Guarantee** | Creating a test case writes one note and opens it. It never opens anything when the type is not `Test case`, so no other creation path changes behaviour. |

**Main flow**

1. The user opens **+** on a `Test suite` and names a case.
2. The note is created with `type`, `parent` and `order` as any item is
   ([[New item flow]]), and the body of the vault's `Test case` template if one is
   configured ([[Creating an item from a template]]).
3. The note is **opened** for editing, unlike every other created item.
4. The user writes the preconditions, the steps and the expected result, and never returns
   to the view unless they want to.

**Extensions**

- **2a — no template is configured, or `templatesFolder` is unset.** The note is created
  empty and still opens. The template is what saves typing the headings; the opening is
  what makes the note get written, and neither depends on the other.
- **2b — [[Item Templates]] has not been built yet.** Then step 2's second half does not
  exist and this PBI is the opening alone, which is a legitimate thing to ship first: a
  blank note that opens beats a shaped note nobody fills in. The dependency runs one way
  only, and saying so is what keeps this PBI from being blocked on a feature it merely
  benefits from.
- **3a — the user is creating several cases in a row.** They get several open notes, which
  is the cost of the exception and is why it is scoped to one type rather than made a
  setting. Nobody has asked for a batch of test cases; if they do, the setting is the
  answer and not a general "open on create".
- **4a — the user writes the steps somewhere other than the skeleton's headings.** Nothing
  reads them, so nothing breaks. The skeleton is a convention for the person walking the
  test, not a format the plugin parses — the epic refuses body parsing outright, and a
  heading the view depended on would be that refusal quietly reversed.

## Acceptance criteria

- Creating a `Test case` opens the created note; creating an `Epic`, `Feature`, `PBI`,
  `Task`, `Test suite` or any extra type does not. Both halves are asserted — the second
  is what stops this from becoming "creation opens notes now".
- The opening happens whether or not a template applied, and whether or not
  `templatesFolder` is configured.
- No new setting, no new folder option, and no template content shipped inside the
  plugin: a template is vault data, and `templatesFolder` is unset by default.
- The skeleton above lives in this register and in the user manual
  ([[Help for creating and filing]]), not in code. A default body baked into the plugin would
  be a template nobody can edit, competing with the one they can.

## Where it lives

**Nothing yet — this note is design.** The creation path is `src/ui/prompts.ts` and the
host method behind it; the one branch this PBI adds belongs where the note is created and
the decision not to open it is currently taken, so that the exception sits beside the rule
it excepts rather than in a caller. Nothing in `src/domain/` is involved: whether a note
opens is not a fact about the backlog.
