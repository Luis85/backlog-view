import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";

/**
 * The Markdown layer `docs-check.mjs` reads documents through.
 *
 * It exists because this was hand-rolled, and every defect the checker has had came from
 * here rather than from a rule: `](<A slice.md>)` refused because a bracketed destination
 * was not understood (a legal link, blocked); a CRLF checkout reported as 136 broken
 * documents; a `[[wikilink]]` Markdown wrapped across two lines unresolvable, documented
 * as a limitation with no detection; and a `**Checked by**` citation that wrapped the same
 * way matching nothing while the run stayed green. Four parser bugs, no rule bugs.
 *
 * So the parsing is a library's — see ADR 0021 for the admission. `marked` was tried
 * first and is the more attractive package by every count that is easy to measure: one
 * dependency against thirty-two. It reports no source positions, so this module derived
 * them by accumulating token text, and that derivation was wrong within the hour: inside
 * an indented list item a paragraph's raw carries per-line indentation its text does not,
 * so every inline offset after the first line drifted, and blanking a code span wiped
 * twenty characters of a `[[wikilink]]` instead. Deriving positions a parser declines to
 * publish is writing the parser again in the one place it is hardest to check. `mdast`
 * publishes them, so this file has no offset arithmetic at all.
 *
 * **Blanking versus closing the gap is a real distinction here**, not a stylistic one:
 * `prose` preserves every offset so a caller's index still points into the document, and
 * `collapsed` gives the reader's sentence to a caller matching words that must be
 * adjacent. Which one a caller needs is a question about that caller.
 */

/** Parsed once per document — several rules read the same file, and parsing is not free. */
const cache = new Map();
const tree = (text) => {
	let root = cache.get(text);
	// GFM TABLES, because the register is written in them and CommonMark alone does not
	// have them: without this a table is one paragraph, backticks pair ACROSS rows, and a
	// `[link](in-a-code-span)` in one cell falls outside every span and resolves as a real
	// reference. That is how two documented examples were reported as broken links. The
	// parser has to speak the dialect the documents are actually written in.
	if (root === undefined) {
		cache.set(text, (root = fromMarkdown(text, { extensions: [gfmTable()], mdastExtensions: [gfmTableFromMarkdown()] })));
	}
	return root;
};

/** Every node, depth first. Positions are the parser's, so nothing here computes one. */
function* nodes(text) {
	const visit = function* (node) {
		yield node;
		for (const child of node.children ?? []) yield* visit(child);
	};
	yield* visit(tree(text));
}

const CODE = new Set(["code", "inlineCode"]);
const range = (n) => [n.position.start.offset, n.position.end.offset];
/**
 * An HTML COMMENT is masked alongside code, because nothing inside one renders and so
 * nothing inside one is a reference — the same rule backticks already carry. Only the
 * comment: an `html` node is also every raw tag, and a `<details>` block's prose is
 * ordinary Markdown that must keep being read. Without this, `<!-- **Checked by** … -->`
 * was found by the marker scan and then had no block to be bounded by, so a contributor
 * commenting out a citation got a malformed-citation failure on a correct document —
 * the expensive direction.
 */
const isComment = (text, n) => n.type === "html" && text.slice(...range(n)).startsWith("<!--");
const spans = (text, kinds) =>
	[...nodes(text)]
		.filter((n) => n.position && (kinds.has(n.type) || isComment(text, n)))
		.map(range);

/** Same length, same newlines — so offsets and line anchors survive. */
const blankOut = (text, ranges) => {
	let out = text;
	for (const [from, to] of ranges) {
		out = out.slice(0, from) + out.slice(from, to).replace(/[^\n]/g, " ") + out.slice(to);
	}
	return out;
};

/** Fenced blocks blanked. A `## Decision` inside one is an example, never a section. */
export const proseWithSpans = (text) => blankOut(text, spans(text, new Set(["code"])));

/** Fenced blocks AND inline spans blanked: inside backticks nothing is a reference. */
export const prose = (text) => blankOut(text, spans(text, CODE));

/**
 * The same removal, closing the gap instead of blanking it.
 *
 * A label like `- **3a — `x` while it is focused**` is matched by a pattern that expects
 * its words adjacent, and blanking leaves a run of spaces where the span was — so the
 * pattern captures something else and the note is reported for a malformed extension it
 * does not have. This is what the hand-rolled stripper did, and the one caller that
 * reads sentences rather than indexes still needs it.
 */
export function collapsed(text) {
	const cuts = spans(text, CODE).sort((a, b) => a[0] - b[0]);
	let out = "";
	let from = 0;
	for (const [start, end] of cuts) {
		if (start < from) continue; // a span already inside a removed fence
		out += text.slice(from, start);
		from = end;
	}
	return out + text.slice(from);
}

/** The source a node covers, which is what every "what does it say" question wants. */
const source = (text, node) => text.slice(node.position.start.offset, node.position.end.offset);

/**
 * Every `## ` heading, in document order, with the offset of its line.
 *
 * The prefix hole the hand-rolled matcher had three times — `## Contextual` satisfying
 * `## Context` — cannot occur here: a heading's content is a parsed range, not a prefix
 * of a line, so the two are different strings rather than one containing the other.
 * Trailing whitespace after the heading is the parser's problem now too.
 *
 * ROOT-LEVEL only. mdast reports `> ## Context` inside a blockquote, and `## Context`
 * indented under a list item, as depth-two headings like any other — but the line-anchored
 * scan this replaced could not match either, and neither is a section of the document. A
 * quoted heading satisfying `checkSections`, or truncating `sectionBody` early, is a
 * malformed note passing the structural rules.
 *
 * ATX only — the `## ` spelling — which the source is asked for rather than the node type,
 * because mdast makes no distinction. CommonMark has a second way to write a level-two
 * heading: any paragraph with `---` under it. This register opens every note with YAML
 * frontmatter and uses `---` as a rule inside prose, so without this the frontmatter of
 * 161 notes parsed as a heading whose text was the whole block, and any paragraph above a
 * horizontal rule became one too. Nothing downstream matched those labels, so nothing
 * failed — a rule reading them as section boundaries would have been wrong quietly.
 */
export function headings(text) {
	const found = [];
	for (const node of tree(text).children) {
		if (node.type !== "heading" || node.depth !== 2 || !node.position) continue;
		if (!source(text, node).startsWith("##")) continue;
		const first = node.children[0];
		const last = node.children.at(-1);
		const label = first && last ? text.slice(first.position.start.offset, last.position.end.offset) : "";
		found.push({ text: label.trim(), index: node.position.start.offset });
	}
	return found;
}

/**
 * What one `## ` section says: to the next `## `, or to the end of the note.
 *
 * Sliced from `proseWithSpans`, so a FENCED example inside the section is not part of what
 * it says while an inline `path.ts` still is. Both halves matter to the one caller: the
 * source-coverage rule reads paths out of `## Where it lives` and `## Decision`, this
 * register writes every path in backticks, and a path appearing only inside a fenced
 * example would otherwise credit a module as specified by a block that describes nothing.
 * Offsets survive the blanking, so the heading indexes still address this string.
 */
export function sectionBody(text, title) {
	const all = headings(text);
	const at = all.findIndex((h) => h.text === title);
	if (at === -1) return "";
	return proseWithSpans(text).slice(all[at].index, all[at + 1]?.index ?? text.length);
}

/**
 * Every relative link destination, with external ones and bare anchors dropped — the
 * question every caller actually asks. The parser resolves the destination forms
 * CommonMark defines, which is what a hand-written matcher kept getting wrong: `<...>`
 * for a destination with a space (this register is full of them), percent-encoding, and
 * an anchor that belongs INSIDE the angle brackets rather than after them.
 *
 * IMAGES count. The pattern this replaced scanned for `](`, which is in `![alt](src)`
 * just as it is in `[text](href)`, so images were covered without anyone deciding they
 * should be — and a parser that gives them their own node type drops that coverage
 * silently unless the type is named here. A missing diagram breaks a document exactly as
 * a missing note does; the register embeds `assets/` and would have stopped noticing.
 *
 * A `definition` counts for a different reason. `[guide][g]` with `[g]: missing.md` below
 * carries its destination on the definition, not on the reference, so neither this nor the
 * `](` scan before it ever saw one — a gap rather than a regression, and one the register
 * has no instance of, which is exactly why it would go on being invisible. Checking the
 * definition covers every reference to it at once, and an unreferenced definition naming a
 * file that is gone is dead prose worth the same report.
 */
const LINKING = new Set(["link", "image", "definition"]);
export function localLinks(text) {
	const out = [];
	for (const node of nodes(text)) {
		if (!LINKING.has(node.type)) continue;
		// `//cdn.example.com/x.md` is EXTERNAL: a protocol-relative reference borrows the
		// page's scheme and names no scheme of its own, so a test for `scheme:` does not see
		// one and the destination reads as a path. The gate would then look for a directory
		// called `cdn.example.com` beneath the note and reject a working link.
		if (/^[a-z][a-z0-9+.-]*:/i.test(node.url) || node.url.startsWith("//") || node.url.startsWith("#")) continue;
		const [target] = node.url.split("#");
		if (target) out.push({ href: node.url, target: decodeURIComponent(target) });
	}
	return out;
}

/**
 * Wikilink targets. Not Markdown — Obsidian's own syntax — so this stays a pattern, but
 * it runs over the document with code blanked rather than over raw text, and it flattens
 * a NEWLINE and the indentation after it on purpose: a link the 100-column wrap breaks
 * across two lines is the same link, and refusing to see it was a documented limitation
 * with no detection, so a contributor met "unresolved wikilink" for a link that resolves.
 *
 * The WRAP only. Collapsing every run of whitespace also rewrites `[[A  slice]]`, which is
 * a legal note name — the lookup against `stems` is exact, so flattening a name the vault
 * really holds reports a resolving link as unresolved. The fix for one false failure must
 * not introduce another.
 */
export function wikilinks(text) {
	return [...prose(text).matchAll(/\[\[([^\]|#]+)/g)].map(([, target]) => target.replace(/\n[ \t]*/g, " ").trim());
}

/**
 * The innermost BLOCK containing an offset — what a marker's citation is bounded by.
 *
 * Not `paragraphs`, which this replaced. A `**Checked by**` inside a GFM table cell is a
 * `tableCell` and not a paragraph at all, so asking only for paragraphs found no owner
 * and the caller fell back to "the rest of the document" — where a malformed marker could
 * reach forward and adopt the next citation's path and name. A table cell is a natural
 * place to put a claim, so the natural place was the hole.
 *
 * Every kind that can HOLD a citation is listed rather than "anything with a position",
 * because inline nodes have positions too and the marker itself is one (`**bold**` is
 * `strong`): bounding a citation at the marker would leave nothing after it to read.
 */
const BLOCKS = new Set(["paragraph", "tableCell", "listItem", "heading", "blockquote", "definition"]);
export function containerAt(text, index) {
	let best = null;
	for (const node of nodes(text)) {
		if (!BLOCKS.has(node.type) || !node.position) continue;
		const { start, end } = node.position;
		if (index < start.offset || index >= end.offset) continue;
		if (best === null || end.offset - start.offset < best.end - best.start) {
			best = { start: start.offset, end: end.offset, text: source(text, node) };
		}
	}
	return best;
}

/**
 * Every **bold marker** with exactly this text, as `{ start, end }` offsets.
 *
 * Asked of the parser rather than matched in the source, which is the third answer to the
 * same question and the only structural one. A text scan found the marker inside a code
 * span (`docs/README.md` names it while documenting the convention), inside an HTML
 * comment (a citation parked for later), and after a backslash escape (`\**Checked by**`,
 * shown literally) — three separate patches, each masking one more construct, each found
 * by review rather than by a test. A `strong` node is none of those by construction: the
 * parser has already decided what is emphasis and what is only asterisks, so the whole
 * category closes at once rather than one spelling at a time.
 */
export function markers(text, label) {
	const found = [];
	for (const node of nodes(text)) {
		if (node.type !== "strong" || !node.position) continue;
		if (node.children.length !== 1 || node.children[0].type !== "text" || node.children[0].value !== label) continue;
		found.push({ start: node.position.start.offset, end: node.position.end.offset });
	}
	return found;
}

/**
 * EVERY GFM table whose header row IS `headings` — each table as its rows, each row as its
 * cells, each cell as `{ code, text, kinds }`: the `code` spans it holds, the prose around
 * them, and the node types it is built from.
 *
 * EXACTLY those headings, not a prefix. A prefix match selects a table that grew a fourth
 * column, and a caller destructuring three of them reads a document with more in it — a
 * `Children may not be` column, correctly formatted, invisible to every rule. Found in
 * review.
 *
 * Code spans are what a rule compares, because that is how this register writes a type or
 * a key — `` `Deliverable` ``. Prose around them (`*(nothing — it is a root)*`, "or") is a
 * human's connective tissue and no rule should try to understand it, which would be
 * reading English — the thing `docs/issues/Tests do not read English.md` says not to
 * build.
 *
 * It is REPORTED rather than understood, and that is the difference. Dropping it silently
 * is how a name written without backticks disappeared from a cell twice — once in the type
 * column, then again in the relation columns after the first was fixed. A caller cannot
 * notice what it never receives, so the prose comes back and each caller says what its own
 * table allows to be in it.
 *
 * `kinds` is that argument taken to its end. `text` sees `text` nodes and `code` sees
 * `inlineCode`, so ANY other node is invisible to both — and `<del>` around a code span is
 * exactly that: the type is collected, the tags are dropped, and the cell reads as
 * agreeing while GitHub and Obsidian render the relation as deleted. Reporting the node
 * types present is the only form of this that does not need a new rule per element,
 * because a caller can whitelist what it understands and refuse the rest unread.
 *
 * Asked of the parser, so a pipe inside a code span cannot split a cell and a table
 * indented inside a list item is still a table.
 *
 * PLURAL deliberately. The first version returned the first match, which answers a
 * question nobody asked: with two tables under one heading set — a merge leaves one, an
 * unfenced example leaves one — "the rows of the table" has no single answer, and picking
 * the first validates one document while a reader sees two. Found in review, as the same
 * defect one level up from duplicate ROWS. An empty array is a real answer (no such
 * table) and a caller has to tell it from a table that is empty.
 */
export function tablesWith(text, headings) {
	// The cell's own descendants, never a source slice: mdast gives a table cell a position
	// that INCLUDES its leading pipe, so slicing yields "| Type" and re-parsing that is one
	// more parser to get wrong. Walking the node the parser already built asks nothing.
	const words = (cell) => [...walk(cell)].filter((n) => n.type === "text").map((n) => n.value).join("").trim();
	const codes = (cell) => [...walk(cell)].filter((n) => n.type === "inlineCode").map((n) => n.value);
	const kinds = (cell) => [...new Set([...walk(cell)].filter((n) => n !== cell).map((n) => n.type))];
	const found = [];
	for (const node of nodes(text)) {
		if (node.type !== "table" || node.children.length === 0) continue;
		const head = node.children[0].children;
		if (head.length !== headings.length) continue;
		if (!headings.every((want, i) => words(head[i]) === want)) continue;
		found.push(node.children.slice(1).map((row) => row.children.map((cell) => ({ code: codes(cell), text: words(cell), kinds: kinds(cell) }))));
	}
	return found;
}

/** Every node beneath one, itself included — `nodes` over a subtree rather than a document. */
function* walk(node) {
	yield node;
	for (const child of node.children ?? []) yield* walk(child);
}
