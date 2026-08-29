// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Notice } from '../helpers/obsidian-mock';
import { flush, refresh, useViewHarness } from '../helpers/view';
import { laneRoadmap } from '../helpers/roadmap';
import { ALICE_AWAY_PATH, absenceVault } from '../helpers/resources';
import { absenceAddButton, openAbsenceEdit, submitAbsence } from '../helpers/absences';

useViewHarness();

/**
 * What an absence writer REFUSES when the world moves under an open form.
 *
 * Split from `absenceEditing.test.ts` on 2026-08-29, at the line the 450-line budget forced
 * and along the seam that was already there: that file is about what the three flows DO, and
 * every test here is about the same question asked of both of them — the form was filled
 * against one state of the vault and submitted against another. Four things can move in that
 * window and each gets its own refusal, so they read better together than split across the
 * flow they happen to belong to:
 *
 * - the roster this model carries (`resourceById`, checked against the list captured at open)
 * - the vault's own answer about the resource, which the model can be a refresh behind
 * - the note being EDITED, retyped INTO a `Resource`
 * - the configuration, narrowed while the modal was up
 *
 * The two interleaving tests are the sharpest of them and came from automated review on
 * PR #209: a guard asked before an await is a guard with a window after it, so they retype
 * DURING the write rather than before the submit. `FakeVault.beforeWrite` is what puts
 * something in that window — fired by `processFrontMatter` on the edit path, and by
 * `createFolder` on the create path, which is the await `createAbsenceNote` sits behind.
 */

describe('adding an absence, when the world moves under the form', () => {
	it('reports a resource that left the roster between the form opening and this submit', async () => {
		// The one race `validate` cannot see, since it checks the chosen id against the
		// roster captured at open: the model moves under an open modal exactly as the
		// config does (the test above), and here it is Bob's own note that stops being a
		// `Resource` before the click lands.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);

		absenceAddButton(harness.containerEl, 'Bob')?.click();
		vault.fm('Bob.md')['type'] = 'Epic';
		refresh(harness.view, vault);
		expect(submitAbsence({ start: '2026-09-01', target: '2026-09-04' })).toBe(true);
		await flush();

		expect(vault.files.has('Bob away 2026-09-01 → 2026-09-04.md')).toBe(false);
		expect(Notice.messages.some((m) => m.startsWith('That resource is no longer in this base'))).toBe(true);
	});

	it('refuses a resource the VAULT no longer calls one, while the model still lists it', async () => {
		// One step past the test above, and the whole of the issue this closes: no `refresh`,
		// so the model's roster is exactly what it was at open and `resourceById` finds Bob.
		// Only the vault knows he was retyped — which is where `createAbsenceNote` asks,
		// through the same `refusesLiveAssignee` `applyWrites` uses. Without that ask the
		// note is written and links to an ordinary note, drawing in no lane at all.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);

		absenceAddButton(harness.containerEl, 'Bob')?.click();
		vault.fm('Bob.md')['type'] = 'Epic';
		expect(submitAbsence({ start: '2026-09-01', target: '2026-09-04' })).toBe(true);
		await flush();

		expect(vault.files.has('docs/Bob away 2026-09-01 → 2026-09-04.md')).toBe(false);
		expect(Notice.messages.some((m) => m.startsWith('That resource is no longer in this base'))).toBe(true);
	});

	it('refuses a retype that lands DURING the write, not only one before the submit', async () => {
		// The test above retypes before submitting, which a check at the top of the writer
		// would also catch. This one retypes inside the write: `createAbsenceNote` awaits
		// `ensureFolder` before it creates, so a guard asked ahead of that await has a
		// window after it, and `beforeWrite` is how this vault puts something in the window.
		// The absence folder must not exist yet, or there is no await to interleave with.
		// Found by automated review on PR #209.
		//
		// What this canNOT reach, and the guard cannot either: a retype landing INSIDE
		// `vault.create`. That call takes no callback, so the line before it is the last
		// moment any caller-side check has — a ceiling, not a remaining gap.
		const vault = absenceVault();
		const harness = laneRoadmap(vault, { 'typeFolder.absence': 'docs/absences' });
		vault.beforeWrite = () => {
			vault.fm('Bob.md')['type'] = 'Epic';
		};

		absenceAddButton(harness.containerEl, 'Bob')?.click();
		expect(submitAbsence({ start: '2026-09-01', target: '2026-09-04' })).toBe(true);
		await flush();

		expect(vault.files.has('docs/absences/Bob away 2026-09-01 → 2026-09-04.md')).toBe(false);
		expect(Notice.messages.some((m) => m.startsWith('That resource is no longer in this base'))).toBe(true);
	});

	it('writes for a resource Obsidian has not indexed yet, since no cache is no answer', async () => {
		// The rule the guard inherits and the reason it is that guard rather than a null
		// check: Obsidian fills the metadata cache AFTER `vault.create` resolves, so a
		// resource made by `New resource...` a moment ago has no cache of its own. Reading
		// that absence as "not a Resource" would refuse every freshly created one.
		// `FakeVault.create` indexes synchronously, so the window has to be asked for.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);

		absenceAddButton(harness.containerEl, 'Bob')?.click();
		vault.unindex('Bob.md');
		expect(submitAbsence({ start: '2026-09-01', target: '2026-09-04' })).toBe(true);
		await flush();

		expect(vault.files.has('docs/Bob away 2026-09-01 → 2026-09-04.md')).toBe(true);
	});

	it('re-asks the gate at submit, so a config narrowed under the open form writes nothing', async () => {
		// The render gate withholds the button, but the form outlives the config it opened
		// under: Obsidian's options pane stays reachable while a modal is up. Without the
		// re-check the write below reaches `setOwn(fm, '', ...)` — a key nobody configured.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);
		const before = vault.files.size;

		absenceAddButton(harness.containerEl, 'Alice')?.click();
		harness.config.values['targetProperty'] = undefined;
		refresh(harness.view, vault);
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.files.size).toBe(before);
		expect(Notice.messages.some((m) => m.startsWith('Name the assignee and both date properties'))).toBe(true);
	});
});

describe('editing an absence, when the world moves under the form', () => {
	it('reports a resource that left the roster between the form opening and this submit', async () => {
		// `writeAbsence`'s own race, read again for the edit path: the model moves under an
		// open modal exactly as the config does, and here Bob's own note stops being a
		// `Resource` before the click lands.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);

		openAbsenceEdit(harness.containerEl);
		vault.fm('Bob.md')['type'] = 'Epic';
		refresh(harness.view, vault);
		expect(submitAbsence({ resource: 'Bob.md', start: '2026-08-05', target: '2026-08-09' })).toBe(true);
		await flush();

		expect(vault.files.has('Bob away 2026-08-05 → 2026-08-09.md')).toBe(false);
		expect(vault.fm(ALICE_AWAY_PATH)['start']).toBe('2026-08-04');
		expect(Notice.messages.some((m) => m.startsWith('That resource is no longer in this base'))).toBe(true);
	});

	it('refuses an edit naming a resource the vault no longer calls one, and does not rename it', async () => {
		// The add flow's own vault-vs-model race, asked of the other writer: no `refresh`,
		// so `resourceById` still finds Bob and only `updateAbsenceNote`'s guard sees the
		// retype. The rename must be skipped too — it spells the resource's name into the
		// title, so renaming after this refusal names the note for a fact never written.
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openAbsenceEdit(containerEl);
		vault.fm('Bob.md')['type'] = 'Epic';
		expect(submitAbsence({ resource: 'Bob.md', start: '2026-08-05', target: '2026-08-09' })).toBe(true);
		await flush();

		expect(vault.fm(ALICE_AWAY_PATH)).toEqual({ type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' });
		expect(vault.files.has(ALICE_AWAY_PATH)).toBe(true);
		expect(Notice.messages.some((m) => m.startsWith('That resource is no longer in this base'))).toBe(true);
	});

	it('refuses a retype that lands DURING the edit, not only one before the submit', async () => {
		// The add flow's own interleaving test, asked of the other writer: `beforeWrite`
		// fires inside `processFrontMatter` ahead of its callback, which is exactly the gap
		// a guard placed before that await would leave open. The frontmatter must be
		// untouched — the callback ran and refused, rather than never having been reached.
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vault.beforeWrite = () => {
			vault.fm('Bob.md')['type'] = 'Epic';
		};

		openAbsenceEdit(containerEl);
		expect(submitAbsence({ resource: 'Bob.md', start: '2026-08-05', target: '2026-08-09' })).toBe(true);
		await flush();

		expect(vault.fm(ALICE_AWAY_PATH)).toEqual({ type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' });
		expect(vault.files.has(ALICE_AWAY_PATH)).toBe(true);
		expect(Notice.messages.some((m) => m.startsWith('That resource is no longer in this base'))).toBe(true);
	});

	it('refuses an edit whose note was retyped to Resource while the modal was open, and does not rename it', async () => {
		// The race `applyWrites` and `applyPropertyWrites` both close and this writer shares
		// none of their path: the modal opened against Alice's absence, and the note itself
		// is retyped between that open and this submit — exactly what an external edit or
		// another view's own write could do while the form sits open. `updateAbsenceNote`
		// must refuse rather than silently write the assignee and both dates onto a resource,
		// and `editAbsence` must not then rename it — half of what the refusal protects.
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openAbsenceEdit(containerEl);
		vault.fm(ALICE_AWAY_PATH)['type'] = 'Resource';
		expect(submitAbsence({ resource: 'Bob.md', start: '2026-08-05', target: '2026-08-09' })).toBe(true);
		await flush();

		// Neither half landed: the frontmatter is exactly what it was retyped to (assignee
		// and dates untouched), and the note kept its old name.
		expect(vault.fm(ALICE_AWAY_PATH)).toEqual({
			type: 'Resource',
			assignee: 'Alice',
			start: '2026-08-04',
			due: '2026-08-06',
		});
		expect(vault.files.has('Bob away 2026-08-05 → 2026-08-09.md')).toBe(false);
		expect(Notice.messages).toContain('That note became a resource while the edit was in flight, so nothing was changed.');
	});

	it('re-asks the gate at submit, exactly as the add flow does', async () => {
		// The edit form outlives the config it opened under for the same reason the add form
		// does — Obsidian's options pane stays reachable while a modal is up — and the write
		// after a narrowing would reach `setOwn(fm, '', ...)`, a key nobody configured.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);

		openAbsenceEdit(harness.containerEl);
		harness.config.values['targetProperty'] = undefined;
		refresh(harness.view, vault);
		submitAbsence({ resource: 'Alice.md', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.fm(ALICE_AWAY_PATH)['start']).toBe('2026-08-04');
		expect(Notice.messages.some((m) => m.startsWith('Name the assignee and both date properties'))).toBe(true);
	});
});
