---
type: PBI
parent: "[[A catalog of tests]]"
order: 50
status: Open
priority: P3
created: 2026-08-08
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A template for a test case

**As** someone writing an end-to-end test, **I want** a new case to arrive with the shape a
test needs and open ready to write, **so that** the instructions get written while I am
thinking about them instead of being a blank note I meant to come back to.

This PBI is **two halves with different dependencies**, and saying which is which is most
of its content.

The half that is this note's own: [[New item flow]] deliberately does **not** open a
created note, because adding several items in a row is the common case. A `Test case` is
the exception, and for the reason [[Adding templates from the plugin]] already gives about
a template — the body *is* the item. A case whose steps are never written is not a test.
That behaviour depends on nothing and **can ship on its own**.

The half that is not: [[Item Templates]] specifies a per-type template keyed by
`templateForKey`, and a `Test case` is one more type that vocabulary covers with no change
of its own. That feature is design, not built (`status: Open`), so the template body cannot
land before it does — not because this PBI is blocked, but because there is nothing yet for
a `Test case` template to be *stored as*.

So: **not blocked, partially deliverable.** The opening ships whenever the type exists; the
skeleton arrives with templates. Ordering the two the other way round is what would be
wrong — a shaped note nobody opens is a document, and a blank note that opens is a test
somebody writes.

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
3. The note is **opened** for editing, unlike every other created item — after the write
   resolves, never beside it, since the file being opened is the write's own result.
4. The user writes the preconditions, the steps and the expected result, and never returns
   to the view unless they want to.

**Extensions**

- **2a — no template is configured, or `templatesFolder` is unset.** The note is created
  empty and still opens. The template is what saves typing the headings; the opening is
  what makes the note get written, and neither depends on the other.
- **2b — [[Item Templates]] has not been built yet.** Then step 2's second half does not
  exist and this PBI is the opening alone — the partial delivery its opening describes,
  and the one to ship first. The dependency runs one way only: templates make a case
  better-shaped, and nothing about the opening waits on them.
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
- A **failed** creation opens nothing. `createBacklogItem` can throw, and the existing path
  catches and reports it; the opening sits inside the success branch, so a vault that
  refused the write leaves the user where they were rather than in an empty tab.
- The opening happens whether or not a template applied, and whether or not
  `templatesFolder` is configured — which is what makes it deliverable before
  [[Item Templates]] exists, and is the criterion that would be untestable if this PBI
  were genuinely blocked on it.
- No new setting, no new folder option, and no template content shipped inside the
  plugin: a template is vault data, and `templatesFolder` is unset by default.
- The skeleton above lives in this register and in the user manual
  ([[Help for creating and filing]]), not in code. A default body baked into the plugin would
  be a template nobody can edit, competing with the one they can.

## Where it lives

**Nothing yet — this note is design.** The branch belongs in `createFromPrompt`
(`src/view/interactions/create.ts`), **immediately after its awaited `createBacklogItem`**,
which is the only place the created `TFile` exists. `src/ui/prompts.ts` is the wrong
address and an earlier draft of this note gave it: `TitlePromptModal` collects input and
hands it back through `onSubmit`, so a branch written there would have no file to open and
would run before the write it depends on had succeeded — opening nothing, or opening on a
creation that then failed.

The distinction is worth keeping in mind for anything else added here: the prompt owns
*what the user asked for*, and `createFromPrompt` owns *what happened*. Only the second can
answer a question about the note.

Nothing in `src/domain/` is involved: whether a note opens is not a fact about the backlog.
