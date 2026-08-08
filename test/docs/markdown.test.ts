import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
// @ts-expect-error — a plain .mjs helper with no type declarations, imported for what it does.
import { collapsed, headings, localLinks, paragraphs, prose, proseWithSpans, sectionBody, wikilinks } from '../../docs-markdown.mjs';

/**
 * **The Markdown layer, tested as a unit.**
 *
 * This is the file that did not exist, and it is where every defect `docs-check.mjs` has
 * had came from — four of them, all parser bugs, none of them rule bugs: a bracketed link
 * destination refused, a CRLF checkout read as 136 broken documents, a wrapped
 * `[[wikilink]]` unresolvable, a wrapped `**Checked by**` citation matching nothing while
 * the run stayed green. Every one was found by a person, late, and two were false
 * failures that blocked correct documents.
 *
 * They were invisible because the layer was only ever exercised THROUGH the whole gate,
 * on planted documents chosen to test rules. A hole in the parsing showed up as a strange
 * rule failure, or as nothing at all. So these cases ask the layer directly, about the
 * Markdown constructs it claims to handle rather than about any rule that uses it.
 *
 * The corpus files (`checkerAccepts` / `checkerRejects`) still exist and still matter:
 * they prove the RULES behave. This proves the layer they read through does.
 */

describe('code is blanked, not deleted', () => {
	it('keeps every offset and line an index into the original document', () => {
		// The property the whole module rests on. The hand-rolled version deleted, which
		// could join two lines into one and move every offset after it — so a rule's
		// `^`-anchored pattern would match a line that does not exist in the file it is
		// about to report on.
		const text = '# Note\n\n```\nfenced\n```\n\nA `span` here.\n';
		const masked = prose(text);

		expect(masked).toHaveLength(text.length);
		expect(masked.split('\n')).toHaveLength(text.split('\n').length);
		expect(masked).toContain('# Note');
		expect(masked).not.toContain('fenced');
		expect(masked).not.toContain('span');
	});

	it('blanks a code span inside a TABLE cell, at the right offset', () => {
		// The container whose children cannot be placed by one `indexOf`, and the case the
		// first version of this module got wrong: every cell was masked from the table's own
		// start, which blanked the `| **Actor** |` marker of four real use cases while
		// leaving the span it was aiming at intact. The gate caught it; nothing here did,
		// because the direct cases only covered paragraphs and headings.
		const text = '| **Actor** | Note |\n| --- | --- |\n| **Trigger** | a `span` here |\n';
		const masked = prose(text);

		expect(masked).toHaveLength(text.length);
		expect(masked).toContain('**Actor**');
		expect(masked).toContain('**Trigger**');
		expect(masked).not.toContain('span');
	});

	it('blanks fences but keeps spans, for the caller that needs the path inside them', () => {
		// `proseWithSpans` is not a lesser `prose`: the citation rule reads a path OUT of a
		// code span, so stripping spans would blind it to every real citation.
		const text = 'A `test/thing.test.ts` path.\n\n```\n`test/gone.test.ts`\n```\n';
		const masked = proseWithSpans(text);

		expect(masked).toContain('`test/thing.test.ts`');
		expect(masked).not.toContain('gone');
	});
});

describe('headings', () => {
	it('does not let a longer heading satisfy a shorter one', () => {
		// The prefix hole that turned up three times in the hand-rolled matcher. A parsed
		// heading is a whole string, so this cannot recur by construction.
		expect(headings('## Contextual\n\nBody.\n').map((h: { text: string }) => h.text)).toEqual(['Contextual']);
		expect(headings('## Context\n\nBody.\n').map((h: { text: string }) => h.text)).toEqual(['Context']);
	});

	it('reads a heading with trailing whitespace, and one inside a fence as no heading', () => {
		const text = '## Real  \n\nBody.\n\n```\n## Fake\n```\n';

		expect(headings(text).map((h: { text: string }) => h.text)).toEqual(['Real']);
	});

	it('slices a section to the next heading, or to the end of the note', () => {
		const text = '## One\n\nfirst\n\n## Two\n\nsecond\n';

		expect(sectionBody(text, 'One')).toContain('first');
		expect(sectionBody(text, 'One')).not.toContain('second');
		expect(sectionBody(text, 'Two')).toContain('second');
		expect(sectionBody(text, 'Missing')).toBe('');
	});
});

describe('links', () => {
	it('resolves every destination form CommonMark defines', () => {
		// Row two is the defect this layer's predecessor shipped: angle brackets are the
		// sanctioned way to put a space in a destination, every note here has spaces in
		// its name, and the one correct way to write the link was rejected.
		const cases: [string, string][] = [
			['[x](A%20slice.md)', 'A slice.md'],
			['[x](<A slice.md>)', 'A slice.md'],
			['[x](<A slice.md#outcome>)', 'A slice.md'],
			['[x](A%20slice.md#outcome)', 'A slice.md'],
			['[a link\nwrapped](A%20slice.md)', 'A slice.md'],
		];

		for (const [md, target] of cases) {
			expect(localLinks(md).map((l: { target: string }) => l.target), md).toEqual([target]);
		}
	});

	it('drops what is not a local file: external schemes and bare anchors', () => {
		expect(localLinks('[x](https://example.com/a.md)')).toEqual([]);
		expect(localLinks('[x](#within-this-note)')).toEqual([]);
	});

	it('sees no link inside a code span or a fence', () => {
		expect(localLinks('`[x](gone.md)`')).toEqual([]);
		expect(localLinks('```\n[x](gone.md)\n```\n')).toEqual([]);
	});
});

describe('wikilinks', () => {
	it('reads one the 100-column wrap has broken across two lines', () => {
		// A known limitation of the hand-rolled version, documented and undetected: the
		// pattern captured the newline into the target, so the stem lookup failed and a
		// contributor met "unresolved wikilink" for a link that resolves.
		expect(wikilinks('See [[A slice]].')).toEqual(['A slice']);
		expect(wikilinks('See [[A\nslice]].')).toEqual(['A slice']);
	});

	it('ignores an example inside a code span or a fence', () => {
		expect(wikilinks('Write `[[Ghost]]` to link.')).toEqual([]);
		expect(wikilinks('```\n[[Ghost]]\n```\n')).toEqual([]);
	});
});

describe('paragraphs', () => {
	it('bounds a paragraph without scanning for blank lines', () => {
		// What the citation rule needs. Its first version hunted for `\n[ \t]*\n`, which is
		// a blank-line scan wearing a parser's job — and would have been wrong on CRLF if
		// the reader had not already normalized it.
		const found = paragraphs('One paragraph.\n\nAnother one.\n').map((p: { text: string }) => p.text.trim());

		expect(found).toEqual(['One paragraph.', 'Another one.']);
	});
});

describe('the property every caller depends on', () => {
	it('changes nothing but the code it blanks, in every note in the register', async () => {
		// The one thing that can go wrong without announcing itself: a masked region landing
		// at the wrong offset corrupts a document silently, and the rule reading it reports
		// something bizarre about a note that is fine. It happened — the first attempt at
		// this module derived offsets from a parser that publishes none, and blanking wiped
		// twenty characters of a `[[wikilink]]` in an indented list item.
		//
		// So the assertion is total rather than sampled: over every note in the register,
		// `prose` may differ from the source ONLY where it has written a space.
		const walk = async (dir: string): Promise<string[]> => {
			const out: string[] = [];
			for (const entry of await readdir(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) out.push(...(await walk(full)));
				else if (entry.name.endsWith('.md')) out.push(full);
			}
			return out;
		};
		const files = [...(await walk('docs')), 'README.md'];

		for (const file of files) {
			const text = (await readFile(file, 'utf8')).replaceAll('\r\n', '\n');
			const masked = prose(text);
			expect(masked, file).toHaveLength(text.length);
			// One assertion rather than one per character: the loop finds the first byte that
			// is neither unchanged nor a blank, and the message carries its context, so a
			// failure names the note and the place rather than an index.
			let corrupt = null;
			for (let i = 0; i < text.length; i++) {
				if (masked[i] !== text[i] && masked[i] !== ' ') {
					corrupt = `${file} @${i}: ${JSON.stringify(text.slice(i - 30, i + 30))} became ${JSON.stringify(masked.slice(i - 30, i + 30))}`;
					break;
				}
			}
			expect(corrupt).toBeNull();
		}

		expect(files.length).toBeGreaterThan(200);
		// Parses every note in the register, and coverage instrumentation roughly doubles
		// that — so the budget is stated rather than left to the 5s default it sits beside.
	}, 30_000);

	it('reads a table cell’s code span, rather than pairing backticks across rows', () => {
		// GFM tables are not CommonMark. Without them a table is one paragraph and backticks
		// pair across ROWS, so a `[link](x.md)` written as an example in one cell falls
		// outside every span and resolves as a real reference — which reported two
		// deliberately-broken examples in the register as broken links.
		const table = '| a | b |\n| --- | --- |\n| `type:` | same |\n| `[d](assets/x.svg)` | reported |\n';

		expect(localLinks(table)).toEqual([]);
		expect(prose(table)).toContain('| same |');
	});

	it('closes the gap for the caller that needs adjacency, and only for it', () => {
		// `collapsed` and `prose` are not interchangeable: one keeps offsets, the other
		// keeps the sentence. A label matched by a pattern expecting adjacent words is
		// reported as malformed if it meets the blanked form.
		const label = '- **3a — `x` while focused** — because.\n';

		expect(collapsed(label)).toContain('**3a —  while focused**');
		expect(prose(label)).toHaveLength(label.length);
	});
});
