---
adr: 20
title: The browser harness draws, it does not assert
status: Accepted
date: 2026-08-05
area: testing
---

# ADR 0020 — The browser harness draws, it does not assert

## Context

[ADR 0006](0006-jsdom-is-the-substitute-for-obsidian.md) decided that jsdom is the
substitute for Obsidian and that **appearance is not tested at all** — it is checked by
hand in a real vault, from a written checklist. It asked to be revisited when "a
visual-regression path exists that does not need the app".

`npm run harness` is now a path that does not need the app. It bundles the real
`ProductBacklogView` against the module mock and the fake vault the suite already uses,
writes the stylesheet through the same assembler the plugin build uses, and produces a
static page any browser can open. The markup, the CSS, the drag library and the toolbar
are the plugin's own; the menu and dialog widgets are stand-ins the harness draws, since
the mock records those two and renders nothing.

That makes the question live rather than hypothetical. A page that renders the view is
one dependency and one baseline directory away from a screenshot suite, and the next
person to notice that will be right that it is *possible*. This record is what they
should read first.

## Decision

**The harness renders for a human or an agent to look at. It asserts nothing about what
it renders, and it is not part of the gate.** Four refusals, each with its own reason:

- **No screenshot baselines, no image diffing.** A pixel baseline fails on every
  legitimate markup or spacing edit and says nothing about whether the result is right —
  the objection [ADR 0006](0006-jsdom-is-the-substitute-for-obsidian.md) already made to
  HTML snapshots, and images are the same argument with a slower failure. The second
  reason this bullet used to give — that it would be a baseline of *this stub's* invented
  colours — expired on 2026-08-10, when the palette turned out to come from Obsidian's own
  app.css (see below); what survives it is that a baseline would still certify a
  resemblance to the DEFAULT appearance, which is not what a user with a theme sees.
- **No browser-automation dependency.** Driving the page needs a driver, a browser
  download and a version to pin — the cost [ADR 0006](0006-jsdom-is-the-substitute-for-obsidian.md)
  refused for end-to-end Obsidian, arriving through a side door with most of the same
  bill. The harness produces a URL; whatever opens it belongs to the session, not to
  `package.json`. `?view=board` exists so that looking needs no click, which is what keeps
  this refusal cheap rather than merely principled.
- **No sixth step in `npm run check`.** [ADR 0007](0007-npm-run-check-is-the-whole-gate.md)
  makes those five steps the whole definition of done, and a build that produces something
  to look at is not a check. The harness stays alive inside the five that already run: a
  vitest file mounts it, and another holds the two linked sheets to the stylesheet.
- **It replaces no live-vault verification.** Every `## How to check` note in
  `docs/tests/cases/` stands, and the release sweep
  ([[A cadence for the checks CI cannot run]]) is unchanged. The harness cannot see a
  theme, a font stack, a touch gesture, or whether Bases hands the view what it expects.

What it IS for: seeing a layout change in the session that makes it, reproducing a
rendering complaint without a vault, and driving a real drag against real geometry —
which jsdom cannot do at all, since it returns zeros from `getBoundingClientRect`.

## Consequences

- A contributor with no Obsidian can now see the thing they are changing. That is new,
  and it is most of the value.
- The gap [ADR 0006](0006-jsdom-is-the-substitute-for-obsidian.md) knowingly left open
  stays open, deliberately. Appearance still ships on a hand check.
- The harness will drift from the app in (at least) two ways, and both are invisible from
  inside the harness. The theme is the one that cannot close: no check here can compare a
  colour to a THEMED vault's, so what a user sees stays unverifiable.
  **Update (2026-08-10):** the sentence this bullet carried until then — that
  `test/harness/theme.css` stays an approximation forever — was measured and found false
  in its premise. The reduced `obsidian.css` defines the default palette itself (base
  scale, named colours, accent, `color-scheme`), so of the stub's variable declarations
  none were unique to it, and twelve were an approximation drawn OVER a value app.css
  resolves correctly. Those twelve are deleted. The page now draws Obsidian's DEFAULT
  appearance, which is a narrower gap than "an approximation" and not a closed one: a
  community theme replaces exactly those values and the accent is picked in settings, so
  "no baselines" above still holds on its own reason. The
  other is narrower but was not distinguished from the first until it produced a real bug
  — a card-children disclosure rendered as a centred, boxed native `<button>` in a vault
  and as plain text here (2026-08-08), because the stub had no baseline at all for a bare
  `button`, only for `.svg-icon` and `.clickable-icon`. Saying so in three places (the
  stub, the Feature note, here) was the mitigation first tried for it. **Update
  (2026-08-08, same day): superseded by a different close, not by a second guess.**
  Rather than hand-writing a `button` baseline in `test/harness/theme.css` and living with
  its drift forever, `test/harness/obsidian.css` — Obsidian's own real `app.css`, reduced
  to what the harness exercises — now loads BEFORE the theme stub, so a bare `<button>`
  gets Obsidian's own rule rather than a guessed one. `theme.css` carries no element
  defaults at all now, `button` included: see `test/CLAUDE.md`'s "What it is faithful
  about" for why a guessed baseline beside a real one was two answers to one question.
  **Update (2026-08-10):** "no element defaults at all" was written a day early. The stub
  went on overriding app.css's `.svg-icon` and `.clickable-icon` — real padding, real
  hover colour, and the active and focus states it never had — until review found them,
  because the pass that removed its redundant colours compared custom properties only. A
  check now refuses any rule in the stub that restates a declaration app.css makes for the
  same selector, which is the shape this bullet's claim needed and did not have.
  The element-default gap this bullet used to describe as narrower-but-open is what that
  change closes, one Obsidian rule at a time as the reduction's coverage grows; the theme
  half above is unaffected and stays open for the reason stated.
- Icons render as their own names, because the module mock records an icon name and draws
  no SVG. Ugly and legible, which is the right trade for a control that would otherwise be
  an invisible zero-width box — but it means the harness cannot answer any question about
  iconography.
- The mock records a `Menu` and a `Modal` rather than drawing them, so the harness draws
  both itself. That is a second place where what is on screen is the harness's rather than
  Obsidian's, and it is the reason the guarantee is written as *the entries and the actions
  are the view's* rather than *the menus are real*. A review found the page advertising
  menus it could never show; the honest sentence is narrower than the one it replaced.
- A page that is not a test can rot. Two checks cost nothing extra to run and stop the two
  ways it rots that anyone can see: it stops building, or its theme stub stops covering
  the stylesheet — `harness.test.ts` and `themeStub.test.ts`. Neither notices that it
  stopped being *useful*.
- Nothing here is load-bearing for the release. The harness could be deleted and the
  plugin would ship unchanged, which is the property that lets it stay outside the gate
  with a clear conscience.

## Alternatives

- **A screenshot suite with committed baselines.** The obvious next step, refused above.
  Worth naming its real cost too: baselines are binary files in the repository that no
  reviewer reads, updated by the same commit that would have broken them.
- **Playwright, as a devDependency, driving the page in CI.** A second test system with
  its own failures and its own browser to keep current, gating this repository on
  something it does not ship — the objection
  [ADR 0006](0006-jsdom-is-the-substitute-for-obsidian.md) raised against end-to-end
  Obsidian and [[A cadence for the checks CI cannot run]] raised against automating the
  release sweep. The things it would check are the things it is worst at.
- **Supersede [ADR 0006](0006-jsdom-is-the-substitute-for-obsidian.md).** Rejected, and
  the distinction matters: 0006 is about what TESTS run against. Nothing about that
  changed — jsdom is still the substitute, the suite still drives real events against it,
  appearance is still unverified here. This adds a way to *look*, which is a different
  verb, so it is a separate record rather than a replacement.
- **Serve the page over HTTP with a dev server.** Needed only if the bundle were ES
  modules. Choosing IIFE makes `file://` work and removes a process to start, stop and
  find a free port for.

## Revisit when

Something makes a colour comparison to a real Obsidian theme possible without shipping a
second test system — a published theme stylesheet that can be vendored, say. That is the
one refusal above resting on "cannot", rather than on "costs more than it is worth".
