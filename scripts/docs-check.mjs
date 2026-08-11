import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { collapsed, containerAt, headings, localLinks, markers, prose, proseWithSpans, sectionBody, tablesWith, wikilinks } from "./docs-markdown.mjs";

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
/**
 * The plugin's OWN rule, applied to the register that documents it — so this table has to
 * track `childTypeChoices` (`src/domain/itemTypes.ts`), which answers
 * `[ladderChild, ...EXTRA_TYPES]` for any parent on the ladder. The four extra types are
 * therefore one set repeated at each rung, and each of them takes Tasks: an extra type's
 * rank is pinned at `EXTRA_TYPE_RANK`, the rung whose children are the deepest level.
 *
 * `Deliverable` was missing here for the whole of the increment that introduced it, which
 * is why the register could not hold the very type the plugin had just started shipping.
 * `Idea` arrived on main while `Deliverable` was being built on this branch, neither
 * knowing about the other. Adding a type to `EXTRA_TYPES` means adding it here too.
 */
const EXTRA = ["Issue", "Bug", "Idea", "Deliverable"];
/**
 * NULL-PROTOTYPE, because every key read against it is user data — a `type:` a note
 * declares, or a type name written into the README's hierarchy table. A plain object
 * literal answers `LEGAL_CHILDREN["toString"]` with an inherited FUNCTION, which is
 * truthy: a note typed `toString` sailed past the `unknown type` check for as long as this
 * table has existed.
 *
 * Kept through the merge deliberately — main's copy of this table is still a plain object
 * literal, because the fix landed on this branch after main forked.
 */
const LEGAL_CHILDREN = Object.assign(Object.create(null), {
	Epic: new Set(["Feature", ...EXTRA]),
	Feature: new Set(["PBI", ...EXTRA]),
	PBI: new Set(["Task", ...EXTRA]),
	Task: new Set(),
	Issue: new Set(["Task"]),
	Bug: new Set(["Task"]),
	Idea: new Set(["Task"]),
	Deliverable: new Set(["Task"]),
	// A marker holds nothing and hangs from nothing: no children, and a root of its own.
	Milestone: new Set(),
	// The test catalog's own ladder — a second one, and it touches the first nowhere
	// except at `Task`, the rung they share. Neither test type is ever a legal child of a
	// plan type or the reverse: the relationship between a test and the work it checks is
	// a coverage PROPERTY, and a schema offering two ways to say it would get both.
	"Test suite": new Set(["Test case"]),
	"Test case": new Set(["Task"]),
});
/**
 * The types that legitimately have no parent, and a SEPARATE set from `LEGAL_CHILDREN`
 * above — only this one decides whether a parentless note is rejected, so a type added to
 * the table and not to this list is a type the register cannot hold as a root.
 *
 * An `Epic` is a root by POSITION — the top of the ladder — while a `Milestone` and a
 * `Test suite` are roots by NATURE: a release date is owned by the plan rather than by an
 * epic, and a suite hangs from nothing because the tests are their own list rather than a
 * branch of the plan. The suite is the first root by nature that has CHILDREN, which is
 * what makes these two questions rather than one.
 */
const ROOT_TYPES = new Set(["Epic", "Milestone", "Test suite"]);

/** `a, b or c` — so the rejection message stays a sentence as this set grows. */
const andList = (names) =>
	names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
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
/**
 * Where the `brainstorming` and `writing-plans` skills save design specs and
 * implementation plans (CLAUDE.md) — plain markdown, never a backlog note or an ADR, so
 * it carries none of the frontmatter this file requires of everything else. Anchored to
 * the `docs/` root exactly like `LIVING`, rather than a bare `superpowers[/\\].*` regex: an
 * unanchored pattern would also exempt a coincidental `docs/requirements/superpowers/`, and
 * `walk` descends nested directories so that would go unnoticed rather than unmatched.
 */
const SUPERPOWERS = path.join(DOCS, "superpowers");
const isSuperpowers = (file) => file.startsWith(SUPERPOWERS + path.sep);

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
 *
 * Present and ordered is not enough: each section must also appear **exactly once**. Two
 * branches converted the same note to a use case at the same time, neither edit conflicted
 * textually, and the merge kept both — two openings, two tables, two main flows, two
 * `## Where it lives`. Every rule here passed it, because "is it there" and "is it in
 * order" are both satisfied twice over, so the register was blessed while the note
 * contradicted itself: one guarantee said the option never touches a note on disk, the
 * other said what actually happens. A document that says a thing twice says it in two
 * versions eventually, and the checker is what has to notice.
 */
function checkSections(file, text, sections, what) {
	const found = [];
	for (const section of sections) {
		const hits = sectionHits(text, section);
		if (hits.length !== 1) fail(file, countProblem(what, section, hits.length));
		// The first index is what the order walk needs, and it is recorded even when the
		// count was wrong: a note reported for saying `## Use case` twice should not also
		// be reported for an inversion it does not have.
		if (hits.length > 0) found.push([section, hits[0].index]);
	}
	checkOrder(file, found, what);
}

/**
 * Every occurrence of one section marker, in document order — `{ index }` either way, so
 * the order walk reads both kinds the same.
 *
 * The two kinds are genuinely different documents' furniture. A `## Heading` is STRUCTURE,
 * so it is asked of the parser (`headings`) and compared whole: the prefix hole that let
 * `## Contextual` satisfy `## Context` — three times, in three places — cannot occur when
 * the comparison is between two parsed strings rather than between a pattern and the start
 * of a line. A `**Bold**` marker is not structure at all; it opens a sentence, so it stays
 * a pattern, bounded so it does not run into more word, over a document with code blanked.
 */
function sectionHits(text, section) {
	if (section.startsWith("##")) return headings(text).filter((h) => h.text === section.slice(3));
	return [...prose(text).matchAll(new RegExp(`^${escapeRe(section)}(?=\\s|$)`, "gm"))];
}

/** Missing and duplicated are one question — "how many" — so they are one message. */
const countProblem = (what, section, n) =>
	n === 0 ? `${what} has no ${section}` : `${what} has ${n} ${section} sections, expected one`;

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

/**
 * Fenced blocks removed. Both fence characters: CommonMark fences with ``` or ~~~, and
 * stripping only the first left every structural question in this file — headings,


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

/**
 * **A name Windows cannot check out**, asked of the entry as it sits on disk.
 *
 * Notes here are titled in prose, and prose contains punctuation NTFS forbids —
 * `< > : " | ? * \`, a trailing space or dot, and the reserved device names. A note called
 * `Finding 4 — "a few hundred rows" is a comment, not a check.md` was committed from Linux,
 * where it is an ordinary filename, and the Windows CI job failed at `git checkout` with
 * `error: invalid path` — before any build step, so nothing in this file ever ran and the
 * repository could not be cloned on half the platforms it supports.
 *
 * It runs inside `walk` rather than over the `.md` files walk returns, and the first
 * version got that wrong in both directions at once. Stripping `.md` to find the "stem"
 * made `A trailing thought..md` look like it ended in a dot — it ends in `d`, and Windows
 * is perfectly happy with it — while the name that actually breaks a checkout,
 * `A trailing thought.md.`, is not a `.md` file at all and so was never in the list being
 * checked. The rule is about the bytes of the directory entry, so the directory entry is
 * what it reads, extension included and before any filtering.
 *
 * Directories are checked too: a folder named `NUL` or ending in a space is exactly as
 * unclonable as a file, and `walk` is the one place both are in hand.
 */
const WINDOWS_NAME_RULES = [
	// A backslash belongs here for the same reason as the rest and is the easiest to leave
	// out: on Linux and macOS it is an ordinary character in a NAME, so `A\B.md` is a file
	// somebody can create and commit, and only Windows reads it as a separator. `/` is
	// deliberately absent — no POSIX filesystem can hold it in a name, so a rule for it
	// could never fire. This tests `entry.name`, never the joined path, which is what keeps
	// the separator on a Windows run from matching every entry in the tree.
	[/[<>:"|?*\\]/, 'uses one of `< > : " | ? * \\`, which Windows forbids — git cannot check this out'],
	// A tab or any other control character is an ordinary byte in a POSIX name — `A\tB.md`
	// is a file that commits and pushes cleanly — and Windows cannot represent any of
	// 0–31. Written as a predicate rather than a `[\x01-\x1f]` class because that class
	// trips `no-control-regex`, and silencing a rule in order to write the thing it warns
	// about is worse than not needing it. `\0` is included for free and is unreachable, for
	// the same reason `/` is absent above.
	[{ test: (name) => [...name].some((c) => c.charCodeAt(0) < 32) }, "holds a control character, which Windows cannot represent"],
	[/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, "is a reserved device name on Windows"],
	[/[ .]$/, "ends in a space or a dot, which Windows cannot represent"],
];
function checkWindowsName(full, name) {
	for (const [pattern, why] of WINDOWS_NAME_RULES) if (pattern.test(name)) fail(full, `name ${why}`);
}

async function walk(dir) {
	const found = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		checkWindowsName(full, entry.name);
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

/**
 * A note's text, with its line endings normalized on the way in.
 *
 * Every structural question below is asked of `\n`: `frontmatter` opens with `^---\n`, and
 * the **Main flow** and **Extensions** blocks are found by `\*\*Extensions\*\*\n+`. None of
 * them match `\r\n`, and `\r\n` is what an ordinary Windows clone has — Git for Windows
 * checks out CRLF by default whatever the object store holds. So the gate read the whole
 * register as typeless and reported 136 problems about documents that were correct: a false
 * failure, on every note at once, and the one direction this project holds is more expensive
 * to get wrong. It was invisible because the workflow ran on Ubuntu alone.
 *
 * Done once, here, rather than by teaching twenty patterns about `\r`. A per-pattern fix is
 * twenty chances to forget one and leaves the next pattern added starting out wrong; and the
 * subject of every rule in this file is the document's structure, never which bytes the
 * checkout happened to use to end a line.
 */
const readText = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");

const files = (await walk(DOCS)).sort();
const texts = new Map(await Promise.all(files.map(async (f) => [f, await readText(f)])));
const stems = new Set(files.map((f) => path.basename(f, ".md")));

// ---------------------------------------------------------------- the backlog tree
const notes = new Map();
// The register addresses work items by **basename** — that is what a `[[wikilink]]` and a
// `parent:` resolve against — so two notes sharing one is an ambiguity the whole tree is
// built on. `superpowers/` documents are exempt from carrying a `type`, never from this:
// they are ordinary prose a wikilink can still name, so a generated spec landing on a name
// already claimed is exactly the ambiguity this map exists to catch. Index pages and ADRs
// are the one class that stays outside it — addressed by *path* (`adrs/README.md`,
// `0013-….md`), which is why their names are never in question.
const usedNames = new Map();
const claimName = (file, name) => {
	if (usedNames.has(name)) {
		fail(file, `basename is already used by ${usedNames.get(name)} — a wikilink to either is ambiguous`);
		return false;
	}
	usedNames.set(name, file);
	return true;
};
for (const file of files) {
	const fm = frontmatter(texts.get(file));
	const type = fm?.field("type");
	const name = path.basename(file, ".md");
	if (!type) {
		// ADRs and the index files are deliberately not work items, and never claim a name.
		if (NOT_WORK_ITEMS.test(file)) continue;
		// A superpowers doc claims its name like any other note, but needs no backlog shape.
		if (isSuperpowers(file)) {
			claimName(file, name);
			continue;
		}
		// Anything else without a type is a note that has silently fallen out of the
		// register — no parent checked, no order, no use-case shape — which is the
		// failure mode a skip hides best.
		fail(file, "backlog note has no `type` in its frontmatter");
		continue;
	}
	// A collision here is also a silent skip in this very loop: `set` would replace the
	// first, and the replaced note would be checked for no parent, no order and no use-case
	// shape while the counts below still looked plausible.
	if (!claimName(file, name)) continue;
	const parent = /^parent:\s*"?\[\[([^\]]+)\]\]"?/m.exec(fm.raw)?.[1] ?? null;
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
		if (!ROOT_TYPES.has(note.type)) {
			fail(note.file, `${note.type} with no parent — only ${andList([...ROOT_TYPES])} can be a root`);
		}
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
	// A link the 100-column wrap breaks across two lines used to be captured with the
	// newline inside it, fail the stem lookup, and report as unresolved — a documented
	// limitation with no detection, so the contributor saw only a false "unresolved
	// wikilink". `wikilinks` flattens the wrap, so that link resolves now.
	for (const target of wikilinks(text)) {
		if (!stems.has(target)) fail(file, `unresolved wikilink [[${target}]]`);
	}
	const living = isLiving(file);
	// `proseWithSpans`, not raw text: the path lives in a code span so spans must survive,
	// but an HTML COMMENT must not — a path parked inside one renders nowhere and is not a
	// reference, the same rule the citation scan follows one section down.
	for (const [, referenced] of proseWithSpans(text).matchAll(/`((?:src|test)\/[\w./-]+\.ts)`/g)) {
		if (await exists(referenced)) continue;
		if (living) fail(file, `names ${referenced}, which does not exist`);
		else historical.push(`${file} -> ${referenced}`);
	}
	// Every relative markdown link, of any shape — not just the `NNNN-slug.md` between
	// ADRs. A link to `assets/diagram.svg` breaks exactly as loudly as a link to a note.
	// Which destinations are LOCAL, and how each form spells its target, is the parser's
	// question now (`localLinks`): the hand-written matcher had to encode `<...>` for a
	// destination with a space ahead of the whitespace-delimited form, and getting that
	// order wrong resolved `[x](<The quick filter on the board.md>)` as a file called
	// `The` — a legal link **failed**, which is the more expensive direction here.
	for (const { href, target } of localLinks(text)) {
		if (!(await exists(path.join(path.dirname(file), target)))) fail(file, `links ${href}, which does not exist`);
	}
}

// ------------------------------------------------------------------- checked claims
/**
 * A behavioural claim may name the check that holds it, and this verifies the CITATION
 * resolves: the file is there, and the test name is still inside it. It does not verify
 * the claim — nothing in a markdown validator can, and `docs/issues/A claim in four notes
 * and nothing to check it.md` argues at length why the candidates that try are all worse
 * than the problem. This is not one of them: it compares a citation against a file, which
 * is the same thing the wikilink and source-path rules above already do.
 *
 * What it buys is the step where the author OPENS the check. The claim it was built for
 * — "the Deliverable key, states and done values fall back as one unit" — was written the
 * same day a test asserting its opposite landed in this repository, and `npm run check`
 * was green on both sides of it. It then spread to five notes before a reviewer read one
 * of them. Nothing here would have caught the wrong sentence; the author going to fetch
 * the test name would have.
 *
 * Two things it does that the source-path rule above cannot. It holds in a CLOSED note
 * too — that rule lets a historical path slide for anything outside `requirements/` and
 * `adrs/`, which is right for prose naming a file and wrong for a citation, since a
 * citation claims the check is live. And it covers the root `README.md`, which is not in
 * the register at all and is where the sentence this rule exists for was read by users.
 *
 * OPT-IN, deliberately: an unmarked claim is not checked. That is the by-name weakness
 * this file spent fifteen rounds removing, taken back on purpose — the alternative is a
 * gate with an opinion about every sentence in the register, which is the thing already
 * refused. So the honest statement of what this delivers is narrow: **a citation that
 * has rotted fails the build; a claim nobody cited is exactly as unchecked as before.**
 *
 * The MARKER is a parsed `strong` node (`markers`), never a pattern over the source, and
 * that is what makes a document showing the convention different from one using it — in a
 * code span, in an HTML comment, behind a backslash escape, all at once. The CITATION
 * after it is read from `proseWithSpans`, because its path lives in a code span by design
 * and blanking spans would blind the rule to every real one, while a citation inside a
 * FENCE is an example (`docs/README.md` has one) and must not resolve. Offsets survive
 * the blanking, so a marker's offset addresses that string directly.
 *
 * A citation is bounded by its BLOCK **and by the next marker**, so a malformed one cannot
 * reach forward and adopt a path and a quoted phrase belonging to something else. The
 * block half was a blank-line scan once, then a paragraph — which a marker in a GFM table
 * cell does not have, so the scan ran to the end of the file from the most natural place
 * to write a claim. `containerAt` answers it for any block that can hold one. The marker
 * half was missing, and the register found it immediately:
 * "one marker, one citation" put two of them in ONE paragraph, so mangling the first was
 * not reported — its scan ran on to the second and resolved that instead, leaving the
 * first claim reading as covered. Two citations in a row is the ordinary shape of the
 * convention, so the ordinary shape was the blind spot.
 *
 * An unparseable marker is a failure of its own, not a skip. The one-regex first version
 * excluded `\n` from the test name to stay bounded, so the first real citation written
 * into the register — which Markdown had wrapped across two lines — matched nothing and
 * went unchecked while `npm run docs` stayed green. A rule that quietly does nothing on
 * input it cannot parse is worse than no rule, because it reads as a check.
 */
const MARKER = "Checked by";
/**
 * A CHECK, never an implementation. The first version reused the source-path rule's
 * `(?:src|test)` alternation without asking whether it meant anything here, so
 * ``**Checked by** `src/domain/settings.ts` — "resolveSettings"`` resolved: the file
 * exists and contains that string, and a citation to the code a claim describes is the
 * claim restated, not evidence for it. `eslint.config.mjs` is admitted beside `test/`
 * because this repository's own answer to a category invariant is a lint rule rather than
 * a test — "checked at the forbidden thing", in the root `CLAUDE.md` — so refusing it
 * would make the convention unusable for exactly the checks it most wants cited.
 *
 * `.test.ts` and not any `.ts` under `test/`, because that directory holds the doubles and
 * the fixture builders too: `test/helpers/register.ts` — "useCase" resolved, the file being
 * there and the exported name being in it, and a citation nobody could open a test case
 * from is the by-name weakness this rule exists to close. The suffix is not a convention
 * borrowed from the file names either — `vitest.config.mts` runs `test/**\/*.test.ts`, so
 * the spelling this admits is exactly the set of files that get executed.
 */
const CITATION = /^[^`]*`(test\/[\w./-]+\.test\.ts|eslint\.config\.mjs)`[^`"“]*(?:"([^"]+)"|“([^”]+)”)/;
/**
 * The WRAP only — a line break and the indentation after it — never every run of
 * whitespace. Both halves of that were learned the hard way, one commit apart and in
 * opposite directions. Flattening the SOURCE too let `it("the  thing works")` be named by
 * a citation saying `the thing works`, a false pass in a rule about exactness. Flattening
 * every run in the CITATION is the inverse: a name whose doubled space is deliberate,
 * reproduced faithfully, was collapsed before the comparison and reported as stale.
 *
 * So: the citation is normalized for the one thing Markdown did to it and nothing else,
 * and the source is not normalized at all, because nothing was done to it.
 */
const flat = (s) => s.replace(/\n[ \t]*/g, " ");
for (const file of [...files, "README.md"]) {
	// The root README is reached by name rather than by the walk, so its absence is a
	// real possibility here in a way no `docs/` file's is — and a gate that CRASHED on a
	// tree without one would take every other rule down with it, reporting nothing. The
	// planted trees in `test/docs/` are exactly such a tree.
	const text = texts.get(file) ?? ((await exists(file)) ? await readText(file) : "");
	const spans = proseWithSpans(text);
	// The markers are the PARSER's bold nodes, not a pattern over the source. Three
	// constructs reached a text scan and each cost a patch — a code span naming the
	// marker, an HTML comment parking a citation, a backslash escape showing it
	// literally — and every one produced a failure on a correct document. A `strong`
	// node is none of them by construction.
	const found = markers(text, MARKER);
	for (const marker of found) {
		const owner = containerAt(text, marker.start);
		const from = marker.end;
		const next = found.map((m) => m.start).find((at) => at > marker.start);
		// No container at all means the marker is somewhere this rule cannot bound — report
		// it rather than scanning to the end of the file, which is how a malformed marker
		// would reach forward and adopt the next citation's path and name.
		const blockEnd = owner ? owner.end : from;
		const cited = CITATION.exec(spans.slice(from, Math.min(next ?? blockEnd, blockEnd)));
		if (!cited) {
			fail(file, "has a **Checked by** with no `path.test.ts` and \"test name\" after it");
			continue;
		}
		// Two delimiter pairs, each admitting the other inside it: a test name may CONTAIN a
		// quote — `test/view/board.test.ts` has one naming a state `"constructor"` — and a
		// single character class for both ends stopped at the inner one, captured a prefix,
		// and reported a correct citation as stale.
		const [, target, straight, curly] = cited;
		const name = straight ?? curly;
		// A path that climbs out of `test/` is not a test. `test/../src/domain/settings.ts`
		// matched the pattern above — `[\w./-]+` admits `..` — and then resolved to the
		// implementation, so quoting a function name off it passed as evidence. The pattern
		// says which SPELLINGS it accepts; this says where the path may actually land, and
		// only the second question can be asked of a normalized path.
		if (path.posix.normalize(target) !== target) {
			fail(file, `cites ${target}, which climbs out of the directory it names`);
			continue;
		}
		if (!(await exists(target))) {
			fail(file, `cites ${target}, which does not exist`);
			continue;
		}
		// An EMPTY normalized name resolves against every file, because `includes("")` is
		// always true — so `— "   "` read as a citation that checks out. The one false PASS
		// this rule has had, and the shape is worth naming: a check whose comparison has a
		// vacuous case reports success loudest exactly where it knows least.
		const wanted = flat(name).trim();
		if (wanted === "") {
			fail(file, `cites ${target} with an empty test name`);
			continue;
		}
		// A WHOLE quoted string in the target, not a substring of it anywhere. Free-text
		// `includes` matched an identifier and a comment as readily as a name — `"resolveSettings"`
		// resolved against the import — and, worse, survived the rename it exists to catch:
		// extending a title past the cited phrase left the citation reading as live.
		//
		// The delimiter is what makes it whole, and that is as far as this goes: it is NOT a
		// check that the string is an `it()` title, deliberately. This repository's citations
		// name table-driven case labels (`runRejections`, whose titles are `reports %s`) and a
		// lint message in `eslint.config.mjs`, neither of which is a test title anywhere in its
		// file — a rule that demanded one would refuse correct citations, which is the direction
		// held more expensive here. So a `describe` name or a case label passes, and a phrase
		// that is nobody's quoted string does not.
		// Compared against BOTH spellings, because a name is written in prose and read out of
		// source: a citation of `doesn't retry` is looking for `it('doesn\'t retry', …)`, where
		// the delimiter forced an escape the register has no reason to carry. Checking only
		// the literal form fails a citation that is exactly right — the false-failure
		// direction, and one nobody would suspect the CHECK of.
		// The CITATION is flattened, the SOURCE is not, and the asymmetry is the point: a
		// citation wraps because Markdown wrapped it, and a quoted string in source means
		// exactly the whitespace it holds. Flattening both let a file's `it("the  thing
		// works")` be named by a citation saying `the thing works` — a false pass in a rule
		// whose whole job is telling a live name from a renamed one.
		const source = await readText(target);
		const escaped = (q) => wanted.replaceAll("\\", "\\\\").replaceAll(q, "\\" + q);
		if (!["'", '"', "`"].some((q) => source.includes(q + wanted + q) || source.includes(q + escaped(q) + q))) {
			fail(file, `cites "${wanted}", which ${target} does not name`);
		}
	}
}

// ------------------------------------------------------------------------ use cases
for (const [, note] of notes) {
	if (note.type !== "PBI") continue;
	// Code stripped once, for every structural question below. `checkSections` strips for
	// itself; `between` did not, so a `## Use case` quoted in an example would bound the
	// block at the wrong place and every answer drawn from that slice would be about the
	// wrong region — a false failure rather than a false pass, and just as wrong.
	const text = collapsed(texts.get(note.file));
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
	// Every Markdown bullet marker, not just the one this register happens to use. Matching
	// `-` alone meant a `* **NOT LABELLED` bullet was not an extension the check could see,
	// so it dropped out exactly as a mistyped label used to — the same hole, one level down,
	// in the fix for it.
	const bullets = [...block[1].matchAll(/^[-*+] .*/gm)];
	if (bullets.length === 0) fail(note.file, "**Extensions** has no bullets");
	const flow = /\*\*Main flow\*\*\n+([\s\S]*?)(?=\n(?:\*\*[A-Z]|## ))/.exec(text);
	const steps = new Set([...(flow?.[1] ?? "").matchAll(/^(\d+)\. /gm)].map(([, n]) => Number(n)));
	if (steps.size === 0) fail(note.file, "main flow has no numbered steps");
	// Every extension is labelled, and departs from a step that exists. Their ORDER on the
	// page is deliberately not checked: it is the one property here a reader fixes by
	// reading, and the two rules above are what stop a label from meaning nothing.
	for (const [bullet] of bullets) {
		const label = /^[-*+] \*\*(\d+)([a-z]) — /.exec(bullet);
		if (!label) {
			fail(note.file, `extension is not labelled \`**Na — \`: ${bullet.slice(0, 60)}`);
			continue;
		}
		const step = Number(label[1]);
		if (steps.size > 0 && !steps.has(step)) {
			fail(note.file, `extension ${label[1]}${label[2]} departs from step ${step}, which the main flow does not have`);
		}
	}
}

// ------------------------------------------------------------------- verification notes
/**
 * **What makes a verification findable, and nothing else about an `Issue` or a `Test case`.**
 *
 * `RELEASING.md` derives the pre-tag sweep by querying `docs/issues/` — and, since the test
 * catalog migration, `docs/tests/cases/` — for notes carrying `## How to check` as a whole
 * heading line and reading their `cadence:`. That query is the only thing in this repository
 * leaning on either type's shape, so it is the only thing checked here. The three shapes
 * `docs/README.md` documents — a decision, a limitation, a verification — are deliberately
 * NOT enforced: most notes in `docs/issues/` do not match the one their opening heading
 * implies, and `## Outcome` is legitimately absent from a check nobody has run yet, since the
 * README says an outcome is written *after* the work. A gate that failed three-quarters of
 * the corpus would be answered by editing the corpus.
 *
 * The rule covers both `Issue` and `Test case` because a verification can now legitimately
 * be filed as either — the migration retypes what used to be an `Issue` carrying `## How to
 * check` into a `Test case` under `docs/tests/cases/`, and the sweep has to keep finding it
 * either way it lands. Once that retyping is done, an `Issue` still carrying the heading is
 * no longer a verification in the old shape; it is a misfiling — the note landed under the
 * wrong type instead of moving into the catalog — and that is worth failing rather than
 * ignoring, exactly as it was before the migration.
 *
 * The rule is a biconditional because the drift went both ways at once. Three verifications
 * headed their section `## What to look at` and the query dropped them silently — including
 * the note that owns the mobile drag verdict another note delegates to — while nothing
 * marked them as verifications at all.
 *
 * **Stated exactly**: a note that DECLARES itself a verification cannot be spelled out of
 * the sweep, and a note the sweep would find cannot leave its cadence to be guessed. What
 * this cannot see is a verification that declares itself nowhere — no cadence, heading
 * spelled freely. Nothing distinguishes that from a note about a check, and inventing a
 * heuristic for it would gate on a guess.
 */
const CADENCES = new Set(["release", "conditional"]);
const SWEPT_TYPES = new Set(["Issue", "Test case"]);
for (const [, note] of notes) {
	if (!SWEPT_TYPES.has(note.type)) continue;
	const text = texts.get(note.file);
	// Whole-line, via the same matcher every other section rule uses: `## How to check,
	// properly` heads an investigation into a CI gate that never ran, and a prefix match
	// sweeps it into a checklist of things a person is supposed to do in a live vault.
	const swept = sectionHits(text, "## How to check").length > 0;
	const cadence = frontmatter(text)?.field("cadence");
	if (swept && cadence === null) {
		fail(note.file, "carries `## How to check` but no `cadence:` — the release sweep cannot place it");
	}
	if (!swept && cadence !== null) {
		fail(note.file, `declares \`cadence: ${cadence}\` but has no \`## How to check\` heading — the sweep's query will never find it`);
	}
	if (cadence !== null && !CADENCES.has(cadence)) {
		fail(note.file, `cadence "${cadence}" is not one of ${[...CADENCES]}`);
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
/**
 * Supersession, resolved once every number is known. A chain that names a record which
 * does not exist is worse than none: it reads as history and leads nowhere. Both ends are
 * required to agree, because a one-sided link is how a chain rots — the superseded record
 * still looks current from the successor's side.
 */
for (const link of chains) {
	// Both directions, from one table — checking only one of them is the asymmetry that
	// let a half-declared chain through, and it let it through in the worse direction.
	for (const [field, raw, mirror, mirrorField, backwards] of [
		["supersedes", link.supersedes, "supersededBy", "superseded-by", true],
		["superseded-by", link.supersededBy, "supersedes", "supersedes", false],
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
		// Chronology. `docs/adrs/README.md` defines Superseded as "replaced by a **later**
		// ADR", so the numbers carry that direction and nothing was reading them. Existence
		// and reciprocity are both satisfied by a pair pointing the wrong way round — and a
		// reciprocal pair with the arrow reversed is a cycle that reads as ordinary history.
		if (backwards !== target < link.number) {
			fail(link.file, `${field}: ${target} — a record is replaced by a later ADR, so this must point ${backwards ? "backwards" : "forwards"}`);
			continue;
		}
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
const adrIndex = prose(texts.get(path.join(DOCS, "adrs", "README.md")) ?? "");
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

/**
 * `src/` only. This is the check that finds *missing* notes rather than wrong ones, and it
 * earns that for modules: **a module nothing specifies is a capability nobody asked for.**
 *
 * `test/` used to be here too and paid for itself in friction rather than defects, for the
 * reason the section below now removes: what it asserted was that a path token appears
 * somewhere under `docs/` — satisfiable by mentioning the file and describing nothing — so
 * it taxed every new test file with a register edit while guaranteeing no reader anything.
 * Naming a path is not describing it, and a suite's shape is documented where it belongs,
 * in `test/CLAUDE.md` and in the task notes that split it. Tightening what counts does not
 * bring `test/` back: the friction was the register edit, not its weakness.
 */
const sources = await collectTs("src", (n) => n.endsWith(".ts"));
/**
 * The paths a note **specifies**, as whole tokens, from the two places that specify one: a
 * use case's `## Where it lives`, and an ADR's `## Decision`.
 *
 * Nowhere else, and that is the rule. Scanning the whole register accepted a path token
 * anywhere under `docs/`, which the register itself called *"satisfiable by mentioning the
 * file and describing nothing"* when it retired the same rule for `test/`. A `Task`, an
 * `Issue` and a `Bug` are records of a moment — they are explicitly allowed to name a file
 * that has since moved — so a rule they can satisfy is a rule history can satisfy.
 *
 * The ADR arm is one SECTION rather than the record, for the same reason. `## Context` and
 * `## Alternatives` exist to describe what was considered and **rejected**, so a path there
 * is evidence a module was discussed; `## Decision` is where the choice is made.
 * `src/view/host.ts` is the case that exists — the interface the layer rule is built on,
 * owned by no use case, named in ADR 0003.
 *
 * Whole tokens, because a substring search once credited a *mistyped* path with naming the
 * real one — `src/main.tsx` contains `src/main.ts` — so a typo simultaneously passed the
 * reference check (which parses the `.ts` prefix and finds the file) and stood in for the
 * module it misspells. Trailing sentence punctuation is trimmed; `.tsx` is not, so it stays
 * the different name it is. Same rule as `test/docs/surfaces.test.ts` uses for option keys
 * and command ids, arrived at from the same failure: membership in a token set has no ends
 * to get wrong.
 */
const specified = new Set(
	[
		...[...notes.values()].filter((n) => n.type === "PBI").map((n) => sectionBody(texts.get(n.file), "Where it lives")),
		...adrFiles.map((f) => sectionBody(texts.get(f), "Decision")),
	]
		.flatMap((body) => body.match(/[\w./-]+/g) ?? [])
		.map((token) => token.replace(/[.-]+$/, ""))
		.filter((t) => t.endsWith(".ts")),
);
for (const file of sources) {
	// Notes write `/`; `collectTs` returns the platform separator. The old substring check
	// had the same split and nobody had run this on Windows to find out.
	if (!specified.has(file.split(path.sep).join("/"))) fail("docs", `no use case or ADR specifies ${file}`);
}

// ------------------------------------------------- the documented hierarchy IS the gate's
/**
 * `docs/README.md`'s hierarchy table against `LEGAL_CHILDREN`, in both directions.
 *
 * The README calls that table the authoritative statement of every legal pair and says
 * this script enforces it — and until now it enforced the register against
 * `LEGAL_CHILDREN` while nothing held `LEGAL_CHILDREN` to the table. So `Deliverable`
 * reached the plugin, then reached this gate, and reached the table only when a reviewer
 * read both: three surfaces, each complete on its own. The rule was written as prose
 * saying "add it in all three places", which is the shape this register keeps proving does
 * not hold — a comment stating a rule is not a check.
 *
 * Now it is one. A type in the table and not in the gate fails; a type in the gate and not
 * in the table fails; a children list that differs either way fails. The table's PARENT
 * column is checked as the inverse of the same map, because a contributor reads that
 * column first and an inverse nobody derives is a second place to be wrong.
 */
const HIERARCHY_HEADINGS = ["Type", "Parent may be", "Children may be"];
const readme = await readFile(path.join(DOCS, "README.md"), "utf8");
const hierarchies = tablesWith(readme, HIERARCHY_HEADINGS);
if (hierarchies.length === 0) {
	fail("docs/README.md", `no table headed ${HIERARCHY_HEADINGS.join(" | ")} — the hierarchy is documented nowhere`);
} else if (hierarchies.length > 1) {
	// Checking the first would validate one document while a reader sees two — the
	// duplicate-ROW defect one level up, found in the same review.
	fail("docs/README.md", `${hierarchies.length} tables headed ${HIERARCHY_HEADINGS.join(" | ")} — the hierarchy is documented twice`);
} else {
	const hierarchy = hierarchies[0];
	// A row may name several types at once (`Issue` / `Bug` / `Deliverable` share one), so
	// the table is flattened to the same type → children shape the gate holds.
	const documented = new Map();
	const documentedParents = new Map();
	for (const [index, cells] of hierarchy.entries()) {
		const [types, parents, children] = cells;
		// A short row does NOT get padded — mdast reports the cells that are there — so the
		// destructuring above binds `undefined` and the read below threw a TypeError, taking
		// the whole gate down with no report at all. Measured: `| \`Feature\` | \`Epic\` |`
		// crashed `npm run docs` rather than failing it, which is the shape
		// `docs/issues/A gate that did not run looks like one that passed.md` is about. The
		// row is reported and then ABANDONED, because everything after this reads three cells.
		if (cells.length !== HIERARCHY_HEADINGS.length) {
			fail("docs/README.md", `hierarchy table row ${index + 1} has ${cells.length} cells, not ${HIERARCHY_HEADINGS.length}`);
			continue;
		}
		for (const [column, cell] of cells.entries()) {
			// A name written WITHOUT backticks disappears: `code` reports the spans a cell holds,
			// so a loop over them never sees it and the cell reads as agreeing with the gate.
			// `| Spike | Epic | *(nothing)* |` left the table advertising a type the gate refuses,
			// and `` `Feature`, …, Spike `` did the same one column over. Both measured against the
			// real register before being fixed; both passed.
			//
			// CAPITALISATION is the rule, which is as far as this goes without reading English:
			// every type is a capitalised word and the prose here is lowercase connective tissue.
			// A type spelled in all-lowercase prose still slips through, and so does a name hidden
			// in markup — struck through, wrapped in `<del>`, quoted in a blockquote. Those were
			// each closed and then deliberately REMOVED: they defend against a maintainer
			// obfuscating the register rather than mistyping it, which is not what this table is
			// for, and the tighter rules would have false-alarmed on the first legitimate sentence
			// anyone added to it. `docs/issues/A rule chased past the mistakes it prevents.md`.
			const loose = cell.text.match(/\p{Lu}[\p{L}\p{M}]*/gu);
			if (loose) {
				fail("docs/README.md", `hierarchy table row ${index + 1} column ${column + 1} has ${loose.join(", ")} outside a code span`);
			}
		}
		// Distinct from the rule above, and not covered by it: a cell holding no name at all.
		if (types.code.length === 0) fail("docs/README.md", `hierarchy table row ${index + 1} names no type in code`);
		for (const type of types.code) {
			// A second row for a type is not a merge, it is a contradiction — and flattening
			// with `set` would keep the last one and call the table consistent. Found in
			// review: a stale `Deliverable` row left above the grouped
			// `Issue` / `Bug` / `Deliverable` row would have passed this check silently,
			// which is the false pass this whole rule exists to remove.
			if (documented.has(type)) fail("docs/README.md", `the hierarchy table gives ${type} more than one row`);
			documented.set(type, new Set(children.code));
			documentedParents.set(type, new Set(parents.code));
		}
	}
	const named = (set) => [...set].sort().join(", ") || "(nothing)";
	for (const type of new Set([...documented.keys(), ...Object.keys(LEGAL_CHILDREN)])) {
		const table = documented.get(type);
		const gate = LEGAL_CHILDREN[type];
		if (!table) fail("docs/README.md", `the hierarchy table omits ${type}, which LEGAL_CHILDREN allows`);
		else if (!gate) fail("docs/README.md", `the hierarchy table names ${type}, which LEGAL_CHILDREN does not allow at all`);
		else if (named(table) !== named(gate)) {
			fail("docs/README.md", `${type} may hold ${named(gate)}, and the hierarchy table says ${named(table)}`);
		}
	}
	// The inverse: X may parent Y exactly when Y is one of X's legal children.
	for (const [type, parents] of documentedParents) {
		if (!LEGAL_CHILDREN[type]) continue;
		const real = new Set(Object.keys(LEGAL_CHILDREN).filter((p) => LEGAL_CHILDREN[p].has(type)));
		if (named(parents) !== named(real)) {
			fail("docs/README.md", `${type} may hang from ${named(real)}, and the hierarchy table says ${named(parents)}`);
		}
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
