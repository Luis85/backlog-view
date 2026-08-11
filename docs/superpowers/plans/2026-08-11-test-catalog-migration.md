# Test Catalog Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the register's 25 live-vault verifications out of `docs/issues/` and into the test catalog the 0.7.0 release publishes, so the plugin's own backlog uses the schema it ships.

**Architecture:** Five `Test suite` notes in `docs/tests/suites/` (three are retypes of Features that already exist), 25 `Test case` notes in `docs/tests/cases/`. `docs-check.mjs`'s cadence gate is widened *first*, because retyping the notes would otherwise switch it off silently. `RELEASING.md`'s sweep query changes one token so its folder scoping survives.

**Tech Stack:** Markdown register under `docs/`, `scripts/docs-check.mjs` (mdast-backed gate), vitest (`test/docs/checker*.test.ts` drive the real gate over planted trees).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-11-test-catalog-migration-design.md`. Read it before Task 1.
- **The gate is the test.** `npm run docs` validates every wikilink, every source path a current note names, the hierarchy and sibling orders. Every task ends with it green.
- **`npm run check` must pass before any commit** — build, lint, coverage-thresholded tests, fallow, docs register.
- **The sweep set stays derived, never listed.** `RELEASING.md` names a query; it must not gain an enumeration of the notes ([[A cadence for the checks CI cannot run]] acceptance criteria).
- **No note is renamed.** Every `[[wikilink]]` in this register resolves by basename, so moving folders is safe and renaming is not. The three existing suites keep the names they have.
- **Bodies are not rewritten.** Only the additions this plan names (a Preconditions line, and a Covers line on nine cases).
- **`cadence:` is carried over verbatim** on all 25. It is what the sweep reads and what the gate checks.
- This lands in the 0.7.0 release PR (#120), on branch `claude/obsidian-min-version-upgrade-7fpskt`, **before** anyone dates a 0.7.0 `Outcome`.

## File Structure

| Path | Responsibility |
| --- | --- |
| `scripts/docs-check.mjs` | Cadence gate widened from `Issue` to `Issue` **or** `Test case` |
| `test/docs/checkerRejects.test.ts` | Planted `Test case` carrying the heading with no cadence — must fail |
| `test/docs/checkerAccepts.test.ts` | Planted `Test case` carrying both — must pass |
| `docs/tests/suites/*.md` (5) | The suites. Root type, no `parent:` |
| `docs/tests/cases/*.md` (25) | The cases, moved from `docs/issues/` |
| `docs/requirements/Plugin Features Smoke Test.md` | Closed; its three children became suites |
| `RELEASING.md` | Sweep query re-scoped; the walk named as the Tests projection |
| `docs/README.md` | `issues/` row narrowed; `tests/` rows already describe the destination |

---

### Task 1: Stop the gate switching itself off

The cadence rule opens `if (note.type !== "Issue") continue;`. Retyping the notes in Task 3 would disable it on all 25 while `npm run docs` kept passing. This task must land first.

**Files:**
- Modify: `scripts/docs-check.mjs` (the verification-notes block, ~line 683)
- Test: `test/docs/checkerRejects.test.ts:401` (the `a verification and its cadence` describe block), `test/docs/checkerAccepts.test.ts:599`

**Interfaces:**
- Consumes: nothing.
- Produces: a gate that fails a `Test case` carrying `## How to check` with no `cadence:`. Tasks 3 and 4 rely on it to catch a note whose cadence was dropped in the move.

- [ ] **Step 1: Write the failing test**

In `test/docs/checkerRejects.test.ts`, inside the existing `a verification and its cadence` describe block, add a case using the same `verification` helper and `rejects` shape the three cases above it use. The helper writes an `Issue`; this one needs a `Test case` in the new folder, so build it explicitly:

```ts
rejects(
    'a Test case the sweep would find, leaving its cadence to be guessed',
    (files) => {
        files['docs/tests/suites/Smoke test the tree.md'] =
            '---\ntype: Test suite\norder: 10\nstatus: Open\n---\n\n# Smoke test the tree\n\nA suite.\n';
        files['docs/tests/cases/Look at the thing.md'] =
            '---\ntype: Test case\nparent: "[[Smoke test the tree]]"\norder: 10\nstatus: Open\n---\n\n# Look at the thing\n\n## How to check\n\nOpen it.\n';
    },
    'carries `## How to check` but no `cadence:`',
);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/docs/checkerRejects.test.ts -t 'leaving its cadence to be guessed'`
Expected: FAIL — the planted tree is *accepted*, because the gate skips every note whose type is not `Issue`. That failure is the defect this task exists for; read it before fixing.

- [ ] **Step 3: Widen the guard**

In `scripts/docs-check.mjs`, replace the loop guard:

```js
const SWEPT_TYPES = new Set(["Issue", "Test case"]);
for (const [, note] of notes) {
	if (!SWEPT_TYPES.has(note.type)) continue;
```

Both types, not a swap to `Test case`: `## How to check` in an `Issue` is a habit, and after this migration it means a verification filed in the wrong folder under the wrong type — worth failing rather than ignoring.

- [ ] **Step 4: Update the block comment**

The comment above it says the query is "the only thing in this repository leaning on an `Issue`'s shape". Amend it to say the sweep reads `docs/tests/cases/`, that the rule covers both types, and why both: an `Issue` carrying the heading is now a misfiling rather than a verification.

- [ ] **Step 5: Add the accepting case**

In `test/docs/checkerAccepts.test.ts`, beside the existing Issue case at line 599, plant the same suite and a `Test case` carrying **both** `## How to check` and `cadence: release`, and assert it is accepted.

- [ ] **Step 6: Run both checker suites**

Run: `npx vitest run test/docs/checkerAccepts.test.ts test/docs/checkerRejects.test.ts`
Expected: PASS, both files.

- [ ] **Step 7: Full gate and commit**

```bash
npm run check
git add scripts/docs-check.mjs test/docs/checkerAccepts.test.ts test/docs/checkerRejects.test.ts
git commit -m "Let the cadence gate see a Test case, before anything becomes one"
```

---

### Task 2: The five suites

**Files:**
- Move + modify: `docs/requirements/Smoke test the {tree,board,roadmap}.md` → `docs/tests/suites/`
- Create: `docs/tests/suites/Smoke test appearance and chrome.md`, `docs/tests/suites/Smoke test the platform and vault identity.md`
- Modify: `docs/requirements/Plugin Features Smoke Test.md`

**Interfaces:**
- Consumes: Task 1's widened gate.
- Produces: five `Test suite` notes, no `parent:`, orders 10/20/30/40/50. Tasks 3 and 4 parent every case to one of these five names.

- [ ] **Step 1: Move and retype the three that exist**

```bash
git mv "docs/requirements/Smoke test the tree.md" "docs/tests/suites/"
git mv "docs/requirements/Smoke test the board.md" "docs/tests/suites/"
git mv "docs/requirements/Smoke test the roadmap.md" "docs/tests/suites/"
```

In each: `type: Feature` → `type: Test suite`, and **delete the `parent:` line** — `Test suite` is in `ROOT_TYPES`, so a suite with a parent fails the gate. Keep `order` (10, 20, 30), `status`, `created`, `source` and the whole body. **Do not rename them**: 16 cases name them in `parent:` and other notes wikilink them.

- [ ] **Step 2: Create the two new suites**

`docs/tests/suites/Smoke test appearance and chrome.md`:

```markdown
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
```

`docs/tests/suites/Smoke test the platform and vault identity.md`:

```markdown
---
type: Test suite
order: 50
status: Open
created: 2026-08-11
source: Test catalog migration
---

# Smoke test the platform and vault identity

The cases a desktop cannot answer alone: a touch device, a folder-note vault, what
Obsidian's own parser does with a frontmatter link, and whether state keyed to a base
survives that base being renamed. These are about the host and the vault rather than
about a projection, which is why they are one suite and not spread through the other four.
```

- [ ] **Step 3: Close the Epic**

`docs/requirements/Plugin Features Smoke Test.md` keeps its frontmatter shape but becomes `status: Done` with a `closed: 2026-08-11` line, and gains a closing paragraph:

```markdown
**Closed by the test catalog (2026-08-11).** Its three children — [[Smoke test the tree]],
[[Smoke test the board]] and [[Smoke test the roadmap]] — are `Test suite` notes now, roots
of the catalog rather than a branch of the plan. That is [[Tests stay out of the plan]]
applied to the one Epic that was holding tests, and it is why this note is closed rather
than re-parented: an Epic whose whole purpose was to group smoke tests has no purpose once
they group themselves.
```

- [ ] **Step 4: Run the gate**

Run: `npm run docs`
Expected: FAIL, loudly — the 16 cases still in `docs/issues/` name suites whose type changed, and an `Issue` cannot hang off a `Test suite`. **This failure is expected and is fixed by Task 3.** Read it to confirm it names the hierarchy and nothing else; if it reports a missing wikilink, a suite got renamed and must be restored.

- [ ] **Step 5: Commit the intermediate state**

The register is deliberately inconsistent between Tasks 2 and 3, so commit without the gate green and say so:

```bash
git add -A
git commit -m "Make the three smoke-test Features into suites, and close the Epic over them

npm run docs fails here on purpose: the cases still sit in docs/issues/ as
Issues under what are now Test suites. Task 3 moves them."
```

---

### Task 3: The 16 cases already under those suites

**Files:** move 16 notes from `docs/issues/` to `docs/tests/cases/`.

**Interfaces:**
- Consumes: the five suite names from Task 2.
- Produces: 16 `Test case` notes. Task 5's re-scoped query reads their folder.

- [ ] **Step 1: Move them**

```bash
mkdir -p docs/tests/cases
for f in "Tree badges and icons" "Tree columns and narrowing" \
  "Tree drag between siblings and into a parent" "Tree keyboard moves" \
  "Tree context menu" "Tree quick filter and Show completed items" "Tree undo" \
  "Parent links Obsidian parsed, and ones it did not" \
  "Board columns and the filtered header" "Board card carrying hidden matches" \
  "Board card moves" \
  "Roadmap axis picker and bucket drag" "Roadmap dated axis month header" \
  "Roadmap inferred bar appearance" "Roadmap milestone appearance" \
  "Roadmap legend with two workflows"; do
  git mv "docs/issues/$f.md" "docs/tests/cases/$f.md"
done
```

- [ ] **Step 2: Retype each**

In all 16: `type: Issue` → `type: Test case`. **Change nothing else in the frontmatter** — `parent`, `order`, `status`, `cadence`, `priority`, `area`, `created`, `source` all carry over. `parent` already names the right suite.

- [ ] **Step 3: Add a Preconditions line to each**

Immediately above each note's `## How to check` heading, add one bold line stating what must be true before the first step. Take it from what the note already says rather than inventing it — most state it in their opening paragraph. Two worked examples:

```markdown
**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.
```

```markdown
**Preconditions** — as above, plus a community theme installed and selectable, since this
case is about what a theme replaces.
```

- [ ] **Step 4: Run the gate**

Run: `npm run docs`
Expected: still FAIL, now only on the **nine** cases in `docs/issues/` whose parents are plan items — those are legal (an `Issue` under a `PBI`) — so in fact expect PASS unless a retype was missed. If it fails, read whether it names a hierarchy problem (a case that kept `type: Issue`) or a path (Task 5's job).

- [ ] **Step 5: Commit**

```bash
npm run check
git add -A
git commit -m "Move the tree, board and roadmap checks into the catalog as Test cases"
```

---

### Task 4: The nine cases that hang off plan items

Reparenting these severs the only link between a feature and the check that proves it, and the coverage property that replaces it is not built. Each gains a `Covers` line naming what it used to hang under.

**Files:** move 9 notes from `docs/issues/` to `docs/tests/cases/`.

**Interfaces:**
- Consumes: the two new suite names from Task 2.
- Produces: the last 9 `Test case` notes. After this, `docs/issues/` holds no note carrying `## How to check`.

- [ ] **Step 1: Move them, and record where each came from**

| Case | Was parented to | New suite |
| --- | --- | --- |
| Smoke test the visual changes | Product Backlog | Smoke test appearance and chrome |
| Smoke test the four button-specificity fixes in a live vault | Children on the card | Smoke test appearance and chrome |
| Smoke test the card children in a live vault | Children on the card | Smoke test appearance and chrome |
| Smoke test the column agreements | WIP limits | Smoke test appearance and chrome |
| Smoke test the board in a live vault | Product Kanban | Smoke test the board |
| Smoke test the writable timeline | Product Backlog | Smoke test the roadmap |
| Smoke test the touch paths on a phone | Verifications a device has to answer | Smoke test the platform and vault identity |
| Smoke test the folder note layout in a live vault | Creating items | Smoke test the platform and vault identity |
| Parent links … *(already moved in Task 3)* | — | — |
| Verify base identity in a live vault | Collapse persistence | Smoke test the platform and vault identity |

```bash
for f in "Smoke test the visual changes" \
  "Smoke test the four button-specificity fixes in a live vault" \
  "Smoke test the card children in a live vault" "Smoke test the column agreements" \
  "Smoke test the board in a live vault" "Smoke test the writable timeline" \
  "Smoke test the touch paths on a phone" \
  "Smoke test the folder note layout in a live vault" \
  "Verify base identity in a live vault"; do
  git mv "docs/issues/$f.md" "docs/tests/cases/$f.md"
done
```

- [ ] **Step 2: Retype and re-parent each**

`type: Issue` → `type: Test case`, and `parent:` → the suite from the table. Give each an `order` that does not collide with its new siblings (10, 20, 30, 40 within each suite). Keep `cadence` verbatim — including `conditional` on `Verify base identity in a live vault`, which is the one case that is **not** in the release sweep.

- [ ] **Step 3: Add the Covers line to each**

Directly under the `# ` title, before the first section:

```markdown
**Covers** [[WIP limits]].
```

using the plan item from the table's middle column. Prose and not frontmatter: the coverage property is not bound, and inventing a key ahead of the feature that owns it is the drift this register keeps writing notes about. When [[Linking a test to what it covers]] ships, these lines are its input.

- [ ] **Step 4: Add the Preconditions line**

Same rule as Task 3 Step 3. `Smoke test the touch paths on a phone` states a real one — a physical device — and must say so.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run docs   # expect PASS on hierarchy; path failures are Task 5
npm run check
git add -A
git commit -m "Move the last nine checks into the catalog, each naming what it covers"
```

---

### Task 5: The sweep, the register's own docs, and every broken path

**Files:** `RELEASING.md`, `docs/README.md`, plus whatever the two greps below return.

**Interfaces:**
- Consumes: all 25 cases in `docs/tests/cases/`.
- Produces: a green `npm run check`, and a release sweep pointed at the new folder.

- [ ] **Step 1: Re-scope the sweep query**

`RELEASING.md:110` — change the folder and nothing else:

```bash
grep -rlxZ "## How to check" docs/tests/cases/ |
  xargs -0 awk 'FNR==1{fm=0;hit=0} /^---$/{fm++} fm==1 && !hit && /^cadence: release$/{print FILENAME; hit=1}'
```

The paragraph below it explaining why the query is scoped by folder rather than by heading or type stays **exactly as written** — the reason (`docs/superpowers/` quotes draft notes verbatim) is unchanged by the move. Update only the folder name where the prose names `docs/issues/`.

- [ ] **Step 2: Name the walk**

Add to step 2 of `RELEASING.md`, after the `npm run test-build` line: the sweep is walked in the vault's **Tests** projection — open `docs/Product Backlog.base`, switch to Tests, walk each suite top to bottom. The grep stays authoritative for "did we miss one", because a projection cannot be run from a terminal.

- [ ] **Step 3: Run the query and confirm it returns 24**

Run the block from Step 1.
Expected: 24 paths, all under `docs/tests/cases/`, and `Verify base identity in a live vault` absent (it is `conditional`). A count other than 24 means a `cadence` was dropped in a move — Task 1's gate should already have failed, so investigate rather than adjust the number.

- [ ] **Step 4: Narrow the `docs/README.md` folder table**

The `issues/` row currently reads "Open questions, verifications and recorded decisions". Drop "verifications" — they are the `tests/` rows now. Add a sentence under the table saying the catalog holds the checks CI cannot run, and that `RELEASING.md`'s sweep reads `tests/cases/`.

- [ ] **Step 5: Find and fix every stale path**

Two greps, because an enumeration written here would be stale by the time it is read:

```bash
# Inbound: anything naming one of these notes at its old path
grep -rn "docs/issues/" --include=*.ts --include=*.css --include=*.mjs --include=*.md \
  --exclude-dir=node_modules --exclude-dir=.git . | grep -v "^./docs/superpowers"

# Outbound: relative links inside the moved notes, which are now one level deeper
grep -rn "](\.\./" docs/tests/cases/ docs/tests/suites/
```

For the first: any hit naming a note that moved becomes `docs/tests/cases/<name>.md`. Known at time of writing: `styles/toolbarFit.css`, `docs/requirements/Layout survives translated text.md`, `docs/adrs/0020-the-browser-harness-draws-it-does-not-assert.md`, `docs/requirements/Cross-cutting concerns.md`, `docs/requirements/A browser harness without Obsidian.md`, `docs/requirements/A cadence for the checks CI cannot run.md`. Hits naming notes that did **not** move are correct and left alone.

For the second: `../requirements/X` resolved from `docs/issues/` and must become `../../requirements/X` from `docs/tests/cases/`.

- [ ] **Step 6: Full gate**

Run: `npm run check`
Expected: PASS, all five steps. `npm run docs` is the one that proves the migration — it validates every wikilink and every source path a current note names, so a missed citation fails here rather than in a reader's face.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "Point the release sweep at the catalog, and repair the paths the move broke"
git push origin claude/obsidian-min-version-upgrade-7fpskt
```

- [ ] **Step 8: Update the pull request body**

#120's test plan names the sweep and says it reads `docs/issues/`. Correct it to the new folder, and to the Tests-projection walk. The body currently enumerates the 24 notes — **delete that enumeration**: the register's own acceptance criterion is that the set is derived and never listed, and a list in a PR body goes stale the same way one in `RELEASING.md` would.

---

## Self-review

**Spec coverage.** Suites (T2), the 25 moves and retypes (T3, T4), Preconditions (T3 S3, T4 S4), `cadence` carried verbatim (T3 S2, T4 S2), the gate that would switch itself off (T1), checker tests both directions (T1 S1, S5), sweep re-scoped with 2f's reason intact (T5 S1), Tests projection named as the walk (T5 S2), `docs/README.md` (T5 S4), relative links and inbound citations (T5 S5), the Epic (T2 S3), the nine severed plan links (T4 S3). Out-of-scope items in the spec — coverage property, test-state migration, cadence change — have no task, correctly.

**Deviation from the approved design, and why.** The design named the suites *The tree in a live vault* and so on. The plan keeps `Smoke test the tree`/`board`/`roadmap`, because those notes already exist as Features with 16 children naming them in `parent:` and other notes wikilinking them; renaming buys a nicer title and costs every one of those links. The two new suites take the same prefix so the five read as one set.

**Placeholders.** None. The two greps in T5 S5 are deliberate derivations, not TODOs — with the known hits named so an implementer can tell a complete run from an empty one.

**Order deviation from this plan's literal numbers, and why.** `docs-check.mjs` scopes
root sibling-order across **all** root types together, not per type, so the plan's literal
10/20/30/40/50 for the five suites collided with the existing roots `Product Backlog`,
`Product Roadmap` and `Product Kanban`. Landed values are suites 31/32/33/40/50, and
per-suite case orders run to 80 (tree, after Task 4's reparented case) and 60 (roadmap),
not the 10/20/30/40 written above — chosen to clear the same collision and to leave gaps
for cases not yet imagined. The numbering is coherent and gate-verified; only this plan's
literal numbers are stale.

**Type consistency.** `SWEPT_TYPES` is defined in T1 S3 and used nowhere else. Suite names are fixed in T2 and referenced identically in T3 and T4's tables.
