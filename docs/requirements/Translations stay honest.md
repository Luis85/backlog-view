---
type: Feature
parent: "[[Multilang]]"
order: 40
status: Open
---

# Translations stay honest

What stops the epic from decaying the week after it lands.

A translated codebase does not stay translated by intention. The next feature adds a
button, the button needs a label, and the shortest way to write a label is to type it.
`Codebase health` already made the argument this feature applies:
*"Invariants as checks, not conventions."* The same standard holds here — every rule in
this epic that can be a check becomes one, and the rules that cannot say so out loud.

The checks belong in `npm run check`, which is the definition of done: build, lint,
coverage-thresholded tests, fallow. A rule enforced anywhere else is a convention wearing
a check's clothes.
