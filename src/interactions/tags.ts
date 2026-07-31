import { Menu } from 'obsidian';
import { BacklogViewHost } from '../host';
import { TagPromptModal } from '../modal';
import { BacklogItem } from '../model';

/**
 * Frontmatter tags carry no '#' and no spaces, and Obsidian only accepts letters,
 * digits, underscores, hyphens and '/' as a nesting separator. Anything else a
 * user types becomes a hyphen rather than an unusable tag.
 */
function normalizeTag(input: string): string {
	return input
		.trim()
		.replace(/^#+/, '')
		.replace(/[^\p{L}\p{N}_/-]+/gu, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^[-/]+|[-/]+$/g, '');
}

/**
 * True when the tags property is one of the base's visible properties. Tag editing
 * follows the column: the row shows what it can edit, and nothing more.
 */
export function tagsColumnVisible(host: BacklogViewHost): boolean {
	const id = `note.${host.settings.tagsKey}`;
	if (!host.settings.tagsKey || !host.settings.showChips) return false;
	try {
		return host.config.getOrder().some((prop) => prop === id);
	} catch {
		return false;
	}
}

/** The tags this item's menu offers: the base's vocabulary plus the item's own. */
function tagChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	const choices = [...(host.model?.observedTags ?? [])];
	for (const tag of item.tags) {
		if (!choices.some((t) => t.toLowerCase() === tag.toLowerCase())) choices.push(tag);
	}
	return choices;
}

function hasTag(item: BacklogItem, tag: string): boolean {
	return item.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
}

/** Add a tag unless the item already carries it (ignoring case). */
function addTag(host: BacklogViewHost, item: BacklogItem, raw: string): void {
	const tag = normalizeTag(raw);
	if (tag.length === 0 || hasTag(item, tag)) return;
	void host.applySafely([{ file: item.file, tags: [...item.tags, tag] }]);
}

export function removeTag(host: BacklogViewHost, item: BacklogItem, tag: string): void {
	if (!hasTag(item, tag)) return;
	const tags = item.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
	void host.applySafely([{ file: item.file, tags }]);
}

function toggleTag(host: BacklogViewHost, item: BacklogItem, tag: string): void {
	if (hasTag(item, tag)) removeTag(host, item, tag);
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
			if (hasTag(item, tag)) mi.setChecked(true);
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
export function promptNewTag(host: BacklogViewHost, item: BacklogItem): void {
	new TagPromptModal(host.app, {
		known: tagChoices(host, item).filter((tag) => !hasTag(item, tag)),
		onSubmit: (tag) => addTag(host, item, tag),
	}).open();
}
