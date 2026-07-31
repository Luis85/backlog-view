# Releasing and community directory submission

## Cutting a release

Either path below ends in the **Release** workflow building the plugin and creating a
GitHub release with `main.js`, `manifest.json` and `styles.css` attached as individual
assets. Both refuse to publish over a version that already has a release.

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
