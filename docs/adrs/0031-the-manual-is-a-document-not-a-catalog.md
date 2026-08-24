---
adr: 31
title: The manual is a document, not a catalog
status: Accepted
date: 2026-08-24
area: architecture
---

# 0031 — The manual is a document, not a catalog

## Context

[[Every surface translated]] left one question open and said so: whether
`src/view/manual/`'s authored prose belongs in the message catalog "at all", and that
whoever takes it "should decide that first and count second". It is the last thing in
`src/` the register still names as a sweep owed.

**The rest of the sweep is finished, re-derived rather than read off a list.** The
instrument is the AST walk that note describes — every string and template in `src/`
outside a `t()` call, kept when it holds whitespace, a lowercase run, and a capital or a
terminal stop. Calibrated on two directories known to be swept, it reports one hit in
`src/ui/` (the plugin's own name) and two in `src/commands/` (`console.error` prefixes),
which is what those directories are documented to keep. Over the whole of `src/`, with
`en.ts` and the classified files subtracted, it returns **24 strings and no open
question**: fifteen `console.error` prefixes, the plugin's own name three times,
`settingsConsistency.ts`'s three fixture-author messages, `typeVocabulary.ts`'s two type
names, and `estimationPresets.ts`'s `Value over effort`, whose own header states that a
preset name is written into the `.base`. The release work that landed after the `storage/`
slice is clean: `src/view/release/` reads 30 `t()` calls and holds no prose literal, and
`test/i18n/projections.test.ts` already drives it.

**The manual is 111 authored entries, about 3,800 words.** Two instruments, disagreeing by
three, which is the disagreement itself: an AST walk over `term`/`text`/`title`/`intro`
properties says 112, one of which is a type badge's `text` and is a type NAME rather than
prose; a line-anchored grep says 109, because it cannot see an inline `{ term, text }`
pair. The catalog is **630 keys**, counted two ways that agree — a match-counting
`grep -Po` over the key lines, and an AST walk over the `as const` object's own properties
— and 630 distinct, so no key is spelled twice.

Two facts decide the shape rather than the size. `en.ts`'s own `max-lines` exemption says
what makes that file translatable: it is "the file a translator is meant to copy whole".
And [[A manual's prose has no compiler]] records what these particular sentences cost —
roughly forty corrections to write once, nothing that checks what any of them says about
behaviour, and two of them false in the first `main` they merged with.

## Decision

**`src/view/manual/`'s authored prose does not enter the message catalog.** `src/i18n/en.ts`
holds sentences the plugin COMPOSES; the manual is a document the dialog DISPLAYS, and its
paragraphs stay in their own module under that DIRECTORY — today
`src/view/manual/sections.ts`, `src/view/manual/setupSection.ts` and
`src/view/manual/typesSection.ts`, and equally any content module added beside them. The
scope is the directory rather than the three files in it, because this decision is about
what the manual IS: a per-locale `ManualSection[]` module, which the last paragraph of this
Decision anticipates, would otherwise fall outside its own record. `eslint.config.mjs`
spells it the same way for the same reason (`MANUAL`, a `src/view/manual/**/*.ts` glob) —
it was the three paths until review caught it reversing both halves of this ADR on a fourth
file (Codex, PR #202).

The line is the frame, not the words inside it. The dialog's own chrome is a surface and
stays keyed — `manual.dialogTitle` in `src/ui/manualDialog.ts`, already swept.

**A manual paragraph enters the catalog when, and only when, the plugin composes it.**
`manual.typesIntro` is the one such paragraph: the type vocabulary rides in as five
parameters, and its `are`/`is` agreement cannot survive being joined at a call site. Fixed
prose has nothing to compose and belongs to the document.

That is checked at the forbidden call. `MANUAL_FIXED_PROSE` in `eslint.config.mjs` refuses
a `t()` call with no parameters anywhere under `src/view/manual/`. Watched in both
directions on 2026-08-24: the tree lints clean, so the two-argument `manual.typesIntro`
passes, and a planted `t('manual.dialogTitle')` errors. The reverse — a parameterised
paragraph left in the module and joined from pieces — is not reachable by a selector and is
stated rather than checked.

**The three text bans stay off `src/view/manual/` permanently.** Their carve-out's reason
changes from "a ban ahead of its sweep" to this record. `typesSection.ts` keeps
`TEXT_TERNARY` and gains nothing.

**If the manual is ever translated, it is translated as a document**: one `ManualSection[]`
module per locale, picked where `manualSections()` is called — the shape `sections.ts`
already exports. Nothing is built for that now. English is the only catalog that ships
([[English ships alone]]), so a dispatch with one arm would be a branch no locale can
exercise.

## Consequences

A reader with a German Obsidian gets a German interface and an English manual. That is a
half-translated product and this record accepts it, on the ground that a consistently
English document reads better than a mixed one — and mixed is what the catalog would
produce, because `t()` falls back per KEY, so a partly translated manual would alternate
languages paragraph by paragraph inside one page.

A locale becomes cheaper to ship: 630 keys to copy, and 3,800 words nobody has to touch.
It also becomes two artifacts to describe instead of one, which is work moved from the
translator to this record.

`en.ts` does not grow by 111 entries of multi-sentence prose, so the property its own lint
exemption defends — one file, copied whole — survives the epic that would have doubled it.

The unchecked-prose liability recorded in [[A manual's prose has no compiler]] stays at one
document rather than multiplying by the number of locales. That is the consequence this
decision is mostly bought for, and it is a deferral rather than a fix: those sentences
still rot, and nothing here checks them.

What got harder: nothing under `src/view/manual/` refuses a new English literal. A LABEL
added to those files — a button, a heading, something the dialog draws rather than
displays — escapes every text ban, because lint cannot tell a manual paragraph from a
label in a file that is nothing but paragraphs. The check for that is review, and this
record is what a reviewer reads.

## Alternatives

**Key all 111 entries into `en.ts`** — the epic's default, and what "every surface
translated" reads as promising. It splits or doubles the one file whose translatability
rests on being copied whole, and it turns 3,800 unchecked words into a per-locale
liability. Rejected: the cost lands on every locale and buys nothing until a second one
exists.

**Key them into a second catalog file read by the same `t()`.** Keeps the catalog's shape
and gives up the copy-whole property anyway, for the same 111 keys. Rejected: it is the
first alternative with a filename change.

**Drop the in-plugin manual and link to `docs/`.** Rejected here rather than argued: the
dialog is [[User manual]]'s own deliverable and works with no network, and removing it is a
product decision this record does not have.

## Revisit when

- **A second catalog ships.** The Decision defers the per-locale `ManualSection[]` module
  as a branch no locale can exercise. The first locale beside English is the point at which
  it stops being speculative, and it is also the first time a reader can say whether an
  English manual under a translated interface is acceptable or merely tolerated.
- **A translator asks for the manual rather than the interface.** The whole record rests on
  3,800 words being the expensive half of a locale. Someone who wants exactly that half is
  evidence against the cost estimate, not against the artifact split.
- **The manual stops being fixed prose.** If a second paragraph needs parameters, or the
  dialog starts drawing labels of its own beside the entries, the file is no longer a
  document with one composed sentence in it, and both the carve-out and
  `MANUAL_FIXED_PROSE` need re-arguing rather than extending.
