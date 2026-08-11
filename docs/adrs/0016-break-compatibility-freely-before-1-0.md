---
adr: 16
title: Break compatibility freely before 1.0
status: Accepted
date: 2026-08-01
area: platform
---

# ADR 0016 — Break compatibility freely before 1.0

## Context

Two kinds of compatibility could be carried here, and they are not the same thing:

- **Plugin versions.** A view option that was renamed or removed; a persisted key whose
  meaning changed. Bases stores view options in the user's `.base` file, so old values are
  genuinely still on disk.
- **Obsidian versions.** `minAppVersion` in the manifest.

The plugin is at 0.x. Real migration code had already started appearing — a folder
compatibility layer, a fallback for bases configured before the home folder existed, a
"guess must not outrank evidence" rule for reconciling old and new settings — and each one
was a branch that could only be tested against a state nobody could produce any more.

## Decision

**Before 1.0, breaking changes are free. Userland follows.**

- No shim, fallback or migration for an older *plugin* version. When an option is removed,
  values users set for it stop being read.
- `minAppVersion` is a **floor, not a range**. A shim for an Obsidian older than it is dead
  code by definition — submenus, for instance, predate 1.12.0, so there is no fallback path
  and should not be one. Raising the floor is therefore a *deletion*: moving it to 1.12.0
  (2026-08-10) removed `getViewOptions`'s optional-config fallback, which existed only to
  serve an Obsidian that passed the callback nothing.
- The `obsidian` devDependency **tracks the floor**, not npm's newest, for the same reason
  `@types/node` tracks the `engines` floor: typings ahead of `minAppVersion` typecheck an
  API the claimed app may not have, and there is no gate here that would catch it. See
  `.github/dependabot.yml`.
- Release tags equal the `manifest.json` version with **no `v` prefix**; the release
  workflow rejects a mismatch.

## Consequences

- Decisions can be **reversed cleanly**. [ADR 0013](0013-fix-the-type-vocabulary-at-six-names.md)
  removed two options the day they shipped, and removed them entirely rather than leaving
  a reader for values nobody should still have.
- Every branch in the code is reachable from a state a current user can be in. Untestable
  branches were the concrete harm: the compatibility layers that existed could not be
  driven by any fixture, so they were coverage that proved nothing.
- The version number carries the warning. 0.x means what it means, and the changelog says
  what broke.
- The exposure is real: someone who set `Levels: Initiative, Epic, Story` before 0.3.0 was
  silently returned to the fixed vocabulary. Accepted, because the alternative is carrying
  a reader for a schema that no longer has rules to enforce.
- **This ADR expires at 1.0.** After that the same reasoning inverts, and each removal
  needs its own decision.

## Alternatives

- **Migrate persisted options forward.** Correct after 1.0, and before it means writing
  migration code for schemas that are still moving — the folder layer was written and
  deleted within a day.
- **Deprecate first, remove later.** A deprecation window needs users to notice, which
  needs a release cadence and a changelog people read. At 0.x neither exists yet.
- **Support a range of Obsidian versions.** The Bases custom view API arrived in 1.10.2
  and the plugin is built on it ([ADR 0001](0001-build-on-the-bases-custom-view-api.md));
  the floor sits at 1.12.0 because that is where the API became able to state this view's
  options correctly. There is no older behaviour to be compatible with.

## Revisit when

1.0 — which is precisely the meaning of 1.0, and the point at which this record should be
superseded rather than edited.
