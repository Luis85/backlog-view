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
const spans = (text, kinds) =>
	[...nodes(text)]
		.filter((n) => kinds.has(n.type) && n.position)
		.map((n) => [n.position.start.offset, n.position.end.offset]);

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
 */
export function headings(text) {
	const found = [];
	for (const node of nodes(text)) {
		if (node.type !== "heading" || node.depth !== 2 || !node.position) continue;
		const first = node.children[0];
		const last = node.children.at(-1);
		const label = first && last ? text.slice(first.position.start.offset, last.position.end.offset) : "";
		found.push({ text: label.trim(), index: node.position.start.offset });
	}
	return found;
}

/** What one `## ` section says: to the next `## `, or to the end of the note. */
export function sectionBody(text, title) {
	const all = headings(text);
	const at = all.findIndex((h) => h.text === title);
	if (at === -1) return "";
	return text.slice(all[at].index, all[at + 1]?.index ?? text.length);
}

/**
 * Every relative link destination, with external ones and bare anchors dropped — the
 * question every caller actually asks. The parser resolves the destination forms
 * CommonMark defines, which is what a hand-written matcher kept getting wrong: `<...>`
 * for a destination with a space (this register is full of them), percent-encoding, and
 * an anchor that belongs INSIDE the angle brackets rather than after them.
 */
export function localLinks(text) {
	const out = [];
	for (const node of nodes(text)) {
		if (node.type !== "link") continue;
		if (/^[a-z][a-z0-9+.-]*:/i.test(node.url) || node.url.startsWith("#")) continue;
		const [target] = node.url.split("#");
		if (target) out.push({ href: node.url, target: decodeURIComponent(target) });
	}
	return out;
}

/**
 * Wikilink targets. Not Markdown — Obsidian's own syntax — so this stays a pattern, but
 * it runs over the document with code blanked rather than over raw text, and it flattens
 * a NEWLINE inside the brackets on purpose: a link the 100-column wrap breaks across two
 * lines is the same link, and refusing to see it was a documented limitation with no
 * detection, so a contributor met "unresolved wikilink" for a link that resolves.
 */
export function wikilinks(text) {
	return [...prose(text).matchAll(/\[\[([^\]|#]+)/g)].map(([, target]) => target.replace(/\s+/g, " ").trim());
}

/** Paragraph bodies, which is what a citation is bounded by — never a blank-line scan. */
export function paragraphs(text) {
	return [...nodes(text)]
		.filter((n) => n.type === "paragraph" && n.position)
		.map((n) => ({ text: source(text, n), index: n.position.start.offset }));
}
