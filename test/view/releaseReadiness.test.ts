// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, scopeVault } from '../helpers/release';
import { useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';

/**
 * A release's readiness on screen: the chip row under the footline, and the effort figures
 * that join the summary strip.
 *
 * The vault is `scopeVault()` with three edits rather than a fixture of its own — the shared
 * helper is read by every other release suite, so a release added there is a release those
 * suites have to account for. `F1.md` gains an estimate (so `R.md` has something to sum AND
 * something outstanding), and two releases join for the two cases `R.md` cannot be: a
 * release whose every estimate is zero, and one with no members at all.
 */
describe("a release's readiness on screen", () => {
	useViewHarness();

	function readinessVault(): FakeVault {
		const vault = scopeVault();
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 });
		// `0` is a valid estimate, so this release is estimated in full and totals nothing.
		vault.addFile('Zeros.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Z1.md', { frontmatter: { type: 'PBI', order: 1, release: '[[Zeros]]', effort: 0 } });
		vault.addFile('Z2.md', { frontmatter: { type: 'PBI', order: 2, release: '[[Zeros]]', effort: 0 } });
		vault.addFile('Empty.md', { frontmatter: { type: 'Release' } });
		return vault;
	}

	function openScope(config: Record<string, unknown>, path = 'R.md'): { containerEl: HTMLElement } {
		const { view, containerEl } = makeReleaseView(readinessVault(), config);
		view.pick(path);
		return { containerEl };
	}

	const CONFIGURED = {
		...RELEASE_CONFIG,
		estimateProperty: 'note.effort',
		dependsOnProperty: 'note.dependsOn',
		riskProperty: 'note.risk',
		criticalRiskValues: 'Critical',
		addressedRiskValues: 'Mitigated',
	};

	it('draws one chip per criterion, in order', () => {
		const { containerEl } = openScope(CONFIGURED);
		const chips = [...containerEl.querySelectorAll('.pbl-rel-crit')] as HTMLElement[];
		expect(chips).toHaveLength(3);
		expect(chips.map((el) => el.dataset.criterion)).toEqual(['estimated', 'blocked', 'risk']);
	});

	it('collapses to one chip when every criterion is unconfigured', () => {
		// Three chips saying nothing three times is noise on exactly the vault that most
		// needs signal. One chip still LISTS them, which is what the readiness note asks;
		// the tooltip names all three.
		const { containerEl } = openScope(RELEASE_CONFIG);
		const chips = [...containerEl.querySelectorAll('.pbl-rel-crit')] as HTMLElement[];
		expect(chips).toHaveLength(1);
		// The three names are reachable without a pointer: a tooltip on a static, unfocusable
		// div reaches nobody using a keyboard or a screen reader, which is the same objection
		// this row already answers for an unsatisfied chip.
		const hidden = chips[0].querySelector('.pbl-sr-only') as HTMLElement;
		expect(hidden.textContent).toBe('Estimated, Dependencies resolved, Critical risks addressed');
		expect(hidden.getAttribute('aria-hidden')).toBeNull();
		expect(chips[0].textContent).toContain('Readiness: 3 criteria not configured');
	});

	it('names the criterion in every chip that is not satisfied', () => {
		// Two chips both reading "2 of 5 outstanding" are indistinguishable, and the tooltip
		// that would separate them is on a static unfocusable div — a pointer-only channel.
		const { containerEl } = openScope(CONFIGURED);
		const chips = [...containerEl.querySelectorAll('.pbl-rel-crit')] as HTMLElement[];
		// A row where every chip is satisfied would pass the loop below without asserting
		// anything: this fixture leaves the estimate criterion outstanding on purpose.
		expect(chips.filter((el) => !el.classList.contains('pbl-rel-crit-ok'))).not.toHaveLength(0);
		for (const chip of chips) {
			if (chip.classList.contains('pbl-rel-crit-ok')) continue;
			expect(chip.textContent).toMatch(/Estimated|Dependencies resolved|Critical risks addressed/);
		}
	});

	it('keeps the effort figures when progress is unconfigured', () => {
		// They read the ESTIMATE key, not the state workflow, so the summary's early return
		// for unconfigured progress must not take them with it.
		const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort', stateProperty: '' });
		const strip = containerEl.querySelector('.pbl-rel-summary') as HTMLElement;
		expect(strip.textContent).toContain('unestimated');
		expect(strip.querySelector('.pbl-rel-unreadable')).not.toBeNull();
		// The estimated total still answers; the progress THROUGH it does not, so it is
		// stated alone rather than against a zero that would read as measured.
		expect(strip.textContent).toContain('pts estimated');
		expect(strip.textContent).not.toContain('0 of');
	});

	it('draws the effort figure for a release whose every estimate is zero', () => {
		// `0` is a valid estimate, so this is not the same release as one nobody estimated —
		// and the percentage must not be a NaN drawn as one.
		const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort' }, 'Zeros.md');
		const strip = containerEl.querySelector('.pbl-rel-summary') as HTMLElement;
		expect(strip.textContent).toContain('0 of 0 pts (0%)');
		expect(strip.textContent).not.toContain('NaN');
	});

	it('keeps individual chips when only some are unconfigured', () => {
		// A mix is where the unconfigured one is the actionable item, so it keeps its own
		// chip rather than being folded away with the answers beside it.
		const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort' });
		const chips = [...containerEl.querySelectorAll('.pbl-rel-crit')] as HTMLElement[];
		expect(chips).toHaveLength(3);
	});

	it('draws no readiness row for a release with no members', () => {
		const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort' }, 'Empty.md');
		expect(containerEl.querySelector('.pbl-rel-ready')).toBeNull();
	});

	it('plans no write while the screen renders', () => {
		// The category check on the CALL, not a list of the paths somebody thought of: this
		// whole increment is a read, and the next render path added must not be able to
		// reopen that by omission. The spy is on the GATE rather than on the view's
		// `applyRelease`, because the gate is what every write of this view goes through —
		// a render calling the gate directly would slip past a spy on the view's own method.
		const { view } = makeReleaseView(readinessVault(), { ...RELEASE_CONFIG, estimateProperty: 'note.effort' });
		const spy = vi.spyOn(view.gate, 'applySafely');
		view.pick('R.md');
		expect(spy).not.toHaveBeenCalled();
	});
});
