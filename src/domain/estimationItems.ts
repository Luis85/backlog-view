import { App, BasesEntry, TFile } from 'obsidian';
import { isResourceType } from './itemTypes';
import { ownValue, readNumber, readString } from './noteFields';
import { boundKeys, Indicator, ScoringModel } from './scoringModel';
import { computeIndicator, computeTotal, Currency, currencyOf, IndicatorFigure, modelFingerprint, TotalResult } from './weightedScore';

/**
 * One result note read into what the table and the panel need: its own answers, what is
 * already stored on it, and what scoring it fresh says about that stored value.
 *
 * Every item here is a Base RESULT — this view draws no context rows and ranks nothing,
 * so unlike `domain/model.ts`'s `RawItem` there is no `outsideFilter` to carry and
 * `entry` is never null.
 */
export interface EstimationItem {
	file: TFile;
	entry: BasesEntry;
	title: string;
	/** By dimension id; null when the note has no answer for it, or an unreadable one. */
	answers: Map<string, number | null>;
	confidence: number | null;
	effort: number | null;
	complexity: number | null;
	storedTotal: number | null;
	storedStamp: string | null;
	result: TotalResult | null;
	/** This model's indicator for this item, or null when none is configured — derived on
	 *  read and written nowhere, which is why it sits beside `result` rather than in it. */
	indicator: IndicatorFigure | null;
	currency: Currency;
	/** Frontmatter keys the note actually carries, of this model's keys — what a Clear action may remove. */
	ownKeys: Set<string>;
}

export interface EstimationModel {
	items: EstimationItem[];
	byPath: Map<string, EstimationItem>;
}

/**
 * Every result read into an item, in the Base's own order. One `getFileCache` per
 * note — the model-cost rule `src/domain/CLAUDE.md` states for the backlog's own
 * build — so every field below reads off the SAME `fm` rather than opening the cache
 * a second time.
 */
export function buildEstimationModel(
	app: App,
	entries: BasesEntry[],
	model: ScoringModel,
	indicator: Indicator,
	typeKey: string,
): EstimationModel {
	const bound = boundKeys(model);
	// Loop-invariant: the same model scores every item, so its fingerprint (a JSON.stringify
	// plus a hash over every dimension) is computed once here rather than once per item
	// inside `currencyOf`.
	const fingerprint = modelFingerprint(model);
	const items: EstimationItem[] = [];
	const byPath = new Map<string, EstimationItem>();
	for (const entry of entries) {
		const file = entry.file;
		// Only markdown files carry the frontmatter this view reads, and a Base can
		// return others; the dedupe guards the same result arriving twice.
		if (!file || file.extension !== 'md' || byPath.has(file.path)) continue;
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		// **A RESOURCE is not something to score, and this view has to refuse it itself.**
		// The backlog's own gate is in `readItems`, which this model never goes through: it
		// reads the Base's results straight into its own item. So a person in a base opened
		// with this view would be a scoreable row, ✨ would stub every configured estimation
		// key onto their note, and the score actions would write to it — none of which the
		// backlog's refusal can reach, because none of it builds a `BacklogItem`.
		//
		// Refused HERE rather than filtered by the caller, for the reason the read gate has:
		// before the item exists, so the table, the toolbar's count, the backfill and every
		// write path are all answered at once and a second caller cannot miss it. Read off
		// the `fm` already open on the line above, which is the one-cache-read-per-note rule
		// this loop's own comment states.
		if (isResourceType(readString(ownValue(fm, typeKey)))) continue;
		const answers = new Map<string, number | null>();
		for (const d of model.dimensions) answers.set(d.id, readNumber(ownValue(fm, d.key)));
		const storedTotal = readNumber(ownValue(fm, model.valueKey));
		const storedStamp = readString(ownValue(fm, model.stampKey));
		const result = computeTotal(model, answers);
		const confidence = readNumber(ownValue(fm, model.confidence.key));
		const effort = readNumber(ownValue(fm, model.effort.key));
		const complexity = readNumber(ownValue(fm, model.complexity.key));
		const item: EstimationItem = {
			file,
			entry,
			title: file.basename,
			answers,
			confidence,
			effort,
			complexity,
			storedTotal,
			storedStamp,
			result,
			indicator: computeIndicator(model, indicator, { answers, confidence, effort, complexity, result }),
			currency: currencyOf(model, { storedTotal, storedStamp, result }, fingerprint),
			ownKeys: new Set(bound.filter((key) => ownValue(fm, key) !== undefined)),
		};
		items.push(item);
		byPath.set(file.path, item);
	}
	return { items, byPath };
}
