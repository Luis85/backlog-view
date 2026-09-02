// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { FolderSuggest, KnownValueSuggest, ValuePromptModal } from '../../src/ui/prompts';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap } from '../../src/domain/roadmap';
import { organizeShelf, searchShelf } from '../../src/domain/shelf';
import { columnPolicyKey, wipLimitKey } from '../../src/domain/settings';
import { isIterationType } from '../../src/domain/itemTypes';
import { setLocale } from '../../src/i18n/t';
import { installObsidianDom } from '../helpers/dom';
import { resetLocale } from '../helpers/locale';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';
import { TFolder } from '../helpers/obsidian-mock';

installObsidianDom();

/**
 * The two halves of the fold split, driven rather than classified — `foldSites.ts` says
 * which fold is which and this file asks what each one DOES in a locale that tells them
 * apart.
 *
 * Turkish is that locale, and it is the reason this PBI exists: `I` folds to `ı` there
 * and `toLowerCase()` gives `i` by specification, whatever language the reader is in. So
 * every assertion below is a pair — the same input under `en` and under `tr` — because
 * asserting only the Turkish answer would pass just as well if the fold had no locale in
 * it at all. **The mirror is the half that matters more**: an identity fold asserted
 * UNCHANGED under `tr` is what fails if somebody ever "fixes locale handling" by sweeping
 * `toLowerCase` to `toLocaleLowerCase`, which the PBI note calls the one careless change
 * worse than no change.
 *
 * `İ` is the other side of the same mapping and is deliberately not a fixture here: it
 * folds from 2 UTF-16 units to 3, so it belongs to a matcher that INDEXES, and `src/`
 * holds none — every matching site below is a boolean `includes` or an `===`.
 */

afterEach(resetLocale);

/**
 * Run `body` with the plugin resolved to `code`, and put the locale back — `afterEach`
 * above covers a body that throws, this covers the two-locale pairs below, which resolve
 * twice inside one test.
 */
function withLocale<T>(code: string, body: () => T): T {
	setLocale(code);
	try {
		return body();
	} finally {
		resetLocale();
	}
}

describe('a matching fold follows the reader\'s locale', () => {
	function shelfOf() {
		const vault = new FakeVault();
		// `Işık` — Turkish for "light", and the worked example: its capital `I` folds to a
		// DOTLESS `ı`, which is what a Turkish keyboard produces and what the reader types.
		vault.addFile('Işık raporu.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Billing export.md', { frontmatter: { type: 'Epic', order: 20 } });
		const settings = settingsWith({ horizonKey: 'horizon', horizonValues: ['Now', 'Next'] });
		const model = buildModel(vault.app, vault.entries(), settings);
		return buildRoadmap(model, settings, () => true, 'horizons').shelf;
	}

	it('finds a shelved card a Turkish reader can see and an English fold cannot', () => {
		const titles = (code: string) =>
			withLocale(code, () => searchShelf(shelfOf(), 'ışık').map((c) => c.item.title));

		expect(titles('tr')).toEqual(['Işık raporu']);
		// The bug this PBI is about: the card is plainly on screen and the filter misses it.
		expect(titles('en')).toEqual([]);
	});

	it('suggests a folder whose name the reader spelled in their own alphabet', () => {
		const paths = (code: string) => {
			const vault = new FakeVault();
			vault.folders.add('Işık');
			vault.folders.add('Billing');
			const suggest = new FolderSuggest(vault.app, document.body.createEl('input'));
			return withLocale(code, () =>
				(suggest as unknown as { getSuggestions: (q: string) => TFolder[] })
					.getSuggestions('ışık')
					.map((f) => f.path),
			);
		};

		expect(paths('tr')).toEqual(['Işık']);
		expect(paths('en')).toEqual([]);
	});

	it('suggests a known value the reader spelled in their own alphabet', () => {
		const matches = (code: string) => {
			const suggest = new KnownValueSuggest(new FakeVault().app, document.body.createEl('input'), [
				'Işık',
				'Billing',
			]);
			return withLocale(code, () =>
				(suggest as unknown as { getSuggestions: (q: string) => string[] }).getSuggestions('ışık'),
			);
		};

		expect(matches('tr')).toEqual(['Işık']);
		expect(matches('en')).toEqual([]);
	});

	it('warns about a duplicate name that only the reader\'s own locale can see', () => {
		// `IŞIL` and `Işıl` are one name in Turkish and two under a locale-independent
		// fold — `IŞIL` folds to `işil` there, which matches nothing on the roster.
		const warned = (code: string) => {
			const vault = new FakeVault();
			const modal = new ValuePromptModal(vault.app, {
				title: 'New resource',
				fieldName: 'Name',
				placeholder: 'Alex',
				ctaLabel: 'Create',
				known: ['Işıl'],
				duplicateWarning: 'Someone with this name is already on the roster.',
				onSubmit: () => undefined,
			});
			return withLocale(code, () => {
				modal.open();
				const input = modal.contentEl.querySelector('input');
				if (!input) throw new Error('resource prompt incomplete');
				input.value = 'IŞIL';
				input.dispatchEvent(new Event('input', { bubbles: true }));
				return modal.contentEl.querySelector('.pbl-modal-warning')?.textContent ?? '';
			});
		};

		expect(warned('tr')).toBe('Someone with this name is already on the roster.');
		expect(warned('en')).toBe('');
	});
});

describe('an identity fold is the same answer in every locale', () => {
	/**
	 * The mirror. Each of these decides what something IS, and each is a shape the PBI
	 * note names as vault-corrupting if it ever took a locale: a persisted option key
	 * built from a state name, and a type name matched against the fixed vocabulary.
	 */
	it('keeps a persisted option key spelled the way every other locale spells it', () => {
		const keys = (code: string) =>
			withLocale(code, () => [wipLimitKey('In progress'), columnPolicyKey('In progress')]);

		// Under a Turkish fold these would key on `ın progress`, so every Turkish user's
		// WIP limits and column policy would silently reset and a vault configured in one
		// locale would read differently in another.
		expect(keys('tr')).toEqual(['wipLimit.in progress', 'columnPolicy.in progress']);
		expect(keys('tr')).toEqual(keys('en'));
	});

	it('still recognizes a declared type name a Turkish fold would not', () => {
		// `Iteration` folds to `ıteratıon` in Turkish, so a swept fold stops matching a
		// note that says `iteration` — an Obsidian set to Turkish would stop recognizing
		// its own iterations.
		expect(withLocale('tr', () => isIterationType('iteration'))).toBe(true);
		expect(withLocale('en', () => isIterationType('iteration'))).toBe(true);
	});

	it('groups a shelf card by the type its badge names, in any locale', () => {
		const groups = (code: string) => {
			const vault = new FakeVault();
			// The note spells its type in lower case; `ALL_TYPES` spells it `Idea`. Only one
			// side is user data, which is what makes the fold identity: under a Turkish fold
			// `Idea` becomes `ıdea`, the two stop matching, and the card falls to `Other`.
			vault.addFile('An idea.md', { frontmatter: { type: 'idea', order: 10 } });
			const settings = settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] });
			const model = buildModel(vault.app, vault.entries(), settings);
			const shelf = buildRoadmap(model, settings, () => true, 'horizons').shelf;
			return withLocale(code, () => organizeShelf(shelf, 'tree', new Set()).map((g) => g.type));
		};

		expect(groups('tr')).toEqual(['Idea']);
		expect(groups('tr')).toEqual(groups('en'));
	});
});
