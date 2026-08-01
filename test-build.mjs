import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * Build the plugin into a vault inside this repository — `.obsidian/plugins/<id>/`,
 * with the repository root as the vault.
 *
 * Everything this project cannot check for itself needs a running Obsidian: appearance
 * (jsdom renders nothing), and every Bases API this code has to assume rather than
 * exercise. Making the repository its own test vault removes the setup that was
 * standing between a change and that check — no second checkout, no symlink, no copying
 * three files by hand after every edit.
 *
 * The plugin folder is a build artifact and is gitignored, so this can be re-run
 * freely and never shows up in a diff.
 */

const VAULT_FILES = ["main.js", "manifest.json", "styles.css"];

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const vaultDir = ".obsidian";
const pluginDir = path.join(vaultDir, "plugins", manifest.id);

// A development bundle, not the release one: unminified and sourcemapped, because the
// point of this build is to be debugged.
execFileSync(process.execPath, ["esbuild.config.mjs", "once"], { stdio: "inherit" });

await mkdir(pluginDir, { recursive: true });
for (const file of VAULT_FILES) {
	// styles.css is hand-edited source rather than a build artifact — the readable copy
	// is the one worth debugging against, so it is copied as it stands.
	await copyFile(file, path.join(pluginDir, file));
}

const listed = await enablePlugin(manifest.id);

console.log(`\n${manifest.name} ${manifest.version} → ${pluginDir}`);
console.log("Open this folder as a vault in Obsidian (or reload it if it is already open).");
if (listed) {
	// Said once, on the run that creates the list — which is the run that is opening a
	// vault for the first time, and the only one where this is news.
	console.log("First open: Settings → Community plugins → turn off Restricted Mode.");
}
console.log("The plugin is in the vault's enabled list. Bases is a core plugin and must be on too.");

/**
 * Add the plugin to the vault's enabled list, so opening the vault does not also mean
 * finding it in settings first. Additive on purpose: the file is read back and merged
 * rather than written wholesale, since a real test vault accumulates other plugins and
 * this script has no business dropping them. Returns true when this run added it.
 *
 * The list is as far as this goes. A vault opened for the first time is in Restricted
 * Mode, and NO entry here loads a plugin until that is turned off — which is a security
 * decision belonging to the person opening the vault, not to a build script. It is also
 * the kind of claim this repository refuses to make on trust: the setting is Obsidian's
 * own, it cannot be exercised here, and a script that wrote it and was wrong would leave
 * a plugin that silently never loads with a message saying it had. So the run that
 * creates the list says the step out loud instead.
 */
async function enablePlugin(id) {
	const listPath = path.join(vaultDir, "community-plugins.json");
	let enabled = [];
	try {
		const parsed = JSON.parse(await readFile(listPath, "utf8"));
		// Anything else on disk is not a list this script wrote; replacing it is the
		// safe reading, since the alternative is spreading a malformed file.
		if (Array.isArray(parsed)) enabled = parsed.filter((entry) => typeof entry === "string");
	} catch {
		// No vault config yet: this run is creating it.
	}
	if (enabled.includes(id)) return false;
	enabled.push(id);
	await writeFile(listPath, `${JSON.stringify(enabled, null, 2)}\n`);
	return true;
}
