---
type: Feature
parent: "[[Codebase health]]"
order: 80
status: Done
area: verification
created: 2026-08-05
closed: 2026-08-05
---

# A browser harness without Obsidian

Everything appearance-shaped in this repository ships on a hand check in a live vault,
and that check has a property nothing else here has: **it needs a person at a GUI.** An
agent working in a session cannot run it, cannot see the layout it just changed, and
cannot tell a rendering regression from a green suite — the jsdom tests assert structure
through `querySelector`, and nothing in this repository has ever *drawn* the view.

The pieces to close that were already here, built for the suite: the `obsidian` module
mock, a whole vault in memory, a mount of the real `ProductBacklogView`, and a stylesheet
already assembled from `styles/` as a build artifact. A browser was the only thing not
wired up. `npm run harness` bundles those into a static page — no Obsidian, no server, no
new dependency — and anything that can open a `file://` URL can now look at all three
projections and drag, click and keyboard them.

[ADR 0006](../adrs/0006-jsdom-is-the-substitute-for-obsidian.md) asked to be revisited
when "a visual-regression path exists that does not need the app". This is that path with
one subtraction stated up front: it is not a visual-*regression* path, because nothing
asserts what it draws. [ADR 0020](../adrs/0020-the-browser-harness-draws-it-does-not-assert.md)
records why that subtraction is deliberate rather than unfinished.

**Outcome** — A change to the view can be looked at in the session that makes it, and the
limit of what looking proves is written down instead of assumed.

## What it is faithful about, and what it is not

**Faithful:** the markup, the CSS the partials write for themselves, the real stylesheet
assembled from the real partials, and every interaction — the drags are the drag
library's, the menu entries and the actions behind them are the view's, the toolbar is
the toolbar.

**Not:** colour. Layout leaning on an Obsidian element default used to be in this list too
— a card-children disclosure whose toggle and entries relied on Obsidian's own button
styling shipped looking right here and wrong in a vault (2026-08-08), because
`test/harness/theme.css` carried no baseline at all for a bare `<button>` — only for
`.svg-icon` and `.clickable-icon`. The fix was not a guessed baseline: `test/harness/
obsidian.css` — Obsidian's own real `app.css`, reduced to what the harness exercises —
now loads BEFORE the theme stub, so a bare `<button>` gets Obsidian's own rule. The stub
carries no hand-written element defaults at all now, `button` included: a guessed
baseline beside a real one is two answers to one question. This narrows the gap; it does
not close it — the reduced sheet keeps only what the harness was driven through, so an
element default no driven state reached is still absent, and a themed vault still
replaces the colours regardless of which sheet supplies the shape.

The COLOUR half of the stub is built on Obsidian's documented base scale and named
palette, in both a light and a dark scheme, switchable in the page (`?theme=light`, or
the harness's own corner toggle) — so contrast, hierarchy and the does-this-read-at-all
question can be asked both ways, which is where the plugin's own choices show. It is
still a stub: a themed vault replaces exactly those values, and most vaults have a theme,
so a colour seen in the harness is not a colour a user sees; and the menu and dialog
**widgets** are the harness's own, since the mock records them and renders nothing.

Icons moved from the second list to the first. They rendered as their own NAMES while
the mock drew no SVG, and that was not a neutral stand-in: `chevron-down` is several
times the width of the 14px glyph it stood for, so every control carrying an icon
measured wider here than in a vault — a layout tool whose placeholders change the layout.
The real lucide glyph is drawn instead (`test/harness/icons.ts`), as an
`<svg class="svg-icon">` child, because that is the class the partials size icons
through. The SHAPES are the library Obsidian itself renders; the stroke and colour still
come from the stub, so an icon's appearance is no more a claim than any other colour
here. A menu that appeared here is a menu the view opened with the
entries it built — it is no evidence about how Obsidian would draw it.

Every live-vault verification in `docs/tests/cases/` stands unchanged; none of them is answered
by a screenshot from here.

## Acceptance criteria

- The page mounts the real view — not a copy of it, and not a fixture of its markup — so
  a change to `src/view/` is visible without any harness edit.
- All three projections are reachable, through the view's own toolbar, in either colour
  scheme — and each is reachable from a URL, so looking needs no click.
- The harness costs `npm run check` no sixth step, and costs the PLUGIN no dependency:
  nothing it needs is shipped, and nothing it needs drives a browser. It carries one
  devDependency, `lucide-static` — static icon data, no binary to download and no version
  to pin against a browser's. This criterion read "no new dependency" flat until icons
  were drawn for real, which is worth stating rather than quietly widening: what
  [ADR 0020](../adrs/0020-the-browser-harness-draws-it-does-not-assert.md) refuses is a
  browser-automation dependency and the download-and-pin treadmill behind it, and that
  refusal is untouched — a session still supplies whatever opens the URL.
- Nothing in it asserts appearance. The checks it does carry are that it still mounts and
  that its theme stub still covers the stylesheet.
- What it cannot be trusted for is stated where someone would rely on it — here, in
  `test/CLAUDE.md`, and in the stub itself.

## Where it lives

`harness.mjs` · `test/harness/mount.ts` · `test/harness/page.ts` ·
`test/harness/icons.ts` · `test/harness/theme.css` · `test/harness/theme.ts` ·
`test/helpers/fixtures.ts` ·
`test/harness/harness.test.ts` · `test/CLAUDE.md`

`icons.ts` installs its renderer through the one hook the shared mock exposes for it
(`setIconRenderer`), for the reason `chrome.ts` patches rather than edits: the suite
asserts on `data-icon` and empties the body between tests, so the mock still only records
by default. A name lucide does not carry is MARKED (`data-icon-missing`) rather than
skipped, the stub prints it, and `harness.test.ts` sweeps all three projections and both
axes asserting the set is empty — driving the view rather than grepping `src/`, since
four of the names are set from a table or a branch and no grep for a literal beside a
`setIcon` call finds them.
