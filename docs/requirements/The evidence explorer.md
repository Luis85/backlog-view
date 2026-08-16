---
type: Feature
parent: "[[Product Evidence]]"
order: 30
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The evidence explorer

The chain drawn end to end: an evidence note, the opportunities it supports, the features
those became, and the objectives those serve.

**Every hop is a key this view names for itself** — the evidence link, the **source** link a
promoted item carries back to the opportunity it came from, and the alignment link to a
strategic entity — each
defaulting to the same suggestion the view that writes it uses, and none of them read from
another view's settings. A hop with no key configured is simply not drawn, and the chain says
where it stopped rather than presenting a shorter path as the whole one.

**The chain is drawn from the evidence end, and its first two hops are stored at the other
end of themselves.** [[Evidence as a link from the item]] writes the evidence link on the
item, and [[Promoting a candidate into the backlog]] writes the source link on the created
backlog note, so neither an evidence note nor an opportunity holds a list of what points at
it. Both hops are therefore walked **inverted**: the first collects the items whose evidence
link names the evidence note in hand, and the second collects the backlog items whose source
link names the opportunity in hand. Only the last hop — the alignment — is read forward, off
the item that stores it. Each inverted hop can find several, or none, and none is drawn as an
end rather than as a gap. Reading either one forward, expecting the note on screen to name
what it supports, finds nothing on every vault: not an empty chain but a chain that is absent
everywhere. A vault with no
Discovery and no Strategy still gets the evidence-to-item hop, which is the one this epic
owns outright.

**Outcome** — Someone can follow an observation as far as the vault's own links reach, and
sees where the trail ends rather than a trail that looks complete.
