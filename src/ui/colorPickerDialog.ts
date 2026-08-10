import { App, ColorComponent, Modal, Setting } from 'obsidian';

/**
 * One row of the picker: a label, the colour it currently holds, and the colour to open
 * the swatch on when it holds none.
 *
 * `value` and `seed` are separate because they answer different questions and only one of
 * them is a decision. `value` null means NOBODY has picked — the row is on its default and
 * saving it unchanged must write nothing — while `seed` is what the swatch shows anyway,
 * so the picker opens on the colour the thing is already drawn in rather than on black.
 * Collapsing them would make every unopened row look picked, and a Save would then write a
 * colour for every label in the dialog.
 */
export interface ColorRow {
	key: string;
	label: string;
	value: string | null;
	seed: string;
}

/** What the dialog is asked to show, and what it hands back. */
export interface ColorPickerSpec {
	title: string;
	intro: string;
	rows: ColorRow[];
	/** Only the rows the user touched — see the class below. */
	onSave: (changed: Map<string, string | null>) => void;
	/** Called after the dialog closes, so the caller can put focus back. */
	onClosed?: () => void;
}

/**
 * A dialog for choosing a colour per label — nothing in it knows what the labels ARE.
 * It reads no vault, resolves no theme and decides no default: the caller hands it rows
 * and takes back the ones that changed, which is what keeps it in `ui/` beside the other
 * dialogs that know about none of the layers.
 *
 * It reports a DELTA, not the whole set: `onSave` receives only the rows the user actually
 * touched, so a dialog opened and saved without edits writes nothing at all. The reason is
 * the caller's, and it is the same one the tag editor has — a full set would turn every
 * seeded row into a pick, and there is no way to tell that apart afterwards.
 */
class ColorPickerDialog extends Modal {
	private readonly spec: ColorPickerSpec;
	/** Only what the user changed — see the class doc: an untouched row is not a pick. */
	private readonly changed = new Map<string, string | null>();

	constructor(app: App, spec: ColorPickerSpec) {
		super(app);
		this.spec = spec;
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(this.spec.title);
		contentEl.empty();
		contentEl.addClass('pbl-color-picker');
		contentEl.createEl('p', { cls: 'pbl-color-intro', text: this.spec.intro });
		for (const row of this.spec.rows) this.renderRow(row);
		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText('Save')
				.setCta()
				.onClick(() => {
					// Captured before `close()`, which empties `contentEl` and disposes every
					// component in it — reading the pickers after that reads nothing.
					const changed = new Map(this.changed);
					this.close();
					if (changed.size > 0) this.spec.onSave(changed);
				});
		});
	}

	private renderRow(row: ColorRow): void {
		const setting = new Setting(this.contentEl).setName(row.label);
		let picker: ColorComponent | null = null;
		setting.addColorPicker((component) => {
			picker = component;
			component.setValue(row.value ?? row.seed).onChange((value) => this.changed.set(row.key, value));
		});
		// The way BACK to no pick, and it has to be its own control: a colour picker has no
		// empty state, so without this a row could be changed but never un-set, and the
		// positional default would be unreachable once anything was chosen.
		setting.addExtraButton((btn) => {
			btn.setIcon('rotate-ccw')
				.setTooltip('Use the default colour')
				.onClick(() => {
					// The swatch goes back to what the default DRAWS, so the row stops showing
					// a colour that is no longer in force — through the component rather than
					// by finding its input, which is what the component is for.
					//
					// The ORDER matters and is the cheap way to not depend on an answer this
					// repository cannot check: `setValue` is not documented to leave `onChange`
					// alone, and if it does fire one, it would record the seed as a pick. Doing
					// it first means the null below wins either way.
					picker?.setValue(row.seed);
					this.changed.set(row.key, null);
				});
		});
	}

	onClose(): void {
		this.contentEl.empty();
		// The caller's way to put focus back where the dialog took it from. Without one,
		// closing leaves focus nowhere: the control that opened this is a menu item that no
		// longer exists — the same hole `⋯ → Open the manual` records.
		this.spec.onClosed?.();
	}
}

export function openColorPicker(app: App, spec: ColorPickerSpec): void {
	new ColorPickerDialog(app, spec).open();
}
