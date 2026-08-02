import { describe, expect, it } from 'vitest';
import { cell, code, list, yamlScalar } from '../../src/domain/readmeText';

/**
 * Every value in the generated README is data somebody typed into the view's options or
 * into a note, and each of the three places it lands reads punctuation differently. These
 * are the rules per place, stated once here so the document's own tests can be about what
 * the document SAYS rather than about backslashes.
 */
describe('a value inside an inline code span', () => {
	it('leaves a plain value plain', () => {
		expect(code('status')).toBe('`status`');
	});

	it('grows the fence past the longest run of backticks in the value', () => {
		// A state called ``a``b`` closes the span early at any shorter fence; the padding
		// spaces are the ones CommonMark strips again, so a value that starts or ends with
		// a backtick still reads as itself.
		expect(code('a``b')).toBe('```a``b```');
		expect(code('`todo`')).toBe('`` `todo` ``');
	});

	it('spells a line break rather than emitting one', () => {
		// A table row is one line: a value carrying a break would end the row in the middle
		// and the rest of the table would stop being a table.
		expect(code('kind\nof')).toBe('`kind\\nof`');
		expect(code('kind\r\nof')).toBe('`kind\\r\\nof`');
	});
});

describe('a value inside a table cell', () => {
	it('escapes a pipe, which ends a cell even inside a code span', () => {
		expect(cell('Waiting | external')).toBe('`Waiting \\| external`');
	});

	it('quotes as HTML when a backslash run would eat the escape', () => {
		// The row is split by a scan that lets each backslash consume the character after
		// it, so `\|` in the value leaves an even run and the pipe delimits again. More
		// backslashes would parse but show a value the reader cannot write back, so the
		// pipe goes in as an entity the scan cannot see and the drawing decodes.
		expect(cell('Waiting \\| external')).toBe('<code>Waiting \\&#124; external</code>');
		// And what HTML itself reads, since the element takes its content literally.
		expect(cell('a<b>&c\\|d')).toBe('<code>a&lt;b&gt;&amp;c\\&#124;d</code>');
	});

	it('reads as one row of cells either way', () => {
		// The property the escaping exists for, asked of the row rather than of the value:
		// walk it letting each backslash eat the next character, and the pipes still
		// standing are the delimiters the table declared.
		const delimiters = (value: string): number =>
			`| ${cell(value)} | Yes |`.replace(/\\[\s\S]/g, '').split('|').length;
		expect(delimiters('plain')).toBe(4);
		expect(delimiters('Waiting | external')).toBe(4);
		expect(delimiters('Waiting \\| external')).toBe(4);
		expect(delimiters('trailing \\\\| run')).toBe(4);
	});
});

describe('a list of values in a sentence', () => {
	it('says so when there are none, rather than trailing off', () => {
		expect(list([])).toBe('*(nothing)*');
	});

	it('escapes the values and leaves the document own prose alone', () => {
		// A starred entry is written by the generator ("*(nothing — it is a root)*"), so
		// quoting it would show a reader the markup instead of the sentence.
		expect(list(['Epic', 'a|b'])).toBe('`Epic`, `a\\|b`');
		expect(list(['*(nothing — it is a root)*', 'Epic'])).toBe('*(nothing — it is a root)*, `Epic`');
	});
});

describe('a value inside the example block', () => {
	it('writes a plain value bare, the way the notes read', () => {
		expect(yamlScalar('Todo')).toBe('Todo');
	});

	it('quotes what YAML would read as something else', () => {
		expect(yamlScalar('Needs: review')).toBe('"Needs: review"');
		expect(yamlScalar('#blocked')).toBe('"#blocked"');
		// The booleans YAML spells with words: bare, `no` is false rather than a state.
		expect(yamlScalar('No')).toBe('"No"');
	});

	it('escapes inside the quotes, because quoting is not escaping', () => {
		// A double-quoted scalar FOLDS a literal break into a space, so the key a reader
		// copies would not be the key this view reads; other control characters make the
		// example not parse at all.
		expect(yamlScalar('kind\nof')).toBe('"kind\\nof"');
		expect(yamlScalar('a\tb')).toBe('"a\\tb"');
		expect(yamlScalar('back\\slash "quoted"')).toBe('"back\\\\slash \\"quoted\\""');
		expect(yamlScalar('bell\u0007')).toBe('"bell\\x07"');
	});

	it('escapes the upper control range too, where another line break hides', () => {
		// YAML's printable set excludes U+0080–U+009F, and U+0085 is one of the breaks it
		// FOLDS — the same silent redefinition as a newline, from a character nothing draws.
		// Frontmatter can spell either as `\x85`, so a key really can arrive holding one.
		expect(yamlScalar('next\u0085line')).toBe('"next\\x85line"');
		expect(yamlScalar('pad\u0080')).toBe('"pad\\x80"');
		expect(yamlScalar('app\u009f')).toBe('"app\\x9f"');
		// Nothing above the range: an accented state or an emoji is printable text, and
		// escaping it would show a reader a value they cannot write back.
		expect(yamlScalar('café ☕')).toBe('"café ☕"');
	});
});
