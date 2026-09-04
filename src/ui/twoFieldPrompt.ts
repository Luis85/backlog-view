import { App, Setting } from 'obsidian';
import { Closable, PromptModal, Refusable, refusableBody, submitOnEnter } from './prompts';

/**
 * The one prompt in this directory that collects TWO related values in one press, in its
 * own file for `textPrompt.ts`'s own reason: `prompts.ts` is at its 400-line budget, and
 * a modal that reuses `PromptModal`, `Refusable`, `refusableBody` and `submitOnEnter`
 * needs nothing from that file a plain import cannot reach.
 *
 * **Why two fields and not two dialogs.** The risk vocabularies — this modal's first
 * caller — are one criterion split across two properties, and a criterion with only one
 * of them bound is unconfigured exactly as if neither were
 * (`docs/requirements/Answering the readiness checklist.md`). Two sequential
 * `ValuePromptModal`s could write the first and leave the second, on a cancel or a crash
 * between them, so this is `IterationPromptModal`'s own field-building loop
 * (`prompts.ts`) generalised to two named fields instead of dates — one CTA, one write.
 */

export interface TwoFieldSpec {
	/** Identifies the field in the submitted record — the caller's own vocabulary. */
	field: string;
	name: string;
	value: string;
	placeholder: string;
}

export interface TwoFieldPromptOptions extends Refusable<Record<string, string>>, Closable {
	heading: string;
	fields: [TwoFieldSpec, TwoFieldSpec];
	cta: string;
}

/** Prompt asking for two related text values, submitted together or not at all. */
class TwoFieldPromptModal extends PromptModal<TwoFieldPromptOptions> {
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
			new Setting(this.contentEl).setName(spec.name).addText((text) => {
				text.setValue(spec.value);
				text.setPlaceholder(spec.placeholder);
				text.onChange((v) => {
					values[spec.field] = v;
					// The refusal was about what was entered, so it stops being true the moment
					// the entry changes — every other refusable prompt in this directory clears
					// the same way.
					errorEl.setText('');
				});
				submitOnEnter(text.inputEl, submit, i === 0);
			});
		});

		this.cta(this.options.cta, submit);
	}
}

/** Open one — the shape every dialog in `ui/` is reached through, so a caller never
 *  constructs a modal itself. */
export function openTwoFieldPrompt(app: App, options: TwoFieldPromptOptions): void {
	new TwoFieldPromptModal(app, options).open();
}
