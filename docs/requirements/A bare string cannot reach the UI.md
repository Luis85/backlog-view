---
type: PBI
parent: "[[Multilang]]"
order: 100
status: Open
---

# A bare string cannot reach the UI

An English literal passed to a user-facing API fails `npm run lint`, rather than being
caught in review or not at all.

## The pattern to copy

`eslint.config.mjs` already does exactly this for the write boundary:
`no-restricted-syntax` bans `processFrontMatter`, `vault.create` and
`load/saveLocalStorage` everywhere outside `storage/`, and the root `CLAUDE.md` states
why — *"a new write path cannot appear by accident."* `VISUAL_DEPTH` is the same idea
applied to level math, scoped to the two files that decide types.

The translation rule wants to be the same shape. The obvious form is a selector over the
places a string reaches the screen — the argument of `setTitle`, `setName`, `setDesc`,
`setTooltip`, `setPlaceholder`, `setButtonText`, `setText`, `new Notice` or
`setAttribute` for a user-facing attribute, and the `text:` / `aria-label` /
`displayName:` / `placeholder:` properties. Those are the twelve forms the ~141 sites
take today.

That list is worth having, because it is what the sweep works through. It is **not**
sufficient as the rule, for the reason below.

One distinction from it is worth keeping either way. `setAttribute` belongs in the list
only for user-facing attributes — `aria-label`, `title`, `placeholder`, `alt`. The other
five `setAttribute` calls in `src/` write `aria-expanded`, `aria-selected`,
`aria-activedescendant` and `aria-busy`, whose `'true'`/`'false'` and element-id literals
are correct and must stay literals. A rule keyed on the *call* rather than on the
attribute would produce five false positives on day one and be switched off by the second
contributor to hit it.

## Why the sink list is the wrong shape

Two forms were added by review rather than found by the sweep — `setText`, then
`setAttribute` — and patching the list twice hid the real problem, which is that **the
list cannot be made complete, because the literal does not have to be at the sink.**

Both patterns are already in the code:

```ts
// toolbar.ts — syncBusy
const label = busy && busy.total > 1 ? `Updating ${busy.done} of ${busy.total}…` : 'Updating…';
el.querySelector<HTMLElement>('.pbl-busy-label')?.setText(busy ? label : '');

// emptyStates.ts — emptyHint returns English, and the caller renders it
empty.createDiv({ cls: 'pbl-empty-hint', text: emptyHint(host, focused, topLevel) });
```

A rule matching literals *inside* `setText(…)` or a `text:` property sees a variable and
a call. Both pass. Assigning to a local first, or returning from a helper, defeats sink
matching entirely — and these are not exotic workarounds, they are the two most ordinary
things a contributor does when a string needs a conditional or a helper needs to build
one. After the sweep, either pattern reintroduces English and lints clean.

## Why the all-literals allowlist is also the wrong shape

The obvious repair is to invert: *no string literal in the UI layers except an allowlist
of kinds that are not text* — icon ids, CSS classes, attribute names, ARIA state values,
config keys. That was the second attempt, and review killed it too, correctly.

`src/view` and `src/ui` contain **615 string literals**. Almost none of them is text.
They are HTML tag names (`createEl('button')`), event names
(`addEventListener('click')`), key values (`evt.key === 'Escape'`), drag payloads
(`setData('text/plain', …)`, `effectAllowed = 'move'`), selectors, class names, icon ids,
property keys. An allowlist has to classify **all 615** correctly or the post-sweep code
cannot pass lint without ad-hoc suppressions — and suppressions are how a rule dies.

The "closed, finite set of shapes" the second attempt claimed was neither closed nor
finite. It was a set populated from memory, which is the same mistake as the sink list
one level up.

## The shape that actually closes it

Stop classifying literals. Make the *destination* refuse them.

1. `t()` returns a **branded** type — `Translated`, not `string`. Only the catalog
   produces one.
2. A thin set of plugin-local UI helpers takes `Translated` where Obsidian's API takes
   `string`. The repo already wraps Obsidian this way where a decision needs one place to
   live: `iconButton` wraps button creation, `showMenuForClick` wraps menu anchoring after
   the un-anchored version shipped as a bug.
3. Lint bans the **raw** Obsidian text setters inside the UI layers, so the wrappers are
   the only route. That is a short, genuinely closed list of *APIs* — and it is the
   repository's existing idiom, the same `no-restricted-syntax` shape that bans
   `processFrontMatter` and `vault.create` outside `storage/` and `showAtMouseEvent`
   outside `menu.ts`.

What this buys is that the indirection hole closes *by type* rather than by pattern
matching. `syncBusy` can build its label wherever it likes; the moment it passes a plain
`string` to `setLabel`, the compiler objects, because the parameter is `Translated`. No
taint analysis, no allowlist, and all 615 structural literals stay exactly as they are —
they were never going near a UI helper.

The residual risk is a cast (`as Translated`), which is visible in review and greppable,
in the way a missing lint rule is not.

## The pattern, now that it has been corrected three times

Each attempt was a list, and each list was populated by recall: first the sinks, then the
literal kinds. Both were wrong in the same way and for the same reason.

**A rule enumerated against examples grows one entry per review. A rule stated against a
property closes the class.** "Every string reaching the UI came from the catalog" is a
property, and a branded type is how a compiler states it. The two lists were attempts to
approximate that property by listing its consequences, which is exactly the move that
needed three rounds of review to abandon.

## Acceptance criteria

- Both indirection patterns above fail. `syncBusy` building a label into a local, and
  `emptyHint` returning one from a helper, are the acceptance test — a mechanism that
  catches only a literal sitting inside `setText(…)` has not met this criterion.
- `t()` returns a branded type, and every UI helper that renders text takes it. A plain
  `string` reaching one is a **compile** error, not a lint error, so it cannot be
  suppressed inline.
- The raw Obsidian text setters are banned in the UI layers by `no-restricted-syntax`,
  scoped and messaged like the existing bans on `processFrontMatter`, `vault.create` and
  `showAtMouseEvent`. That list is of APIs, is short, and is closed.
- **No literal-classification rule ships.** The 615 structural literals in `src/view` and
  `src/ui` — tag names, event names, key values, drag payloads, selectors, icon ids — are
  not touched, not annotated and not allowlisted. If the design requires classifying them,
  it is the wrong design and this criterion has failed.
- Casts to the branded type are greppable and reviewed. They are the one remaining way
  through, and knowing where they are is worth more than pretending there are none.
- The inline plural ternary (`? '' : 's'` and its variants) is covered too, so
  `Plurals and interpolation` cannot regress.
- The catalog module is exempt, since literals are what it is made of, and `test/**` is
  exempt for the reason the Obsidian ruleset already stops at `src/`.
- Messages name the fix, not the violation. *"UI text belongs in the catalog — add a key
  and call `t()`"* teaches; *"unexpected string literal"* gets suppressed.
