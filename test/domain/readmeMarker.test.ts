import { describe, expect, it } from 'vitest';
import { README_MARKER_PREFIX, displaySource, joinSource, readmeMarker, readmeSource } from '../../src/domain/readmeMarker';

/**
 * `readmeMarker.ts` decides what the generated README IS — the identity line that lets a
 * regeneration recognize its own output — split from `backlogReadme.test.ts`, which is
 * about what the document SAYS. Moved out under the same rule its own module states:
 * "its own question" gets its own file, once the sibling file's line budget said so.
 */
describe('readmeMarker / readmeSource round-trip', () => {
	it('keeps two sources apart when only the comment-hostile characters differ', () => {
		// `--` cannot sit in an HTML comment, and dropping or collapsing it gives two bases
		// one marker: the second view then reads the first's file as its own and reports
		// "Updated" for a contract it just replaced.
		expect(readmeMarker('Product--Backlog.base › B')).not.toBe(readmeMarker('Product-Backlog.base › B'));
		expect(readmeMarker('a<b')).not.toBe(readmeMarker('ab'));
		// Whatever it escapes, the line stays a comment: no run of hyphens, no `>` before
		// the terminator this function writes itself.
		const marker = readmeMarker('a-->b--<c%2D>');
		expect(marker.slice(README_MARKER_PREFIX.length, -4)).not.toMatch(/--|>/);
	});

	it('reads back the source it wrote, escapes and all', () => {
		// It is shown to a user in a notice, so it has to come back spelled as they wrote
		// it — including a literal `%2D`, which the escaping must not turn into a hyphen.
		for (const source of ['work/Product Backlog.base › Backlog', 'Product--Backlog.base › B', 'a%2Db', '<a->']) {
			expect(readmeSource(readmeMarker(source))).toBe(source);
		}
		expect(readmeSource('# not a marker at all')).toBeNull();
	});

	it('refuses a line that only opens like the marker', async () => {
		// The caller replaces a file whose first line parses, so a half-written marker — an
		// interrupted write, a bad merge — must not parse: it is the file least able to
		// afford being overwritten. Nor must a comment that merely starts the same way.
		expect(readmeSource(`${README_MARKER_PREFIX} from "work/B.base › B".`)).toBeNull();
		expect(readmeSource(`${README_MARKER_PREFIX} of my own -->`)).toBeNull();
		expect(readmeSource(README_MARKER_PREFIX)).toBeNull();
		// And the whole line still round-trips with its trailing whitespace trimmed.
		expect(readmeSource(`${readmeMarker('work/B.base › B')}  `)).toBe('work/B.base › B');
	});

	it('keeps the two halves of a source apart, whatever they are called', () => {
		// Free text either side: a view named `b.base › c` under `a.base` would otherwise
		// produce the identity of view `c` under a base called `a.base › b.base`, and the
		// second view would replace the first's document reported as an ordinary update.
		expect(joinSource('a.base', 'b.base › c')).not.toBe(joinSource('a.base › b.base', 'c'));
		// An ordinary pair still reads as itself, in the file and in the notice.
		expect(joinSource('work/Product Backlog.base', 'Backlog')).toBe('work/Product Backlog.base › Backlog');
	});

	it('shows a source in a notice the way the user spelled it', () => {
		// The join escaping keeps two identities apart; it is not something to read back to
		// somebody about their own base. `work/100%.base` is not `work/100%25.base`.
		expect(displaySource(joinSource('work/100%.base', 'Backlog'))).toBe('work/100%.base › Backlog');
		expect(displaySource(joinSource('a.base', 'b › c'))).toBe('a.base › b › c');
		// And it never decodes twice: an escape the user typed comes back as they typed it.
		expect(displaySource(joinSource('a%25b.base', 'B'))).toBe('a%25b.base › B');
	});

	it('encodes a line break, which would cost the marker its whole job', () => {
		// A view name can hold one — a hand-edited `.base` spells it — and the reader only
		// ever sees the first line: left literal, every regeneration would read a truncated
		// marker and call this plugin's own document somebody else's.
		const marker = readmeMarker('work/B.base › Sprint\nplanning');
		expect(marker.includes('\n')).toBe(false);
		expect(readmeSource(marker)).toBe('work/B.base › Sprint\nplanning');
		expect(readmeSource(readmeMarker('a\rb'))).toBe('a\rb');
	});

	it('refuses an interior this module could not have written', () => {
		// Both halves copied, and something in between that `encodeSource` never emits: a
		// raw `>` or a run of hyphens. Such a line is somebody's own comment or a corrupted
		// one, and answering "ours" hands the whole file to the writer.
		const around = (interior: string): string =>
			`${README_MARKER_PREFIX} from "${interior}". Rewritten in full whenever it is regenerated. -->`;
		expect(readmeSource(around('a>b'))).toBeNull();
		expect(readmeSource(around('a--b'))).toBeNull();
		expect(readmeSource(around('a<b'))).toBeNull();
		// What the encoder does produce still parses, including a lone hyphen and a
		// literal percent escape the user typed.
		expect(readmeSource(around('work/Product-Backlog.base › B'))).toBe('work/Product-Backlog.base › B');
		expect(readmeSource(around('a%252Db'))).toBe('a%2Db');
	});
});
