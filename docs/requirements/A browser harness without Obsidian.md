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

**Faithful:** the markup, the layout, the real stylesheet assembled from the real
partials, and every interaction — the drags are the drag library's, the menus are the
view's, the toolbar is the toolbar.

**Not:** colour. The Obsidian variables `styles/` reads are supplied by a stub of
approximations, because Obsidian's theme is Obsidian's. A colour seen in the harness is
not a colour a user sees, and icons render as their own names because the module mock
draws no SVG. Every live-vault verification in `docs/issues/` stands unchanged; none of
them is answered by a screenshot from here.

## Acceptance criteria

- The page mounts the real view — not a copy of it, and not a fixture of its markup — so
  a change to `src/view/` is visible without any harness edit.
- All three projections are reachable, through the view's own toolbar.
- The harness costs `npm run check` no sixth step, and costs `package.json` no new
  dependency.
- Nothing in it asserts appearance. The checks it does carry are that it still mounts and
  that its theme stub still covers the stylesheet.
- What it cannot be trusted for is stated where someone would rely on it — here, in
  `test/CLAUDE.md`, and in the stub itself.

## Where it lives

`harness.mjs` · `test/harness/mount.ts` · `test/harness/page.ts` ·
`test/harness/theme.css` · `test/helpers/fixtures.ts` · `test/harness/harness.test.ts` ·
`test/CLAUDE.md`
