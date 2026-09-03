import { describe, expect, it } from 'vitest';
import { andList, cell, cellList, code, yamlScalar } from '../../src/domain/readmeText';

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

	it('keeps the spaces a span would otherwise be read without', () => {
		// CommonMark strips one space from each end of a span whose content begins AND ends
		// with one, so ` status ` — a property id is not trimmed — would draw as `status`,
		// a different key from the one the example writes. The padding feeds that stripper.
		expect(code(' status ')).toBe('`  status  `');
		// A space at one end only is never stripped, and a value that is nothing but spaces
		// is the case the rule exempts — padding either would show a value nobody typed.
		expect(code('status ')).toBe('`status `');
		expect(code(' ')).toBe('` `');
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
		expect(cellList([])).toBe('*(nothing)*');
	});

	it('escapes the values and leaves the document own prose alone', () => {
		// A starred entry is written by the generator ("*(nothing — it is a root)*"), so
		// quoting it would show a reader the markup instead of the sentence.
		expect(cellList(['Epic', 'a|b'])).toBe('`Epic`, `a\\|b`');
		expect(cellList(['*(nothing — it is a root)*', 'Epic'])).toBe('*(nothing — it is a root)*, `Epic`');
	});
});

describe('values joined as an exhaustive prose list', () => {
	// Every arm driven directly: `backlogReadmeContent`'s own callers no longer exercise
	// the one-name form on their own (`MARKER_TYPES` is two names now, not one), so a
	// vocabulary that shrank back to one name would have nothing left to catch it here.
	it('says nothing for an empty list, rather than trailing off', () => {
		expect(andList([])).toBe('');
	});

	it('names one value bare', () => {
		expect(andList(['Epic'])).toBe('Epic');
	});

	it('joins two with "and", never a comma', () => {
		expect(andList(['Epic', 'Milestone'])).toBe('Epic and Milestone');
	});

	it('commas every value but the last, which takes "and"', () => {
		expect(andList(['Issue', 'Bug', 'Idea', 'Deliverable'])).toBe('Issue, Bug, Idea and Deliverable');
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

	it('quotes a value the reader would not get its whitespace back from', () => {
		// A plain scalar is read without its trailing space, so `status ` bare emits
		// `status : ...` and defines `status` — a key one character off the one this view
		// reads, from an example promised as copyable. A space INSIDE is ordinary.
		expect(yamlScalar('status ')).toBe('"status "');
		expect(yamlScalar('due date')).toBe('due date');
		expect(yamlScalar('a')).toBe('a');
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

	it('escapes the two noncharacters YAML stops just below', () => {
		// U+FFFE and U+FFFF are outside YAML's printable set exactly as a control character
		// is, and arrive the same way — escaped in a hand-edited file and decoded before this.
		// Emitted raw, the block promised as copyable fails to parse though the configuration
		// it came from parsed. `\\u` because `\\x` spells a byte.
		expect(yamlScalar('non\uFFFEchar')).toBe('"non\\ufffechar"');
		expect(yamlScalar('non\uFFFFchar')).toBe('"non\\uffffchar"');
		// U+FFFD, the character the printable set ends AT, is text and stays as itself.
		expect(yamlScalar('lost \uFFFD')).toBe('"lost \uFFFD"');
	});
});
