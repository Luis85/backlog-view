---
type: Bug
parent: "[[Backfill missing properties]]"
order: 20
status: Open
area: storage
priority: P2
created: 2026-08-14
source: this repository's own register, after ✨ ran against it in a live vault on 2026-08-14
files:
  - src/storage/frontmatter.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A hash in a value is a comment the first rewrite erases

## What happened

✨ was pressed with `docs/` open as a vault. The backfill stubs missing optional keys, so
it rewrote the frontmatter of every result note — and on the way through, **about forty
notes lost the tail of their `source:` value**. `source: 2026-08-02 Codex review of PR
#56, found while fixing the milestone line's twin` came back as
`source: 2026-08-02 Codex review of PR`. Multi-line plain scalars were also re-folded
onto one line, with their content intact — only the `#` case loses anything.

The forty truncated entries were restored from git the same day; this note records the
mechanism, which is still live.

## Why

YAML: in a plain (unquoted) scalar, ` #` begins a comment. So the tail of every such
value was semantically a comment all along — Obsidian's own Properties panel already
displayed the value truncated — and the bytes survived only because nothing had ever
re-serialized the block. `processFrontMatter` parses and rewrites the whole frontmatter,
and comments do not survive a rewrite. ANY write this plugin makes to such a note
materializes the loss for that note; the backfill is only the amplifier, because one
click rewrites every result in the base.

## What the plugin can and cannot do

The serialization is Obsidian's — `processFrontMatter` hands the callback a parsed
object, so by the time this plugin sees the value the comment is already gone, and there
is no shape it could write that would put it back. What the plugin cannot do is therefore
the whole of it: this is recorded as a hazard of writing at all, not as something a
guard in `storage/` could catch.

What a vault owner can do: quote any frontmatter value that contains ` #`
(`source: "review of PR #56, ..."`), which makes the hash part of the value in every
YAML reader, this plugin and Obsidian's Properties panel alike.

## Evidence

The truncations were visible as one deleted line per note in `git diff` after the
backfill ran — every deletion a `source:` line ending exactly where the first ` #`
stood. The restoration compared each dirty note's folded `source` entry against git and
put back the forty whose live value was a strict prefix of the recorded one.
