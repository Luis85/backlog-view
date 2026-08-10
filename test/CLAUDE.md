# Tests — harness guide

Obsidian cannot run here, so the jsdom harness below is the substitute; say so honestly
when a change still needs a live-vault smoke test — and when the question is what a
change *looks* like, build the browser harness and look, rather than guessing from
markup assertions (see **Looking at it**, at the end). The two test rules that bind while you
are editing `src/` — the `test/**` lint budget and "an invariant asserted in a comment gets
a watched-failing test" — stay in [`../CLAUDE.md`](../CLAUDE.md).

- `test/helpers/obsidian-mock.ts` — runtime stand-in for the `obsidian` module (aliased in
  `vitest.config.mts`). Extend it when new obsidian API surface is used; keep it minimal.
- `test/helpers/dom.ts` — installs Obsidian's DOM prototype extensions (`createEl`,
  `addClass`, `setCssProps`, …) for jsdom files. Call `installObsidianDom()` at module top.
  **`createSvg` is deliberately STRICTER than its HTML siblings, because Obsidian's is.**
  `addClass` lives on `HTMLElement`, so an SVG node's `cls` goes straight to
  `classList.add`, which rejects a space-separated string with `InvalidCharacterError`
  where `createEl` would have split it. Sharing the HTML helper's option handling made
  this fake KINDER than the real thing, and it cost a shipped bug: a two-class arrow path
  threw in a vault on every conflicting edge, and because the throw aborted the render
  before `wireTimelineDrag` ran, the timeline's grid never registered its drop target —
  so dragging a bar silently did nothing and the only way to reschedule was the menu. The
  suite and the browser harness both drew it without complaint, because both run on this
  file. Pass an array; it is the form that works in both — and a lint rule now bans the
  string spelling at the call (`SVG_CLASS_TOKENS` in `eslint.config.mjs`), because a
  faithful fake only catches a path some test drives and this one was reached by none.
- `test/helpers/vault.ts` — `FakeVault` (metadata cache, vault, `processFrontMatter`, workspace
  recorder) and `FakeViewConfig` (records `set()` calls). Assert writes via
  `vault.fm(path)` / `vault.writeLog`; assert navigation via `vault.opened`.
- `test/helpers/view.ts` — the view harness every `test/view/*.test.ts` file shares:
  `makeView`, `refresh`, `fixture`, the row/tree accessors, `drag`, `key`, `stubRect`,
  `flush`, `submitPrompt`, and `useViewHarness()` for the per-test reset. Call
  `useViewHarness()` at the top of the file; the helper installs no hooks by itself.
- `test/helpers/register.ts` — a whole miniature repository (`docs/`, `src/`, `test/`)
  written to a throwaway directory and handed to the REAL `docs-check.mjs` as a subprocess.
  The gate is a script — top-level await, paths relative to the working directory,
  `process.exit` for its verdict — so it is run the way CI runs it rather than refactored
  into something importable; a seam built for the test is the thing that would get tested.
  `baseRegister()` is one valid tree and every case is a single delta against it, so a
  failure names a rule rather than a document.
- View tests (`test/view/*.test.ts`, one file per subject) drive REAL interactions: dispatch
  `dragstart`/`dragover`/`drop` (stub `getBoundingClientRect` for drop zones — jsdom returns
  zeros, and `dataTransfer` is absent unless the test supplies one), `keydown`, `click`,
  `contextmenu` (grab the menu via `Menu.lastShown`). Async writes need `await flush()`.
- Known harness limits: nothing refreshes on its own — a write updates the vault and no
  `onDataUpdated` follows, so a test that wants to see the result RE-RENDERED calls
  `refresh(view, vault)` (or sets `vault.afterWrite`, which is how a Bases update is
  interleaved with a batch). The model it rebuilds does see the write: `addFile` gives
  the metadata cache the same frontmatter object `processFrontMatter` mutates — verified
  2026-08-02, after this line claimed for months that the caches were static and cost a
  legitimate test that was deleted rather than driven. A note added with NO frontmatter
  is the real exception: the cache never gets an object for it, so writes to it stay
  invisible to the model. `entry.getValue()` returns null, so property chips render empty
  in tests.
- `addFile` fills `frontmatterLinks` only through its `parentLink` option, and a faithful
  parent fixture is decided by TWO questions, not one — is the value bracketed, and does it
  resolve. Both measured in a vault (2026-08-08), in two runs and in both directions: a
  plain `[[Name]]` link that RESOLVES has a `frontmatterLinks` entry, and one that resolves
  to NOTHING has none — so for that spelling, Obsidian indexes a frontmatter link exactly
  when it resolves. The alias and heading-ref spellings were never read from the cache, so
  the rule below is stated for the form that was measured and assumed for the other two. The
  second half was checked only after review pointed out that the first had been written as
  a biconditional off one run — `docs/issues/The fake vault can hold a cache Obsidian would
  not produce.md` records both, and what each covers.
  - **`parent: Epic`, a bare name.** Never a link, so never indexed, whether or not an
    `Epic.md` exists. Write it into `frontmatter` — always. This is the raw fallback's
    stated purpose and the shape `resolveParent`'s own comment names.
  - **`[[Epic]]` where `Epic.md` exists.** Indexed, so `parentLink: 'Epic'` — and writing
    the brackets into `frontmatter` beside a real `Epic.md` builds a cache no vault hands
    out. Measured for the plain `[[Name]]` form; the alias and heading-ref spellings were
    watched parenting correctly in the tree but never had their cache read, which is a
    weaker statement about the same mechanism rather than a second open question.
  - **`[[No Such Note]]`.** A link that resolves to nothing has no entry at all, so a raw
    bracketed value with no such file added is exactly what a vault produces.

  The trap is reading this as "it resolves, so use `parentLink`" and converting a
  bare-name fixture — `model.test.ts`'s `Plain.md` is one, and moving it would bypass the
  branch it exists to cover. Bracketing decides the path; resolution only decides which
  bracketed spelling is honest. (Found by review, on the version of this bullet that had
  just been rewritten to fix the opposite error.)

  None of the three measures the fallback's bracket STRIPPING, which has no observable
  effect in a vault — the reasoning is in `docs/issues/The fake vault can hold a cache
  Obsidian would not produce.md` and beside the test in `test/domain/model.test.ts`.

## Looking at it

`npm run harness` bundles the REAL view into a static page — no Obsidian, no server, no
browser-automation dependency — and prints a `file://` URL. `?view=board`,
`?view=roadmap` and `?view=deliverables` open straight into a projection and `?theme=light` into the light scheme,
so a headless screenshot of a URL needs nothing to click; a corner toggle switches the
scheme by hand, and it is the harness's furniture rather than the view's. The toolbar switches projections, and the drags, menu entries and
keyboard moves are the view's own — but the menu and dialog WIDGETS are drawn by
`test/harness/chrome.ts`, because the module mock records a `Menu`/`Modal` and renders
nothing. What they contain and what they do is the view's; what they look like is not
Obsidian's.

- `test/harness/mount.ts` — mounts `ProductBacklogView` against `demoVault()`, re-rendering
  once a batch of writes stops. `test/harness/page.ts` is the bundle entry and is two
  statements, so everything real is reachable from a test — and it is the DEFAULT entry,
  not the only one: `npm run harness -- test/harness/mock.ts` bundles another, which is how
  a projection that does not exist yet gets hand-drawn markup into the real stylesheet
  before it is built. Leave such a file uncommitted; nothing imports it, so `npm run
  analyze` reports it dead, correctly.
- `test/helpers/fixtures.ts` — the demo backlog and the view options that configure all
  four projections at once. A fourth fixture, not a replacement: the per-suite ones stay
  four notes each on purpose. `demoVault('folders')` — `?fixture=folders`, mounted with
  `folderOptions()` — is the SAME backlog filed the way a folder-note vault files it:
  every note the note of its own folder, one noteless container folder on the way down,
  and no `parent` key anywhere, so folder inference is the only thing placing a row.
  Layout is a separate argument from the notes for exactly that reason — a second list of
  notes could not show that the two trees come out the same.
- **A change that visibly alters the view puts its cases in a FIXTURE, not in a mock.**
  In `demoVault()` where the case belongs in the everyday picture; in a named variant —
  `edgeCaseVault()`, reached by `?fixture=edges` — where it would distort it, which is
  what a clipped bar does: clipping needs the window past `MAX_TIMELINE_DAYS`, and that
  clamp squeezes every other bar in the demo. An uncommitted `mock.ts` is for markup no
  code produces yet; the moment code produces it, the case belongs somewhere the harness
  can be pointed at and a test can assert exists.
  What checks this is narrower than the rule, and the gap is the point:
  `test/harness/harness.test.ts` asserts each fixture RENDERS the cases it exists for, so
  a deleted note or a renamed class fails. Nothing checks that a contributor remembered
  the rule — a register gate for it was considered and would have to guess which changes
  are "visible".
- `test/harness/chrome.ts` — patches the mock's `Menu` and `Modal` to appear, from the
  harness rather than in the mock, so the 68 files asserting through `lastShown` /
  `lastOpened` measure exactly what they did before.
- `test/harness/icons.ts` — draws the real lucide glyph for each `setIcon` name, through
  `setIconRenderer`, the one hook the mock exposes; by default the mock still only
  records `data-icon`, so the suite is untouched. An unresolvable name is marked rather
  than skipped, because a blank control in the tool built for looking is the one failure
  nobody would see.
- Its own checks live in `test/harness/harness.test.ts` — it still mounts, each fixture
  still draws the cases it exists for, and every icon name the view asks for across all
  four projections still resolves. `test/harness/themeStub.test.ts` is the separate
  subject: whether the two linked sheets BETWEEN them resolve every value the partials ask
  the page for, per scheme. `test/helpers/cssVars.ts` is how it reads them, and each rule
  in it came from a review round on PR #125 — follow a value's own references rather than
  check that a name is declared; skip a block under a wrapper like `@media print`; accept
  a rule when ANY selector in its comma-separated list matches; take a `var()` fallback as
  the one branch it is, at a use site as at a declaration; and look for dependency cycles
  per ELEMENT, since a reference across `:root` and `body` is inheritance rather than a
  dependency. Three of those were live defects in the check; the rest were correct about
  CSS with nothing in either sheet exhibiting them, and say so where they are stated.

**What it is faithful about:** markup, the CSS the partials write for themselves, every
interaction, and icon SHAPES — lucide's own, sized through the `.svg-icon` class the
partials style, and — since 2026-08-10 — Obsidian's own DEFAULT colours. **What it is
not:** a user's colours, and any layout a partial leans on an Obsidian element default to
supply rather than writing itself. Two files answer that now, in order:
`test/harness/obsidian.css` is Obsidian's REAL app.css, reduced to the rules the harness
exercises (its header states what was kept and why), and `test/harness/theme.css` carries
the harness's own chrome — the leaf frame, the menu and modal widgets, the missing-icon
marker — and, since 2026-08-10, no Obsidian value at all. Loading the real sheet first is what makes an
element default present at all rather than approximated: a card-children disclosure whose
toggle rendered as a centred, boxed native button shipped looking right here and wrong in
a vault (2026-08-08), because the stub then had no `button` rule and nothing had guessed
one. That episode is also why the stub no longer carries hand-written element defaults —
a guessed baseline beside a real one is two answers to one question. That sentence was
written before it was true: `.svg-icon`, `.clickable-icon` and its hover state stayed on
until 2026-08-10, overriding app.css's real padding (4px vs 4px 6px) and hover colour,
because the pass that deleted the stub's redundant COLOURS compared custom properties and
could not see an ordinary declaration. `themeStub.test.ts` now refuses any rule here that
restates a declaration app.css already makes for the same selector — with no exemption for
variables, which is the second half of the same episode: that check first spared the
palette copy as "identical and deliberate", and review pointed out that identical is the
best case rather than the safe one. The stub loads second and spelled the theme classes
`body.theme-dark`, outranking app.css's `.theme-dark`, so the copy won the cascade
everywhere and the day a newer app.css is vendored in it would go on winning with stale
values and a green suite — the coverage check asks only whether a name RESOLVES, and a
stale duplicate resolves. All 54 remaining declarations were deleted rather than compared.

This narrows the gap; it does not close it. The reduced sheet keeps only what the
harness was driven through, so an element default that no driven state reached is still
absent, and a themed vault still replaces the colours. "Layout is faithful" remains true
only of what a partial sets itself and of the app defaults the reduction happened to
keep. On COLOUR the claim changed shape rather than widening: the stub used to invent the
base scale, and app.css turned out to define it — and the accent, the named colours and
`color-scheme` — outright, so what the page draws is Obsidian's default appearance. That
made twelve of the stub's declarations an approximation drawn OVER a correct value, and
they were deleted with the rest of its palette; the measurement is in
`test/harness/theme.css`'s header. What is still
unanswerable is a USER's colours — a community theme replaces exactly these values, the
accent is picked in settings — so this replaces NO live-vault
verification, and asserting appearance from it is refused in
[ADR 0020](../docs/adrs/0020-the-browser-harness-draws-it-does-not-assert.md): no
baselines, no screenshot suite, no sixth step in `npm run check`.
