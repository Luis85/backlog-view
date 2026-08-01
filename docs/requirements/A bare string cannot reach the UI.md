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

1. Two **branded** types, by provenance. `t()` returns `Translated`; the vault-read
   boundary returns `VaultText`. Only the catalog produces the first, only a note produces
   the second, and a literal produces neither.
2. A thin set of plugin-local UI helpers takes the union — call it `Displayable` — where
   Obsidian's API takes `string`. The repo already wraps Obsidian this way where a
   decision needs one home: `iconButton` wraps button creation, `showMenuForClick` wraps
   menu anchoring after the un-anchored version shipped as a bug.
3. Lint bans the **raw** Obsidian text setters inside the UI layers, so the wrappers are
   the only route. That is a short, genuinely closed list of *APIs* — the repository's
   existing idiom, the same `no-restricted-syntax` shape that bans `processFrontMatter`
   and `vault.create` outside `storage/` and `showAtMouseEvent` outside `menu.ts`.

### Why two brands and not one

A single `Translated` brand makes the plugin unable to render the vault. Most of what
reaches a text sink today is **user data**, and it is not translatable by definition:

| Site | Renders |
| --- | --- |
| `prompts.ts:63` | `folder.path` |
| `prompts.ts:86` | a tag |
| `rows.ts:215-220` | the note title, split around the filter match |
| `columns.ts:201` | a property value |
| `columns.ts:137` | the property's display name |

With one brand, every one of those has to either cast — turning the documented escape
hatch into the normal path, which also lets literals back in — or go through `t()`, which
files vault data as catalog text and contradicts this feature's own `text is not data`
invariant. Neither is acceptable, so the invariant the types encode is **provenance**,
not translation: a string reaching the UI came from the catalog *or* from the vault, and
a literal came from neither.

Two sites make the case better than the argument does, because they render **either** in
one expression:

```ts
chip.createSpan({ cls: 'pbl-state-text', text: value ?? 'State' });   // columns.ts:319
btn.createSpan({ text: active || 'All types' });                      // toolbar.ts:211
```

A state value or a literal; a type name or a literal. These do not typecheck under one
brand at all — and the union resolves them the right way round rather than papering over
them, because those fallback literals *are* UI text: they become `value ?? t('state.unset')`
and `active || t('focus.allTypes')`. The union stops user data being misfiled; it does not
let a literal through.

What this buys is that the indirection hole closes *by type* rather than by pattern
matching. `syncBusy` can build its label wherever it likes; the moment it passes a plain
`string` to `setLabel`, the compiler objects, because the parameter is `Displayable`. No
taint analysis, no allowlist, and all 615 structural literals stay exactly as they are —
they were never going near a UI helper.

Both brands are minted at a boundary that already exists and is already narrow.
`Translated` comes from the catalog; `VaultText` comes from where note fields are read —
`domain/noteFields.ts` and the Bases entry API — which is the same choke point
`Persisted keys stay as written` relies on. Neither brand needs a new concept, only a type
on a boundary that was already the one place that data crosses.

The residual risk is a cast, which is visible in review and greppable, in the way a
missing lint rule is not.

### Three things branding does not close by itself

A brand is `string & { readonly __x: unique symbol }`, and TypeScript loses it the moment
the string is touched. Three consequences, all present in today's code, and all of which
have to be designed for rather than discovered:

**1. Transformations drop the brand.** `rows.ts:218-220` splits the note title around the
quick-filter match with three `text.substring(…)` calls; `prompts.ts:86` builds a tag pill
as `` `#${tag}` ``. Both produce plain `string`, so a branded input arrives at the sink
unbranded and the design fails its own "no cast for vault data" criterion.

The fix is to move the transformation **inside** the module that owns the brand rather
than adding helpers at the call sites. The filter split becomes one
`renderMatch(el, title, needle)` that slices and brands internally, so no caller ever
un-brands. The tag pill is better still: the `#` is presentation, not data, so it becomes
a catalog message with the tag as a parameter — which is where it belonged anyway.

**2. Not all vault text comes through `noteFields.ts`.** `prompts.ts:63` renders
`folder.path` from an Obsidian `TFolder`. The mint point is therefore *"every string
entering from Obsidian or the vault"* — note fields, `TFile`/`TFolder` paths and basenames,
and Bases values — not the one module the earlier draft named. Still enumerable, still
narrow, but wider than stated, and stating it wrongly is how the first cast gets written.

**3. `t()`'s parameters are the laundering hole.** If a message's named parameters accept
`string`, then `t('tag.pill', { tag: 'hard-coded text' })` returns a perfectly valid
`Translated` with a literal inside it, and the sink sees only the brand. Every message
that interpolates — tags, state names, titles, type labels — is a way through. Parameters
must therefore carry provenance too: `Displayable | number`, never `string`.

### The destinations that are not setters

Banning the raw setters covers calls. It does not cover **object literals handed to an
external interface**, and that is where the largest single concentration of strings lives:

| Destination | Field | Sites |
| --- | --- | --- |
| `BasesAllOptions` / `BasesOptions` (`domain/viewOptions.ts`) | `displayName`, `placeholder` | 30 |
| `registerBasesView` (`main.ts:10`) | `name` | 1 |
| `addCommand` (`main.ts:25`) | `name` | 1 |

`obsidian.d.ts:846` types `displayName: string`, so a branded value is accepted there and
so is a literal — no setter to ban, nothing to fail. Thirty of the roughly 141 sites would
be unguarded.

The answer is a **local branded option type** that the plugin builds and widens at the
boundary: declare the schema with `displayName: Translated`, and let it flow into
`BasesAllOptions` on return. Because a brand is an intersection with `string`, the
widening is free and needs no cast. The same for the two `name` fields. The rule is
general — *anywhere the plugin hands text to an external interface, it declares its own
type first* — and it is the same move as the UI helpers, applied to a shape rather than a
call.

## Cost, and the order to land it in

Two brands plus a helper layer is the expensive half of this PBI, and the lint ban is the
cheap half. They can land in that order — ban the raw setters first, brand afterwards —
but only with the ordering understood: **lint alone leaves the indirection hole open**,
which is the hole that started this. Shipping step 3 and calling the PBI done would
reproduce the first design under a different name.

### Spike this before treating the criteria as final

This design has now been rewritten five times without a line of code: sinks, then literal
kinds, then one brand, then two, then the brand-integrity gaps above. Each round was
correct about the previous round being wrong, which is a good sign about the review and a
bad sign about the medium — the last three findings were all facts about how TypeScript
treats an intersection type, and every one of them is settled definitively by about fifty
lines of real code.

So the honest sequencing is a **spike first**: brand two values, wrap two sinks, run one
transformation and one `t()` call with a parameter through it, and see what the compiler
says. That answers the transformation question, the widening question and the parameter
question at once, and it is cheaper than a sixth paper round.

Treat everything above as the design to *validate*, not to implement directly. If the
spike says a nominal wrapper with an explicit `.value` is needed instead of an
intersection brand, that is a better outcome than discovering it after the sweep has
touched 141 sites — and it is exactly the kind of thing this register exists to record
rather than rediscover.

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
- `t()` returns `Translated`, the vault-read boundary returns `VaultText`, and every UI
  helper that renders text takes the union. A plain `string` reaching one is a **compile**
  error, not a lint error, so it cannot be suppressed inline.
- `t()`'s **parameters** carry provenance as well — `Displayable | number`, never
  `string`. A message that interpolates an unbranded parameter launders a literal into a
  branded result, which defeats the whole mechanism at its own front door.
- Destinations that are object fields on an external interface are covered too:
  `viewOptions.ts` (30 sites), and the two `name` fields in `main.ts`. The plugin declares
  its own branded option and registration types and widens them at the boundary. A design
  that guards only setter calls leaves the largest concentration of strings in the
  codebase unguarded.
- Transformations of vault text happen **inside** the module that owns the brand — the
  filter-match split and the tag pill are the two that exist — so no call site un-brands
  and re-brands. If the implementation needs a re-branding helper at a call site, the
  boundary is drawn in the wrong place.
- Rendering vault data needs **no cast and no `t()` call**. Note titles, folder paths,
  tags, state values and property values render as directly as they do today. A design in
  which showing a note title requires either is the single-brand design, and has failed
  this criterion.
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
