---
type: Test suite
order: 36
status: Open
created: 2026-08-23
source: the release-management increment, whose every visual claim is jsdom-only
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Smoke test the release view

`product-release`, the plugin's third registered Bases view — the one that creates notes and
its own config and never edits a note that already exists: the index of every release, one
release's scope as a tree, and the four empty states between them — plus, from
[[Setting an item's release]], the one thing that puts work into a scope at all, which is a
menu on the BACKLOG view rather than anything on this one, and, from
[[Creating a release from the release view]], the one thing that makes a release at all,
which is a control on this one.

**This suite exists because the increment shipped with nothing having looked at it.** Every
visual and assistive-technology claim on it rests on jsdom, which computes no layout and no
styles, plus two ad-hoc headless-Chromium runs against markup reproduced by hand. That gap
is not theoretical: it is exactly how `display: contents` on a release row — which makes the
row unfocusable, so Tab skips it and `.focus()` does nothing — survived eight tests, two
reviews and a fix round before a browser was finally asked. `npm run test-build` bundles into
`.obsidian/plugins/<id>/` in the repository root, and `docs/Product Backlog.base` is a real
base in this plugin's own schema, so the plugin can display its own register.

## What to look at

Registration and chrome, none of which any test here can reach:

- The view appears in the Bases view picker, under its own name, with the `lucide-package`
  icon resolving rather than falling back.
- Every option `getReleaseViewOptions` declares appears in the view-options menu, each with
  the suggested property name — the property pickers, the done-value list beside the state
  property, and the releases folder. Count the menu against that function rather than against
  a number written here, which is how three notes in this repository came to state three
  different totals. The last three arrived on 2026-08-25 with the band, and **whether
  Obsidian's property picker can offer a released-date property no note in the vault yet
  carries** is the question none of them can be bound without.
- `resolveViewIdentity` finds the leaf for a `.base` file: pick a release, switch away,
  switch back, and the same release is open. The persistence rests on it and fails silently.

The index — **redrawn on 2026-08-25 as a two-line band per release, replacing the five-column
grid**, so every item here is about markup nobody has opened in Obsidian:

- How the band reads at a real pane width, in both schemes. The five-column grid and its
  per-column custom properties are gone; each band now lays out its own two flex lines, and
  which figure yields width to which is decided by shrink factors rather than by fixed tracks.
  At a narrow pane the version yields first, down to a floor of `5ch` so a bound figure is
  never shrunk to nothing, and the NAME yields after it — both with an ellipsis, never a
  clip. Measured in headless Chromium at 500px over four name lengths on 2026-08-26, and
  nowhere else; a review found the name CLIPPED and the version at 0px when this line said
  otherwise, because the only band measured before that was the one whose name never
  overflowed.
- The two group headings, `In flight (n)` and `Shipped (n)`, read as headings for the bands
  beneath them rather than as rows in the list.
- The band's `<button>` reset holds against a **theme** that styles `button` harder than the
  harness's stand-in baseline — precisely the surface the defect in
  [[The release index rows paint as Obsidian buttons]] lives on, and it has already been paid
  for twice: once at the background and shadow, once at Obsidian's bare `button { height:
  30px }`, which squashed a two-line band into one line's height and was invisible to every
  jsdom test.
- **Whether `--text-error` reads as a warning under a theme rather than as an error.** An
  overdue band spends four coordinated signals on that token — a rule down its leading edge,
  the date, the bar and the note — and a theme is free to make it shout.
- Tab reaches every band, in order; Enter and Space open a release; Space does not scroll the
  list. The focus ring is visible and lands on the band rather than a figure inside it.
- A band's spoken name pairs each figure with its heading. **Nothing here has heard a screen
  reader** — the name is composed correctly by assertion only.

One release's scope:

- Context ancestors read as scaffolding: dimmed, with the corner marker, and its tooltip
  saying the row is in the base but not in this release.
- The tree is announced as a tree — levels and sibling positions — rather than a flat list.
- The back control is reachable and returns to the index.
- Title text can be selected and copied; the read-only rows must not show a pointer cursor
  or a hover highlight.

Putting work in a release, from the backlog view — the second increment, and the only way
a scope on this view is ever non-empty:

- **The picker's length.** `Set release` lists every release the base holds, with no cap and
  no search. Against a vault with many releases it may be a submenu nobody can use, which is
  a question about a real vault's release count and not about the code.
- **Whether the path-qualified entries read well.** Two releases sharing a basename are named
  apart by their whole path minus the extension — `Releases/2.4`, `Archive/2.4` — which is
  legible in a fixture with two-segment paths and unknown in a vault with deep ones.
- **The row menu's total length.** `Set release` joins Set type, Set state, Set risk, Set
  priority, Set assignee, Set iteration, Set horizon, the schedule entry, Edit tags and the
  dependency entries — one editable section, each entry present only where its property is
  configured, so a fully configured vault is where this is worst. Whether that menu still
  reads as a menu, or wants grouping, is a screen-height question no test here can ask.
- **That a link to a same-basename release resolves to the note that was picked.** The write
  hands Obsidian a qualified linkpath (`wikilinkTo`), and the check under that claim runs
  against `FakeVault`'s own `fileToLinktext` and `getFirstLinkpathDest` — a stand-in written
  here, not Obsidian's resolver. Put `Releases/2.4.md` and `Archive/2.4.md` in one vault, pick
  each in turn, and open the link the note ends up carrying.
- **That the property bound in this view and the one bound in the backlog view agree.** They
  are two separate options with one suggested default, no code may compare them, and a
  mismatch looks exactly like a vault nobody has assigned yet: every scope empty, nothing
  unresolved, no warning. Bind them apart on purpose once and see what the two screens say,
  because that is the whole of the signal a user gets.

Making a release — the third increment, and the only way a vault gets its first one from
inside the plugin:

- **Whether `New release` reads right in its two positions.** It is the same control at the
  head of the index, above the scroller, and inside the no-releases empty state, beneath the
  guidance text. The two sit in different frames and neither has been looked at: at the head
  of the index it is chrome over a list, and in the empty state it is the call to action a
  guidance shell was never designed to carry. Whether a `mod-cta` button reads as either, and
  whether the index's own head has the air for one, is a layout question no test here asks.
- **Whether the bind notice is understood by somebody who did not write it.** Pressing the
  control can change the saved view's own configuration before the dialog opens — it binds
  the membership, version, target-date and status properties this vault has never named. The
  notice is one sentence, fired once, over a dialog that is opening; whether a reader takes
  it as "your base was just edited" or as noise beside a form is exactly what cannot be
  judged from a string.
- **Where a release actually lands on disk.** `releaseFolder` ships as `docs/releases`, and
  the folder is created if it is not there. Make one on the shipped defaults and confirm the
  path. **Then do it in a vault whose backlog home folder is not `docs`** — its releases were
  under `<home>/releases` before this increment, and this view cannot read the other view's
  home folder, so the next one lands in `docs/releases` until the option is set. Nothing
  detects that and nothing warns about it: the whole of the signal is where the note appears.
  Whether the default is the right one for such a vault is the question, and only a vault
  answers it.
- **Whether the dialog reads well.** A title, then whichever of version, target date and
  status this vault has bound, in that order; confirm is disabled until a title is typed. The
  date field is a native `date` input, the other two are plain text. Whether the field names
  read as a release's own fields, and whether a dialog of one field (a vault that cleared all
  three) looks deliberate rather than broken, are both live-vault questions.
- **Whether the index looks right with no release rows in the backlog tree.** As of this
  increment a `Release` is drawn on no backlog projection at all and is offered by no New
  menu. So the release view is the only place a release is visible, and a vault that used to
  see its releases as tree rows will not. Open both views in a vault holding releases and
  check that nothing reads as data lost.
- **Where focus is after a release is created**, which has a stated ceiling. The press puts
  focus back on the `New release` control the current screen draws, after the dialog closes
  and again after the create — but that only wins a refresh landing INSIDE the create's own
  await. A vault refreshes on its own schedule, so one arriving after it takes focus to the
  body again, and nothing in the suite can say which happens in a real vault. Make a release
  with the keyboard alone and see where Tab resumes from. The first release is the worst
  case: the empty state that held the control is replaced by the index.
- **That the first release makes the three properties pickable.** Nothing is backfilled onto
  existing notes — this view never edits one — so Obsidian's own property picker cannot offer
  `version`, `target-date` or `status` until a note carries them. After the first **New
  release**, open the view options and confirm each of the three is now offerable from
  Obsidian's list rather than only bindable by suggestion.

Under a theme that is not the default:

- The status chip draws grey rather than adopting a state colour. The band's own two theme
  questions are in the index list above, beside the markup they are about.

## Outcome

Not yet run. The creation gesture added on 2026-08-25 is unrun with the rest of it, and so is
the band that replaced the index's column grid the same day — **nothing in either increment
has been seen in Obsidian**, and neither the browser harness nor a headless-Chromium
measurement is a substitute: both answer layout against Obsidian's DEFAULT colours and neither
answers a theme, an accent, or anything Bases hands the view. The pull request's test-plan box
for this is deliberately unticked, and stays unticked until a maintainer has opened a vault
and worked through the list above.
