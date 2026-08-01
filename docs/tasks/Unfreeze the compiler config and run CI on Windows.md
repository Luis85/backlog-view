---
type: Task
order: 90
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
closed: 2026-08-01
created: 2026-08-01
source: tsc 6.0.2 run against tsconfig.json, and the Windows-only defect found while planting the register corpus
files:
  - tsconfig.json
  - .github/workflows/ci.yml
  - docs-check.mjs
  - test/docs/checkerAccepts.test.ts
---

# Unfreeze the compiler config and run CI on Windows

## Evidence

Two measurements, taken separately, that turned out to be the same shape: a gate reporting
green because the condition that would fail it cannot arise in the one environment the gate
runs in.

**The compiler.** `tsconfig.json` set `baseUrl: "."` and `moduleResolution: "node"`.
TypeScript 6.0.2, run against that file unchanged, does not warn about either — it errors:

```
tsconfig.json(3,5):  error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.
tsconfig.json(12,25): error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0.
```

Every run of `npm run build` was green because `package.json` pins `typescript: ^5.6.3`,
which can never resolve to 6.x. The configuration was not passing; it was out of reach of
the thing that would fail it.

**The platform.** `.github/workflows/ci.yml` ran `ubuntu-latest` and nothing else. A
Windows-only failure had already shipped through it: `docs-check.mjs` builds every path it
reports with `path.join`, so on Windows it says `docs\adrs\0001-….md` where the corpus in
`test/docs/` expects `/`, and roughly eighty assertions would have failed for a verdict the
checker got right. That one was found by reading, closed while planting the corpus
([[Plant a corpus the register gate runs against]]), and left nothing behind that would
catch the next one.

There was a next one, and it was larger. A CRLF checkout of this repository — which is what
Git for Windows produces by default, whatever the object store holds — makes the gate report
**136 problems and "0 backlog notes"**, because `frontmatter` opens with `^---\n` and matches
nothing against `\r\n`. Every note in the register reads as having no `type`. Measured by
converting `docs/`, `src/` and `test/` to CRLF in a scratch tree and running the real script
over it.

## Why it matters

[[Invariants as checks, not conventions]] promises that `npm run check` is the whole gate and
that CI runs the same command. Both findings are that promise holding in one configuration
and quietly not being tested in the others: a compiler version the pin cannot reach, and an
operating system the matrix does not have. Neither is a rule that was written down and
skipped — they are rules with no place they could fail.

The register's own claim is the sharper one. `docs/README.md` argues at length that an
advertised invariant nobody can run is worse than none. A gate that reports 136 problems
about a correct register on the platform half of contributors use is the same failure from
the other side: a check that runs, and is wrong, and blames the documents.

## Approach

Ordered, because the second step is what proves the first two.

1. **`tsconfig.json`.** Confirm nothing depends on the deprecated options before removing
   them — no `paths` mapping anywhere, and every import in `src/` and `test/` either relative
   or a bare package specifier (`obsidian`, `vitest`, `node:*`), so `baseUrl` resolves
   nothing. Remove `baseUrl`; move `moduleResolution` to `"bundler"`, which is what esbuild
   already does at bundle time and which `module: "ESNext"` already satisfies.
   `ignoreDeprecations` was rejected: it silences the report and leaves the configuration
   exactly as frozen, one major version later, with the escape hatch itself removed in 7.0.
2. **`docs-check.mjs`.** Normalize line endings once, at the read, rather than teaching
   twenty patterns about `\r`. A per-pattern fix is twenty chances to forget one, and the
   next pattern added starts out wrong; the subject of every rule in that file is a
   document's structure, never which bytes its checkout used to end a line.
3. **The workflow.** `windows-latest` beside `ubuntu-latest`, with `fail-fast: false` so the
   legs cannot cancel each other — the question this matrix exists to answer is precisely
   which platform failed.

A `.gitattributes` declaring `eol=lf` was considered and rejected. It would make the Windows
checkout byte-identical to the Linux one and turn the whole CRLF question off, which is the
attraction and also the objection: the Windows leg would then be testing a normalized clone
rather than the tree a Windows contributor actually has, and the defect above would go back
to being invisible — this time behind a file that looks like configuration hygiene. The
underlying defect is a Markdown gate that cannot read Markdown as half the world writes it,
and that is what got fixed. The setting can still be added later for other reasons; it is
not a substitute for this.

## Acceptance criteria

- `tsc` 6.0.2 exits 0 against `tsconfig.json`, and `npm run build` still passes on the pinned
  5.6.
- The emitted `main.js` is byte-identical across the change — esbuild reads `tsconfig.json`
  for resolution, so this is not a typecheck-only edit and cannot be assumed.
- The register gate accepts a CRLF checkout, pinned by a case in `test/docs/checkerAccepts.test.ts`
  that fails against the unfixed script.
- CI runs every step of `npm run check` on `windows-latest` as well as `ubuntu-latest`, and
  neither leg can cancel the other.

## Risks

The Windows leg has never run. **Obsidian cannot run in this repository and neither can
Windows**, so everything above was verified on Linux — including the CRLF condition, which
was simulated by converting a scratch checkout rather than observed on the platform that
produces it. Path separators could not be simulated at all; that half rests on reading the
code, and the reading says the two places that mix separators (`path.sep` against the notes'
`/`, and the report the corpus parses) are already normalized. The PR's first Windows run is
the verification, and the honest expectation was that it would find something the reading
missed.

Three specific things the reading could not settle: whether `fallow` — a native binary, with
a `win32-x64` build in the lockfile — agrees with itself about paths when it reads a coverage
file whose keys are absolute Windows paths; whether removing a temporary tree immediately
after a subprocess read it hits the `EPERM`/`EBUSY` that `fs.rm`'s `maxRetries` option exists
for; and whether any assertion in 486 tests depends on a separator nobody thought about. All
three were left alone deliberately rather than pre-emptively patched, so that whatever the
first red run reports is evidence rather than a guess that happened to be right.

## Outcome

Both configurations now fail when they are wrong.

`tsc` 6.0.2 exits 0 against the new `tsconfig.json`; the pinned 5.6 still does; and
`main.js` hashes to `5fbfec68a5de0d33707b5a0ddd1a2344` before and after — byte-identical,
which is the answer to the only question the change actually raised. `moduleResolution:
"bundler"` changed no resolution because nothing in either tree was resolving through
`baseUrl` in the first place; the two options were dead weight that a future compiler was
going to charge for.

The CRLF fix is the larger of the two, and it was not what this task set out to find. The
Windows bug this repository already knew about was cosmetic — a separator in a message — and
the one hiding behind it made the gate reject the entire register. That is the argument for
adding the platform rather than fixing the report: a class of failure produces more than one
member, and the second one was worth 136 false problems. Converted to a checked property
rather than a fixed bug, it sits in `test/docs/checkerAccepts.test.ts` as one more legal form
the register does not itself use, and it runs on Ubuntu too — the corpus is written by the
test, so the condition travels with it instead of waiting for the right runner.

What this task did not anticipate: that the whole test suite already passed under CRLF, and
only `npm run docs` did not. The suite reads files from disk in three places and every one of
them happened to be tolerant — `surfaces.test.ts` extracts inline code spans, which survive
`\r`, and its fenced-block pattern, which does not, contributes nothing the inline one does
not already find. So the damage was concentrated entirely in the one tool nobody had a
reason to think of as a parser. It is the most parser-like thing in the repository, and it
was the only file with a hand-rolled frontmatter reader — a limitation
[[The checker reads frontmatter its own way]] had already recorded, for an unrelated reason,
and which turns out to be exactly where the platform assumption was living.
