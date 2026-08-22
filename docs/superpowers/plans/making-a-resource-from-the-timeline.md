# Plan — Making a resource from the timeline

Implements `docs/requirements/Making a resource from the timeline.md` (read it; it is the
spec). Related: `docs/requirements/A resource is not a backlog item.md`,
`docs/requirements/What a resource carries.md`.

Branch: `claude/new-resource-from-timeline`, off `origin/main`.

## Global constraints

- `npm run check` (build, lint, coverage-thresholded tests, fallow, docs register) must
  pass before EVERY commit. Never lower a coverage threshold in `vitest.config.mts`.
- Any invariant asserted in a comment gets a test, and the test is WATCHED FAILING before
  it is kept: revert the change, run it, see red, restore. Report what you watched fail.
- Only `storage/createNote.ts`, `storage/frontmatter.ts`, `storage/propertyWrite.ts` and
  `storage/absenceNotes.ts` may put frontmatter or notes into the vault. Only
  `storage/` may call `vault.create` (a lint rule enforces it).
- The four gates that keep a `Resource` out of the backlog (`readItems`, `applyWrites`,
  `buildEstimationModel`, `applyPropertyWrites`) must not be weakened. `Resource` must
  NOT join `ALL_TYPES` or `MARKER_TYPES`.
- Layering: `main → commands → view → storage → domain`; `ui/` and `i18n/` are leaves.
- `src/**` files have a 400-line lint budget (blank/comment lines excluded); `test/**` 450.
  Effective headroom today: `prompts.ts` 52, `toolbarControls.ts` 33, `viewOptions.ts` 36.
- Every user-visible sentence in `src/ui/`, `src/view/**`, `src/domain/viewOptions.ts` goes
  through `t()` with a key in `src/i18n/en.ts`. Type names, option keys, folder paths and
  frontmatter values are DATA and stay out of the catalog.
- Any commit that adds a NEW module under `src/` must name that path in the spec note's
  `## Where it lives` in the same commit, or `docs-check` fails.

## Settled decisions (do not re-litigate)

- The control lives in the toolbar's projection zone (`renderProjectionZone`), gated on
  roadmap mode AND the resources axis. `renderStateColorsButton` is the precedent.
- The modal shows Name always; Capacity and Role only where those keys are configured.
  **Neither key exists in `BacklogSettings` today** ([[Capacity on a resource]] and
  [[A resource's role]] have not shipped), so today's modal is Name alone — the spec's
  extension 2a says that is the whole modal, not a degraded one. Do NOT build an empty
  field-list mechanism for keys that do not exist.
- A duplicate name warns and allows. An empty name is refused (nothing opens or writes).
- The folder is its own view option (`resourceFolder`), defaulting to
  `<homeFolder>/resources` — its own key, NOT a `typeFolder.*` one.
- The created note carries no `order` and no `parent`.
- A resource filed outside what the base returns gets no row: a stated limitation, never
  a detection mechanism. Build nothing for it.

## Task 1 — the folder view option, declared and resolved

Files: `src/domain/typeVocabulary.ts`, `src/domain/settings.ts`,
`src/domain/settingsResolve.ts`, `src/domain/viewOptions.ts`, `src/i18n/en.ts`, tests.

1. `typeVocabulary.ts`: export `DEFAULT_RESOURCE_SUBFOLDER = 'resources'` and
   `defaultResourceFolder(homeFolder = DEFAULT_HOME_FOLDER)` returning
   `homeFolder ? `${homeFolder}/resources` : 'resources'`. It belongs here for the same
   reason `defaultTypeFolder` does: this module says where a declared name's notes are
   filed. Its doc comment states WHY it is not a `typeFolder.*` key (that list is
   generated per `ALL_TYPES` entry and `Resource` is deliberately not in it).
2. `settings.ts`: `resourceFolder: string` on `BacklogSettings`, default
   `defaultResourceFolder()`. Document that `''` means "no folder of its own" and the
   caller falls back to the home folder — the ladder `absenceFolder` already uses.
3. `settingsResolve.ts`: resolve it inside `resolveFolders` beside `typeFolders`, so it
   tracks the RESOLVED home folder: `clearable('resourceFolder',
   defaultResourceFolder(homeFolder), () => vaultFolder(str('resourceFolder')))`.
   `clearable` because the default is a real value and clearing it must be possible.
4. `viewOptions.ts`: a `folder` option in `newItemsGroup`, key `resourceFolder`,
   `displayName: t('option.resourceFolder')`, `default: defaultResourceFolder(homeFolder)`,
   placeholder as the type-folder rows do.
5. Tests (`test/domain/`): the shipped default; that it follows a changed `homeFolder`;
   that a picked value is normalised through `vaultFolder`; that a cleared option resolves
   to `''` rather than back to the default. Also assert the OPTION is declared with that
   key (the schema and the resolver must agree — a key spelled twice can differ).

Verification: `npm run check` green; name the tests you watched fail.

## Task 2 — the modal

Files: `src/ui/prompts.ts`, `styles/modals.css`, `src/i18n/en.ts`, tests.

The Name-only prompt is `ValuePromptModal` already: one field, known values suggested,
anything typed accepted, an empty entry refused by staying open. Reuse it rather than
writing a fifth dialog — the spec's "a new dialog" prose was written for the three-field
version that Capacity and Role will need.

What it lacks is the warning. Add ONE optional member to `ValuePromptOptions`:
`duplicateWarning?: string` — a sentence shown under the field while the trimmed entry
matches a `known` value case-insensitively, cleared as soon as it does not. It warns and
never refuses. Keep the element in the DOM and empty (the `.pbl-modal-error` rule's own
reason: a dialog must not resize under the pointer), with a new `.pbl-modal-warning` rule
in `styles/modals.css` using `--text-warning`.

Tests (`test/ui/` or wherever prompt tests live today — find them): the warning appears
for a known name in another casing, is cleared when the name is edited away, is absent
when the option is not passed, and does NOT stop submission. Watch each fail.

## Task 3 — the creation write, and its config-gate refusal

Files: `src/storage/createNote.ts`, new `src/view/interactions/resourceNotes.ts`,
`src/i18n/en.ts`, `docs/requirements/Making a resource from the timeline.md`, tests.

1. `createNote.ts` gains `createResourceNote(app, settings, spec: {folder, title})`:
   `ensureFolder` → `uniqueNotePath` → one `vault.create` writing `settings.typeKey:
   RESOURCE_TYPE` through `setOwn` and NOTHING else. No `order`, no `parent` — not even
   folder mode's explicit-empty parent, because a resource is not on the tree at all.
   State that in the comment and test it (assert the created frontmatter has exactly the
   type key, with `folderHierarchy` ON so the parent branch would fire if it were reused).
   Do NOT call `createBacklogItem`: its `NewItemSpec` requires a parent, a rank and a
   ladder type, which is `createAbsenceNote`'s own stated reason for standing apart.
2. `view/interactions/resourceNotes.ts` — the view's half: `promptNewResource(host)`.
   - The `configProblems` gate runs FIRST, before the form (a Notice, and return), and
     AGAIN at submit — `interactions/absences.ts`'s `refusedByConfig` states why: the
     options pane stays reachable while a modal is up.
   - The folder is resolved at SUBMIT (`host.settings.resourceFolder ||
     host.settings.homeFolder`), never captured at open — `absenceFolder`'s rule.
   - `known` is the roster: the drawn `host.roadmap.lanes` names (skip `markers`) union
     `host.settings.resourceNames`, deduped. Pass `duplicateWarning`.
   - On success a Notice naming `file.basename` (never the requested title —
     `uniqueNotePath` may have suffixed it); on failure `console.error` plus a Notice.
     Both are `interactions/absences.ts`'s shape.
3. Update the spec note's `## Where it lives` (it currently says "Nothing yet") to name
   every path this branch touches, and its `files:` frontmatter, in the SAME commit.

Tests (`test/view/`): a created note carries the type key alone; the folder ladder;
a config problem refuses before opening AND at submit (nothing written); a cancel writes
nothing; the created note produces no item, no row and no count after a refresh
(A resource is not a backlog item's gate, asserted here as a consequence).

## Task 4 — the toolbar control and its gating

Files: `src/view/render/toolbarControls.ts`, `src/i18n/en.ts`, tests.

`renderNewResourceButton(host, zone)` in the `'roadmap'` case of `renderProjectionZone`,
after `renderStateColorsButton`. It draws only when
`activeAxis(host.settings, host.axisPick) === 'resources'`. Use `iconButton` like its
neighbours; pick an icon that no other control in the row wears (`users` is the axis's).
Click calls `promptNewResource(host)`.

Tests (`test/view/`): drawn on the resources axis; absent on the horizons axis, on the
dated axis, on the tree, on both boards; clicking it opens the prompt. Watch them fail.

## Task 5 — the register and the changelog

- The spec note: `status: Done`, `started`/`finished` `2026-08-22`, `files:` accurate,
  `## Where it lives` naming each module and saying what each contributes.
- `CHANGELOG.md`: an entry under `[Unreleased]`.
- State honestly in the note what still needs a live-vault check (the button's appearance
  in the row, the folder picker in Obsidian's options pane).
