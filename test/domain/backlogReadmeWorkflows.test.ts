import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { backlogReadmeContent } from '../../src/domain/backlogReadme';

/**
 * What the generated README says about the TWO workflows sharing one property table.
 *
 * Split from `backlogReadme.test.ts` by subject rather than by size: every case here
 * turns on one question that file does not otherwise ask — whether a configuration is
 * one property or two — and the answer decides both how many rows the table has and
 * what each says about the other. The rest of that file is about the type section, the
 * example block, the stamps and the prose.
 */
describe('the property table with two workflows in it', () => {
	/** How many rows of the property table name this key — one property, one row. */
	const keyRows = (content: string, key: string) => content.split('\n').filter((l) => l.startsWith(`| \`${key}\` |`)).length;

	it('adds a property row for a configured Deliverable state key', () => {
		const settings = settingsWith({ deliverableStateKey: 'deliverableStatus' });
		const content = backlogReadmeContent(settings, [], 'test');
		expect(content).toContain('deliverableStatus');
	});


	it('omits the Deliverable state row when unconfigured', () => {
		const content = backlogReadmeContent(defaultSettings(), [], 'test');
		expect(content).not.toContain('deliverableStatus');
	});


	it('renders the Deliverable state row with no positional claim, when nothing precedes it', () => {
		// A fully independent, reachable configuration: deliverableStateKey needs no
		// stateKey, so the requirements-workflow row — and the whole '## Workflow states'
		// section — can be entirely absent from this same document while this row renders.
		// "The one above" would have no antecedent here.
		const settings = settingsWith({ deliverableStateKey: 'deliverableStatus' });
		const content = backlogReadmeContent(settings, [], 'test');
		expect(content).toContain('| `deliverableStatus` | Optional, on a Deliverable |');
		expect(content).not.toContain('## Workflow states');
		expect(content).not.toMatch(/\bthe one above\b/i);
	});


	it('documents ONE shared property once, however the sharing was arrived at', () => {
		// Two ways to share: leaving the Deliverable option unset (the fallback), and
		// setting it to the requirements key on purpose — the one collision
		// `configProblems` exempts. Both are one property, so both get one row that says
		// it carries both workflows. Asking the raw option instead of the resolved key
		// documented the second as two SEPARATE properties, and listed the one key twice
		// in a table of what a note may carry.
		for (const settings of [
			settingsWith({ stateKey: 'status' }),
			settingsWith({ stateKey: 'status', deliverableStateKey: 'status' }),
		]) {
			const content = backlogReadmeContent(settings, [], 'test');
			expect(keyRows(content, 'status')).toBe(1);
			expect(content).toContain("The workflow state — see below, and the Deliverable workflow's own state on a Deliverable");
			expect(content).not.toContain("separate from the requirements workflow's");
		}
	});


	it('still claims "separate" when the Deliverable workflow has its own distinct key', () => {
		const settings = settingsWith({ stateKey: 'status', deliverableStateKey: 'deliverableStatus' });
		const content = backlogReadmeContent(settings, [], 'test');
		expect(content).toContain(
			"| `deliverableStatus` | Optional, on a Deliverable | The Deliverable workflow's own state — separate from the requirements workflow's |",
		);
		// Two properties, so two rows — one each, neither claiming to be the other.
		expect(keyRows(content, 'status')).toBe(1);
		expect(keyRows(content, 'deliverableStatus')).toBe(1);
	});


	it('states no relationship when there is no requirements workflow to relate to', () => {
		// `stateKey` unset and the Deliverable one configured is a reachable, fully
		// independent configuration: the document has no requirements-state row and no
		// "## Workflow states" section, so "separate from the requirements workflow's"
		// would name something this reader cannot find.
		const settings = settingsWith({ stateKey: '', deliverableStateKey: 'docStatus' });
		const content = backlogReadmeContent(settings, [], 'test');
		expect(content).toContain("| `docStatus` | Optional, on a Deliverable | The Deliverable workflow's own state |");
		expect(content).not.toContain('requirements workflow');
	});
});
