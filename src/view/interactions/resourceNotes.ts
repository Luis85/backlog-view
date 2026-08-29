import { Notice, TFile } from 'obsidian';
import { BacklogViewHost } from '../host';
import { ValuePromptModal } from '../../ui/prompts';
import { configProblems } from '../../domain/settingsConsistency';
import { createResourceNote } from '../../storage/createNote';
import { t } from '../../i18n/t';

/**
 * The view's half of making a `Resource` note: opening the prompt from the roadmap's
 * resources axis, gating it, writing what comes back, and — for the caller that asked for
 * one — naming the note it just made.
 *
 * `interactions/absences.ts`'s own shape — the config gate before the form and again at
 * submit, the folder resolved at submit, a Notice naming `file.basename` — because a
 * resource and an absence are the same kind of note for this purpose: neither is a work
 * item, so neither goes through `interactions/create.ts`'s `NewItemSpec` ladder.
 * `promptNewResource` takes no lane and no item: the toolbar control that opens it is not
 * per-row, it is the resources axis's own — see [[Making a resource from the timeline]].
 */

/**
 * Ask for a name, then write it — and, once it exists, hand `then` the file it made. The
 * caller with a pick in flight (`addAssigneeItems`'s **New resource...**) supplies one so
 * the note it just wrote is exactly what the pick assigns; a caller with nothing to do
 * afterward (the toolbar button) leaves it out.
 *
 * The gate runs FIRST, before the form: an action that took the user's typing and then
 * had its write refused would leave them worse off than one that never opened — the same
 * order `promptAddAbsence` puts these in, for the same reason.
 */
export function promptNewResource(host: BacklogViewHost, then?: (file: TFile) => void): void {
	if (refusedByConfig(host)) return;
	new ValuePromptModal(host.app, {
		title: t('resource.createHeading'),
		fieldName: t('resource.nameField'),
		placeholder: t('resource.namePlaceholder'),
		ctaLabel: t('resource.createCta'),
		// The `Resource` notes the base returned — what this dialog can actually claim
		// exists, now that a resource is a note and not a name gathered off the roadmap.
		known: host.model?.resources.map((r) => r.title) ?? [],
		// 3a: warned, and allowed. Two real people can share a name, and this dialog
		// guides rather than arbitrates who exists. The wording matches what `known`
		// can actually claim — see `resource.duplicateWarning`'s own comment.
		duplicateWarning: t('resource.duplicateWarning'),
		onSubmit: (value) => void writeResource(host, value, then),
	}).open();
}

/**
 * Where a resource is filed: its own configured folder, else the home folder, else the
 * vault root — `absenceFolder`'s own ladder, minus the "no parent to infer a folder-mode
 * position from" rung an absence has no question about either.
 *
 * Asked at SUBMIT, never at open, for `absenceFolder`'s own reason: Obsidian's options
 * pane stays reachable while a modal is up, and the reader's newest statement of where
 * resources live is the one they meant.
 */
function resourceFolder(host: BacklogViewHost): string {
	return host.settings.resourceFolder || host.settings.homeFolder;
}

/**
 * The config gate this flow runs BEFORE opening the form — `applySafely`'s own guard, at
 * the one path that writes a resource note without going through it — and AGAIN at
 * submit, because the form outlives the config it opened under: Obsidian's options pane
 * stays reachable while a modal is up, and a write after the narrowing would reach
 * `setOwn(fm, '', ...)`.
 *
 * Unlike `absences.ts`'s `refusedByConfig`, there is no second, sharper check here:
 * `createResourceNote` writes exactly one key, `settings.typeKey`, which always
 * resolves, so `configProblems` is the whole of what could refuse it.
 */
function refusedByConfig(host: BacklogViewHost): boolean {
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		new Notice(t('config.fixFirst', { problem: problems[0] }));
		return true;
	}
	return false;
}

async function writeResource(host: BacklogViewHost, name: string, then?: (file: TFile) => void): Promise<void> {
	if (refusedByConfig(host)) return;
	try {
		const file = await createResourceNote(host.app, host.settings, {
			folder: resourceFolder(host),
			title: name.trim(),
		});
		// The note's own name, never the requested one — `uniqueNotePath` may have
		// suffixed it. `writeAbsence` reports the same way for the same reason.
		new Notice(t('resource.created', { name: file.basename }));
		// The note exists BEFORE anything links to it — a link to a note that does not
		// exist is the one value this flow must not produce — so a failed creation
		// throws past this line and writes no link.
		then?.(file);
	} catch (e) {
		console.error('Product Backlog: failed to create the resource', e);
		new Notice(t('resource.createFailed'));
	}
}
