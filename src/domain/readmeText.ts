/**
 * Putting a value the user chose into the generated README without it changing meaning
 * on the way. Property names, states, folders and type names are all data somebody typed,
 * and the document quotes them in three places that read punctuation differently: an
 * inline code span, a table cell, and a YAML block a reader is invited to copy.
 *
 * Its own module because that is one concern, said three times, and because every defect
 * this document has shipped has been here rather than in the prose — a pipe that ended a
 * row early, a backtick that closed a span, a line break that halved a table, a colon that
 * turned an example into a different mapping. Kept beside `backlogReadme.ts`, which asks
 * these questions and never answers them.
 */

/**
 * A value as an inline code span. The fence is as long as it has to be, and a value that
 * begins or ends with a backtick gets the padding spaces CommonMark strips again — a state
 * called `` `todo` `` must render as itself rather than closing the span early.
 *
 * The padding answers a second value too, and for the same reason read the other way
 * round: CommonMark strips ONE space from each end of a span whose content both begins
 * and ends with a space, so a key spelled ` status ` — a property id is not trimmed —
 * would be drawn as `status`, a different key from the one the example writes and the
 * view reads. Padding it feeds the stripper the spaces it wants. A value that is nothing
 * but spaces is the exception the rule itself makes (it strips nothing there), so padding
 * it would ADD two, and a space at one end only is never stripped.
 */
export function code(value: string): string {
	const shown = oneLine(value);
	const longest = Math.max(0, ...[...shown.matchAll(/`+/g)].map((m) => m[0].length));
	const fence = '`'.repeat(longest + 1);
	const stripped = shown.startsWith(' ') && shown.endsWith(' ') && shown.trim() !== '';
	const pad = shown.startsWith('`') || shown.endsWith('`') || stripped ? ' ' : '';
	return `${fence}${pad}${shown}${pad}${fence}`;
}

/**
 * A line break, spelled rather than emitted — a table row is one line, so a state or a
 * property name holding one splits the row in half and the rest of the table stops being
 * a table. In prose it merely renders as a space, which is a value shown as something
 * other than what it is. Spelled the way the example block spells it, since a reader
 * meets both.
 */
const oneLine = (value: string): string => value.replace(/\r/g, '\\r').replace(/\n/g, '\\n');

/**
 * The same value inside a table cell, where a pipe ends the cell whatever it sits in —
 * code span included — and the row is split by a scan that lets each backslash consume
 * the character after it. `\|` is enough while nothing precedes the pipe, and cannot be:
 * a value spelling `\|` itself would leave an even run and hand the parser a delimiter
 * again, and adding backslashes until it parses shows the reader a value they cannot
 * write back.
 *
 * So a value carrying a backslash run before a pipe is quoted as an HTML code element
 * instead, with the pipe as `&#124;` — invisible to the row scan, decoded to a pipe by
 * the time it is drawn. The value renders exactly as configured, which is the point of
 * quoting it at all: this document is copied from.
 */
export const cell = (value: string): string =>
	/\\+\|/.test(value) ? `<code>${htmlCode(value)}</code>` : code(value).replace(/\|/g, '\\|');

/**
 * The inside of that element: the three characters HTML reads, plus the pipe. Nothing
 * else is touched — backticks need no fence here, and a code element takes its content
 * literally, so what is left is the value itself.
 */
const htmlCode = (value: string): string =>
	oneLine(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\|/g, '&#124;');

/** Values as cells, in a sentence — a starred entry is the document's own prose, not data. */
export const list = (values: string[]): string =>
	values.length > 0 ? values.map((v) => (v.startsWith('*') ? v : cell(v))).join(', ') : '*(nothing)*';

/**
 * A value as YAML, quoted when writing it bare would change what it means. The example
 * block is the part a reader copies, so a state called `Needs: review` or `#blocked` has
 * to survive it — bare, those are a mapping and a comment.
 */
export function yamlScalar(value: string): string {
	// The safe form must END in a non-space as well as begin with a letter: a plain scalar
	// is read without its trailing whitespace, so a key spelled `status ` — which a
	// hand-edited `.base` can hold — would be emitted as `status : `, and the reader
	// copying it defines `status`. A space INSIDE is ordinary and stays bare.
	const safe =
		/^[A-Za-z](?:[A-Za-z0-9 _./-]*[A-Za-z0-9_./-])?$/.test(value) && !/^(true|false|null|yes|no|on|off)$/i.test(value);
	return safe ? value : `"${yamlEscape(value)}"`;
}

/** The escapes a double-quoted YAML scalar spells with a name; the rest go as `\xNN`. */
const YAML_ESCAPES = new Map([
	['\\', '\\\\'],
	['"', '\\"'],
	['\n', '\\n'],
	['\r', '\\r'],
	['\t', '\\t'],
]);

/**
 * The inside of a double-quoted scalar. Quoting alone is not escaping: a state or a
 * property name holding a newline emits a literal line break, which YAML *folds* into a
 * space — so the example a reader copies would define a different key from the one this
 * view uses, silently, which is the whole failure this document exists to prevent. Other
 * control characters make it not parse at all.
 *
 * BOTH control ranges, not just the ASCII one: YAML's printable set excludes `U+0080`
 * through `U+009F` as well, and `U+0085` is one of the line breaks it folds — the same
 * silent redefinition as a newline, from a character nothing renders. A key can hold one
 * legitimately, since frontmatter can spell it `\x85` and this reader decodes it before
 * the value ever reaches here.
 *
 * Built by walking the characters rather than by a regex, because a class covering the
 * control range is exactly what `no-control-regex` forbids, and a suppression here would
 * be hiding the rule rather than answering it.
 */
function yamlEscape(value: string): string {
	return [...value]
		.map((char) => {
			const named = YAML_ESCAPES.get(char);
			if (named !== undefined) return named;
			const code = char.codePointAt(0) ?? 0;
			return code < 0x20 || (code >= 0x7f && code <= 0x9f) ? `\\x${code.toString(16).padStart(2, '0')}` : char;
		})
		.join('');
}
