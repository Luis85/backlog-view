---
type: PBI
parent: "[[Test harness and coverage]]"
order: 10
status: Done
---

# A test suite that can be navigated

The jsdom harness drives the real view through real DOM events, so the tests are worth
reading as documentation — which they only are if you can find the one you want.

## Acceptance criteria

- One file per subject, each with its own size budget, so the suite cannot grow a file
  that becomes the place tests hide.
- The hardest paths to drive are driven anyway: drag and drop is dispatched as real
  `dragstart`/`dragover`/`drop`, not called as functions.
- What the harness cannot check is stated rather than assumed.
