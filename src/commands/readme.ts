import { App, Notice } from 'obsidian';
import { backlogReadmeContent } from '../domain/backlogReadme';
import { configProblems } from '../domain/settings';
import { BacklogModel } from '../domain/model';
import { BacklogSettings } from '../domain/settings';
import { ReadmeOutcome, writeBacklogReadme } from '../storage/readmeFile';
import { activeBacklogView } from '../view/registry';

/** A view that has its first result set — the only kind a README may be generated from. */
interface LoadedBacklogView {
	settings: BacklogSettings;
	model: BacklogModel;
}

/**
 * The command's id, beside the flow it runs — persisted in the user's hotkeys, so it
 * is a named value rather than a literal at the registration site.
 */
export const WRITE_README_COMMAND_ID = 'write-backlog-readme';

/** What the user is told, per outcome. The two that wrote nothing say so plainly. */
function outcomeNotice(outcome: ReadmeOutcome, path: string): string {
	switch (outcome) {
		case 'created':
			return `Wrote "${path}".`;
		case 'updated':
			return `Updated "${path}".`;
		case 'unchanged':
			return `"${path}" already matches this view. Nothing was written.`;
		case 'foreign':
			return `"${path}" was not written by this plugin, so it was left alone. Move it aside to generate one.`;
	}
}

/**
 * Generate the README for one view and write it.
 *
 * The configuration gate is the same one every write path passes: a document
 * generated from a contradictory configuration would state a collided key as though it
 * were the one answer for both roles, which is worse than no document at all.
 */
async function writeReadmeForView(app: App, view: LoadedBacklogView): Promise<void> {
	const problems = configProblems(view.settings);
	if (problems.length > 0) {
		new Notice(`Fix the view configuration first: ${problems.join('; ')}.`);
		return;
	}
	const content = backlogReadmeContent(view.settings, view.model.observedStates);
	try {
		const { outcome, path } = await writeBacklogReadme(app, view.settings.homeFolder, content);
		new Notice(outcomeNotice(outcome, path));
	} catch (e) {
		console.error('Product Backlog: failed to write the backlog readme', e);
		new Notice('Could not write the readme. See the developer console for details.');
	}
}

/**
 * The command body, in `checkCallback` shape: it offers itself only while a Product
 * Backlog view is active, because the document is generated from that view's
 * configuration and one generated from the defaults would describe a backlog nobody
 * has — the keys being wrong is worse than the command being absent.
 */
export function writeBacklogReadmeCommand(app: App, checking: boolean): boolean {
	const view = activeBacklogView(app);
	// A view still waiting for its first result set has no observed states, which is
	// not the same as having none: generating from it would replace a good README with
	// one whose whole state vocabulary is missing. "Not loaded" is not an answer, so
	// the command withholds itself for the moment it takes to become one.
	if (view === null || view.model === null) return false;
	if (!checking) void writeReadmeForView(app, { settings: view.settings, model: view.model });
	return true;
}
