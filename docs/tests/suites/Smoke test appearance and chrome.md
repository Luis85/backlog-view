---
type: Test suite
order: 40
status: Open
created: 2026-08-11
source: Test catalog migration
---

# Smoke test appearance and chrome

What a projection looks like rather than what it does: the stylesheet's own rules, the
controls Obsidian's defaults supply, and the disclosures and columns that read correctly
only in a themed vault. The browser harness draws all of it and asserts none of it
([ADR 0020](../../adrs/0020-the-browser-harness-draws-it-does-not-assert.md)), so every
case here needs eyes.
