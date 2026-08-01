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

So the rule is inverted. Rather than *"no literal at these sinks"*, it is **"no
user-facing string literal anywhere in the UI layers"**, with a narrow allowlist of the
literal kinds that are not text:

| Allowed | Because |
| --- | --- |
| Icon ids (`'plus'`, `'chevron-down'`) | A lucide name, not words |
| CSS classes and selectors | Structure |
| Attribute *names*, and ARIA *state* values (`'true'`, `'false'`) | Not read by a human as prose |
| Frontmatter and config keys | Data — see `Persisted keys stay as written` |

That is a whitelist over a known-finite set of shapes, rather than a blacklist over an
open set of sinks, and it is why it can actually hold. It also flags
`` `Updating ${busy.done} of ${busy.total}…` `` where it is *written*, which is where a
contributor can still see what to do about it.

The belt-and-braces half is at the other end: `t()` returns a **branded** string type
rather than `string`, so a value that never came from the catalog is visible in the type
system as well as to the linter. The Obsidian setters take `string` and cannot be
changed, so branding alone does not close the hole — but the two together mean a literal
has to survive both a lint rule at its construction site and a type at the boundary.

The pattern worth naming, since this PBI has now been corrected three times: **a rule
enumerated against examples grows one entry per review; a rule stated against a
property closes the whole class.** Both corrections here were symptoms of the first kind.

## Acceptance criteria

- A user-facing string literal anywhere in the UI layers is a lint **error**, wherever it
  is written — at a sink, assigned to a local, or returned from a helper. The two
  patterns above are the acceptance test: both must fail, and a rule that only catches
  the sink form has not met this criterion.
- The allowlist is of literal **kinds**, enumerated and closed: icon ids, CSS classes and
  selectors, attribute names, ARIA state values, frontmatter and config keys. Anything
  outside it is text until someone argues otherwise.
- `t()` returns a branded type, so an unbranded string reaching a message parameter is a
  type error as well as a lint error. Neither mechanism is sufficient alone — the setters
  take `string` and cannot be changed — which is why both are here.
- Permitting is **explicit and narrow** — a named allowance, not a blanket exemption on
  the file. The root `CLAUDE.md` already sets this standard for framework-invoked members:
  they are *"declared in `usedClassMembers`, not suppressed inline."*
- The catalog files themselves are exempt, since literals are what they are made of.
- `test/**` is exempt. The Obsidian ruleset already stops at `src/`, and the doubles exist
  to do what it forbids.
- The inline plural ternary (`? '' : 's'` and its variants) is covered too, so
  `Plurals and interpolation` cannot regress.
- The message names the fix, not the violation. A rule that says *"UI text belongs in the
  catalog — add a key and call `t()`"* teaches; one that says *"unexpected string
  literal"* gets suppressed.
