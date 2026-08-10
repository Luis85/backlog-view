import { App, BasesViewConfig, Notice } from 'obsidian';
import { BacklogModel } from '../../domain/model';
import { BacklogSettings } from '../../domain/settings';
import { paletteDone, paletteSlot, statePalettes } from '../../domain/board';
import { stateColorKey } from '../../domain/stateColors';
import { byName } from '../../domain/typeVocabulary';
import { ColorRow, openColorPicker } from '../../ui/colorPickerDialog';

/**
 * Choosing a colour per workflow state, and writing the choice to the `.base`.
 *
 * It lives here rather than in the view options because Bases has no colour control —
 * its schema is dropdown, file, folder, formula, multitext, property, slider, text and
 * toggle — so the only way to offer a picker at all is the plugin's own dialog. That is
 * also why nothing declares `stateColor.*` in `getViewOptions` any more, and why the
 * manual's setup section explains this dialog rather than claiming an option key.
 *
 * What it writes is the `.base` and nothing else: no note, no frontmatter. So it needs
 * neither the write gate nor the `configProblems` check that gates every note write —
 * unlike `runInit`, which runs that gate precisely because its second half does write
 * notes. A `config.set` is enough to bring the view back with the new colours, the same
 * way the completed-items toggle relies on it.
 */

/**
 * Exactly what the picker needs, and no more: the `⋯` entry holds a `BacklogViewHost` and
 * the palette command holds a `LiveBacklogView`, and both satisfy this. Naming the four
 * members rather than taking either type is what lets ONE function serve both inputs —
 * the rule this view keeps for every move, applied to an action instead of a write.
 */
export interface StateColorTarget {
	readonly app: App;
	readonly config: BasesViewConfig;
	readonly settings: BacklogSettings;
	readonly model: BacklogModel | null;
}

/** The colour a swatch opens on when nothing is picked: what the bar is drawing already. */
const FALLBACK_SEED = '#808080';

/**
 * The colour a slot class actually paints, resolved from the live stylesheet.
 *
 * Read rather than tabulated, and that is the whole reason this can seed honestly: the
 * slots resolve through `--color-*-rgb`, so what slot 0 paints depends on the theme and
 * on light versus dark. A table here would be this plugin's guess at the user's theme,
 * which is exactly the colour question no code in this repository is allowed to answer.
 *
 * Returns the fallback where nothing resolves — jsdom loads no stylesheet, so that is the
 * answer under test, and a vault with a theme that somehow defines no such token gets a
 * neutral swatch rather than black.
 */
function slotColor(slot: number): string {
	// `pbl-color-probe` carries the two static rules (`styles/colorPicker.css`): never
	// painted, and painted FROM the slot token, which is the value being read back.
	const probe = document.body.createDiv({ cls: `pbl-color-probe pbl-state-${slot}` });
	const painted = getComputedStyle(probe).backgroundColor;
	probe.remove();
	return hexOf(painted) ?? FALLBACK_SEED;
}

/**
 * `rgb(r, g, b)` — what a computed `background-color` is — as the hex a picker takes.
 *
 * Exported for its own test, which is the one part of the seeding path jsdom can reach:
 * `slotColor` above it resolves nothing under test (no stylesheet is loaded), so without
 * this the arithmetic that turns a painted colour into a swatch would be checked by
 * nothing at all. A channel losing its leading zero is the failure it exists to catch.
 */
export function hexOf(computed: string): string | null {
	const parts = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(computed);
	if (!parts) return null;
	return `#${parts.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * One row per state a colour can actually reach, in the order the legend keys them.
 *
 * Built from `statePalettes` rather than from the settings lists, so the dialog offers
 * exactly the states something on screen can draw — the same source the bars and the
 * legend read, which is what stops the picker from offering a state no bar could show the
 * result on.
 *
 * Two states are deliberately absent. A value some OTHER workflow already listed, because
 * the colours are one table keyed by the state VALUE and a second row would be two
 * controls over one key. And a DONE state, because its bar is green by specificity
 * whatever is picked — a row that provably changes nothing is worse than no row, and the
 * intro says so rather than leaving it to be discovered.
 */
function stateColorRows(host: StateColorTarget): ColorRow[] {
	const rows: ColorRow[] = [];
	const seen = new Set<string>();
	// No model, no vocabulary: the palettes are derived from one, and a view whose first
	// result set has not arrived has nothing to colour rather than everything.
	if (!host.model) return rows;
	for (const palette of statePalettes(host.model, host.settings)) {
		for (const state of palette.values) {
			const key = state.toLowerCase();
			if (seen.has(key) || paletteDone(palette, state)) continue;
			seen.add(key);
			const slot = paletteSlot(palette, state);
			rows.push({
				key: stateColorKey(state),
				label: state,
				value: byName(host.settings.stateColors, state) ?? null,
				seed: slot === null ? FALLBACK_SEED : slotColor(slot),
			});
		}
	}
	return rows;
}

/**
 * Open the picker for this view's workflow states, and write what comes back.
 *
 * With nothing to colour it says so rather than opening an empty dialog: `statePalettes`
 * returns no palette until a workflow has a property, and a state list that is all done
 * values leaves every row filtered out — two different reasons for the same empty screen,
 * and the notice names the one thing that fixes both.
 */
export function openStateColors(host: StateColorTarget, onClosed?: () => void): void {
	const rows = stateColorRows(host);
	if (rows.length === 0) {
		new Notice('No workflow states to colour yet. Name a state property and its states in the view options.');
		return;
	}
	openColorPicker(host.app, {
		title: 'State colours',
		intro:
			'A colour per workflow state, drawn on the roadmap’s dated axis and in its legend. ' +
			'Finished states are not listed: a done bar is green whatever is picked. A picked ' +
			'colour is fixed — unlike the default, it does not follow the theme between light and dark.',
		rows,
		onSave: (changed) => {
			for (const [key, value] of changed) host.config.set(key, value);
		},
		onClosed,
	});
}
