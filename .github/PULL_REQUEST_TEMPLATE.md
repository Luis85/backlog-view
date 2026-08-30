## Summary

## Test plan

- [ ] `npm run check` passes locally (build, lint, markdown, coverage-thresholded tests,
      fallow, docs register) — CI runs the same six steps on Ubuntu **and** Windows.
- [ ] Every `src/` module touched is still specified in `docs/` (a use case's
      `## Where it lives`, or an ADR's `## Decision`), and any behaviour change is
      reflected in the relevant note.
- [ ] If this needs a live-vault check `npm run check` cannot run (appearance, drag and
      drop, base identity), say so and note what was verified with `npm run test-build`.
