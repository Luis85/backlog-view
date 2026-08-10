---
type: Issue
parent: "[[Codebase health]]"
order: 260
status: Open
area: platform
priority: P3
created: 2026-08-03
source: Review of 0.4.0, finding 17 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
---

# Finding 17 — obsidian version drift has no owner

## The finding

`manifest.json` sets `minAppVersion` 1.10.2 against the young Bases custom-view API, and the typings trail the app in places. ADR 0019 put dependencies on a clock; the host app is on none.

## Why it matters

Nothing notices when Obsidian changes something the view rests on, and the live-vault sweep only catches it if someone runs it.

It had already happened when this note was written, in the direction nobody was watching — not the app moving under the plugin, but the plugin moving past the app it claimed. The Bases `options` callback is handed the base's configuration only from **1.12.0**; before that it was called with nothing. `getViewOptions` took `config?` and fell back to `defaultSettings()`, so on the 1.10.2 the manifest promised, the view-options menu advertised the shipped `docs/…` type folders inside any other base and offered no WIP-limit or column-policy box at all. The `^1.13.1` typings compiled it without complaint through eleven releases, because typings are not a floor.

## Where it is tracked

Half of it now has an owner. `minAppVersion` is **1.12.0** (2026-08-10) and the fallback is deleted; the `obsidian` devDependency is pinned to `~1.12.3` so the compiler refuses an API the manifest does not promise, with the reasoning in `.github/dependabot.yml` beside the `@types/node` entry it copies. That is the cheap guard for drift in the direction that bit: the plugin cannot silently start needing a newer app.

The other direction still has none, and it is the one this note named: nothing notices when a **newer** Obsidian changes something the view rests on. The open question is unchanged — whether the sweep gains a second conditional trigger on an Obsidian upgrade, the way [[Verify base identity in a live vault]] already has one — which would cost nothing and belongs in [[A cadence for the checks CI cannot run]].

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
