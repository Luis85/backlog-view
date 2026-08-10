import { Menu, Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { ValuePromptModal } from '../../ui/prompts';
import { BacklogItem } from '../../domain/model';
import { hasTag, normalizeTag } from '../../domain/noteFields';

/**
 * True when the tags property is one of the base's visible properties. Tag editing
 * follows the column: the row shows what it can edit, and nothing more. This asks
 * about the Base's configuration, not the pane — a column dropped by `columnFit`
 * for want of space keeps its menu entry, which is then the only way to edit tags,
 * and which lists them checked rather than editing anything unseen.
 */
export function tagsColumnVisible(host: BacklogViewHost): boolean {
	return host.columns.some((column) => column.kind === 'tags');
}

/** The tags this item's menu offers: the base's vocabulary plus the item's own. */
function tagChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	const choices = [...(host.model?.observedTags ?? [])];
	for (const tag of item.tags) {
		if (!hasTag(choices, tag)) choices.push(tag);
	}
	return choices;
}

/**
 * Add or remove a tag. Both send a delta, never a computed list: the row's tags
 * are a snapshot from the last refresh, so a second click before the refresh
 * lands would otherwise write the list as it was before the first one.
 */
function addTag(host: BacklogViewHost, item: BacklogItem, raw: string): void {
	const tag = normalizeTag(raw);
	if (tag.length === 0) {
		// Say so rather than closing the prompt as if the tag had been added.
		if (raw.trim().length > 0) new Notice('Tags need at least one non-numeric character, so that was not added.');
		return;
	}
	if (hasTag(item.tags, tag)) return;
	void host.applySafely([{ file: item.file, tags: { add: [tag] } }]);
}

export function removeTag(host: BacklogViewHost, item: BacklogItem, tag: string): void {
	void host.applySafely([{ file: item.file, tags: { remove: [tag] } }]);
}

function toggleTag(host: BacklogViewHost, item: BacklogItem, tag: string): void {
	if (hasTag(item.tags, tag)) removeTag(host, item, tag);
	else addTag(host, item, tag);
}

/**
 * The tag picker's entries: every known tag as a checkable toggle, then a way to
 * type a new one. Shared by the row's tag button and the context menu submenu, so
 * mouse and keyboard reach exactly the same choices.
 */
export function addTagItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	for (const tag of tagChoices(host, item)) {
		menu.addItem((mi) => {
			mi.setTitle(`#${tag}`).onClick(() => toggleTag(host, item, tag));
			if (hasTag(item.tags, tag)) mi.setChecked(true);
		});
	}
	menu.addItem((mi) =>
		mi
			.setTitle('New tag...')
			.setIcon('plus')
			.onClick(() => promptNewTag(host, item)),
	);
}

/** Free-text entry, suggesting the tags already in use so spellings stay consistent. */
function promptNewTag(host: BacklogViewHost, item: BacklogItem): void {
	new ValuePromptModal(host.app, {
		title: 'Add tag',
		fieldName: 'Tag',
		placeholder: 'Sprint-12',
		ctaLabel: 'Add',
		sigil: '#',
		known: tagChoices(host, item).filter((tag) => !hasTag(item.tags, tag)),
		onSubmit: (tag) => addTag(host, item, tag),
	}).open();
}
