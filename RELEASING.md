# Releasing and community directory submission

## Cutting a release

Either path below ends in the **Release** workflow building the plugin and creating a
GitHub release with `main.js`, `manifest.json` and `styles.css` attached as individual
assets. Both refuse to publish over a version that already has a release.

**The release workflow builds; it does not gate.** Its only npm steps are `npm ci` and
`npm run build`, so lint, the tests, fallow and the docs register are not re-run at
publish time — CI runs all five on every push to `main`, and that run is the evidence.
Publishing from a red commit is therefore possible and nothing will stop it: check `main`
is green before triggering, whichever path below you take. The two things the workflow
DOES refuse are a tag that disagrees with `manifest.json` and a version that already has
a release.

The two built assets are minified: `npm run build` minifies the bundle into `main.js`
and writes a minified `styles.css` to `dist/`, which is what the release uploads. Both
stylesheets are assembled from `styles/` by `styles-assemble.mjs`, so the file to edit
is the partial — the `styles.css` at the repository root is generated and gitignored
exactly as `main.js` is. A dev vault symlinked at the repository still reads that root
file directly, and `npm run dev` rewrites it whenever a partial changes. Each built
asset also gets a signed provenance attestation, verifiable with
`gh attestation verify <file> --repo Luis85/backlog-view`.

### Before the tag: the live-vault sweep

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

### When the version files are already committed

This is the case for the **first release** (the repository was authored at `0.1.0`), and
for any later release where the bump landed on `main` but the tag did not. Do **not** run
`npm version` here — it would bump past the version you mean to publish.

- From the browser: **Actions** → **Release** → **Run workflow** on `main`. The workflow
  reads the version from `manifest.json`, creates that tag on the selected commit, and
  publishes it.
- Or from a clone, if you would rather push the tag yourself. Read the tag from the
  manifest rather than typing it, so this works for whatever version is committed:

  ```bash
  tag="$(node -p "require('./manifest.json').version")"
  git tag "$tag" && git push origin "$tag"
  ```

- Or from anything that can reach the API — `gh`, curl, or an agent session with the
  GitHub tools. This is the same manual trigger the browser offers, so it needs neither a
  checkout nor a browser, and it takes no inputs: the workflow reads the version from
  `manifest.json` itself and tags the ref you name.

  ```bash
  gh workflow run release.yml --ref main
  ```

  ```http
  POST /repos/Luis85/backlog-view/actions/workflows/release.yml/dispatches
  {"ref": "main"}
  ```

  A dispatch returns no run id, so find the run rather than assuming it: list the
  workflow's runs and take the newest, then read its jobs or logs while it goes. What
  proves it worked is the release, not a green run — check the tag exactly matches the
  manifest version and that all three assets are attached, which is the same verification
  the last paragraph of this section asks for whichever way you triggered it.

  Publishing is public and a release cannot be un-published without deleting it, so an
  agent session should have been told to release, not infer it from a merged PR.

### When you still need to bump the version

1. Make sure `main` is green (CI runs build + tests on every push).
2. Bump the version — this updates `package.json`, `manifest.json` and `versions.json`
   together and commits them:

   ```bash
   npm version patch   # or minor / major
   git push --follow-tags origin main
   ```

   The repo's `.npmrc` sets `tag-version-prefix=""` so `npm version` creates the tag as
   `0.1.1`, not `v0.1.1` — Obsidian requires the tag to exactly match the manifest
   version. The release workflow refuses tags that don't match, as a second line of
   defense.

3. The tag push triggers the **Release** workflow.

Either way, verify on the releases page that the tag name **exactly matches** the version
in `manifest.json` (`x.y.z`, no `v` prefix) and that all three files are attached.

## Submitting to the community directory (one-time)

**Done** — the plugin is listed at
[community.obsidian.md/plugins/product-backlog-view](https://community.obsidian.md/plugins/product-backlog-view).
Subsequent releases need no re-submission; see *After acceptance* below. The rest of this
section is kept as the record of what the review required.

Prerequisites — all already satisfied by this repository:

- [x] Public GitHub repository with `README.md`, `LICENSE` and `manifest.json` in the
      repository root (the directory reads the manifest from the HEAD of the default
      branch).
- [x] `manifest.json` rules: unique `id` without the word `obsidian`
      (`product-backlog-view` — verified against `community-plugins.json`), name without
      "Obsidian"/"Plugin" ("Product Backlog" — no conflict), description that starts with
      an action verb, stays under 250 characters, ends with a period, and avoids emoji and
      special characters, accurate `minAppVersion` (1.10.2, required for the Bases folder
      option), `isDesktopOnly: false` (no Node.js or Electron APIs).
- [x] A published (non-draft) GitHub release for the current version with the three
      assets (created by the workflow above).
- [x] Code guidelines: `this.app` instead of the global `app`, no `var`, no
      `innerHTML`, styling via CSS classes and `setCssProps`, `normalizePath()` for
      user-entered paths, cleanup via `Component`/`registerDomEvent`, sentence case UI
      text, error-only console output, no network calls or telemetry.
- [x] Lint-clean against Obsidian's official
      [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin) ruleset
      (`npm run lint`, enforced in CI).

Steps:

1. Sign in at [community.obsidian.md](https://community.obsidian.md) with your Obsidian
   account and link your GitHub account (verifies you own `Luis85/backlog-view`).
2. Select **Plugins** → **New plugin**, enter the repository URL
   (`https://github.com/Luis85/backlog-view`), agree to the developer policies, and
   submit.
3. The directory runs an automated review. To address feedback, push fixes and publish a
   new release with an incremented version — the submission picks up the new release
   automatically.

## After acceptance

- Announce in the Obsidian forum/Discord `#updates` if desired.
- Subsequent releases need no re-submission: publishing a new GitHub release (tag =
  manifest version) is enough for the directory to offer the update.
