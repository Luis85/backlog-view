---
adr: 5
title: Ship with no runtime dependencies
status: Superseded
date: 2026-07-30
area: tooling
superseded-by: 18
---

# ADR 0005 — Ship with no runtime dependencies

## Context

An Obsidian plugin ships as a single bundled `main.js` that runs inside the user's editor,
loaded on every vault open. Whatever it depends on is in that file, is read by whoever
reviews it for the community directory, and is executing in a process that has the user's
notes.

The plugin's actual needs are small: parse frontmatter (Obsidian does it), resolve links
(Obsidian does it), sort, and render DOM.

## Decision

**No runtime dependencies.** `package.json` has `devDependencies` only.

The toolchain is deliberately plain:

| | |
| --- | --- |
| **TypeScript**, `strict` | The type system is load-bearing here — see [ADR 0003](0003-four-layers-enforced-by-lint.md) and the model's phase types |
| **esbuild** → one CJS bundle | `obsidian`, `electron`, CodeMirror and Node builtins external |
| **Vitest** + jsdom | [ADR 0006](0006-jsdom-is-the-substitute-for-obsidian.md) |
| **ESLint** + `typescript-eslint` + `eslint-plugin-obsidianmd` | The official ruleset, plus this project's own structural rules |
| **fallow** | Dead code, duplication, complexity, dependency hygiene |
| **Node 22** | Engines floor; CI and release run it |

## Consequences

- The bundle is the source: a reviewer reading `main.js` sees this project's code and
  nothing else. That matters for a plugin asking to write to people's vaults.
- No supply-chain surface at runtime, no transitive licence questions, and nothing to
  audit on a schedule.
- No dependency can break a user's vault on an update we did not make.
- Things a library would have given us are written here instead: tag normalization, YAML
  quoting for the scaffolded filter, fractional ranking, the tree build. Each is small,
  and each is a place a bug can live that a well-tested library would not have had.
- `fallow`'s `unused-dev-dependencies` rule is `error`, so the dev list cannot rot either.
- Obsidian's own typings trail the app, and with no shim library there is nowhere to hide
  that — the two or three call sites that cast say why in a comment.

## Alternatives

- **A YAML or frontmatter library.** Obsidian already parses frontmatter and offers
  `stringifyYaml`; a second parser would be a second opinion about the user's notes.
- **A tree or ranking library** (fractional-indexing, immutable trees). Each is a few
  dozen lines of what we need plus a general case we do not, and the ranking rules here
  are unusual enough — context rows are read but never renumbered — that the general case
  would not fit anyway.
- **A UI framework.** The view renders a few hundred rows into a container Obsidian owns,
  with Obsidian's own DOM helpers and theme variables. A framework would fight the host
  for the same job.

## Revisit when

A need appears whose correct implementation is genuinely hard and well-solved elsewhere.
Nothing so far has qualified; date parsing or a diff algorithm might.
