import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * Validate `docs/` — the backlog register and the ADRs — against itself and against the
 * source tree.
 *
 * This exists because `docs/README.md` used to *advertise* these checks while they lived
 * only in whatever ad-hoc script last ran. An advertised invariant nobody can run is
 * worse than none: it invites trust it has not earned, and it had already quietly gone
 * false once. Everything the README claims is checked is checked here, and `npm run
 * check` runs it.
 *
 * The register is the plugin's own schema, so a wrong parent or a duplicate sibling
 * order here is a bug in the example — which is why the hierarchy rules are enforced
 * rather than described.
 */

const DOCS = "docs";
const LEGAL_CHILDREN = {
	Epic: new Set(["Feature", "Issue", "Bug"]),
	Feature: new Set(["PBI", "Issue", "Bug"]),
	PBI: new Set(["Task", "Issue", "Bug"]),
	Task: new Set(),
	Issue: new Set(["Task"]),
	Bug: new Set(["Task"]),
};
/**
 * Sections every use case carries — the shape documented in `docs/README.md`, including
 * all four rows of the table. Checking only `Actor` would let a use case ship without the
 * trigger or the guarantee, which are the two rows that do the most work.
 */
const USE_CASE_SECTIONS = [
	"**As**",
	"## Use case",
	"| **Actor** |",
	"| **Trigger** |",
	"| **Preconditions** |",
	"| **Guarantee** |",
	"**Main flow**",
	"**Extensions**",
	"## Acceptance criteria",
	"## Where it lives",
];
const ADR_SECTIONS = ["## Context", "## Decision", "## Consequences", "## Alternatives", "## Revisit when"];
const ADR_STATUSES = new Set(["Accepted", "Superseded", "Proposed"]);
const ADR_AREAS = new Set(["architecture", "domain", "platform", "storage", "testing", "tooling"]);
/**
 * Folders whose notes describe the code as it is now, so every path they name must
 * exist. The others (`tasks/`, `issues/`, `bugs/`) are records of a moment and may name
 * a file that has since been split or removed — rewriting them would falsify the record.
 */
const LIVING = new Set(["requirements", "adrs"]);

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

/** Wikilinks and paths inside code spans are examples, not references. */
function withoutCode(text) {
	return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

function frontmatter(text) {
	const match = /^---\n([\s\S]*?)\n---/.exec(text);
	if (!match) return null;
	const field = (name) => {
		const found = new RegExp(`^${name}:\\s*(.+)$`, "m").exec(match[1]);
		return found ? found[1].trim() : null;
	};
	return { field, raw: match[1] };
}

async function walk(dir) {
	const found = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...(await walk(full)));
		else if (entry.name.endsWith(".md")) found.push(full);
	}
	return found;
}

const exists = async (file) => {
	try {
		await stat(file);
		return true;
	} catch {
		return false;
	}
};

const files = (await walk(DOCS)).sort();
const texts = new Map(await Promise.all(files.map(async (f) => [f, await readFile(f, "utf8")])));
const stems = new Set(files.map((f) => path.basename(f, ".md")));
const allText = [...texts.values()].join("\n");

// ---------------------------------------------------------------- the backlog tree
const notes = new Map();
for (const file of files) {
	const fm = frontmatter(texts.get(file));
	const type = fm?.field("type");
	if (!type) continue; // ADRs and the READMEs are deliberately not work items.
	const parent = /^parent:\s*"?\[\[([^\]]+)\]\]"?/m.exec(fm.raw)?.[1] ?? null;
	notes.set(path.basename(file, ".md"), { type, parent, order: Number(fm.field("order") ?? 0), file });
}

const siblings = new Map();
for (const [name, note] of notes) {
	if (!LEGAL_CHILDREN[note.type]) fail(note.file, `unknown type "${note.type}"`);
	if (note.parent === null) {
		if (note.type !== "Epic") fail(note.file, `${note.type} with no parent — only an Epic is a root`);
	} else if (!notes.has(note.parent)) {
		fail(note.file, `parent [[${note.parent}]] does not exist`);
	} else {
		const parentType = notes.get(note.parent).type;
		if (!LEGAL_CHILDREN[parentType]?.has(note.type)) {
			fail(note.file, `${note.type} under ${parentType} is not a legal pair`);
		}
	}
	// The register must not demonstrate the one ranking limitation the plugin has.
	const group = siblings.get(note.parent) ?? new Map();
	if (group.has(note.order)) fail(note.file, `order ${note.order} is already taken by "${group.get(note.order)}"`);
	group.set(note.order, name);
	siblings.set(note.parent, group);
}

// ------------------------------------------------------------------- cross-references
const historical = [];
for (const file of files) {
	const text = texts.get(file);
	for (const [, target] of withoutCode(text).matchAll(/\[\[([^\]|#]+)/g)) {
		if (!stems.has(target.trim())) fail(file, `unresolved wikilink [[${target.trim()}]]`);
	}
	const living = LIVING.has(path.basename(path.dirname(file)));
	for (const [, referenced] of text.matchAll(/`((?:src|test)\/[\w./-]+\.ts)`/g)) {
		if (await exists(referenced)) continue;
		if (living) fail(file, `names ${referenced}, which does not exist`);
		else historical.push(`${file} -> ${referenced}`);
	}
}

// ------------------------------------------------------------------------ use cases
for (const [, note] of notes) {
	if (note.type !== "PBI") continue;
	const text = texts.get(note.file);
	for (const section of USE_CASE_SECTIONS) {
		if (!text.includes(section)) fail(note.file, `use case has no ${section}`);
	}
	// Extensions are numbered against the step they depart from, in step order.
	const block = /\*\*Extensions\*\*\n\n([\s\S]*?)(?=\n(?:\*\*[A-Z]|## ))/.exec(text);
	if (!block) continue;
	const labels = [...block[1].matchAll(/^- \*\*(\d+)([a-z]) /gm)].map(([, step, letter]) => [Number(step), letter]);
	const ordered = [...labels].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
	if (labels.some(([step, letter], i) => ordered[i][0] !== step || ordered[i][1] !== letter)) {
		fail(note.file, "extensions are not in step order");
	}
}

// ----------------------------------------------------------------------------- ADRs
const adrFiles = files.filter((f) => /adrs[/\\]\d{4}-/.test(f));
const numbers = new Map();
const chains = [];
for (const file of adrFiles) {
	const text = texts.get(file);
	const fm = frontmatter(text);
	if (!fm) {
		fail(file, "ADR has no frontmatter");
		continue;
	}
	for (const field of ["adr", "title", "status", "date", "area"]) {
		if (fm.field(field) === null) fail(file, `ADR has no ${field}`);
	}
	const number = Number(fm.field("adr"));
	if (numbers.has(number)) fail(file, `ADR number ${number} is already used by ${numbers.get(number)}`);
	numbers.set(number, file);
	if (!path.basename(file).startsWith(String(number).padStart(4, "0") + "-")) {
		fail(file, `filename does not match adr: ${number}`);
	}
	const status = fm.field("status");
	if (status && !ADR_STATUSES.has(status)) fail(file, `status "${status}" is not one of ${[...ADR_STATUSES]}`);
	if (status === "Superseded" && fm.field("superseded-by") === null) {
		fail(file, "Superseded without naming superseded-by");
	}
	// Resolved in a second pass below: a forward reference names an ADR this loop has
	// not reached yet, so presence is all that can be judged here.
	chains.push({
		file,
		number,
		status,
		supersedes: fm.field("supersedes"),
		supersededBy: fm.field("superseded-by"),
	});
	const area = fm.field("area");
	if (area && !ADR_AREAS.has(area)) fail(file, `area "${area}" is not one of ${[...ADR_AREAS]}`);
	if (!/^date:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(fm.raw)) fail(file, "date is not YYYY-MM-DD");
	for (const section of ADR_SECTIONS) {
		if (!text.includes(section)) fail(file, `ADR has no ${section}`);
	}
	for (const [, link] of text.matchAll(/\]\((\d{4}-[a-z0-9-]+\.md)\)/g)) {
		if (!(await exists(path.join(path.dirname(file), link)))) fail(file, `links ${link}, which does not exist`);
	}
}
for (let n = 1; n <= Math.max(0, ...numbers.keys()); n++) {
	if (!numbers.has(n)) fail("docs/adrs", `no ADR ${String(n).padStart(4, "0")} — numbering has a gap`);
}

/**
 * Supersession, resolved once every number is known. A chain that names a record which
 * does not exist is worse than none: it reads as history and leads nowhere. Both ends are
 * required to agree, because a one-sided link is how a chain rots — the superseded record
 * still looks current from the successor's side.
 */
const adrNumber = (raw) => (raw !== null && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null);
for (const link of chains) {
	// Both directions, from one table — checking only one of them is the asymmetry that
	// let a half-declared chain through, and it let it through in the worse direction.
	for (const [field, raw, mirror, mirrorField] of [
		["supersedes", link.supersedes, "supersededBy", "superseded-by"],
		["superseded-by", link.supersededBy, "supersedes", "supersedes"],
	]) {
		if (raw === null) continue;
		const target = adrNumber(raw);
		if (target === null) {
			fail(link.file, `${field}: "${raw}" is not an ADR number`);
			continue;
		}
		if (!numbers.has(target)) {
			fail(link.file, `${field}: ${target} — no such ADR`);
			continue;
		}
		if (target === link.number) {
			fail(link.file, `${field} points at itself`);
			continue;
		}
		const partner = chains.find((c) => c.number === target);
		if (adrNumber(partner?.[mirror] ?? null) !== link.number) {
			fail(link.file, `says ${field}: ${target}, but ADR ${target} does not say ${mirrorField}: ${link.number}`);
		}
	}
	// Declaring a successor while still claiming Accepted is the same failure stated in
	// one record instead of two: the record reads as current and is not.
	if (link.supersededBy !== null && link.status !== "Superseded") {
		fail(link.file, `names superseded-by but its status is "${link.status}", not Superseded`);
	}
}
const adrIndex = texts.get(path.join(DOCS, "adrs", "README.md")) ?? "";
for (const file of adrFiles) {
	if (!adrIndex.includes(`(${path.basename(file)})`)) fail("docs/adrs/README.md", `does not list ${path.basename(file)}`);
}

// -------------------------------------------------- notes the register never mentions
// The check that finds MISSING notes rather than wrong ones: a module worth its own file
// is a concern the register should be able to point at.
async function collectTs(dir, keep) {
	const found = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...(await collectTs(full, keep)));
		else if (keep(entry.name)) found.push(full);
	}
	return found;
}

const sources = [
	...(await collectTs("src", (n) => n.endsWith(".ts"))),
	...(await collectTs("test", (n) => n.endsWith(".test.ts"))),
];
for (const file of sources) {
	if (!allText.includes(file)) fail("docs", `no note names ${file}`);
}

/**
 * The two feature surfaces that are literal strings in the source, and so can be checked
 * rather than swept: a persisted view-option key, and a command id. Both are promises to
 * the user — an option key is *stored in their `.base` file* — so one arriving with no
 * note naming it is a capability nobody specified.
 *
 * The other surfaces in the sweep (menu items, toolbar controls) are display text, and
 * the register describes them in prose rather than quoting them. Those stay a hand sweep;
 * see `docs/issues/Sweep the register against the code.md`, which says which is which.
 */
const surfaces = [
	["view option", "src/domain/viewOptions.ts", /\bkey: '([^']+)'/g],
	["command", "src/main.ts", /\bid: '([^']+)'/g],
];
for (const [kind, file, pattern] of surfaces) {
	for (const [, name] of (await readFile(file, "utf8")).matchAll(pattern)) {
		if (!allText.includes(name)) fail("docs", `no note names the ${kind} "${name}"`);
	}
}

// --------------------------------------------------------------------------- report
const useCases = [...notes.values()].filter((n) => n.type === "PBI").length;
console.log(
	`docs: ${notes.size} backlog notes · ${useCases} use cases · ${adrFiles.length} ADRs · ${sources.length} modules`,
);
if (historical.length > 0) {
	console.log(`\n  ${historical.length} historical path reference(s) in record notes (allowed, not an error):`);
	for (const line of historical) console.log(`    ${line}`);
}
if (problems.length > 0) {
	console.error(`\n✗ ${problems.length} problem(s):`);
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}
console.log("✓ register and ADRs consistent");
