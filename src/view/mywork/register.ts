import { Plugin } from 'obsidian';
import { getMyWorkViewOptions } from '../../domain/myWorkOptions';
import { MY_WORK_VIEW_TYPE, MyWorkView } from './myWorkView';
import { WriteLock } from '../writeLock';
import { t } from '../../i18n/t';

/**
 * The my-work view's own registration — one file per view, so a fourth capability adds a
 * file rather than a branch in main (ADR 0030). The lock arrives from main because the
 * write path is the one piece of plugin-wide runtime state: a state set here is in the
 * same undo slot as a state set on the board.
 */
export function registerMyWorkView(plugin: Plugin, lock: WriteLock): void {
	plugin.registerBasesView(MY_WORK_VIEW_TYPE, {
		// An ordinary view-type label, so it is translated — only the plugin's own identity
		// in `registerBacklogView.ts` gets the eslint-disable.
		name: t('mywork.viewName'),
		icon: 'lucide-user-round-check',
		factory: (controller, containerEl) => new MyWorkView(controller, containerEl, lock),
		options: getMyWorkViewOptions,
	});
}
