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
		// The estimate key is bound and NOT ONE member answers it — extension 4a, which is a
		// different statement from `Zeros.md` above, where every member answers with zero.
		vault.addFile('NoEst.md', { frontmatter: { type: 'Release' } });
		vault.addFile('N1.md', { frontmatter: { type: 'PBI', order: 1, release: '[[NoEst]]' } });
		vault.addFile('N2.md', { frontmatter: { type: 'PBI', order: 2, release: '[[NoEst]]', effort: 'TBD' } });
		// Each estimate finite, their sum not — the one door the per-value reader cannot close.
		vault.addFile('Huge.md', { frontmatter: { type: 'Release' } });
		vault.addFile('H1.md', { frontmatter: { type: 'PBI', order: 1, release: '[[Huge]]', effort: 1e308 } });
		vault.addFile('H2.md', { frontmatter: { type: 'PBI', order: 2, release: '[[Huge]]', effort: 1e308 } });
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
		// The three keys are CLEARED rather than left to `RELEASE_CONFIG`'s silence: ✨ binds
		// all three since 2026-09-01, so that fixture is a configured vault again and a test
		// whose whole claim is "nothing is configured" has to say so itself.
		const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: '', dependsOnProperty: '', riskProperty: '' });
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

	it('names the property and vocabulary behind every readiness figure', () => {
		// `Summing up a release` main flow step 5: every figure names its property and
		// vocabulary where there is one. The chips and the effort figures shipped without it,
		// found by a review bot on the pull request that added them.
		//
		// Asserted on the HIDDEN text rather than the tooltip, and the choice is the point:
		// `setTooltip` on a static unfocusable div reaches a pointer alone, which is the
		// objection this module already answers for the collapsed chip. The tooltip is set
		// too, from the identical string.
		const { containerEl } = openScope(CONFIGURED);
		const said = [...containerEl.querySelectorAll('.pbl-rel-ready .pbl-sr-only, .pbl-rel-summary .pbl-sr-only')]
			.map((el) => el.textContent)
			.join(' | ');
		// The KEYS, not the config's `note.`-prefixed property ids — a reader goes and edits
		// frontmatter, which carries the bare key.
		expect(said).toContain('Estimates read effort.');
		expect(said).toContain('Prerequisites read dependsOn');
		expect(said).toContain('Risk reads risk.');
		// Both vocabularies, because a verdict cannot be reconciled from the critical list
		// alone: a member holding `Mitigated` clears, and nothing on screen said why.
		expect(said).toContain('Critical: Critical.');
		expect(said).toContain('Addressed: Mitigated.');
	});

	it('names no property for a criterion that is not configured', () => {
		// An unconfigured criterion has no property to name, and a sentence naming an empty
		// one is the "unconfigured reads as nothing, never as empty" defect this increment is
		// about — asked of the provenance sentence rather than of a figure.
		//
		// Clearing the ADDRESSED list is what makes it unconfigured: `releaseReadiness.ts`
		// requires the key and both vocabularies, so a half-written risk configuration has no
		// verdict and therefore nothing to explain. Written first as "names the critical list
		// alone", which failed by drawing nothing at all — which is how the unreachable
		// branch behind it was found and deleted.
		const { containerEl } = openScope({ ...CONFIGURED, addressedRiskValues: '' });
		const said = [...containerEl.querySelectorAll('.pbl-rel-ready .pbl-sr-only')].map((el) => el.textContent).join(' | ');
		expect(said).not.toContain('Risk reads');
		// The two that ARE configured still say what they read.
		expect(said).toContain('Estimates read effort.');
		expect(said).toContain('Prerequisites read dependsOn');
	});

	it('says there is nothing to sum when no member carries an estimate', () => {
		// Extension 4a: "the effort figures say there is nothing to sum, which is a different
		// statement from a total of zero". Drawing NOTHING does not say it — the figure reads
		// as accidentally missing, which is the same absent-and-unnamed defect the
		// unconfigured cases exist to prevent. The comment beside this branch claimed the rule
		// while the code silently omitted the figure; found by a review bot.
		const { containerEl } = openScope(CONFIGURED, 'NoEst.md');
		const strip = containerEl.querySelector('.pbl-rel-summary');
		expect(strip?.textContent).toContain('No estimates to sum');
		// Still says how many carry none, and never a total that would read as measured.
		expect(strip?.textContent).toContain('2 unestimated');
		expect(strip?.textContent).not.toContain('pts');
	});

	it('names an unreadable total rather than drawing an infinite one', () => {
		// The domain refuses the overflowed sum; this is the half that decides what the
		// reader SEES. Not folded into "not configured": the key is bound and the members
		// answered, so that sentence would send them to the wrong place.
		const { containerEl } = openScope(CONFIGURED, 'Huge.md');
		const strip = containerEl.querySelector('.pbl-rel-summary');
		expect(strip?.textContent).toContain('Effort does not add up to a readable total');
		expect(strip?.textContent).not.toContain('Infinity');
		expect(strip?.textContent).not.toContain('NaN');
		// The unestimated COUNT is a number of members and cannot overflow, so it survives.
		expect(strip?.textContent).toContain('0 unestimated');
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
