---
type: Feature
parent: "[[Multilang]]"
order: 10
status: Open
---

# Translation layer

The mechanism: where strings live, how a locale is chosen, and how a message with a
number or a name in it is assembled without being concatenated.

Everything else in this epic is a consumer of this feature, so it lands first and it
lands whole. A half-built layer means the sweep translates a hundred strings against an
interface that then changes.

## Where it sits

The layer diagram in `CLAUDE.md` has no room for this. `ui/` may import nothing at all
(`forbidden('ui', ['view', 'commands', 'domain', 'storage'])` in `eslint.config.mjs`) and
`ui/prompts.ts` has 13 string sites; `domain/` may not reach view, storage, ui or
commands. So a catalog placed in any existing directory is unreachable from at least one
of its callers.

It has to be a **new leaf below everything**: `src/i18n/`, importable by every layer,
importing none of them. That is the same shape `ui/` has, one level lower, and it needs
the same mechanical statement — a `forbidden('i18n', [...])` entry listing every other
directory, so the leaf cannot quietly grow an edge back up.
