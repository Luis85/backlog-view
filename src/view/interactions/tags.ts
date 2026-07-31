import { Menu, Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { TagPromptModal } from '../../ui/prompts';
import { BacklogItem } from '../../domain/model';

/**
 * Frontmatter tags carry no '#' and no spaces, and Obsidian only accepts letters,
 * digits, underscores, hyphens and '/' as a nesting separator. Anything else a
 * user types becomes a hyphen rather than an unusable tag. Returns '' for input
 * that cannot become a tag at all — Obsidian also requires one non-numeric
 * character, so "123" would be written and then never recognized. A hyphen or a
 * slash satisfies that, which is what makes "2026-07" a perfectly good tag.
 */
function normalizeTag(input: string): string {
	const tag = input
		.trim()
		.replace(/^#+/, '')
		// Unusable characters at the edges are dropped, not turned into a hyphen:
		// "Sprint 12!" should be "Sprint-12", not "Sprint-12-".
		.replace(/^[^\p{L}\p{N}_/-]+|[^\p{L}\p{N}_/-]+$/gu, '')
		.replace(/[^\p{L}\p{N}_/-]+/gu, '-')
		.replace(/-{2,}/g, '-')
		// A hyphen the user typed is theirs to keep, at either end — "-urgent" and
		// "123-" are real tags. A slash there is not: it means an empty nesting
		// segment, which is why only those are trimmed.
		.replace(/\/{2,}/g, '/')
		.replace(/^\/+|\/+$/g, '');
	return /[^\p{N}]/u.test(tag) ? tag : '';
}

/**
 * True when the tags property is one of the base's visible properties. Tag editing
 * follows the column: the row shows what it can edit, and nothing more. This asks
 * about the Base's configuration, not the pane — a column dropped by `columnFit`
 * for want of space keeps its menu entry, which is then the only way to edit tags,
 * and which lists them checked rather than editing anything unseen.
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
	if (hasTag(item, tag)) return;
	void host.applySafely([{ file: item.file, tags: { add: [tag] } }]);
}

export function removeTag(host: BacklogViewHost, item: BacklogItem, tag: string): void {
	void host.applySafely([{ file: item.file, tags: { remove: [tag] } }]);
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
