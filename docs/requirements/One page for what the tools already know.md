---
type: Feature
parent: "[[Codebase health]]"
order: 280
status: Open
area: verification
created: 2026-08-18
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# One page for what the tools already know

Four tools in this repository already know where the technical debt is. Fallow knows the
churn hotspots, the maintainability index and every dead-code and duplication finding;
vitest knows the coverage of each module against its floor; ESLint knows how close each
file is to its line cap; and `docs/` holds the debt a person wrote down. None of them
knows what any of the others found.

So the file that is a churn hotspot, near its cap **and** thinly covered is three separate
facts, in three terminal outputs, on three different days — and the question a maintainer
actually asks, *what should I work on next*, is answerable only by holding all of it in
their head at once. `npm run health` puts them on one page and ranks the answer, with each
row naming the tool and the number that put it there.

What the page deliberately does not do is score the codebase.
[[A health score that can be argued with]] states the register's position on the single
opaque number, and it applies here: every row carries its band, the rule that assigned it
and the figure behind it, so a reader disagrees with a rule rather than with a total.
Nothing on the page adds a figure from one tool to a figure from another.

**Outcome** — A person or an agent can see what to work on next without running five tools
and relating their output by hand.

## Landmines, before implementation

No ordering rule: the pieces can be built in any order. What follows is the other half of
what this section is for — the seams that fail **silently**, each of which cost real time
here and none of which announces itself.

**`scripts/` has a complexity budget of 4, and nothing says so.** `vitest.config.mts`
includes only `src/**` in coverage, so fallow estimates every function in `scripts/` at its
lowest coverage tier, where CRAP is `cyclomatic² + cyclomatic`. That crosses the configured
threshold of 30 at a cyclomatic of **5**, so the real budget is 4 — far tighter than
anything in `src/`, and invisible until `npm run analyze` fails. A single chain of `??`
fallbacks, five lines long and unremarkable to read, scored 42.

**A token this repository documents does not exist in the harness stylesheet.** The page
borrows its colours from `test/harness/obsidian.css`, the vendored and **reduced**
`app.css`. `DESIGN.md` declares `--text-accent`; that file never defines it. A rule reading
it is not an error, is not a warning, and simply has no effect — the link hover was dead
and looked deliberate. Of the nineteen tokens the page reads, it was the only one that
failed, which is the argument for asking the page rather than trusting the list.

**Inlining that stylesheet brings Obsidian's application shell with it.** The page
carries the whole of the vendored `app.css`, and Obsidian's `body` does not scroll,
cannot be selected and is `contain: strict` — every one of those correct for a window
and wrong for a document. `contain: strict` is the one no symptom names: size
containment makes the body's height independent of its contents, so the page collapsed
to its padding, 64 pixels holding twenty-five rows, and reported itself as *not
scrollable* rather than as clipped. `app.css` undoes the same four declarations in its
own `@media print` block, which is what confirms the set is document-shaped rather than
guessed. Exactly eleven of its rules can match a page carrying no Obsidian classes.

**Headless cannot verify this page, at any flag.** A `<link>` to a sibling `file://`
stylesheet is refused in a real browser window — *"'file:' URLs are treated as unique
security origins"* — and the page then renders with no tokens at all. Three headless
runs had already pronounced it fine: Edge with `--allow-file-access-from-files`, Edge
without it, and `--headless=new`, which is meant to enforce closest to a headed
profile. All three loaded the stylesheet happily. The defect was found by a person
opening the file, which is the only instrument that has ever seen it.

**A missing coverage file kills far more than the coverage figures.** `.fallowrc.json`
points fallow's health analysis at `coverage/coverage-final.json`, and fallow exits 2 when
it cannot read it. So a contributor who has not run the suite loses the vital signs, the
hotspots and every finding — none of which need coverage at all. There is no
`--no-coverage`; an empty istanbul map is what stands in for it.
