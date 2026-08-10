import { App, ColorComponent, Modal, Setting } from 'obsidian';

/**
 * One row: a state, the colour to open its swatch on, and whether that colour is a CHOICE
 * or merely what the state is currently drawn in.
 *
 * The two are separate because only one of them is a decision. `isSet` false means nobody
 * has chosen — the row is on its default, and the reset beside it has nothing to do —
 * while `value` is shown either way, so the picker opens on the colour the bar already
 * wears rather than on black. Collapsing them would make every unopened row look chosen.
 */
export interface StateColorRow {
	state: string;
	value: string;
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
				.onClick(() => {
					// The swatch first, the clear second: `setValue` is not documented to leave
					// `onChange` alone, and if it fires one it would report the seed as a
					// choice. Doing it in this order means the null below wins either way.
					picker?.setValue(row.value);
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
