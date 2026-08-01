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
const ADRS = path.join(DOCS, "adrs");
const LEGAL_CHILDREN = {
	Epic: new Set(["Feature", "Issue", "Bug"]),
	Feature: new Set(["PBI", "Issue", "Bug"]),
	PBI: new Set(["Task", "Issue", "Bug"]),
	Task: new Set(),
	Issue: new Set(["Task"]),
	Bug: new Set(["Task"]),
};
/** The headings every use case carries, in the order `docs/README.md` documents. */
const USE_CASE_SECTIONS = [
	"**As**",
	"## Use case",
	"**Main flow**",
	"**Extensions**",
	"## Acceptance criteria",
	"## Where it lives",
];
/**
 * The four fields of the use-case table, checked as **rows of that table** rather than as
 * four more strings in the sequence above. Ordering constrains where a marker sits and not
 * what it is: `| **Guarantee** |` on a line of its own between the table and the main flow
 * satisfies every position rule and is not a row of anything. What the README requires is
 * the table, so the table is what gets parsed.
 */
const USE_CASE_ROWS = ["Actor", "Trigger", "Preconditions", "Guarantee"];
/** The register's own status vocabulary, from the conventions table in `docs/README.md`. */
const NOTE_STATUSES = new Set(["Open", "Active", "Done"]);
const ADR_SECTIONS = ["## Context", "## Decision", "## Consequences", "## Alternatives", "## Revisit when"];
const ADR_STATUSES = new Set(["Accepted", "Superseded", "Proposed"]);
const ADR_AREAS = new Set(["architecture", "domain", "platform", "storage", "testing", "tooling"]);
/**
 * Folders whose notes describe the code as it is now, so every path they name must
 * exist. The others (`tasks/`, `issues/`, `bugs/`) are records of a moment and may name
 * a file that has since been split or removed — rewriting them would falsify the record.
 */
const LIVING = [path.join(DOCS, "requirements"), path.join(DOCS, "adrs")];
/** Anywhere beneath one of them: `walk` finds nested notes, so the rule has to reach them. */
const isLiving = (file) => LIVING.some((dir) => file.startsWith(dir + path.sep));
/** The only files legitimately outside the work-item hierarchy: ADRs, and the index pages. */
const NOT_WORK_ITEMS = /(^|[/\\])(adrs[/\\].*|README)\.md$/;

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);
const adrNumber = (raw) => (raw !== null && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null);

/**
 * Sections present AND in the documented order — for use cases and for ADRs alike, from
 * one function, because they are the same rule and the round that found one of them
 * un-ordered found the other still checking `includes`.
 *
 * A substring search verifies the *vocabulary*, not the shape — three ways, each closed by
 * a round of review. It found the marker **anywhere**, so a heading deleted and quoted in a
 * sentence still counted; it said nothing about **order**; and it said nothing about the
 * marker being **part of the structure it names**. So: code stripped first (a `## Context`
 * inside backticks or a fence is an example, not a heading), matched at the **start of a
 * line**, and compared for order.
 *
 * Both ends of an inversion are named. A monotonic walk blames whichever section follows
 * the displaced one, which points at the innocent party.
 */
function checkSections(file, text, sections, what) {
	const prose = withoutCode(text);
	const found = [];
	for (const section of sections) {
		const at = prose.search(new RegExp(`^${escapeRe(section)}`, "m"));
		if (at === -1) fail(file, `${what} has no ${section}`);
		else found.push([section, at]);
	}
	checkOrder(file, found, what);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Both ends of an inversion are named; see above for why the following one is the wrong one. */
function checkOrder(file, found, what) {
	for (let i = 1; i < found.length; i++) {
		if (found[i][1] < found[i - 1][1]) fail(file, `${what} has ${found[i][0]} before ${found[i - 1][0]}`);
	}
}

/** The slice a block occupies, or "" when its bounds are missing — already reported. */
function between(text, start, end) {
	const from = text.indexOf(start);
	const to = text.indexOf(end);
	return from === -1 || to <= from ? "" : text.slice(from, to);
}

/** Wikilinks and paths inside code spans are examples, not references. */
function withoutCode(text) {
	return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

/**
 * `field` reads a **value**, `has` reads a **key**, and the difference is load-bearing: a
 * bare `parent:` with nothing after it is an absent field to `field` and an explicit root to
 * `resolveParent`. A rule about what a note must *contain* asks `field`; a rule about what
 * it must not *declare* asks `has`. Which one is not a style choice — it is whichever the
 * rule is actually about, and getting it backwards is how the prohibition below first
 * shipped broken.
 */
function frontmatter(text) {
	const match = /^---\n([\s\S]*?)\n---/.exec(text);
	if (!match) return null;
	const field = (name) => {
		const found = new RegExp(`^${name}:\\s*(.+)$`, "m").exec(match[1]);
		return found ? found[1].trim() : null;
	};
	const has = (name) => new RegExp(`^${name}:`, "m").test(match[1]);
	return { field, has, raw: match[1] };
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
	if (!type) {
		// ADRs and the index files are deliberately not work items. Anything ELSE without a
		// type is a note that has silently fallen out of the register — no parent checked,
		// no order, no use-case shape — which is the failure mode a skip hides best.
		if (!NOT_WORK_ITEMS.test(file)) fail(file, "backlog note has no `type` in its frontmatter");
		continue;
	}
	const parent = /^parent:\s*"?\[\[([^\]]+)\]\]"?/m.exec(fm.raw)?.[1] ?? null;
	// The register addresses work items by **basename** — that is what a `[[wikilink]]` and
	// a `parent:` resolve against — so two notes sharing one is an ambiguity the whole tree
	// is built on. It is also a silent skip in this very loop: `set` would replace the
	// first, and the replaced note would be checked for no parent, no order and no use-case
	// shape while the counts below still looked plausible. Index pages and ADRs are addressed
	// by *path* (`adrs/README.md`, `0013-….md`), which is why their names are not in question.
	const name = path.basename(file, ".md");
	if (notes.has(name)) {
		fail(file, `basename is already used by ${notes.get(name).file} — a wikilink to either is ambiguous`);
		continue;
	}
	// `Number(field ?? 0)` manufactured a rank for a note that has none: a missing `order`
	// became 0, which is a legal-looking value that no sibling had claimed, so the note
	// passed the uniqueness check by being unranked. The register's conventions say every
	// backlog note carries a rank; a default invented by the checker is the checker
	// deciding what the note meant.
	const raw = fm.field("order");
	const order = raw === null ? null : Number(raw);
	if (order === null) fail(file, "backlog note has no `order`");
	else if (!Number.isFinite(order)) fail(file, `order "${raw}" is not a number`);
	// `status` is in the same conventions table as `type` and `order`, and was the one of
	// the three nothing checked — so the register could have violated its own documented
	// schema in the field a reader scans first.
	const status = fm.field("status");
	if (status === null) fail(file, "backlog note has no `status`");
	else if (!NOTE_STATUSES.has(status)) fail(file, `status "${status}" is not one of ${[...NOTE_STATUSES]}`);
	notes.set(name, { type, parent, order, file });
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
	// The register must not demonstrate the one ranking limitation the plugin has. An
	// unusable order is skipped here rather than compared: it is already reported above, and
	// two notes missing one are not "the same rank taken twice".
	if (!Number.isFinite(note.order)) continue;
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
	const living = isLiving(file);
	for (const [, referenced] of text.matchAll(/`((?:src|test)\/[\w./-]+\.ts)`/g)) {
		if (await exists(referenced)) continue;
		if (living) fail(file, `names ${referenced}, which does not exist`);
		else historical.push(`${file} -> ${referenced}`);
	}
	// Every relative markdown link, of any shape — not just the `NNNN-slug.md` between
	// ADRs. A link to `assets/diagram.svg` breaks exactly as loudly as a link to a note.
	// Code spans are skipped for the same reason wikilinks are: inside backticks nothing
	// renders as a link, so it is an example being quoted, not a reference being made.
	for (const [, target] of withoutCode(text).matchAll(/\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)) {
		if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
		const [linkPath] = target.split("#");
		if (!linkPath) continue; // a bare anchor into this same file
		const resolved = path.join(path.dirname(file), decodeURIComponent(linkPath));
		if (!(await exists(resolved))) fail(file, `links ${target}, which does not exist`);
	}
}

// ------------------------------------------------------------------------ use cases
for (const [, note] of notes) {
	if (note.type !== "PBI") continue;
	// Code stripped once, for every structural question below. `checkSections` strips for
	// itself; `between` did not, so a `## Use case` quoted in an example would bound the
	// block at the wrong place and every answer drawn from that slice would be about the
	// wrong region — a false failure rather than a false pass, and just as wrong.
	const text = withoutCode(texts.get(note.file));
	checkSections(note.file, text, USE_CASE_SECTIONS, "use case");
	// The whole opening sentence, not just its first word. `**As**` alone would accept a
	// note that never says what the actor wants or why — the two halves that make it a use
	// case rather than a title. Matched with `\s+` inside the markers because the 100-column
	// wrap routinely breaks them: `**I\nwant**` is the real formatting of two notes here, so
	// a literal `"**I want**"` would fail the corpus for a line break.
	const opening = between(text, "**As**", "## Use case");
	if (opening && !/\*\*I\s+want\*\*[\s\S]*\*\*so\s+that\*\*/.test(opening)) {
		fail(note.file, "use case has no `**As** … **I want** … **so that** …` opening");
	}
	// Inside the block the table occupies, and shaped like a row of it — see USE_CASE_ROWS.
	const table = between(text, "## Use case", "**Main flow**");
	for (const row of USE_CASE_ROWS) {
		if (!new RegExp(String.raw`^\|\s*\*\*${row}\*\*\s*\|.*\|\s*$`, "m").test(table)) {
			fail(note.file, `use-case table has no | **${row}** | row`);
		}
	}
	// Extensions are numbered against the step they depart from, in step order. Three
	// things are checked, and the third is what makes the label mean anything: EVERY
	// bullet is labelled (a mistyped `**3 —` would otherwise drop out silently and leave
	// the rest looking well ordered), the labels are ordered, and each names a step the
	// **Main flow** actually has — a `**99a —` departs from nowhere.
	//
	// The block is tolerant of the blank line and **loud when it cannot be read**. Requiring
	// exactly `\n\n` meant a section with one newline parsed as nothing and `continue`
	// skipped every rule below — the whole extension contract, silently, on a note that
	// still had an `**Extensions**` heading three lines up. A parser that gives up quietly
	// is the same failure as a filter standing in for a check.
	const block = /\*\*Extensions\*\*\n+([\s\S]*?)(?=\n(?:\*\*[A-Z]|## ))/.exec(text);
	if (!block) {
		fail(note.file, "**Extensions** block could not be parsed");
		continue;
	}
	const bullets = [...block[1].matchAll(/^- .*/gm)];
	if (bullets.length === 0) fail(note.file, "**Extensions** has no bullets");
	const flow = /\*\*Main flow\*\*\n+([\s\S]*?)(?=\n(?:\*\*[A-Z]|## ))/.exec(text);
	const steps = new Set([...(flow?.[1] ?? "").matchAll(/^(\d+)\. /gm)].map(([, n]) => Number(n)));
	if (steps.size === 0) fail(note.file, "main flow has no numbered steps");
	const labels = [];
	for (const [bullet] of bullets) {
		const label = /^- \*\*(\d+)([a-z]) — /.exec(bullet);
		if (!label) {
			fail(note.file, `extension is not labelled \`**Na — \`: ${bullet.slice(0, 60)}`);
			continue;
		}
		const step = Number(label[1]);
		if (steps.size > 0 && !steps.has(step)) {
			fail(note.file, `extension ${label[1]}${label[2]} departs from step ${step}, which the main flow does not have`);
		}
		labels.push([step, label[2]]);
	}
	const ordered = [...labels].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
	if (labels.some(([step, letter], i) => ordered[i][0] !== step || ordered[i][1] !== letter)) {
		fail(note.file, "extensions are not in step order");
	}
}

// ----------------------------------------------------------------------------- ADRs
/**
 * An ADR is any note under `docs/adrs/` that is not the index — discovered by **where it
 * lives**, never by whether its name looks right. Filtering on `NNNN-` would let a
 * malformed filename opt out of every ADR check by failing to look like one: no
 * frontmatter checked, no sections, no index membership, and a green run. That is the same
 * silent skip a typeless note used to get. The name is a rule to *report*, not a filter.
 */
const adrFiles = files.filter((f) => f.startsWith(ADRS + path.sep) && path.basename(f) !== "README.md");
const numbers = new Map();
const chains = [];
for (const file of adrFiles) {
	if (!/^\d{4}-[a-z0-9-]+\.md$/.test(path.basename(file))) fail(file, "ADR filename is not `NNNN-slug.md`");
	const text = texts.get(file);
	const fm = frontmatter(text);
	if (!fm) {
		fail(file, "ADR has no frontmatter");
		continue;
	}
	for (const field of ["adr", "title", "status", "date", "area"]) {
		if (fm.field(field) === null) fail(file, `ADR has no ${field}`);
	}
	// And carries neither work-item field. This is not tidiness: the runtime treats a note
	// with a `parent` OR a supported `type` as a work item, so either one silently enrols
	// the ADR in the plugin's own backlog — against the invariant both index pages state.
	// Checking the fields ADRs *should* have never notices a field they should not.
	//
	// By KEY, not by value: `resolveParent` reads a bare `parent:` with nothing after it as
	// an explicit root, which enrols the note exactly as a filled one would, while
	// `fm.field` — which wants a value — reports it as absent. The prohibition is on the
	// key being there at all, so that is what is tested.
	for (const field of ["parent", "type"]) {
		if (fm.has(field)) fail(file, `ADR carries a \`${field}\` — an ADR is not a work item`);
	}
	// A missing or non-numeric `adr` is already reported; registering it as 0 would invent
	// a duplicate and a numbering gap on top of the real problem.
	const number = adrNumber(fm.field("adr"));
	if (number === null) {
		if (fm.field("adr") !== null) fail(file, `adr: "${fm.field("adr")}" is not a number`);
	} else {
		if (numbers.has(number)) fail(file, `ADR number ${number} is already used by ${numbers.get(number)}`);
		numbers.set(number, file);
		if (!path.basename(file).startsWith(String(number).padStart(4, "0") + "-")) {
			fail(file, `filename does not match adr: ${number}`);
		}
	}
	const status = fm.field("status");
	if (status && !ADR_STATUSES.has(status)) fail(file, `status "${status}" is not one of ${[...ADR_STATUSES]}`);
	// By VALUE, and it is the counter-example to the prohibition above: this rule is that a
	// Superseded record must *name* its successor, and a bare `superseded-by:` names nobody.
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
	// `docs/adrs/README.md` says "four headings, in this order", and a record that answers
	// Consequences before Decision is a different document.
	checkSections(file, text, ADR_SECTIONS, "ADR");
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
		if (link.number === null) continue; // reciprocity needs our own number; the missing `adr` is already reported
		if (adrNumber(partner?.[mirror] ?? null) !== link.number) {
			fail(link.file, `says ${field}: ${target}, but ADR ${target} does not say ${mirrorField}: ${link.number}`);
		}
	}
	// Declaring a successor while still claiming Accepted is the same failure stated in
	// one record instead of two: the record reads as current and is not.
	if (link.supersededBy !== null && link.status !== "Superseded") {
		fail(link.file, `names superseded-by but its status is "${link.status}", not Superseded`);
	}
	// And the mirror of that, on the successor's side. `Proposed` means "written down, not
	// yet acted on", so it is the one status that cannot retire another record: a Proposed
	// successor leaves the predecessor marked Superseded with nothing in force in its place.
	// Superseded is fine here — a record that replaced one and was later replaced itself is
	// an ordinary link in a longer chain, not a decision nobody made.
	if (link.supersedes !== null && link.status === "Proposed") {
		fail(link.file, `supersedes ${link.supersedes} while still Proposed — nothing would be in force`);
	}
}
// Code stripped: the index's job is to *link* every record, and a filename quoted inside
// backticks is an example being shown, not a row pointing anywhere.
const adrIndex = withoutCode(texts.get(path.join(DOCS, "adrs", "README.md")) ?? "");
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

// Every `.ts` under both trees, helpers included: `test/helpers/view.ts` is the harness
// every view test is written against, so it is at least as worth naming as a suite.
const sources = [...(await collectTs("src", (n) => n.endsWith(".ts"))), ...(await collectTs("test", (n) => n.endsWith(".ts")))];
/**
 * The paths the docs actually name, as whole tokens. `allText.includes(file)` credited a
 * *mistyped* path with naming the real one — `src/main.tsx` contains `src/main.ts` — so a
 * typo simultaneously passed the reference check (which parses the `.ts` prefix and finds
 * the file) and stood in for the module it misspells. Trailing sentence punctuation is
 * trimmed; `.tsx` is not, so it stays the different name it is.
 *
 * Same rule as `test/docs/surfaces.test.ts` uses for option keys and command ids, arrived
 * at from the same failure: membership in a token set has no ends to get wrong.
 */
const namedPaths = new Set(
	(allText.match(/[\w./-]+/g) ?? []).map((token) => token.replace(/[.-]+$/, "")).filter((t) => t.endsWith(".ts")),
);
for (const file of sources) {
	// Notes write `/`; `collectTs` returns the platform separator. The old substring check
	// had the same split and nobody had run this on Windows to find out.
	if (!namedPaths.has(file.split(path.sep).join("/"))) fail("docs", `no note names ${file}`);
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
