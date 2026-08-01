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

The translation rule is the same shape with a different selector: a string literal as the
argument of `setTitle`, `setName`, `setDesc`, `setTooltip`, `setPlaceholder`,
`setButtonText`, `setText`, `new Notice`, `setAttribute` (for a user-facing attribute),
or as a `text:` / `aria-label` / `displayName:` / `placeholder:` property. Those are the
twelve forms the ~141 sites already take.

`setText` earns its place by example rather than by symmetry: `ui/prompts.ts:110` is
`this.titleEl.setText('Add tag')`, and `backlogView.ts:445` builds the count label the
same way. A selector list assembled from the *other* setters would leave both passing
lint after the sweep, which is the exact failure this PBI exists to prevent — the rule
has to cover the APIs this codebase actually reaches for, not the ones that came to mind.

`setAttribute` is the twelfth form, and it is the subtlest: `aria-label` appears in the
list above as an object *property* (`attr: { 'aria-label': … }`), which is how most of the
code writes it — but `columns.ts:216` writes the same attribute through
`valueEl.setAttribute('aria-label', described)`, and a selector matching only the object
form lets a literal through there. The rule covers `setAttribute`'s **second** argument
when its first is a user-facing attribute: `aria-label`, `title`, `placeholder`, `alt`.

It must not cover the rest. The other five `setAttribute` calls write `aria-expanded`,
`aria-selected`, `aria-activedescendant` and `aria-busy` — ARIA *state*, whose values are
`'true'`/`'false'` and element ids. Those literals are correct and must stay literals, so
a rule keyed on the call rather than on the attribute would produce five false positives
on day one and be switched off.

The companion form is `appendText` (`rows.ts:218`), and it makes the boundary concrete:
every call site of `setText`, `appendText` and `setAttribute('aria-label', …)` today
passes a **value** — a folder path, a note title, a state name, a described property. The
rule bans *literals* in these positions, so data-carrying calls are unaffected by
construction, and that is the property to preserve rather than a special case to write.

Two forms have now been added by review rather than found by the sweep — `setText`, then
`setAttribute`. A list of APIs assembled by recall is short by however many the codebase
happens to use elsewhere, so the population is not final until it has been **derived**
from the code: enumerate every call that can put a string on screen, then subtract the
ones that cannot carry text. Built the other way round, it is short and nobody can say
by how much.

## Acceptance criteria

- A literal in any of those positions in `src/` is a lint **error**. Adding one fails CI.
- The population is **derived from the code before the rule is written**, not taken from
  the list above. That list is the starting point and has already been wrong twice; the
  deliverable is the enumeration that makes it complete.
- The rule permits what is genuinely not text: an icon id (`'plus'`, `'chevron-down'`),
  a CSS class, an `attr` like `tabindex`, and a value that is user data.
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
