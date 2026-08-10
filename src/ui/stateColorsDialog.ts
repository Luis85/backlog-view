import { App, ColorComponent, Modal, Setting } from 'obsidian';

/**
 * One row: a state, the colour to open its swatch on, the colour the reset restores, and
 * whether there is a choice to reset at all.
 *
 * Three fields rather than two, and each earns its place — a `<input type="color">` always
 * holds a colour, so none of these can be inferred from the control:
 *
 * - `value` is what the swatch OPENS on: the chosen colour if there is one, else what the
 *   state is drawn in anyway, so the dialog never opens on black.
 * - `defaultValue` is what the state would be drawn in with NO choice. It is a separate
 *   field precisely because it differs from `value` exactly when a choice exists, which is
 *   the only time the reset does anything: resetting to `value` would clear the setting
 *   while leaving the old colour in the swatch, and — because the input's value never
 *   changed — would then swallow the `change` event if the user immediately re-picked it.
 * - `isSet` says whether there is a choice, which is what makes the reset a real control
 *   rather than one that is sometimes inert.
 */
export interface StateColorRow {
	state: string;
	value: string;
	defaultValue: string;
	isSet: boolean;
}

/**
 * The state-colour dialog. It knows what a state is called and nothing else: no vault, no
 * settings, no palette, no idea where the colours it hands back are stored — which is what
 * keeps it in `ui/` beside the other dialogs that know about none of the layers.
 *
 * It reports each change AS IT HAPPENS rather than collecting a set to save. That is what
 * makes the grid behind it a live preview, and it is also why there is no Save button to
 * mean "these are all my colours": a row nobody touched must write nothing, and a dialog
 * that submitted its whole row set would turn every seeded swatch into a choice.
 */
class StateColorsDialog extends Modal {
	private readonly rows: StateColorRow[];
	private readonly onChange: (state: string, color: string | null) => void;

	constructor(app: App, rows: StateColorRow[], onChange: (state: string, color: string | null) => void) {
		super(app);
		this.rows = rows;
		this.onChange = onChange;
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText('State colours');
		contentEl.empty();
		contentEl.addClass('pbl-state-colors');
		contentEl.createEl('p', {
			cls: 'pbl-state-colors-intro',
			text:
				'The colour each workflow state is drawn in on the roadmap’s dated axis, and in ' +
				'its legend. A chosen colour is fixed: unlike the default, it does not follow the ' +
				'theme between light and dark. A finished state stays green whatever is chosen here.',
		});
		for (const row of this.rows) this.renderRow(row);
	}

	private renderRow(row: StateColorRow): void {
		const setting = new Setting(this.contentEl).setName(row.state);
		let picker: ColorComponent | null = null;
		setting.addColorPicker((component) => {
			picker = component;
			component.setValue(row.value).onChange((value) => this.onChange(row.state, value));
		});
		// The way BACK to the default, and it has to be its own control: a colour input has
		// no empty state, so without this a state could be changed but never un-chosen, and
		// "by position" would be unreachable once anything was picked.
		setting.addExtraButton((btn) => {
			btn.setIcon('rotate-ccw')
				.setTooltip('Use the default colour')
				// A reset with nothing to reset is a control that lies about being available.
				.setDisabled(!row.isSet)
				.onClick(() => {
					if (!row.isSet) return;
					// The swatch first, the clear second: `setValue` is not documented to leave
					// `onChange` alone, and if it fires one it would report the default as a
					// choice. Doing it in this order means the null below wins either way.
					picker?.setValue(row.defaultValue);
					this.onChange(row.state, null);
				});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export function openStateColorsDialog(
	app: App,
	rows: StateColorRow[],
	onChange: (state: string, color: string | null) => void,
): void {
	new StateColorsDialog(app, rows, onChange).open();
}
