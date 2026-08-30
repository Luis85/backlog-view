---
type: Issue
order: 310
parent: "[[Codebase health]]"
status: Open
priority: P3
area: styling
created: 2026-08-30
source: Impeccable critique of the view, .impeccable/critique/2026-08-30T12-26-06Z__src-view.md, P2 — measured again here and found to be three separate causes rather than one defect
files:
  - src/view/render/legend.ts
  - src/domain/settings.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The timeline legend cannot give every state its own colour

## The limitation

The dated roadmap's legend draws one swatch per state, and on the demo fixture twelve
items resolve to nine distinct colours. Measured in headless Chromium off the rendered
legend, dark and light:

```text
COLLISION rgb(2, 122, 255)  <- Ready, Active, Concept
COLLISION rgb(68, 207, 110) <- Done, Published
```

A reader who sees a blue bar cannot tell which of three states it is from the key.

## Why it is deliberate

**The critique read this as one defect. It is three causes, and two of them are correct
behaviour** — which is why nothing was changed in response to it.

1. **`Done` and `Published` are both green because green means finished.** That is stated
   in `legend.ts` where the fallback swatch is drawn — "green means finished on either,
   and the grid draws one green". A done bar takes an override rather than its positional
   slot, on purpose, because finished is a meaning the reader already has. Two done states
   in two workflows drawing one green, each labelled with its own name, is the legend
   reporting the truth.

2. **`Active` is blue because the fixture painted it blue.** `test/helpers/fixtures.ts`
   sets `'stateColor.active': 'blue'` — a named colour, deliberately, to cover the
   named-versus-hex branch in `stateColorPaint`. A user may paint two states the same
   colour, and the legend must show what the grid draws. This instance is a property of
   the demo fixture, not of the product.

3. **`Ready` and `Concept` collide positionally, and that one is structural.**
   `STATE_COLOR_SLOTS` is 4 and `paletteSlot` is `(offset + index) % 4`. The demo carries
   nine states over two workflows; two are done and take the green override, leaving seven
   positional states over four slots. By pigeonhole at least three must share. The
   critique's suggested fix — "assign distinct hues to every state in the legend's
   vocabulary" — is unreachable for any vault with more than four non-done states, which is
   most of them.

The slot count is not free to raise: `settings.ts` records why it is 4 rather than 5, and
the reason is a collision with the user's own accent, which is a setting rather than a
constant. Raising it trades a legend collision for an accent collision.

## What would lift it

Not a legend change. The legend is accurate — it draws exactly what the grid draws, which
is the one property it has ever needed to keep, and every state-colour defect this feature
has had was the legend disagreeing with a bar rather than agreeing with one.

What is actually missing is a way to read a bar's state that does not go through colour at
all. Some of that exists: `stateNote` puts hidden words in each timeline row, which is why
the legend is `aria-hidden` and out of the tab order without that being a gap. What has no
answer today is the SIGHTED reader of a blue bar. A label on the bar, a hover, or a
pattern rather than a hue would each answer it; none is designed, and picking one is a
design question rather than a fix.

## Impact

On a vault with more than four non-done states, a bar's colour narrows its state to a set
rather than naming it. The information is not lost — it is on the row, in the tooltip and
in the tree — but the projection whose whole job is at-a-glance state cannot finish the
job with colour alone.

The two cases that look worst on the demo fixture (`Done`/`Published`, and `Active`) are
not instances of this at all, so a reader comparing the demo against this note should
expect one genuine collision and two correct ones.
