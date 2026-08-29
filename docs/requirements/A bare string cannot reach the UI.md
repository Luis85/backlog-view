---
type: PBI
parent: "[[Multilang]]"
order: 100
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# A bare string cannot reach the UI

An English literal passed to a user-facing API fails `npm run lint`, rather than being
caught in review or not at all.


**As** someone maintaining this plugin after the sweep, **I want** an English literal on a
UI path to fail the build, **so that** the translation does not decay one convenient
string at a time.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the plugin |
| **Trigger** | Writing code that puts a string on screen |
| **Preconditions** | The catalog exists and the sweep has run |
| **Guarantee** | Rendering the user's own text needs no cast and no `t()` call. The rule constrains where text comes from, never what the plugin may display. |

**Main flow**

1. A contributor writes code that renders text.
2. They call a UI helper, which accepts only a value with known provenance.
3. `t()` supplies a catalog message; the vault boundary supplies the user's own text.
4. `npm run check` passes.

**Extensions**

- **1a — they write a literal at the sink.** Lint rejects it and names the fix.
- **1b — they assign the literal to a local first, or return it from a helper.** The type
  rejects it at the sink regardless of where it was built — which is the hole a
  sink-matching rule cannot close.
- **2a — they reach past the helper for a raw setter.** Banned across every shipped layer,
  so the wrappers are the only route.
- **2b — they reach for a native DOM sink.** `textContent`, `innerText`, `innerHTML`,
  `createTextNode`, `insertAdjacentText`, and the reflected text properties `placeholder`,
  `title`, `alt` and `ariaLabel` are all assignments the ban must cover. A branded type
  cannot help here at all: the DOM types them `string`.
- **2c — the code reads one of those properties.** Legal. `columns.ts` reads `textContent`
  to serialize rendered output; the rule matches assignment, not the property name.
- **3a — the message interpolates a parameter.** Parameters carry provenance too, or a
  literal launders itself into a branded result.

## The pattern to copy

`eslint.config.mjs` already does exactly this for the write boundary:
`no-restricted-syntax` bans `processFrontMatter`, `vault.create` and
`load/saveLocalStorage` everywhere outside `storage/`, and the root `CLAUDE.md` states
why — *"a new write path cannot appear by accident."* `VISUAL_DEPTH` is the same idea
applied to level math, scoped to the two files that decide types.

The translation rule wants to be the same shape. The obvious form is a selector over the
places a string reaches the screen, and that set is **derived from the code** rather than
recalled — the earlier drafts of this note listed it from memory three times and were
short by an entry each time.

| Call | Sites | Guarded |
| --- | --- | --- |
| `setTooltip` | 23 | argument |
| `setTitle` | 20 | argument |
| `new Notice` | 14 | argument |
| `setText` | 11 | argument |
| `setAttribute` | 7 | second argument, for `aria-label` / `title` / `placeholder` / `alt` only |
| `setName` | 5 | argument |
| `setPlaceholder`, `setButtonText` | 3 each | argument |
| `setDesc` | 2 | argument |
| `appendText` | 2 | argument |
| `addOption` | 1 | **second** argument only — the first is the persisted value |

| Object field | Sites |
| --- | --- |
| `text:` | 30 |
| `displayName:` | 21 |
| `'aria-label':` | 10 |
| `placeholder:` | 10 |
| `name:` | 6 |

That is the list the *sweep* works through, and the same set the ban in step 3 below
covers. It is **not** sufficient as the rule, for the reason in the next section — but
where a list is used at all, it is now one the code produced.

That list is worth having, because it is what the sweep works through. It is **not**
sufficient as the rule, for the reason below.

Three distinctions from it are worth keeping either way, and all three are about guarding
a *position* rather than an identifier — which is the shape to expect from the rest.

`setAttribute` belongs in the list only for user-facing attributes — `aria-label`,
`title`, `placeholder`, `alt`. The other five `setAttribute` calls in `src/` write
`aria-expanded`, `aria-selected`, `aria-activedescendant` and `aria-busy`, whose
`'true'`/`'false'` and element-id literals are correct and must stay literals. A rule
keyed on the *call* would produce five false positives on day one and be switched off by
the second contributor to hit it.

`textContent` is the third: `columns.ts:204` **reads** it, legitimately, to serialize what
Obsidian's renderer built. A rule keyed on the property name would fail there on day one.
Assignment is the sink; reading is not.

`DropdownComponent.addOption` is the same shape and the clearest example in the codebase.
`prompts.ts:215` is `drop.addOption(type, type)` — the type name as **both** the persisted
value and the visible label, which is exactly the conflation `Type names are data` exists
to undo. After that PBI it becomes `addOption(type, label(type))`: canonical name stored,
translated label shown. So the guard covers the **second** argument only. Guarding the
first would forbid storing the canonical name, which is the one thing that must not
change.

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
   boundary returns `UserText`. Only the catalog produces the first, only something
   outside this plugin's source produces the second, and a literal produces neither.
2. A thin set of plugin-local UI helpers takes the union — call it `Displayable` — where
   Obsidian's API takes `string`. The repo already wraps Obsidian this way where a
   decision needs one home: `iconButton` wraps button creation, `showMenuForClick` wraps
   menu anchoring after the un-anchored version shipped as a bug.
3. Lint bans the **raw** text sinks across **every shipped source layer**, so the wrappers
   are the only route. That is a list of *APIs* — the repository's existing idiom, the same
   `no-restricted-syntax` shape that bans `processFrontMatter` and `vault.create` outside
   `storage/` and `showAtMouseEvent` outside `menu.ts`.

   **It is not closed over Obsidian's surface.** Obsidian's setters are a convenience over
   the DOM, and the DOM underneath them is still reachable: `el.textContent = 'English'`,
   `innerText`, `innerHTML`, `document.createTextNode`, `insertAdjacentText`, and
   `append`/`prepend`/`replaceChildren` with a string argument all render a literal and
   would compile and lint clean against an Obsidian-only ban.

   **The reflected text properties are the same hole once more.** `input.placeholder`,
   `button.title`, `img.alt` and `el.ariaLabel` are assignments that render user-facing
   text, and the DOM types every one of them `string` — so the branded helpers do not
   reach them either. They belong in the ban beside `textContent`, and they are the reason
   "the native DOM boundary" has to be enumerated rather than gestured at: it is not one
   API, it is every property that reflects text. None is used as a *write* in
   `src/` today, so this is a hole the sweep would leave open rather than one it has to
   close — which is exactly the kind that gets found a year later.

   The one native use is a **read**: `columns.ts:204` does
   `valueEl.textContent?.trim()` to serialize what Obsidian's renderer built. That must
   stay legal, so the rule matches **assignment**, not the property name.

   Scoping it to `view/` and `ui/` would leave a hole: `commands/scaffold.ts:18,21` calls
   `new Notice(...)` directly, so a future literal there would compile and lint clean. The
   sweep would fix today's two strings and the route would stay open — which is the failure
   mode this whole PBI exists to prevent, reappearing as a scoping decision rather than as
   a missing API. Only the wrapper and catalog implementations are exempt.

### Why two brands and not one

A single `Translated` brand makes the plugin unable to render the vault. Most of what
reaches a text sink today is **user data**, and it is not translatable by definition:

| Site | Renders |
| --- | --- |
| `prompts.ts:63` | `folder.path`, off an Obsidian `TFolder` |
| `emptyStates.ts:58` | `host.filterText`, straight from an `<input>` |
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
placeholder: homeFolder || 'Home folder',                             // viewOptions.ts:156
```

A state value or a literal; a type name or a literal; a configured folder path or a
literal. These do not typecheck under one brand at all — and the union resolves them the
right way round rather than papering over
them, because those fallback literals *are* UI text: they become `value ?? t('state.unset')`
and `active || t('focus.allTypes')`. The union stops user data being misfiled; it does not
let a literal through.

### The two mechanisms cover different ground

Worth stating because it decides how much weight step 3 carries. A branded type cannot
help at a native sink at all: `textContent` is typed `string | null` by the DOM library,
and nothing in this plugin can narrow it. So the type closes the *helper* boundary and the
lint rule closes the *native* one, and neither substitutes for the other. Dropping the ban
as "belt and braces" would leave every native DOM sink open.

What this buys is that the indirection hole closes *by type* rather than by pattern
matching. `syncBusy` can build its label wherever it likes; the moment it passes a plain
`string` to `setLabel`, the compiler objects, because the parameter is `Displayable`. No
taint analysis, no allowlist, and all 615 structural literals stay exactly as they are —
they were never going near a UI helper.

Both brands are minted at a boundary that already exists and is already narrow.
`Translated` comes from the catalog; `UserText` comes from the points where text enters
from outside the plugin's source — note fields (`domain/noteFields.ts`), the Bases entry
API, Obsidian's `TFile`/`TFolder`, and the filter input. Neither brand needs a new concept,
only a type on boundaries that were already the places text crosses.

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

**2. The second brand is not about the vault.** Two drafts named its source too narrowly
and were wrong both times. `prompts.ts:63` renders `folder.path` off an Obsidian `TFolder`,
which is not a note field; `emptyStates.ts:58` renders `host.filterText`, which came from
an `<input>` in `toolbar.ts:176` and never touched the vault at all.

Chasing those one at a time would add a brand per source. The boundary that actually holds
is the **negative** one: `UserText` is any string that did not originate in this plugin's
source. Vault content, Obsidian API values and live user input are all the same thing from
the type system's point of view — the user's words, not the developer's — and grouping
them is not a convenience, it is the distinction the feature is built on. `Multilang`
already says as much: *"Note content. Titles, tags and state values are the user's words
already."*

The mint points stay enumerable — note fields, `TFile`/`TFolder` paths and basenames, Bases
values, and the filter input — but they are instances of one rule rather than a list to
keep extending.

**3. `Intl` formatters return plain `string`.** `Intl.NumberFormat.prototype.format()` and
`Intl.ListFormat.prototype.format()` both do, and both are *required* elsewhere in this
feature — `Locale-aware sorting and formatting` asks for the standalone counts at
`columns.ts:276,280` to be number-formatted, and `Plurals and interpolation` asks for
`configProblems` to be joined with `Intl.ListFormat`. As written, the two specifications
contradict each other: what the formatter returns cannot reach a branded sink.

The resolution is the one already used for transformations — the formatters live **inside**
the module that owns the brands and return one, rather than being called at the sink and
re-branded. Which brand follows the line already drawn in
`Locale-aware sorting and formatting`: a formatted **count** is data presentation, so it is
`UserText`; a **list joined into a sentence** is grammar, so it is `Translated`. That is
the same rule answering a third question, which is a good sign it is the right rule.

**4. `t()`'s parameters are the laundering hole.** If a message's named parameters accept
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

### The spike ran (2026-08-15), and the design holds

Run before `t()` was written, because `t()`'s parameter type is the thing the spike
decides. About forty lines: two `unique symbol` intersection brands, a `Displayable` union,
a helper taking it, a mint for each brand, and a `@ts-expect-error` on every form this note
claims must fail. All of them fired, and every legal form compiled. Specifically —

- **Widening is free.** `{ displayName: t('a') }` satisfies an interface declaring
  `displayName: string` with no cast, because a brand is an intersection with `string`. So
  the local-branded-option-type plan for `viewOptions.ts` works as written.
- **Both indirection patterns fail at the sink**, which is the criterion the sink-list
  designs could not meet: a literal assigned to a local first, and a template literal built
  from variables, are both rejected where a `Displayable` is expected.
- **Transformations do drop the brand**, as the note predicted — `title.substring(0, 4)` is
  a plain `string` and is rejected. That confirms the "transform inside the module that owns
  the brand" rule rather than casting at call sites.
- **`Intl` output is rejected too**, which is the contradiction this note flagged between
  itself and the two `Intl` criteria elsewhere. The resolution stands: the formatters have
  to live inside the module and return a brand.
- **A literal parameter cannot launder itself.** With parameters typed `Displayable | number`,
  `t('tag.pill', { tag: 'hard-coded' })` does not compile. That is the front door closed.
- **`value ?? t('state.unset')` typechecks** under the union, which is the two-brand
  design's own worked example.

**No nominal wrapper with an explicit `.value` is needed.** The intersection brand answers
every question this note raised, so the criteria above can be implemented as written.

One thing the spike does NOT settle, and it is the reason `t()` ships returning plain
`string` rather than `Translated`: the brands only pay for themselves once the sinks demand
them, and no `UserText` mint point exists until the sweep builds one. Typing the parameters
`Displayable | number` today would make `t()` unusable by every call site that passes a note
title. Narrowing both is a one-line change per signature, compiler-guided from there — which
is what this PBI's own work is.

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
- `t()` returns `Translated`, every entry point for text from outside the plugin's source
  returns `UserText`, and every UI helper that renders text takes the union. A plain
  `string` reaching one is a **compile**
  error, not a lint error, so it cannot be suppressed inline.
- `t()`'s **parameters** carry provenance as well — `Displayable | number`, never
  `string`. A message that interpolates an unbranded parameter launders a literal into a
  branded result, which defeats the whole mechanism at its own front door.
- Destinations that are object fields on an external interface are covered too:
  `viewOptions.ts` (30 sites), and the two `name` fields in `main.ts`. The plugin declares
  its own branded option and registration types and widens them at the boundary. A design
  that guards only setter calls leaves the largest concentration of strings in the
  codebase unguarded.
- Transformations happen **inside** the module that owns the brands, so no call site
  un-brands and re-brands. Three exist: the filter-match split, the tag pill, and the
  `Intl` formatters — whose output is branded by what it formats (a count is `UserText`,
  a list joined into a sentence is `Translated`). If the implementation needs a re-branding
  helper at a call site, the boundary is drawn in the wrong place.
- Rendering the user's own text needs **no cast and no `t()` call**. Note titles, folder
  paths, tags, state values, property values and the quick-filter text render as directly
  as they do today. A design in
  which showing a note title requires either is the single-brand design, and has failed
  this criterion.
- The raw text sinks are banned across every shipped source layer by
  `no-restricted-syntax`, scoped and messaged like the existing bans on
  `processFrontMatter`, `vault.create` and `showAtMouseEvent`. The list covers **native
  DOM sinks as well as Obsidian's** — `textContent`/`innerText`/`innerHTML` assignment,
  `createTextNode`, `insertAdjacentText`, and `append`/`prepend`/`replaceChildren` with a
  string — because Obsidian's setters are a convenience over a DOM that stays reachable.
- Reads stay legal. `columns.ts:204` reads `textContent` to serialize rendered output; a
  rule keyed on the property rather than on assignment breaks it immediately.
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

## Where it lives

**The first of the bans is in, and it is the narrowest one.** `TEXT_TERNARY` in
`eslint.config.mjs` refuses a `ConditionalExpression` between two string literals inside a
template literal, in `src/view/render/**` — the shape that assembles a sentence at the call
site, whether the two halves are `''`/`'s'` or `'Expand'`/`'Collapse'`. It sits beside the
`no-restricted-syntax` bans on `processFrontMatter`, `vault.create` and `showAtMouseEvent`
that it copies, and it is checked in both directions: a planted ternary was watched failing
lint, and the swept tree passes.

It is **not** this PBI. What that ban does is stop the twentieth instance of the shape
already swept — `Plurals and interpolation` records the nineteenth arriving mid-flight in a
merge. What this note still asks for is the harder thing: a bare string reaching a text
SINK it was never routed through the catalog for, which no AST shape can see. Read the ban
as evidence the mechanism works in this config, not as the requirement met.

Four limits, stated because each is a place the next one gets in. They have changed twice
since the ban landed, so read them against `eslint.config.mjs` rather than from memory —
the selector is two rules now, not one.

- **Scope is three regions, and a region joins only once it is swept.** `render/`,
  `interactions/menu.ts` and `manual/typesSection.ts`. The menu came in with
  `render/timeline.ts` because the two hold one fold label between them and a ban over half
  of that guarantee is not the guarantee. The types section came in on 2026-08-18, when its
  `are`/`is` agreement became one catalog key — that order is the rule and not the
  accident: ban a directory before sweeping it and the result is a wall of errors somebody
  switches off. Still unbanned: the rest of `interactions/` (`structure.ts` holds
  `runInit`'s outcome notice, whose OUTER sentence is assembled too — keying the fragment
  alone would be this defect one level up), `ui/`, `commands/`, `manual/sections.ts`, and
  `domain/` — where the count was wrong and so was the reason. It is **six** instances, and
  **five** are generated README prose that must stay English; the sixth,
  `markerLaneCaption` in `domain/roadmap.ts`, is live roadmap UI text and is owed to
  `Every surface translated` like any other rendered string. Measured on 2026-08-18 after
  "seven, all README prose" had been restated twice — a claim of that shape is exactly what
  tells the next sweeper a directory is safe to skip.
- **A capital letter is what separates a sentence from an identifier, and that is a
  heuristic.** Every identifier this plugin writes is lowercase — CSS class, icon id, ARIA
  value, `data-` key, catalog key — so a capital in a picked literal reads as prose. Its
  ceiling is a lowercase sentence, and one is live inside a banned directory:
  `' — inferred from children'` in `render/lanes.ts`. Not a regression the rule let in, and
  naming it is what stops the ban being read as "`render/` is clean".
- **It still cannot tell a class name from a sentence** where the class is capitalized, and
  the `t()` exclusion is what keeps a key ternary — `t(a ? 'k.one' : 'k.two')` — legal at
  all. Checking a shape rather than a meaning is what buys the rule its reach, and this is
  the bill.
- **It sees one spelling.** A sentence assembled by `+`, by `.join()`, or by a ternary
  between two template literals passes untouched. `render/cardChildren.ts` was the worked
  example until it was swept: a ternary AND a `+` joining a translated fragment on with an
  em dash, of which this rule could only ever have seen the first half.

The rest of this note is still design.

What it constrains is every rendering module — `src/view/render/toolbar.ts`,
`src/view/render/rows.ts`, `src/view/render/columns.ts`,
`src/view/render/emptyStates.ts`, `src/view/interactions/menu.ts`,
`src/view/backlogView.ts`, `src/view/writeGate.ts`, `src/ui/prompts.ts`,
`src/commands/scaffold.ts` and
`src/main.ts` — plus `src/domain/viewOptions.ts`, whose option objects are text
destinations with no setter to ban.
