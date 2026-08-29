// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getReleaseViewOptions } from '../../src/domain/releaseOptions';
import { makeReleaseView, RELEASE_CONFIG } from '../helpers/release';
import { useViewHarness } from '../helpers/view';
import { en } from '../../src/i18n/en';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/**
 * The band's own progress line — split out of `releaseIndex.test.ts` (the 450-line test
 * budget) as its own subject: the design's layout (a bar, and a counted phrase folding the
 * member count in), the two ways progress can legitimately draw nothing (no members at
 * all; a state property that is unbound), and the gap named on a band that cannot compute
 * one at all.
 *
 * Each test builds its own small vault rather than `releaseVault()`, which has no members
 * and is shared with `test/i18n/projections.test.ts` and `test/domain/bars.test.ts`.
 */
describe('the band’s progress line', () => {
	useViewHarness();

	it('draws a bar and the counted phrase when membership and state are both bound', () => {
		const vault = new FakeVault();
		vault.addFile('0.8.md', {
			frontmatter: { type: 'Release', version: '0.8.0', 'target-date': '2026-09-12', status: 'In progress' },
		});
		vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Done' } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Doing' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;
		expect(band.querySelector('.pbl-rel-bar')).not.toBeNull();
		expect(band.querySelector('.pbl-rel-progress')?.textContent).toBe(
			en['column.rollupTooltip'].other.replace('{done}', '1').replace('{count}', '2'),
		);
		expect(band.querySelector('.pbl-state-chip')?.textContent).toContain('In progress');
	});

	it('says a member is done, singular, at exactly one of one', () => {
		// The whole reason `column.rollupTooltip` is reused rather than a release-specific
		// key with `{total}`: a key that cannot accept a parameter named `count` cannot
		// select this form at all (see the catalog's own comment at the key).
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release' } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Done' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;
		expect(band.querySelector('.pbl-rel-progress')?.textContent).toBe(
			en['column.rollupTooltip'].one.replace('{done}', '1').replace('{count}', '1'),
		);
	});

	it('says there is nothing to count rather than drawing an empty bar', () => {
		const vault = new FakeVault();
		vault.addFile('0.9.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-12' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		expect(band.textContent).toContain(en['release.index.noMembers']);
		expect(band.querySelector('.pbl-rel-bar')).toBeNull();
	});

	it('leaves the bar and the phrase absent when membership is bound but the state property is not, and names the gap on the band itself', () => {
		// Extension 2a's own case: a done count with no state property to read is a
		// configuration to fix, not a truthful zero.
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release', version: '0.8.0' } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Done' } });
		const { containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, stateProperty: '' });
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		expect(band.querySelector('.pbl-rel-bar')).toBeNull();
		expect(band.querySelector('.pbl-rel-progress')).toBeNull();
		// Not the "no members" reading — this release DOES have one, so the sentence names
		// the gap rather than reusing the empty-list phrase.
		expect(band.textContent).not.toContain(en['release.index.noMembers']);
		expect(band.textContent).toContain('is not configured');
		// Said once — on the band, never also beneath the list.
		const note = containerEl.querySelector('.pbl-rel-note')?.textContent ?? '';
		expect(note).not.toContain('Progress');
	});

	/**
	 * The guard for a rule the previous test cannot see: it hardcodes
	 * `deliverableStateProperty` on both sides — the config it builds and the string
	 * `releaseOptions.ts` happens to declare today — so a rename on EITHER side (the
	 * declared option's key, or `DELIVERABLE_NAMES.property` in `settingsResolve.ts`,
	 * which reads it) would leave both a passing declaration test (asserts the declared
	 * name) and a passing behaviour test (sets that same literal directly) while the
	 * feature silently stopped working — the option would still render in Bases' options
	 * panel and bind nothing. This test reads the key OFF the declaration
	 * (`getReleaseViewOptions`) instead of spelling it a second time, so it is the one place
	 * a declared option and the settings reader that consumes it are asked to agree.
	 */
	it('binds through whatever key the release view actually declares for the Deliverable state', () => {
		const declared = getReleaseViewOptions(new FakeViewConfig({}) as never)
			.flatMap((entry) => (entry.type === 'group' ? entry.items : [entry]))
			.find((option) => option.type === 'property' && option.displayName === en['option.deliverableStateProperty']);
		expect(declared).toBeDefined();
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release', version: '0.8.0' } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', release: '[[0.8]]', docStatus: 'Done' } });
		const { containerEl } = makeReleaseView(vault, {
			...RELEASE_CONFIG,
			stateProperty: '',
			[declared!.key]: 'note.docStatus',
		});
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;
		expect(band.querySelector('.pbl-rel-bar')).not.toBeNull();
	});

	it('draws the bar for a Deliverables-only release with no plan state property at all', () => {
		// Carried finding 1: the gate moved from the plan's own `stateKey` to the workflows
		// the members actually span, and `ReleaseRow.done` is the single figure both the band
		// and the scope header read — so the index has to gain progress on this release
		// exactly when the single-release screen does (`test/view/releaseScopeRender.test.ts`'s
		// matching case), never as a second opinion about it.
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release', version: '0.8.0' } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', release: '[[0.8]]', docStatus: 'Done' } });
		const { containerEl } = makeReleaseView(vault, {
			...RELEASE_CONFIG,
			stateProperty: '',
			deliverableStateProperty: 'note.docStatus',
		});
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;
		expect(band.querySelector('.pbl-rel-bar')).not.toBeNull();
		expect(band.querySelector('.pbl-rel-progress')?.textContent).toBe(
			en['column.rollupTooltip'].one.replace('{done}', '1').replace('{count}', '1'),
		);
	});

	/**
	 * The bug this pins: `drawAbsences` used to read `rows[0]` alone to decide whether
	 * Progress is absent, and `done.unconfigured` is a PER-RELEASE answer since the gate
	 * moved to the workflows a release's members actually span (Carried finding 1, the test
	 * above) — so a base mixing a Deliverables-only release (progress CONFIGURED, through
	 * `deliverableStateProperty`) with an ordinary one (progress UNCONFIGURED, `stateProperty`
	 * cleared) got two different answers depending on which release happened to sort first.
	 * `Alpha`/`Beta` control the ordering directly through `releaseIndex`'s own path
	 * tie-break (`withinGroupOrder`/`rank` both tie here — no target date, no order — so the
	 * final tie-break, the path string, decides), rather than trusting file-add order or a
	 * property the domain module does not sort on.
	 *
	 * Both bands must show their own truth regardless of ordering (one bar, one none — the
	 * "one denominator, one predicate, one answer" rule one level up), and the note beneath
	 * the list must give the SAME answer about Progress in both orderings: since at least one
	 * release always has it configured, Progress is never named absent — `rows.every`, never
	 * `rows[0]`. The old code passed the first ordering below by accident (`rows[0]` happened
	 * to be the configured release, so it silently said nothing — arguably still short of the
	 * mark, but not the loud defect) and FAILED the second (`rows[0]` was the unconfigured
	 * release, so the note falsely claimed Progress absent while the Deliverables band right
	 * beside it plainly showed one) — this test drives both, so an ordering-dependent
	 * regression cannot hide behind whichever one a future edit happens to exercise.
	 */
	it('agrees about Progress across a mixed-config base regardless of which release sorts first', () => {
		function mixedVault(deliverablesFirst: boolean): FakeVault {
			const vault = new FakeVault();
			const [deliv, plan] = deliverablesFirst ? ['Alpha', 'Beta'] : ['Beta', 'Alpha'];
			vault.addFile(`${deliv}.md`, { frontmatter: { type: 'Release', version: '0.1.0' } });
			vault.addFile('DeliverableItem.md', {
				frontmatter: { type: 'Deliverable', release: `[[${deliv}]]`, docStatus: 'Done' },
			});
			vault.addFile(`${plan}.md`, { frontmatter: { type: 'Release', version: '0.2.0' } });
			vault.addFile('PlanItem.md', { frontmatter: { type: 'PBI', release: `[[${plan}]]`, status: 'Done' } });
			return vault;
		}
		const config = { ...RELEASE_CONFIG, stateProperty: '', deliverableStateProperty: 'note.docStatus' };

		for (const deliverablesFirst of [true, false]) {
			const { containerEl } = makeReleaseView(mixedVault(deliverablesFirst), config);
			const bands = [...containerEl.querySelectorAll('.pbl-rel-band')];
			expect(bands).toHaveLength(2);
			const [first, second] = deliverablesFirst ? bands : [bands[1], bands[0]];
			expect(first.querySelector('.pbl-rel-bar'), 'Deliverables release should show a bar').not.toBeNull();
			expect(second.querySelector('.pbl-rel-bar'), 'ordinary release should show no bar').toBeNull();

			// Not globally absent either way: one release DOES have it configured.
			const note = containerEl.querySelector('.pbl-rel-note')?.textContent ?? '';
			expect(note, `Progress must not be claimed absent (deliverablesFirst=${deliverablesFirst})`).not.toContain(
				'Progress',
			);
		}
	});

	/** A release whose members are all Deliverables with `deliverableStateProperty` bound,
	 *  beside a release of ordinary work with `stateProperty` cleared — one band computable,
	 *  one not, which is the case a list-wide statement about Progress cannot make. */
	function mixedProgressRows(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Deliverables.md', { frontmatter: { type: 'Release', version: '0.1.0' } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', release: '[[Deliverables]]', docStatus: 'Done' } });
		vault.addFile('Ordinary.md', { frontmatter: { type: 'Release', version: '0.2.0' } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', release: '[[Ordinary]]', status: 'Done' } });
		return vault;
	}

	/** Both releases unconfigured for progress — the case the old `rows.every` gate
	 *  covered, now asked of the band instead. */
	function allUnconfiguredRows(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('One.md', { frontmatter: { type: 'Release', version: '0.1.0' } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[One]]', status: 'Done' } });
		vault.addFile('Two.md', { frontmatter: { type: 'Release', version: '0.2.0' } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', release: '[[Two]]', status: 'Done' } });
		return vault;
	}

	const MIXED_CONFIG = { ...RELEASE_CONFIG, stateProperty: '', deliverableStateProperty: 'note.docStatus' };
	const UNCONFIGURED_CONFIG = { ...RELEASE_CONFIG, stateProperty: '' };

	it('names the progress gap on the band that has one, not only beneath the list', () => {
		// Two releases, one computable and one not: the case a list-wide statement cannot make.
		const { containerEl } = makeReleaseView(mixedProgressRows(), MIXED_CONFIG);
		const bands = [...containerEl.querySelectorAll<HTMLElement>('.pbl-rel-band')];
		const silent = bands.find((b) => b.textContent?.includes('Ordinary'))!;
		expect(silent.textContent).toContain('is not configured');
		// The computable band keeps its figure and gains no such sentence.
		const shown = bands.find((b) => b.textContent?.includes('Deliverables'))!;
		expect(shown.querySelector('.pbl-rel-bar')).not.toBeNull();
		expect(shown.textContent).not.toContain('is not configured');
	});

	it('says it once — on the band, never also in the note beneath the list', () => {
		// EVERY release unconfigured: the case the old `rows.every` gate covered.
		const { containerEl } = makeReleaseView(allUnconfiguredRows(), UNCONFIGURED_CONFIG);
		const note = containerEl.querySelector('.pbl-rel-note');
		expect(note?.textContent ?? '').not.toContain('Progress');
		for (const band of containerEl.querySelectorAll<HTMLElement>('.pbl-rel-band')) {
			expect(band.textContent).toContain('is not configured');
		}
	});

	it('speaks the gap in the band accessible name', () => {
		const { containerEl } = makeReleaseView(mixedProgressRows(), MIXED_CONFIG);
		const band = [...containerEl.querySelectorAll<HTMLElement>('.pbl-rel-band')].find((b) =>
			b.textContent?.includes('Ordinary'),
		)!;
		expect(band.getAttribute('aria-label')).toContain('is not configured');
	});
});
