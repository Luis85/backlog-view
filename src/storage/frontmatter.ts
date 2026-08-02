import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import { hasTag, normalizeTag, readString, readTags } from '../domain/noteFields';
import { AXIS_FIELDS, axisKeyFor, BacklogSettings, isDoneValue, vaultFolder } from '../domain/settings';
import { AxisWrite, ItemWrite, TagDelta } from '../domain/writePlan';

/**
 * The ONLY module that writes frontmatter. Everything upstream decides what a
 * change should be (`domain/writePlan.ts`) and hands the plan here; nothing else
 * in the codebase may call `processFrontMatter` or create a note. Keeping that
 * true is what makes the write-safety rules checkable by reading one file.
 */

/** A raw frontmatter value, or its absence — undo must tell the two apart. */
export type RawValue = { present: true; value: unknown } | { present: false };

/**
 * One key's before/after, captured as a write landed. `prior` is what undo puts
 * back; `written` is the compare of the restore's compare-and-swap. Raw values,
 * not planner shapes: an aliased or unresolved parent link, a string-typed order
 * and an absent key all have to come back exactly as they were.
 */
export interface KeyRestore {
	key: string;
	prior: RawValue;
	written: RawValue;
}

/** The inverse of one applied write. Only keys the write effectively changed appear. */
export interface RestoreWrite {
	file: TFile;
	keys: KeyRestore[];
	/**
	 * Reverses the effective tag delta. Tags stay a delta rather than a snapshot —
	 * the list is shared with the user's own edits, and a delta composes with
	 * changes made between the write and the undo instead of clobbering them.
	 */
	tags?: { key: string; delta: TagDelta };
}

/** What a restore batch could not put back, for the undo notice. */
export interface RestoreOutcome {
	/** Keys whose live value no longer matched what the batch wrote; left as they are. */
	conflicts: number;
	/** Notes gone from the vault since the write; skipped whole. */
	missing: number;
}

/**
 * Apply writes sequentially so concurrent edits of the same file cannot race.
 * `onProgress` reports after each file so a long batch — a backfill over a whole
 * backlog is hundreds of notes — can show how far along it is. Each await yields
 * to the event loop, so the view stays interactive throughout.
 *
 * `onInverse` receives each write's inverse as it lands — incrementally, not as a
 * return value, because a batch that fails partway leaves its earlier writes
 * applied, and those are exactly the ones that still need to be undoable. A write
 * that changed nothing emits no inverse, so a no-op batch cannot cost the caller
 * the undo of the change before it.
 */
export async function applyWrites(
	app: App,
	settings: BacklogSettings,
	writes: ItemWrite[],
	onProgress?: (done: number, total: number) => void,
	onInverse?: (inverse: RestoreWrite) => void,
): Promise<void> {
	let done = 0;
	for (const write of writes) {
		let inverse: RestoreWrite | null = null;
		await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
			const keys = touchedKeys(settings, write);
			const before = keys.map((key) => rawValueOf(fm, key));
			const tags = applyInto(app, fm, settings, write);
			inverse = captureInverse(write.file, keys, before, fm, tags);
		});
		if (inverse) onInverse?.(inverse);
		onProgress?.(++done, writes.length);
	}
}

/**
 * Apply one planned write to the live frontmatter, returning the tag restore its
 * delta earned (null when it changed no tags). Separate from the loop above so the
 * question "what does a write DO" is answerable in one place, and so the capture
 * that surrounds it stays readable beside it.
 */
function applyInto(
	app: App,
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
): RestoreWrite['tags'] | null {
	// The state this note is actually leaving, read BEFORE the write replaces it. The
	// model's idea of it can be a refresh behind — an external edit, or a batch still
	// landing — and the done boundary has to be judged on the truth. Through the same
	// tolerant reader the model builds `stateValue` with, or a state stored as a
	// one-item list reads as no state here and as `Done` there: two answers to one
	// question, and the boundary rule believes the wrong one.
	const leaving = settings.stateKey ? readString(ownValue(fm, settings.stateKey)) : null;
	applyHierarchy(app, fm, settings, write);
	// The stateKey may be unset (progress tracking off) — never write to an empty key.
	if (write.removeStateKey && settings.stateKey) delete fm[settings.stateKey];
	else if (write.state !== undefined && settings.stateKey) setOwn(fm, settings.stateKey, write.state);
	applyStamps(fm, settings, write, leaving);
	// The roadmap's placement keys, by the same two rules: never an unconfigured key,
	// and a null REMOVES rather than blanks — unscheduled is a state a note returns
	// to, not a pair of empty strings.
	for (const { key, value } of axisEntries(settings, write.axis)) {
		if (value === null) delete fm[key];
		else setOwn(fm, key, value);
	}
	const applied =
		write.tags !== undefined && settings.tagsKey ? applyTagDelta(fm, settings.tagsKey, write.tags) : null;
	// The stored delta is the one that UNDOES what was applied.
	return applied ? { key: settings.tagsKey, delta: { add: applied.remove, remove: applied.add } } : null;
}

/** The three hierarchy properties: the parent link (or its removal), the rank, the type. */
function applyHierarchy(app: App, fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): void {
	if (write.removeParentKey) {
		delete fm[settings.parentKey];
	} else if (write.parent !== undefined) {
		if (write.parent !== null) setOwn(fm, settings.parentKey, wikilinkTo(app, write.parent, write.file.path));
		// In folder mode a deleted key would just re-infer the folder parent;
		// an explicitly empty value pins the item to the top level instead.
		else if (settings.folderHierarchy) setOwn(fm, settings.parentKey, '');
		else delete fm[settings.parentKey];
	}
	if (write.order !== undefined) setOwn(fm, settings.orderKey, write.order);
	if (write.typeName !== undefined) setOwn(fm, settings.typeKey, write.typeName);
}

/** The frontmatter keys this write will touch, in the order they are written. */
function touchedKeys(settings: BacklogSettings, write: ItemWrite): string[] {
	const keys: string[] = [];
	if (write.removeParentKey || write.parent !== undefined) keys.push(settings.parentKey);
	if (write.order !== undefined) keys.push(settings.orderKey);
	if (write.typeName !== undefined) keys.push(settings.typeKey);
	if ((write.removeStateKey || write.state !== undefined) && settings.stateKey) keys.push(settings.stateKey);
	// Listed whenever the write CARRIES a stamp, including the started date it may
	// decline to write: a key whose value did not change emits no inverse anyway, and
	// listing it is what makes the dates ride the state's own undo.
	if (write.startedDate !== undefined && settings.startedDateKey) keys.push(settings.startedDateKey);
	if (write.finish !== undefined && settings.finishedDateKey) keys.push(settings.finishedDateKey);
	for (const { key } of axisEntries(settings, write.axis)) keys.push(key);
	return keys;
}

/**
 * The date stamps of one write. Never a write of their own — they mutate the same
 * frontmatter the state write just did, inside the same `processFrontMatter` call, so
 * the batch that changed the state is the batch an undo takes back.
 *
 * A stamp key is only ever written when the user named that property, exactly as the
 * state key is: every part of stamping is opt-in.
 */
function applyStamps(
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
	leaving: string | null,
): void {
	// A start records a TRANSITION, so one has to have happened. Both halves are asked
	// of the LIVE value rather than the planner's snapshot, because the row that planned
	// this can be a refresh behind the note: it must actually MOVE the note to another
	// state — a stale row can propose the state the note already holds, and stamping
	// that would date a redundant selection rather than the moment work began, and
	// spend the undo slot doing it — and the property must still be empty, so the
	// earliest start survives rework.
	if (
		write.startedDate !== undefined &&
		settings.startedDateKey &&
		movesState(leaving, write.state) &&
		isBlank(ownValue(fm, settings.startedDateKey))
	) {
		setOwn(fm, settings.startedDateKey, write.startedDate);
	}
	if (write.finish === undefined || !settings.finishedDateKey) return;
	// Only CROSSING the boundary writes, and the crossing is measured from the state
	// the NOTE was in. Done to done is a re-labelling — Done becoming Dropped — not a
	// new finish, and moving the date forward would rewrite the item's history to say
	// the work took longer than it did. Leaving done clears it, so a reopened item
	// never claims a finish it no longer has.
	const wasDone = isDoneValue(settings, leaving);
	if (write.finish.toDone === wasDone) return;
	if (write.finish.toDone) setOwn(fm, settings.finishedDateKey, write.finish.date);
	else delete fm[settings.finishedDateKey];
}

/**
 * Whether this write actually moves the note to a different state, by the same
 * case-insensitive match the planner and the board's columns use. A write carrying no
 * state moves nothing.
 */
function movesState(leaving: string | null, state: string | undefined): boolean {
	if (state === undefined) return false;
	return leaving === null || leaving.toLowerCase() !== state.toLowerCase();
}

/**
 * Write a note's OWN property for a user-configured key.
 *
 * `fm[key] = value` is not safe when the user names the property `__proto__`: plain
 * assignment reaches `Object.prototype`'s setter instead of creating a key, which
 * SILENTLY drops a string or a number — the state changes and its date vanishes — and
 * for the tag list, which is an array, actually replaces the object's prototype. A
 * defined own property is what YAML round-trips, for every key including that one.
 */
function setOwn(fm: Record<string, unknown>, key: string, value: unknown): void {
	Object.defineProperty(fm, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * A note's OWN value for a user-configured key, or undefined when it has none.
 *
 * Frontmatter keys are user data, so `fm[key]` is not safe: `toString`, `constructor`
 * and `valueOf` are all legal property names, and on a note that lacks them the lookup
 * returns the inherited FUNCTION — truthy, so a blank test reports "a date is already
 * recorded" for a note that has none, and the stamp is declined forever. The rule is
 * old here (`byTypeName` in `domain/settings.ts` says it has shipped three times), and
 * the answer is the same one: a function to reach for, not a rule to remember. Every
 * live read of a configured key in this module goes through it.
 */
function ownValue(fm: Record<string, unknown>, key: string): unknown {
	return Object.prototype.hasOwnProperty.call(fm, key) ? fm[key] : undefined;
}

/**
 * Whether a frontmatter value counts as "no date yet". Absent, null and empty text —
 * and a LIST holding nothing but those, because Obsidian writes an emptied list
 * property as `[]` and the date readers already call that absence. A stricter test
 * here would read `started: []` as a date already recorded and decline the stamp
 * forever, which is the write-once rule protecting a value that is not there.
 */
function isBlank(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value === 'string') return value.trim() === '';
	if (Array.isArray(value)) return value.every((entry) => isBlank(entry));
	return false;
}

/**
 * The configured keys one axis write touches, each with the value it will write.
 * Applying and capturing read the SAME list: a key written but not captured would
 * be a change no undo could reach, which is exactly how a hole gets in.
 */
function axisEntries(settings: BacklogSettings, axis?: AxisWrite): { key: string; value: string | null }[] {
	if (!axis) return [];
	const entries: { key: string; value: string | null }[] = [];
	for (const field of AXIS_FIELDS) {
		const key = axisKeyFor(settings, field);
		const value = axis[field];
		if (key !== '' && value !== undefined) entries.push({ key, value });
	}
	return entries;
}

/**
 * The inverse of the write that just mutated `fm`: the keys whose value it
 * effectively changed, prior and written both. Null when nothing changed — a
 * state re-set to itself must not consume the caller's single undo slot.
 */
function captureInverse(
	file: TFile,
	keys: string[],
	before: RawValue[],
	fm: Record<string, unknown>,
	tags: RestoreWrite['tags'] | null,
): RestoreWrite | null {
	const changed: KeyRestore[] = [];
	keys.forEach((key, i) => {
		const written = rawValueOf(fm, key);
		if (!sameRaw(before[i], written)) changed.push({ key, prior: before[i], written });
	});
	if (changed.length === 0 && !tags) return null;
	return { file, keys: changed, tags: tags ?? undefined };
}

/**
 * Replay captured inverses. Restoring is a compare-and-swap, never a blind write:
 * a key goes back to its prior value only where the note still holds what the
 * batch wrote — undo is not the only editor, and a key hand-edited since is newer
 * than the undo. A note deleted since the write is skipped whole; the rest of the
 * batch still restores. `onInverse` records each restore's own inverse the same
 * way `applyWrites` does, which is what makes undoing an undo redo.
 */
export async function applyRestores(
	app: App,
	restores: RestoreWrite[],
	onProgress?: (done: number, total: number) => void,
	onInverse?: (inverse: RestoreWrite) => void,
): Promise<RestoreOutcome> {
	const outcome: RestoreOutcome = { conflicts: 0, missing: 0 };
	let done = 0;
	for (const restore of restores) {
		// The same NOTE, not merely the same path: a note deleted and recreated at
		// this path is a different file, and restoring into it would write history
		// that was never its own. Obsidian keeps one TFile per file, so instance
		// identity is the test — a path-only check would pass the replacement.
		if (app.vault.getAbstractFileByPath(restore.file.path) !== restore.file) {
			outcome.missing++;
			onProgress?.(++done, restores.length);
			continue;
		}
		let inverse: RestoreWrite | null = null;
		await app.fileManager.processFrontMatter(restore.file, (fm: Record<string, unknown>) => {
			inverse = restoreInto(fm, restore, outcome);
		});
		if (inverse) onInverse?.(inverse);
		onProgress?.(++done, restores.length);
	}
	return outcome;
}

/** Apply one file's restore into its live frontmatter; returns the redo inverse. */
function restoreInto(
	fm: Record<string, unknown>,
	restore: RestoreWrite,
	outcome: RestoreOutcome,
): RestoreWrite | null {
	const changed: KeyRestore[] = [];
	for (const entry of restore.keys) {
		if (!sameRaw(rawValueOf(fm, entry.key), entry.written)) {
			outcome.conflicts++;
			continue;
		}
		if (entry.prior.present) setOwn(fm, entry.key, entry.prior.value);
		else delete fm[entry.key];
		changed.push({ key: entry.key, prior: entry.written, written: entry.prior });
	}
	let tags: RestoreWrite['tags'];
	if (restore.tags) {
		const applied = applyTagDelta(fm, restore.tags.key, restore.tags.delta);
		if (applied) tags = { key: restore.tags.key, delta: { add: applied.remove, remove: applied.add } };
	}
	if (changed.length === 0 && !tags) return null;
	return { file: restore.file, keys: changed, tags };
}

function rawValueOf(fm: Record<string, unknown>, key: string): RawValue {
	// Own properties only: 'toString' is a legal frontmatter name on a note that
	// lacks it, and `in` would report the inherited function as a prior value.
	return Object.prototype.hasOwnProperty.call(fm, key)
		? { present: true, value: fm[key] }
		: { present: false };
}

/** Equality on raw frontmatter values — plain YAML data, so structural compare is sound. */
function sameRaw(a: RawValue, b: RawValue): boolean {
	if (!a.present || !b.present) return a.present === b.present;
	return a.value === b.value || JSON.stringify(a.value) === JSON.stringify(b.value);
}

/**
 * Add and remove tags on whatever the note holds right now — inside processFrontMatter,
 * so the list a click was rendered from cannot overwrite a change made since. Always
 * written back as a YAML list (the shape Obsidian's own property editor writes), and
 * the key goes when the last tag does rather than leaving an empty array behind.
 * Returns the delta that actually changed the note — adds already present and removes
 * already absent drop out — or null when nothing did and the note was left alone.
 */
function applyTagDelta(fm: Record<string, unknown>, key: string, delta: TagDelta): TagDelta | null {
	const current = readTags(ownValue(fm, key));
	const removals = delta.remove ?? [];
	const removed = current.filter((tag) => hasTag(removals, tag));
	const next = current.filter((tag) => !hasTag(removals, tag));
	// Normalizing here rather than at the call site is what makes "every tag on disk is
	// one Obsidian will read" true of the write path itself, not of one caller.
	const added: string[] = [];
	for (const tag of (delta.add ?? []).map(normalizeTag)) {
		if (tag.length > 0 && !hasTag(next, tag)) {
			next.push(tag);
			added.push(tag);
		}
	}
	// A delta that changes nothing leaves the note alone, rather than rewriting the
	// value into a different shape for no reason.
	if (added.length === 0 && removed.length === 0) return null;
	if (next.length > 0) setOwn(fm, key, next);
	else delete fm[key];
	return { add: added, remove: removed };
}

export interface NewItemSpec {
	folder: string;
	title: string;
	typeName: string;
	parent: TFile | null;
	order: number;
	/** The bucket it was created in, when it was created from one. */
	horizon?: string;
}

/** Create a new backlog note in the configured folder with its hierarchy properties set. */
export async function createBacklogItem(app: App, settings: BacklogSettings, spec: NewItemSpec): Promise<TFile> {
	const folder = vaultFolder(spec.folder);
	await ensureFolder(app, folder);

	const base = sanitizeTitle(spec.title);
	const filePath = (name: string) => (folder ? normalizePath(`${folder}/${name}.md`) : `${name}.md`);
	let path = filePath(base);
	for (let i = 1; app.vault.getAbstractFileByPath(path) !== null; i++) {
		path = filePath(`${base} ${i}`);
	}

	// One atomic write: a create-then-update pair could fail in between and leave
	// a blank note without its hierarchy properties behind.
	const fm: Record<string, unknown> = { [settings.typeKey]: spec.typeName };
	if (spec.parent) setOwn(fm, settings.parentKey, wikilinkTo(app, spec.parent, path));
	// In folder mode a missing parent key would let folder inference nest this
	// intentionally top-level note — pin it with an explicitly empty parent.
	else if (settings.folderHierarchy) setOwn(fm, settings.parentKey, '');
	setOwn(fm, settings.orderKey, spec.order);
	// A note created from a bucket claims that bucket in the SAME write, through the
	// same axis list the edit path uses — so it is never momentarily a note sitting in
	// a bucket its own frontmatter does not name, and never a write to an unconfigured
	// key. `axisEntries` yields nothing here when the horizon axis is off.
	for (const { key, value } of axisEntries(settings, spec.horizon ? { horizon: spec.horizon } : undefined)) {
		if (value !== null) setOwn(fm, key, value);
	}
	return app.vault.create(path, `---\n${stringifyYaml(fm)}---\n`);
}

/**
 * Always write parents as quoted wikilinks so the metadata cache picks them up
 * as frontmatter links regardless of the user's link format setting.
 */
function wikilinkTo(app: App, target: TFile, sourcePath: string): string {
	return '[[' + app.metadataCache.fileToLinktext(target, sourcePath) + ']]';
}


function sanitizeTitle(title: string): string {
	const cleaned = title
		.replace(/[\\/:*?"<>|#^[\]]/g, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^[-\s.]+|[-\s]+$/g, '');
	return cleaned.length > 0 ? cleaned : 'Untitled';
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
	if (!folder) return;
	const parts = folder.split('/');
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (app.vault.getAbstractFileByPath(current) === null) {
			try {
				await app.vault.createFolder(current);
			} catch {
				// Folder may have been created concurrently; creation of the note will surface real errors.
			}
		}
	}
}
