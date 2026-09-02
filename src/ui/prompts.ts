import { App, ButtonComponent, Modal, Setting, TFolder } from 'obsidian';
import { compareText, foldForMatch, t } from '../i18n/t';
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
 * A per-modal counter rather than a shared element-id helper: `ui/` may import nothing at
 * all, so the view's own `uniqueElementId` (`view/selection.ts`) is unreachable from here,
 * and a plain module-scoped counter is the whole of what minting one more id needs.
 */
let warningIdSeq = 0;

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
/**
 * The one thing a prompt does that is not about collecting a value: say when it went away.
 *
 * Every prompt here closes on the way OUT of both exits — the CTA closes and then submits,
 * and Escape or the close control closes and submits nothing — so a caller that wants
 * focus back where the reader pressed cannot get it from `onSubmit` alone. That is the
 * hole review found on the release view's status prompt (Codex, PR #211): the prompt is
 * opened from a body-mounted `Menu` that is gone by the time it closes, so cancelling left
 * a keyboard reader on `document.body` with no way back to the chip they came from.
 *
 * Stated on the BASE rather than on the three option bags that pass one, because the
 * reason is the base's: `close()` is what every prompt in this directory does, and the
 * hole is in that shared step rather than in any one dialog. The same `onClosed` name and
 * the same "fires BEFORE `onSubmit`" order the four hand-written dialogs in this directory
 * already use (`newReleaseDialog.ts` and the rest), so a caller needs one rule and not two.
 */
export interface Closable {
	onClosed?: () => void;
}

export abstract class PromptModal<O extends Closable> extends Modal {
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
		this.options.onClosed?.();
	}
}

/** What a refusable prompt needs of its options, whatever else it also asks for. */
export interface Refusable<T> {
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

export interface NewItemPromptOptions extends Closable {
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

/**
 * Folder autocomplete for the folder field of the prompt. Exported for tests.
 *
 * Both sides fold through `foldForMatch`, in the READER's locale rather than
 * `toLowerCase`'s locale-independent one: a suggest compares what was typed against paths
 * that are on screen, so a Turkish reader typing `ışık` must be offered `Işık`. A boolean
 * `includes` and never an index back into the unfolded path — folding is not
 * length-preserving. See `test/i18n/foldSites.ts` for the split.
 */
export class FolderSuggest extends ValueSuggest<TFolder> {
	protected getSuggestions(query: string): TFolder[] {
		const needle = foldForMatch(query);
		const folders: TFolder[] = [];
		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder && file.path !== '/' && foldForMatch(file.path).includes(needle)) {
				folders.push(file);
			}
		}
		folders.sort((a, b) => compareText(a.path, b.path));
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
 *
 * `foldForMatch` on both sides, for `FolderSuggest`'s reason exactly: what was typed
 * against what is on screen, in the reader's own locale.
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
		const lowered = foldForMatch(needle);
		return this.known.filter((value) => foldForMatch(value).includes(lowered)).slice(0, 50);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(this.sigil + value);
	}

	protected valueOf(value: string): string {
		return value;
	}
}

export interface ValuePromptOptions extends Closable {
	/** The modal's own heading, and the field label under it. */
	title: string;
	fieldName: string;
	placeholder: string;
	ctaLabel: string;
	/** What the vocabulary wears rather than stores — `#` for tags, nothing otherwise. */
	sigil?: string;
	/** Values offered as suggestions — for tags, the ones this item does not already carry. */
	known: string[];
	/**
	 * Sentence shown under the field while the trimmed entry matches a `known` value
	 * case-insensitively, cleared the moment it does not. Warns and never refuses — two
	 * real people can share a name, and this dialog guides rather than arbitrates who
	 * exists. Undefined for the two callers this ships with (a tag, an assignee), where a
	 * repeat is ordinary rather than worth a second look; the resource-name caller is what
	 * wants it.
	 *
	 * **Case-insensitively in the READER's locale** (`foldForMatch`), which is a deliberate
	 * call rather than the shape it shares with the identity folds. Nothing here is stored,
	 * keyed or matched against a persisted value: the note is created under the raw typed
	 * name whatever this decides, and the `known` list is note TITLES the reader can see in
	 * the suggest above the field. So the whole divergence between two locales is whether
	 * one advisory sentence appears — text, not data, by the root guide's own test — while
	 * folding without a locale silently drops the case this PBI exists for, `IŞIL` against
	 * `Işıl` on the roster.
	 */
	duplicateWarning?: string;
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
			// **The value it VALIDATES is the value it delivers.** The blank test below is on
			// the trimmed string, and handing `onSubmit` the raw one made those two different
			// answers: every caller of this modal mints vault DATA from it — a tag, a
			// resource's name, a release's first status — and a padded value reads back
			// trimmed while the frontmatter still holds the spaces, so a Base filter comparing
			// against what the screen shows drops the note (found by review, PR #211).
			// `newReleaseDialog` trims every field for the same reason; this is that rule at
			// the modal, so a caller cannot forget it.
			const entry = value.trim();
			if (entry.length === 0) return;
			this.close();
			this.options.onSubmit(entry);
		};

		const warningText = this.options.duplicateWarning;
		let warningEl: HTMLElement | null = null;
		const syncWarning = () => {
			if (!warningEl) return;
			const typed = foldForMatch(value.trim());
			const isKnown = this.options.known.some((k) => foldForMatch(k) === typed);
			warningEl.setText(isKnown ? (warningText ?? '') : '');
		};

		let inputEl!: HTMLInputElement;
		new Setting(this.contentEl).setName(this.options.fieldName).addText((text) => {
			inputEl = text.inputEl;
			text.setPlaceholder(this.options.placeholder);
			text.onChange((v) => {
				value = v;
				syncWarning();
			});
			new KnownValueSuggest(this.app, text.inputEl, this.options.known, this.options.sigil);
			submitOnEnter(text.inputEl, submit, true);
		});

		// Only built when the caller wants the feature, and then kept in the DOM and empty
		// rather than created on demand — `.pbl-modal-error`'s own reason: a dialog must
		// not resize under the pointer as the match is typed.
		//
		// `aria-live="polite"`, never `.pbl-modal-error`'s `role="alert"`: this text
		// appears and disappears on every keystroke while the field is otherwise valid —
		// nothing is refused — so an ASSERTIVE region would interrupt the reader on each
		// character typed near a match. Polite queues the announcement instead, and
		// `aria-describedby` ties the (possibly empty) warning to the field itself so a
		// screen reader user typing a duplicate hears it at all, which is the whole of
		// what extension 3a is for.
		if (warningText !== undefined) {
			const warningId = `pbl-modal-warning-${++warningIdSeq}`;
			warningEl = this.contentEl.createDiv({
				cls: 'pbl-modal-warning',
				attr: { id: warningId, 'aria-live': 'polite' },
			});
			inputEl.setAttribute('aria-describedby', warningId);
		}

		this.cta(this.options.ctaLabel, submit);
	}
}

export interface FolderPromptOptions extends Closable {
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
			.setName(t('prompt.folderField'))
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

export interface SchedulePromptOptions extends Refusable<Record<string, string>>, Closable {
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
						.setTooltip(t('prompt.clearDate', { name: spec.name }))
						.onClick(() => {
							input.value = '';
							values[spec.field] = '';
							errorEl.setText('');
						});
				});
			});
		});

		this.cta(t('prompt.save'), submit);
	}
}

export interface AbsenceResult {
	/** The chosen resource's id — its note path. Never a name somebody typed. */
	resource: string;
	start: string;
	target: string;
}

export interface AbsencePromptOptions extends Refusable<AbsenceResult>, Closable {
	heading: string;
	/**
	 * The resources this absence may name, as id/label pairs. Pairs rather than notes
	 * because this module imports nothing — the caller maps the id back to its file.
	 */
	resources: { id: string; label: string }[];
	/** Pre-selected from the row it was opened on, and changeable — the row is a default, not a lock. */
	resource: string;
	/**
	 * The stretch being EDITED, pre-filling the two date fields. Absent when adding one,
	 * which is what makes this one form for both acts rather than two that can disagree
	 * about what an absence is — the validator, the field list and the refusal rules are the
	 * same questions whether the note exists yet or not.
	 *
	 * No title among them since 2026-08-14: the note's name is derived from the three facts
	 * (`absenceTitle`), so there is nothing here to pre-fill it with.
	 */
	editing?: { start: string; target: string };
}

/**
 * Prompt asking for one resource's unavailable stretch.
 *
 * The resource is a CHOICE, not text: `AbsencePromptOptions.resources` is the whole
 * vocabulary this form may name, so a submission can never come back naming somebody
 * this base does not carry a note for. That is a change of shape from the free-text
 * field this form used to render (with a `KnownValueSuggest` merely suggesting a
 * spelling) — a typed name that matched nothing was still a name the writer would spell
 * onto the note, and that hole is what a `<select>` over a closed list closes.
 *
 * Both dates are required, always — this is the one form in this file where an empty
 * date is not a real answer, because an absence has nothing beneath it to infer the
 * other end from and no shelf to wait on. So there is no per-field clear button either:
 * `SchedulePromptModal` carries one because clearing an end is how a single date is
 * taken back, and here that would offer a gesture whose result the validator must then
 * refuse.
 *
 * The date fields are `type="date"` for that same modal's reason: the platform's picker,
 * and the only values that can come back are a calendar date or nothing.
 */
export class AbsencePromptModal extends PromptModal<AbsencePromptOptions> {
	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		const editing = this.options.editing;
		const values: AbsenceResult = {
			resource: this.options.resource,
			start: editing?.start ?? '',
			target: editing?.target ?? '',
		};

		const { errorEl, submit } = refusableBody(this, this.options, () => ({
			resource: values.resource,
			start: values.start.trim(),
			target: values.target.trim(),
		}));

		new Setting(this.contentEl).setName(t('prompt.absenceResource')).addDropdown((dropdown) => {
			// A placeholder option only where the pre-selection names nothing this form
			// offers. Neither caller in `interactions/absences.ts` can hand this a mismatch
			// from a freshly DRAWN mark or lane — an absence only draws in a lane its link
			// already resolved to, and a lane is a `Resource` note by construction — so what
			// this actually covers is a model rebuild in the window between opening the
			// context menu (or the lane's own button) and this modal reading the roster,
			// which is also why `resourceMissing`'s submit-time refusal exists beside it
			// rather than as a defensive habit: neither guard is reachable from a stable
			// model, only from one that moved under an open menu or an open form. This
			// module imports nothing and so cannot lean on either caller's invariant
			// regardless — it is this dialog's own contract with whatever calls it.
			if (!this.options.resources.some((resource) => resource.id === values.resource)) {
				dropdown.addOption('', t('prompt.absenceResourcePlaceholder'));
			}
			for (const resource of this.options.resources) dropdown.addOption(resource.id, resource.label);
			dropdown.setValue(values.resource);
			dropdown.onChange((v) => {
				values.resource = v;
				// The refusal was about what was entered, so it stops being true the moment
				// the entry changes.
				errorEl.setText('');
			});
		});

		const field = (name: string, key: 'start' | 'target', setup: (input: HTMLInputElement) => void) => {
			new Setting(this.contentEl).setName(name).addText((text) => {
				text.setValue(values[key]);
				text.onChange((v) => {
					values[key] = v;
					// The refusal was about what was entered, so it stops being true the
					// moment the entry changes.
					errorEl.setText('');
				});
				setup(text.inputEl);
				submitOnEnter(text.inputEl, submit, key === 'start');
			});
		};

		// Autofocused rather than the resource, which the row this was opened on already
		// answered — and there is no title field to claim it since the name became a
		// function of these three facts.
		field(t('prompt.absenceStart'), 'start', (input) => (input.type = 'date'));
		field(t('prompt.absenceEnd'), 'target', (input) => (input.type = 'date'));

		this.cta(t('prompt.save'), submit);
	}
}

export interface IterationResult {
	/** Empty on the edit path, which shows no name field — see {@link IterationPromptOptions.name}. */
	name: string;
	start: string;
	target: string;
	/** Blank means "no goal", which the two write paths spell differently — see the option. */
	goal: string;
}

export interface IterationPromptOptions extends Refusable<IterationResult>, Closable {
	heading: string;
	/**
	 * The name to prefill, or **null on the edit path**, where there is no name field at
	 * all: renaming an iteration is renaming a note, Obsidian does it better, and the
	 * stored scope already follows a rename.
	 */
	name: string | null;
	/** Prefilled dates. Every computed value here is a PREFILL — what is written is what was confirmed. */
	start: string;
	target: string;
	goal: string;
	/** Which fields have a property to be written to; one with none is not shown at all. */
	fields: { start: boolean; target: boolean; goal: boolean };
	cta: string;
}

/**
 * Make an iteration, or edit the one this board is scoped to — one form for both acts,
 * `AbsencePromptModal`'s reason exactly: the validator and the field list are the same
 * questions whether the note exists yet or not, and two forms are two answers waiting to
 * disagree.
 *
 * A field whose property is unconfigured is ABSENT rather than disabled. An unconfigured
 * key is never written, so a box that collected a value with nowhere to put it would be a
 * control that discards what it is given — and with all three unconfigured this is a name
 * alone, which still makes a perfectly good iteration note.
 */
export class IterationPromptModal extends PromptModal<IterationPromptOptions> {
	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		const values: IterationResult = {
			name: this.options.name ?? '',
			start: this.options.start,
			target: this.options.target,
			goal: this.options.goal,
		};
		const { errorEl, submit } = refusableBody(this, this.options, () => ({
			name: values.name.trim(),
			start: values.start.trim(),
			target: values.target.trim(),
			goal: values.goal.trim(),
		}));
		const field = (label: string, key: keyof IterationResult, setup?: (input: HTMLInputElement) => void) => {
			new Setting(this.contentEl).setName(label).addText((text) => {
				text.setValue(values[key]);
				text.onChange((v) => {
					values[key] = v;
					// The refusal was about what was entered, so it stops being true the
					// moment the entry changes.
					errorEl.setText('');
				});
				setup?.(text.inputEl);
				submitOnEnter(text.inputEl, submit, key === (this.options.name === null ? 'start' : 'name'));
			});
		};

		if (this.options.name !== null) field(t('prompt.iterationName'), 'name');
		if (this.options.fields.start) field(t('prompt.iterationStart'), 'start', (input) => (input.type = 'date'));
		if (this.options.fields.target) field(t('prompt.iterationTarget'), 'target', (input) => (input.type = 'date'));
		if (this.options.fields.goal) field(t('prompt.iterationGoal'), 'goal');
		this.cta(this.options.cta, submit);
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
			new Setting(this.contentEl).setName(t('prompt.newItemType')).addDropdown((drop) => {
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

		new Setting(this.contentEl).setName(t('prompt.newItemTitle')).addText((text) => {
			text.setPlaceholder(t('prompt.newItemTitlePlaceholder'));
			text.onChange((v) => {
				title = v;
				createBtn?.setDisabled(title.trim().length === 0);
			});
			submitOnEnter(text.inputEl, submit, true);
		});

		if (this.options.askFolder) {
			new Setting(this.contentEl)
				.setName(t('prompt.folderField'))
				.setDesc(t('prompt.newItemFolderDesc'))
				.addText((text) => {
					text.setPlaceholder(t('prompt.newItemFolderPlaceholder'));
					text.onChange((v) => (folder = v));
					new FolderSuggest(this.app, text.inputEl);
					submitOnEnter(text.inputEl, submit);
				});
		}

		createBtn = this.cta(t('prompt.create'), submit).setDisabled(true);
	}
}
