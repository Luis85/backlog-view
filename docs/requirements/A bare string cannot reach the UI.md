---
type: PBI
parent: "[[Translations stay honest]]"
order: 10
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
`setButtonText`, `new Notice`, or as a `text:` / `aria-label` / `displayName:` /
`placeholder:` property. Those are the ten forms the ~141 sites already take, so the
selector is written against a known population rather than guessed.

## Acceptance criteria

- A literal in any of those positions in `src/` is a lint **error**. Adding one fails CI.
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
