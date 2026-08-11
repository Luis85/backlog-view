import { Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { paletteSlot, stateColorPaint, statePalettes } from '../../domain/board';
import { colorableStates, stateColorKey } from '../../domain/stateColors';
import { byName } from '../../domain/typeVocabulary';
import { openStateColorsDialog, StateColorRow } from '../../ui/stateColorsDialog';

/**
 * Choosing a colour per workflow state, and writing the choice to the `.base`.
 *
 * It is a dialog rather than a view option because Bases has no colour control — its
 * schema is dropdown, file, folder, formula, multitext, property, slider, text and toggle
 * — so the only way to offer a picker at all is one of the plugin's own. That is also why
 * nothing declares `stateColor.*` in `getViewOptions`, and why the manual's setup section
 * explains this dialog rather than claiming an option key.
 *
 * What it writes is the `.base` and nothing else: no note, no frontmatter. So it needs
 * neither the write gate nor the `configProblems` check that gates every note write —
 * unlike `runInit`, which runs that gate precisely because its second half does write
 * notes. Each `config.set` brings the view back with the new colour, which is what makes
 * the grid behind the dialog a live preview.
 */

/** The colour a swatch opens on where the class's own resolves to nothing, as under jsdom. */
const FALLBACK_SEED = '#808080';

/**
 * The colour a class actually paints, resolved from the live stylesheet.
 *
 * Read rather than tabulated, and that is the whole reason a swatch can open honestly: the
 * slots and the named colours all resolve through `--color-*-rgb`, so what any of them
 * paints depends on the theme and on light versus dark. A table here would be this
 * plugin's guess at the user's theme, which is exactly the colour question no code in this
 * repository is allowed to answer.
 */
function paintedColor(cls: string): string {
	// `pbl-color-probe` carries the two static rules (`styles/stateColorsDialog.css`):
	// never painted, and painted FROM the state token, which is the value being read back.
	const probe = document.body.createDiv({ cls: `pbl-color-probe ${cls}` });
	const painted = getComputedStyle(probe).backgroundColor;
	probe.remove();
	return hexOf(painted) ?? FALLBACK_SEED;
}

/**
 * `rgb(r, g, b)` — what a computed `background-color` is — as the hex a picker takes.
 *
 * Exported for its own test, which is the one part of the seeding path jsdom can reach:
 * `paintedColor` above it resolves nothing under test (no stylesheet is loaded), so
 * without this the arithmetic that turns a painted colour into a swatch would be checked
 * by nothing at all. A channel losing its leading zero is the failure it exists to catch.
 */
export function hexOf(computed: string): string | null {
	const parts = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(computed);
	if (!parts) return null;
	return `#${parts.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * One row per state a colour can be chosen for, in vocabulary order.
 *
 * The LIST is `colorableStates` — the declared vocabularies, deduped — because those are
 * the only states a choice survives a refresh for (see that function). The PAINT is
 * `stateColorPaint`, the very function the bar and the legend ask, so an unchosen row opens
 * on the colour that state is actually drawn in and a chosen one opens on the choice.
 *
 * A state no palette can place is skipped rather than seeded grey. With a declared
 * vocabulary the palettes ARE that vocabulary, so this only bites where a workflow declares
 * states and has no property to write them to — where a colour would decorate nothing.
 */
function stateColorRows(host: BacklogViewHost): StateColorRow[] {
	const model = host.model;
	if (!model) return [];
	const palettes = statePalettes(model, host.settings);
	const rows: StateColorRow[] = [];
	for (const state of colorableStates(host.settings.states, host.settings.deliverableStates)) {
		// The palette that PLACES this state, kept rather than mapped over: the row needs
		// its slot as well as its paint, and the slot is what the reset restores to.
		//
		// The FIRST one that does, and where two workflows both carry a state that is a
		// documented imprecision rather than a choice worth agonising over. Slots continue
		// across palettes, so `Active` can be slot 1 in Work and slot 3 in Deliverables — one
		// value, two default colours. The stored colour is right either way (the key is the
		// VALUE and both workflows read it), so what is approximate is only what the swatch
		// OPENS on and what the reset puts back: the requirements workflow's, which is the
		// one the legend keys first. A row per workflow would be two controls over one key —
		// the thing this design refuses — and one swatch cannot show two colours. Stated in
		// `docs/requirements/A colour per state.md` rather than left to be discovered.
		const palette = palettes.find((candidate) => paletteSlot(candidate, state) !== null);
		const paint = palette && stateColorPaint(host.settings, palette, state);
		if (!palette || !paint) continue;
		// The colour with NO choice applied — a state chosen by NAME wears that name's class,
		// so probing the paint's own class would answer the choice rather than the default.
		const slotCls = `pbl-state-${paletteSlot(palette, state)}`;
		const defaultValue = paintedColor(slotCls);
		rows.push({
			state,
			value: paint.color ?? (paint.cls === slotCls ? defaultValue : paintedColor(paint.cls)),
			defaultValue,
			isSet: byName(host.settings.stateColors, state) !== undefined,
		});
	}
	return rows;
}

/**
 * Whether this view can offer the picker at all — the gate its button renders under.
 *
 * It asks the same two questions `stateColorRows` does and STOPS THERE: a declared state,
 * and a palette that can place it. It must not build the rows, because building one probes
 * the live stylesheet (`paintedColor`), and this runs on every toolbar render — a
 * `getComputedStyle` per state per pass, to answer a question that needs none. That is not
 * a micro-optimisation: it timed the 400-row render-cost test out at eight seconds.
 */
export function hasColorableStates(host: BacklogViewHost): boolean {
	if (!host.model) return false;
	const palettes = statePalettes(host.model, host.settings);
	return colorableStates(host.settings.states, host.settings.deliverableStates).some((state) =>
		palettes.some((palette) => paletteSlot(palette, state) !== null),
	);
}

/**
 * Open the picker for this view's workflow states, and write each choice as it is made.
 *
 * With nothing to colour it says so rather than opening an empty dialog. The button is
 * gated on the same question, so this is only reachable when the two disagree — and the
 * notice names the configuration that produces it: a state property with no DECLARED
 * states, where the vocabulary is whatever the notes happen to carry and a choice could
 * not be stored against it.
 */
export function openStateColors(host: BacklogViewHost, onClosed?: () => void): void {
	const rows = stateColorRows(host);
	if (rows.length === 0) {
		new Notice('No workflow states to colour yet. Name a state property and list its states in the view options.');
		return;
	}
	openStateColorsDialog(host.app, rows, (state, color) => host.config.set(stateColorKey(state), color), onClosed);
}
