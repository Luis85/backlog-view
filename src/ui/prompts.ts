import { App, ButtonComponent, Modal, Setting, TFolder } from 'obsidian';
import { ValueSuggest } from './valueSuggest';

/**
 * Enter submits the prompt, and the field can claim focus once the modal is on
 * screen — the shape every text field in these prompts wants. The Enter that
 * confirms an IME composition is not a submit: taking it would close the prompt
 * on the half-finished reading instead of the word being composed.
 */
function submitOnEnter(inputEl: HTMLInputElement, submit: () => void, autofocus = false): void {
	inputEl.addEventListener('keydown', (evt) => {
		if (evt.key === 'Enter' && !evt.isComposing) {
			evt.preventDefault();
			submit();
		}
	});
	if (autofocus) window.setTimeout(() => inputEl.focus(), 0);
}

/**
 * What every prompt in this file is: options handed in at construction, a footer holding
 * one call-to-action button, and a content element emptied on the way out.
 *
 * It exists because those three were written four times and `npm run analyze` could see
 * the repetition — not as a place to put anything a prompt might one day want. The rule
 * for adding to it is that all four already do the thing, identically; anything true of
 * three stays in the three.
 *
 * `cta` RETURNS the button rather than only mounting it, because one caller disables it
 * until the title field has something in it. Mounting it is still the point: the footer
 * is the last thing appended to `contentEl`, and a caller that built its own would be
 * free to get that order wrong.
 */
abstract class PromptModal<O> extends Modal {
	protected readonly options: O;

	constructor(app: App, options: O) {
		super(app);
		this.options = options;
	}

	protected cta(label: string, submit: () => void): ButtonComponent {
		let button!: ButtonComponent;
		new Setting(this.contentEl).addButton((btn) => {
			button = btn;
			btn.setButtonText(label).setCta().onClick(submit);
		});
		return button;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** What a refusable prompt needs of its options, whatever else it also asks for. */
interface Refusable<T> {
	description: string;
	/**
	 * Refuse the entry with a reason, keeping the prompt open and the values in place.
	 * Null accepts. What a value MEANS belongs to the layer that reads them, so these
	 * dialogs ask rather than decide — which is what keeps `ui/` free of the domain.
	 */
	validate: (value: T) => string | null;
	onSubmit: (value: T) => void;
}

/**
 * The description line, the error element rendered up front, and a submit that asks
 * `validate` before it closes — what the two prompts that REFUSE an entry do identically.
 *
 * A free function rather than another member of `PromptModal`: that base is what ALL the
 * prompts in this file do, and its own rule is that anything true of only some of them
 * stays out. Two of five collect an entry that can be wrong; the other three cannot be.
 * The error element comes back so the field renderers can clear it — a refusal was about
 * what was entered, so it stops being true the moment the entry changes.
 */
function refusableBody<T>(
	modal: Modal,
	options: Refusable<T>,
	read: () => T,
): { errorEl: HTMLElement; submit: () => void } {
	modal.contentEl.createDiv({ cls: 'pbl-modal-detail', text: options.description });
	// Rendered up front and filled on refusal: a message that appears only when the
	// dialog grows one is a dialog that resizes under the pointer as you submit.
	const errorEl = modal.contentEl.createDiv({ cls: 'pbl-modal-error', attr: { role: 'alert' } });
	const submit = () => {
		const value = read();
		const problem = options.validate(value);
		if (problem !== null) {
			errorEl.setText(problem);
			return;
		}
		modal.close();
		options.onSubmit(value);
	};
	return { errorEl, submit };
}

export interface NewItemPromptResult {
	title: string;
	/** Only present when the prompt asked for a folder. */
	folder?: string;
	/** The chosen type; the only offered one when there was no choice to make. */
	typeName: string;
}

export interface NewItemPromptOptions {
	heading: string;
	/**
	 * Context line under the heading: where the new item will land. A function of the
	 * chosen type, because the folder can depend on it — a Bug and a PBI created from
	 * the same row may be filed in different places, and a line that said otherwise
	 * would be telling the user something untrue at the moment they confirm.
	 */
	detail?: (typeName: string) => string;
	/**
	 * Types this row may hold, most expected first. One entry asks nothing and creates
	 * that type; more than one adds a picker, because which of them is wanted is a
	 * question only the user can answer.
	 */
	types: string[];
	/** Ask where to create the item because no folder is configured or inferable. */
	askFolder?: boolean;
	/**
	 * An optional point-of-need door into the manual, drawn under the detail line. This
	 * file is a `ui/` leaf and knows nothing of the manual's content, so the caller
	 * builds the whole affordance and hands over only where to mount it.
	 */
	help?: (parent: HTMLElement) => void;
	onSubmit: (result: NewItemPromptResult) => void;
}

/** Folder autocomplete for the folder field of the prompt. Exported for tests. */
export class FolderSuggest extends ValueSuggest<TFolder> {
	protected getSuggestions(query: string): TFolder[] {
		const needle = query.toLowerCase();
		const folders: TFolder[] = [];
		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder && file.path !== '/' && file.path.toLowerCase().includes(needle)) {
				folders.push(file);
			}
		}
		folders.sort((a, b) => a.path.localeCompare(b.path));
		return folders.slice(0, 50);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	protected valueOf(folder: TFolder): string {
		return folder.path;
	}
}

/**
 * Autocomplete over the values already in use, so spellings do not drift. Exported for
 * tests.
 *
 * `sigil` is what the vocabulary WEARS and never what it stores — the tags are the one
 * such vocabulary today, written without their `#` and read with it — so it is stripped
 * off the query before matching and put back only when a row is drawn. A suggest with
 * no sigil matches and renders the value as it is.
 */
export class KnownValueSuggest extends ValueSuggest<string> {
	private readonly known: string[];
	private readonly sigil: string;

	constructor(app: App, textInputEl: HTMLInputElement, known: string[], sigil = '') {
		super(app, textInputEl);
		this.known = known;
		this.sigil = sigil;
	}

	protected getSuggestions(query: string): string[] {
		let needle = query.trim();
		while (this.sigil && needle.startsWith(this.sigil)) needle = needle.slice(this.sigil.length);
		const lowered = needle.toLowerCase();
		return this.known.filter((value) => value.toLowerCase().includes(lowered)).slice(0, 50);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(this.sigil + value);
	}

	protected valueOf(value: string): string {
		return value;
	}
}

export interface ValuePromptOptions {
	/** The modal's own heading, and the field label under it. */
	title: string;
	fieldName: string;
	placeholder: string;
	ctaLabel: string;
	/** What the vocabulary wears rather than stores — `#` for tags, nothing otherwise. */
	sigil?: string;
	/** Values offered as suggestions — for tags, the ones this item does not already carry. */
	known: string[];
	onSubmit: (value: string) => void;
}

/**
 * Prompt asking for a single value from a vocabulary that is not fixed: the known ones
 * are suggested, and anything typed is accepted. Two callers — a tag to add, and who an
 * item is assigned to — because both ask the same question of a list this plugin does
 * not own.
 */
export class ValuePromptModal extends PromptModal<ValuePromptOptions> {
	onOpen(): void {
		this.titleEl.setText(this.options.title);
		let value = '';
		const submit = () => {
			if (value.trim().length === 0) return;
			this.close();
			this.options.onSubmit(value);
		};

		new Setting(this.contentEl).setName(this.options.fieldName).addText((text) => {
			text.setPlaceholder(this.options.placeholder);
			text.onChange((v) => (value = v));
			new KnownValueSuggest(this.app, text.inputEl, this.options.known, this.options.sigil);
			submitOnEnter(text.inputEl, submit, true);
		});

		this.cta(this.options.ctaLabel, submit);
	}
}

export interface FolderPromptOptions {
	heading: string;
	description: string;
	ctaLabel: string;
	defaultFolder: string;
	onSubmit: (folder: string) => void;
}

/** Prompt asking for a single folder, prefilled and with autocomplete. */
export class FolderPromptModal extends PromptModal<FolderPromptOptions> {
	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		let folder = this.options.defaultFolder;
		const submit = () => {
			this.close();
			this.options.onSubmit(folder.trim().replace(/^\/+|\/+$/g, ''));
		};

		new Setting(this.contentEl)
			.setName('Folder')
			.setDesc(this.options.description)
			.addText((text) => {
				text.setValue(this.options.defaultFolder);
				text.onChange((v) => (folder = v));
				new FolderSuggest(this.app, text.inputEl);
				submitOnEnter(text.inputEl, submit, true);
			});

		this.cta(this.options.ctaLabel, submit);
	}
}

/** One dated field of the schedule prompt: what to call it, and what the note states now. */
export interface DateFieldSpec {
	/** Identifies the field in the submitted values; the caller's own vocabulary. */
	field: string;
	name: string;
	/**
	 * Prefill — the date the note itself states as `YYYY-MM-DD`, or '' when it states
	 * none. The field is a native date input, which accepts that spelling and nothing
	 * else: anything a reader could not turn into a calendar date arrives here as ''
	 * and is simply not prefilled.
	 */
	value: string;
}

export interface SchedulePromptOptions extends Refusable<Record<string, string>> {
	heading: string;
	/** Only the ends the configured axis has: a field with no property is never asked for. */
	fields: DateFieldSpec[];
}

/**
 * Prompt asking for an item's planned dates, prefilled with what the note states.
 * An emptied field means the date goes: absence is a real answer here, so clearing
 * one is how a single end is taken back without unscheduling the whole item — which
 * is why each field carries its own clear button. A native date input can be emptied
 * from the keyboard, segment by segment, and a gesture that fiddly is one nobody
 * finds; the button keeps "leave a field empty" a thing a user can actually do.
 *
 * The fields are `type="date"`, so the platform's own date picker and its locale
 * formatting apply, and the only values this dialog can hand back are a calendar
 * date or nothing at all.
 */
export class SchedulePromptModal extends PromptModal<SchedulePromptOptions> {
	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		const values: Record<string, string> = {};
		for (const spec of this.options.fields) values[spec.field] = spec.value;

		const { errorEl, submit } = refusableBody(this, this.options, () => {
			const trimmed: Record<string, string> = {};
			for (const [field, value] of Object.entries(values)) trimmed[field] = value.trim();
			return trimmed;
		});

		this.options.fields.forEach((spec, i) => {
			const setting = new Setting(this.contentEl).setName(spec.name);
			setting.addText((text) => {
				// A date input round-trips `YYYY-MM-DD` and refuses everything else, so the
				// value read back is either a calendar date or ''. The picker, the segment
				// order and the display format are the platform's.
				const input = text.inputEl;
				input.type = 'date';
				text.setValue(spec.value);
				text.onChange((v) => {
					values[spec.field] = v;
					// The refusal was about what was entered, so it stops being true the
					// moment the entry changes.
					errorEl.setText('');
				});
				submitOnEnter(input, submit, i === 0);
				// Wired here, where the field it empties is in hand: carried out to a
				// later statement it would need a null check that can never fire.
				setting.addExtraButton((btn) => {
					btn.setIcon('x')
						.setTooltip(`Clear ${spec.name}`)
						.onClick(() => {
							input.value = '';
							values[spec.field] = '';
							errorEl.setText('');
						});
				});
			});
		});

		this.cta('Save', submit);
	}
}

/** The four facts an absence is: who is away, what to call it, and both ends of the range. */
export interface AbsenceResult {
	resource: string;
	title: string;
	start: string;
	target: string;
}

export interface AbsencePromptOptions extends Refusable<AbsenceResult> {
	heading: string;
	/** Pre-filled from the row it was opened on, and editable — the row is a default, not a lock. */
	resource: string;
	/** Names to suggest, so spellings stay consistent with the roster the view options name. */
	known: string[];
}

/**
 * Prompt asking for one resource's unavailable stretch.
 *
 * Both ends, always — this is the one form in this file where an empty date is not a real
 * answer, because an absence has nothing beneath it to infer the other end from and no
 * shelf to wait on. So there is no per-field clear button either: `SchedulePromptModal`
 * carries one because clearing an end is how a single date is taken back, and here that
 * would offer a gesture whose result the validator must then refuse.
 *
 * The date fields are `type="date"` for that same modal's reason: the platform's picker,
 * and the only values that can come back are a calendar date or nothing.
 */
export class AbsencePromptModal extends PromptModal<AbsencePromptOptions> {
	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		const values: AbsenceResult = { resource: this.options.resource, title: '', start: '', target: '' };

		const { errorEl, submit } = refusableBody(this, this.options, () => ({
			resource: values.resource.trim(),
			title: values.title.trim(),
			start: values.start.trim(),
			target: values.target.trim(),
		}));
		const field = (name: string, key: keyof AbsenceResult, setup: (input: HTMLInputElement) => void) => {
			new Setting(this.contentEl).setName(name).addText((text) => {
				text.setValue(values[key]);
				text.onChange((v) => {
					values[key] = v;
					// The refusal was about what was entered, so it stops being true the
					// moment the entry changes.
					errorEl.setText('');
				});
				setup(text.inputEl);
				submitOnEnter(text.inputEl, submit, key === 'title');
			});
		};

		field('Resource', 'resource', (input) => new KnownValueSuggest(this.app, input, this.options.known));
		// Autofocused rather than the resource, which the row above already answered.
		field('Title', 'title', (input) => (input.placeholder = 'Away'));
		field('Start', 'start', (input) => (input.type = 'date'));
		field('End', 'target', (input) => (input.type = 'date'));

		this.cta('Save', submit);
	}
}

/** Prompt asking for the title (and, when needed, target folder) of a new backlog item. */
export class TitlePromptModal extends PromptModal<NewItemPromptOptions> {
	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		let title = '';
		let folder = '';
		let createBtn: ButtonComponent | null = null;
		let typeName = this.options.types[0];

		const detailEl = this.options.detail ? this.contentEl.createDiv({ cls: 'pbl-modal-detail' }) : null;
		const syncDetail = () => detailEl?.setText(this.options.detail?.(typeName) ?? '');
		syncDetail();
		this.options.help?.(this.contentEl);

		const submit = () => {
			const trimmed = title.trim();
			if (!trimmed) return;
			this.close();
			this.options.onSubmit({
				title: trimmed,
				folder: this.options.askFolder ? folder.trim().replace(/^\/+|\/+$/g, '') : undefined,
				typeName,
			});
		};

		// Asked first: the type decides what the item IS, and it is the one field with a
		// default worth reviewing. A single choice is not a question — it stays out.
		if (this.options.types.length > 1) {
			new Setting(this.contentEl).setName('Type').addDropdown((drop) => {
				for (const type of this.options.types) drop.addOption(type, type);
				drop.setValue(typeName);
				drop.onChange((v) => {
					typeName = v;
					// The landing spot follows the type, so the line saying where it lands
					// has to follow it too.
					syncDetail();
				});
			});
		}

		new Setting(this.contentEl).setName('Title').addText((text) => {
			text.setPlaceholder('Item title');
			text.onChange((v) => {
				title = v;
				createBtn?.setDisabled(title.trim().length === 0);
			});
			submitOnEnter(text.inputEl, submit, true);
		});

		if (this.options.askFolder) {
			new Setting(this.contentEl)
				.setName('Folder')
				.setDesc(
					"New items are created here, and the choice is saved to the view options. Point this base's filter at the same folder so items show up. Leave empty for the vault root.",
				)
				.addText((text) => {
					text.setPlaceholder('Backlog');
					text.onChange((v) => (folder = v));
					new FolderSuggest(this.app, text.inputEl);
					submitOnEnter(text.inputEl, submit);
				});
		}

		createBtn = this.cta('Create', submit).setDisabled(true);
	}
}
