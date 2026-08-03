---
type: Feature
parent: "[[Codebase health]]"
order: 10
status: Open
---

# Test harness and coverage

Obsidian cannot run in this repository, so the substitute is a jsdom harness driving the
real view through real DOM events, plus a small mock of the `obsidian` module.

**Outcome** — The suite is worth reading as documentation, and says out loud what it
cannot check.

## Acceptance criteria

- Coverage thresholds only ever go up.
- Test files carry their own size budget, so the one suite without a cap does not become
  the place tests hide.
- What the harness *cannot* check is said out loud rather than assumed.
