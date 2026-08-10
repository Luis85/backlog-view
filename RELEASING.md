# Releasing and community directory submission

## Cutting a release

The **Release** workflow builds the plugin and creates a GitHub release with `main.js`,
`manifest.json` and `styles.css` attached as individual assets. It runs on a tag push
(the tag named exactly the `manifest.json` version, no `v` prefix) or on a manual
dispatch, which reads the version straight out of `manifest.json` on the ref you name and
creates that tag itself.

**The release workflow builds rather than gates, and REQUIRES the gate rather than
trusting you to have run it.** Its own npm steps are `npm ci` and `npm run build`, so
lint, the tests, fallow and the docs register are not re-run at publish time; CI is where
those run, and before building anything the workflow demands that run. It refuses, with
a message naming the reason, when:

- the commit is not one `main` contains — which a dispatch on the wrong ref produces in
  a single click;
- CI did not conclude successfully on that exact commit. It **waits** for a run still in
  flight rather than refusing it, because `git push --follow-tags` pushes the branch and
  the tag together and this workflow starts while CI is still starting;
- the tag disagrees with `manifest.json`;
- that version already has a release;
- that version's tag already exists on a *different* commit — what a failed attempt
  leaves behind, since the tag is pushed before the workflow runs. `gh release create`
  would publish the tag's commit while attaching assets built from this one, so the two
  have to be the same commit or nothing else here applies to what gets published.

Nothing below asks you to check those first. That is the point: they were preconditions
a person had to remember and an agent had no way to discover, and they are now the
workflow's own refusals. `manifest.json`, `package.json` and `versions.json` agreeing is
checked earlier still — by the test suite, so it fails on the pull request rather than at
publish time.

The two built assets are minified: `npm run build` minifies the bundle into `main.js`
and writes a minified `styles.css` to `dist/`, which is what the release uploads. Both
stylesheets are assembled from `styles/` by `styles-assemble.mjs`, so the file to edit
is the partial — the `styles.css` at the repository root is generated and gitignored
exactly as `main.js` is. A dev vault symlinked at the repository still reads that root
file directly, and `npm run dev` rewrites it whenever a partial changes. Each built
asset also gets a signed provenance attestation, verifiable with
`gh attestation verify <file> --repo Luis85/backlog-view`.

### 1. Get the version bumped onto `main`

Skip this step if the version files are already committed on `main` — the case for the
**first release** (the repository was authored at `0.1.0`), or for any later release
where the bump landed as part of some other merged change and only the tag is missing.

Otherwise, bump it — this updates `package.json`, `manifest.json` and `versions.json`
together and commits them:

```bash
npm version patch   # or minor / major
```

**`main` is a protected branch, and this is not this repository's own rule to relax:**
`git push` (with or without `--follow-tags`) straight to `main` is refused by GitHub
itself — confirmed by hitting the refusal directly, not assumed from documentation. Every
change here, including a version bump, goes through a normal pull request: push the
commit to a branch, open a PR, get CI green, merge. `npm version` also creates a local
tag on the pre-merge commit; that is not the tag that gets published, since the merge
commit — not this one — is what lands on `main`. Leave the local tag alone rather than
pushing it; step 3 below creates the real one, reading the version from `manifest.json`
on `main` once the bump has landed there.

The repo's `.npmrc` sets `tag-version-prefix=""` so `npm version` names that local tag
`0.1.1`, not `v0.1.1` — Obsidian requires the published tag to exactly match the manifest
version, and the release workflow refuses a mismatch as a second line of defense.

**`npm version` does not touch `CHANGELOG.md`, and the same commit must**: rename its
`## [Unreleased]` heading to `## [<version>] - <date>`, leaving a fresh, empty
`## [Unreleased]` above it for whatever lands next. `[Unreleased]` is not this step's to
fill from scratch — a pull request that changes what the plugin does adds its own bullet
there as it merges, so the bump only retitles and dates a section that already has
content. `test/release/changelogVersion.test.ts` is what makes this a check rather than a
habit: it reads `manifest.json` and fails whenever its version has no matching heading in
`CHANGELOG.md`, so a bump that forgot the entry fails `npm run check` on the pull request
rather than shipping a release nobody can tell apart from the last one.

### 2. Before the tag: the live-vault sweep

Some of this plugin's behaviour cannot be checked here at all — appearance, base identity,
whether a long press opens a menu. Obsidian does not run in the jsdom harness, so those
checks are notes in `docs/issues/` and a person is the runner. Walk them **before** the
tag: after it, the only thing a failure can produce is a second release.

1. `npm run test-build` installs the plugin into `.obsidian/plugins/` in this repository,
   so the repository root opens as a vault with `docs/` already a backlog. That is what
   makes the sweep cheap enough to actually do.
2. Ask the register for the set — do not read a list from this file. The verifications are
   the notes **in `docs/issues/` that carry `## How to check` as a whole heading line and
   are marked `cadence: release`**. One way to ask:

   ```bash
   grep -rlxZ "## How to check" docs/issues/ |
     xargs -0 awk 'FNR==1{fm=0;hit=0} /^---$/{fm++} fm==1 && !hit && /^cadence: release$/{print FILENAME; hit=1}'
   ```

   Two things in that line are load-bearing and both were wrong in an earlier version of it:

   - **`-Z`/`-0`.** Every note here is titled in prose, so every path has spaces, and the
     same query without them reports `docs/issues/Board` and `card` as missing files while
     still looking like it worked.
   - **`awk` on the frontmatter rather than `grep -l "^cadence: release"`.** A plain `grep`
     matches the whole file, so a *conditional* note that merely mentions `cadence: release`
     in prose or a fenced example is swept into the release checklist — quietly replacing
     the cadence its own outcome specifies. The `fm==1` guard reads only the first `---`
     block, which is the same place `docs-check.mjs` reads it from.

   The first stage does *not* strip code fences, so it can match a `## How to check` written
   inside an example — but such a note is only swept if its frontmatter also says
   `cadence: release`, and that combination fails `npm run check`, because the gate strips
   code before deciding whether a note is a verification. The over-match cannot reach the
   checklist while the gate is green.

   Each of the three conditions is load-bearing, and each is a case that exists in the tree
   today rather than a hypothetical:
   - **`docs/issues/` and not the whole of `docs/`** — the plans under
     `docs/superpowers/` quote draft notes verbatim, headings and `type: Issue`
     frontmatter included, so a query scoped by type or heading alone sweeps a copy of a
     note instead of the note.
   - **A whole line, not a prefix** — `A gate that did not run looks like one that passed`
     heads a section `## How to check, properly`. It is an investigation into a CI gate, not
     something a device can run, and a prefix match sweeps it in.
   - **`cadence: release`** — see below.
3. Date each note's `Outcome` with what was seen. A verification that fails becomes a bug
   note; whether it blocks the release is your call, not the sweep's.

**A check that has found nothing across two releases gets reviewed, not retired.** A quiet
result is the *expected* one here: these notes exist because nothing else watches that
behaviour, so two clean runs say it has not regressed yet and nothing about whether it can.
What retires a verification is evidence about its subject — the thing it watches is gone, or
an automated test now watches it — never its hit rate. Record the decision either way. A
sweep that drops its quietest checks empties itself while reading as disciplined.

**`cadence:` says when a verification is due**, and every note carrying `## How to check`
declares it. `release` means this sweep. `conditional` means the note keeps its own
trigger, stated in its own prose — [Verify base identity in a live vault](docs/issues/Verify%20base%20identity%20in%20a%20live%20vault.md)
asks to be repeated after an Obsidian or bundler upgrade, and running it every release would replace
the cadence its outcome specifies with a more frequent one less likely to find anything.
Those are **not** part of this sweep. A note carrying `## How to check` with no `cadence:`
is a defect in the note: fix it rather than guessing which it meant.

`docs-check.mjs` holds the two halves of that convention to each other, so a note cannot
carry `## How to check` without a cadence or declare a cadence the query will never reach.
The limit worth knowing when you trust this sweep: it checks that a note which *declares*
itself a verification is findable, not that every verification declares itself. A note with
no cadence and its own spelling of the heading is indistinguishable from a note *about* a
check, and is simply absent from the list above.

### 3. Cut the tag and publish

Once the version files are on `main` — from step 1, or because they were already there —
this is the whole remaining step. Three equivalent ways to trigger it, all of which read
the version from `manifest.json` on the ref you name and take it from there:

- From the browser: **Actions** → **Release** → **Run workflow** on `main`.
- From anything that can reach the API — `gh`, curl, or an agent session with the GitHub
  tools. This needs neither a checkout nor a browser, and takes no inputs:

  ```bash
  gh workflow run release.yml --ref main
  ```

  ```http
  POST /repos/Luis85/backlog-view/actions/workflows/release.yml/dispatches
  {"ref": "main"}
  ```

  A dispatch returns no run id, so find the run rather than assuming it: list the
  workflow's runs and take the newest, then read its jobs or logs while it goes.

- Or push the tag yourself, reading it from the manifest rather than typing it, so this
  works for whatever version is committed. `main`'s branch protection does not cover
  tags, so this succeeds even though pushing to `main` itself does not. Pull the merged
  `main` first — if step 1 ran in this same clone, `npm version` already left a local tag
  with this exact name on the **pre-merge** commit, and `git tag` refuses to reuse a name
  without `-f`; recreate it on the commit you actually mean to release rather than
  reusing or fighting the stale one:

  ```bash
  git fetch origin main && git checkout main && git merge --ff-only origin/main
  tag="$(node -p "require('./manifest.json').version")"
  git tag -f "$tag" && git push origin "$tag"
  ```

  `-f` only ever moves the LOCAL ref onto the commit just checked out; the push after it
  is a plain, non-forced push of a name that does not yet exist on the remote in the
  normal case, so it fails safely rather than silently overwriting anything there. The
  dispatch path above sidesteps all of this — it never touches a local tag.

What proves it worked is the release, not a green workflow run: check on the releases
page that the tag name **exactly matches** the version in `manifest.json` (`x.y.z`, no
`v` prefix) and that all three assets — `main.js`, `manifest.json`, `styles.css` — are
attached.

Publishing is public and a release cannot be un-published without deleting it, so an
agent session should have been told to release, not infer it from a merged PR.

