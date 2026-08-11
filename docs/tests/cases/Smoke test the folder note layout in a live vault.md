---
type: Test case
order: 20
parent: "[[Smoke test the platform and vault identity]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-01
source: Backlog as folder notes design
---

# Smoke test the folder note layout in a live vault

**Covers** [[Creating items]].

## Why this exists

[[Backlog as folder notes]] is the one option whose result is a shape on disk, and this
repository cannot see disk the way Obsidian does. The jsdom harness drives `FakeVault`,
whose caches are static and whose folders are a map — it can assert the path a creation
*asked for*, never that the file explorer shows a tree, that Obsidian's own folder-note
handling agrees, or that the base still returns the note afterwards. Opened in advance,
like [[Smoke test the board in a live vault]], because the gap is known before the work
starts and a verification remembered afterwards is one that gets skipped.

Run it in a `npm run test-build` vault once the option lands. `docs/` is the test data:
it is already a backlog, and it is already flat, so it exercises the mixed case from the
first item created.

**Preconditions** — the folder-notes option has landed; `npm run test-build` has
installed the plugin, and a Base is pointed at `docs/`, which is already flat.

## How to check

- **The shape** — a created item is `<container>/<Title>/<Title>.md`, the folder and note
  named identically, and the file explorer shows the item where the tree does.
- **Nesting** — a child created under a foldered parent lands *inside* its folder; a child
  created under a **flat** parent lands beside it and does not get a folder built around
  the parent. Both are correct, and seeing them next to each other is the point.
- **A nested Task** — Tasks get folders too, and the ladder clamps rather than stops, so
  a Task under a Task nests. This is the case whose noise the option's cost is about:
  look at `tasks/` afterwards and judge whether the toggle is worth having on.
- **The filter** — the note is still returned by the base it was created from. `inFolder`
  matches subfolders, which is what `docs/` already demonstrates, but the demonstration
  is a base written by hand and this is a note written by the plugin.
- **Inference on and off** — toggle `Infer hierarchy from folder notes` and confirm the
  tree is unchanged in both directions. This is the check the top-level marker exists for,
  and the one thing no unit test can prove, since it is a claim about two settings and a
  vault rather than about one function.
- **A move to the root, with the option off** — outdent a note that was created as a
  folder note, then turn inference on. It must stay at the top level: the marker is
  written from the note's own layout, not from the option's current state.
- **A failed creation** — if a failure can be provoked (a read-only folder, a name the
  filesystem rejects), confirm the folder it made is gone and a reused one is not
  ([[Failed creation leaves its folder behind]]).

## Acceptance criteria

- Every line above checked in a live vault. A behaviour that differs from
  [[Backlog as folder notes]] means the spec was wrong and gets corrected there — not
  patched around in the code, and not quietly left as a difference between what the
  register says and what the plugin does.
