// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../src/i18n/t';
import { makeRoadmap, shelfCountOf } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The shelf's own count crossing a thousand — `.pbl-shelf-count`'s bare face text used to
 * be `String(shelf.length)`, which renders `1000` beside a disclosure `aria-label` that
 * has always gone through `t()`'s own `Intl.NumberFormat` and so already said `1,000`. Two
 * locales, so a fix that merely happens to read the same as `String()` under English is
 * not enough to catch: German groups with a dot, and `String()` groups with neither.
 *
 * The shelf stays COLLAPSED: the header (and its count) renders regardless of the fold —
 * `renderShelfControls`'s own rule — and a thousand cards' own DOM is not what this test
 * is about, so nothing here needs it built.
 */
describe('the shelf count at a thousand', () => {
	function thousandShelfVault(): FakeVault {
		const vault = new FakeVault();
		for (let i = 0; i < 1000; i++) vault.addFile(`Untriaged ${i}.md`, { frontmatter: { type: 'Epic', order: i } });
		return vault;
	}

	it('formats the face and the accessible name the same way, in English', () => {
		setLocale('en');
		const { containerEl } = makeRoadmap(thousandShelfVault(), {}, { shelfCollapsed: true });
		expect(shelfCountOf(containerEl)).toBe('1,000');
		const disclosure = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-disclosure');
		expect(disclosure?.getAttribute('aria-label')).toContain('1,000');
	});

	it('and in German, where the same count groups with a dot instead', () => {
		setLocale('de-DE');
		const { containerEl } = makeRoadmap(thousandShelfVault(), {}, { shelfCollapsed: true });
		expect(shelfCountOf(containerEl)).toBe('1.000');
		const disclosure = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-disclosure');
		expect(disclosure?.getAttribute('aria-label')).toContain('1.000');
	});
});
