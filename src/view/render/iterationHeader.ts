import { setIcon, setTooltip } from 'obsidian';
import { RowContext } from './columns';
import { formatDate, formatNumber, t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { bucketLabel, IterationBucket } from '../../domain/board';
import { statedEnds } from '../../domain/bars';
import { boardPeople, iterationProgress, personKey, timebox, Timebox } from '../../domain/iterationDaily';
import { BacklogItem } from '../../domain/model';
import { CivilDate, todayCivil } from '../../domain/noteFields';

/**
 * The iteration board's header: which sprint this is and what it is for, set larger than
 * anything else on the board, then where its timebox stands and how far the work has got —
 * the questions a stand-up opens with. The Daily/Planning switch beside the name is chrome,
 * so its two buttons are ordinary tab stops.
 *
 * Returns the header so a later row (the people) can be drawn into it.
 */
export function renderIterationHeader(
	ctx: RowContext,
	boardEl: HTMLElement,
	iteration: BacklogItem,
	population: BacklogItem[],
): HTMLElement {
	const host: BacklogViewHost = ctx.host;
	const headerEl = boardEl.createDiv({ cls: 'pbl-iteration-header' });
	const titlebar = headerEl.createDiv({ cls: 'pbl-iteration-titlebar' });
	const titles = titlebar.createDiv();
	titles.createDiv({ cls: 'pbl-iteration-kicker', text: t('iteration.kicker') });
	titles.createEl('h2', { cls: 'pbl-iteration-name', text: iteration.title });
	renderModeSwitch(host, titlebar, boardEl);
	renderGoal(host, headerEl, iteration);
	const meta = headerEl.createDiv({ cls: 'pbl-iteration-meta' });
	const stated = statedEnds(iteration);
	renderTimebox(meta, timebox(stated.start.value, stated.target.value, todayCivil()));
	renderProgress(meta, population, host);
	return headerEl;
}

/**
 * No goal draws nothing — never an empty line, never a placeholder inviting a value — and
 * the goal is TEXT: a control here would be a second way to edit a note whose own dialog
 * owns that.
 */
function renderGoal(host: BacklogViewHost, headerEl: HTMLElement, iteration: BacklogItem): void {
	const goal = host.settings.iterationGoalKey ? (iteration.iterationGoalValue ?? '').trim() : '';
	if (goal === '') return;
	headerEl.createDiv({ cls: 'pbl-iteration-goal-label', text: t('iteration.goalLabel') });
	headerEl.createDiv({ cls: 'pbl-iteration-goal', text: goal });
}

/**
 * Pressing a mode re-renders the board, which replaces the button that was pressed — so
 * focus moves to its replacement rather than falling to the document.
 */
function renderModeSwitch(host: BacklogViewHost, titlebar: HTMLElement, boardEl: HTMLElement): void {
	const group = titlebar.createDiv({
		cls: 'pbl-iteration-mode',
		attr: { role: 'group', 'aria-label': t('iteration.modeLabel') },
	});
	const modes = [
		{ daily: true, text: t('iteration.modeDaily'), tip: t('iteration.modeDailyTip') },
		{ daily: false, text: t('iteration.modePlanning'), tip: t('iteration.modePlanningTip') },
	];
	for (const mode of modes) {
		const btn = group.createEl('button', {
			text: mode.text,
			attr: { type: 'button', 'aria-pressed': String(host.iterationDaily === mode.daily) },
		});
		setTooltip(btn, mode.tip);
		btn.addEventListener('click', () => {
			host.setIterationDaily(mode.daily);
			// The pane, not the document: another leaf may hold an iteration board too. The
			// header is the pane's first child, so the walk stops before any card.
			boardEl.querySelector<HTMLElement>('.pbl-iteration-mode button[aria-pressed="true"]')?.focus();
		});
	}
}

/** Each part is its own sentence, so the `·` between them is a separator span, not text joined. */
function renderTimebox(meta: HTMLElement, box: Timebox): void {
	if (box.kind === 'none') return;
	const when = meta.createSpan({ cls: 'pbl-iteration-when' });
	setIcon(when.createSpan({ cls: 'pbl-iteration-icon' }), 'calendar');
	timeboxParts(box).forEach((part, i) => {
		if (i > 0) when.createSpan({ cls: 'pbl-iteration-sep', text: '·', attr: { 'aria-hidden': 'true' } });
		const el = when.createSpan({ text: part.text });
		if (part.strong) el.addClass('pbl-iteration-day');
	});
}

function timeboxParts(box: Exclude<Timebox, { kind: 'none' }>): { text: string; strong?: boolean }[] {
	switch (box.kind) {
		case 'startOnly':
			return [{ text: t('iteration.starts', { date: day(box.start) }) }];
		case 'targetOnly':
			return [{ text: t('iteration.ends', { date: day(box.target) }) }];
		case 'upcoming':
			return [span(box), { text: t('iteration.startsIn', { count: box.startsIn }) }];
		case 'ended':
			return [span(box), { text: t('iteration.endedAgo', { count: box.endedAgo }) }];
		case 'running':
			return [
				span(box),
				{ text: t('iteration.dayOf', { day: box.day, length: box.length }), strong: true },
				{ text: box.left === 0 ? t('iteration.lastDay') : t('iteration.daysLeft', { count: box.left }) },
			];
	}
}

function span(box: { start: CivilDate; target: CivilDate }): { text: string } {
	return { text: t('iteration.span', { start: day(box.start), target: day(box.target) }) };
}

function day(date: CivilDate): string {
	return formatDate('dayMonth', date.year, date.month, date.day);
}

const BUCKETS: IterationBucket[] = ['open', 'inProgress', 'resolved'];

/** Resolved and in-progress as two lengths of one bar, then the count in each bucket. */
function renderProgress(meta: HTMLElement, population: BacklogItem[], host: BacklogViewHost): void {
	const progress = iterationProgress(population, host.settings);
	const share = (n: number): string => `${progress.total === 0 ? 0 : (n / progress.total) * 100}%`;
	const el = meta.createSpan({ cls: 'pbl-iteration-progress' });
	const bar = el.createSpan({ cls: 'pbl-iteration-bar', attr: { 'aria-hidden': 'true' } });
	bar.createSpan({ cls: 'pbl-iteration-bar-resolved' }).setCssProps({ '--pbl-w': share(progress.resolved) });
	bar.createSpan({ cls: 'pbl-iteration-bar-inprogress' }).setCssProps({ '--pbl-w': share(progress.inProgress) });
	el.createSpan({ text: t('iteration.resolvedOf', { resolved: progress.resolved, total: progress.total }) });
	const buckets = meta.createSpan({ cls: 'pbl-iteration-buckets' });
	for (const bucket of BUCKETS) {
		const item = buckets.createSpan({ cls: 'pbl-iteration-bucket' });
		item.createSpan({ cls: `pbl-iteration-dot pbl-iteration-dot-${bucket}`, attr: { 'aria-hidden': 'true' } });
		item.createSpan({ text: t('iteration.bucketCount', { bucket: bucketLabel(bucket), count: progress[bucket] }) });
	}
}

/**
 * Walk the board one person at a time: a chip per person, and pressing one dims every card
 * that is not theirs. Chrome like the mode switch, so each chip is an ordinary tab stop —
 * and a press updates the board IN PLACE rather than rendering, so focus stays on it.
 */
export function renderPeopleRow(ctx: RowContext, headerEl: HTMLElement, population: BacklogItem[]): void {
	const host: BacklogViewHost = ctx.host;
	// No assignee property: everyone would be Unassigned, one chip that dims nothing.
	const people = host.settings.assigneeKey ? boardPeople(population) : [];
	if (people.length === 0) return;
	const row = headerEl.createDiv({ cls: 'pbl-iteration-people' });
	row.createSpan({ cls: 'pbl-iteration-people-label', text: t('iteration.walkLabel') });
	const chips = people.map((person) => {
		const name = person.name ?? t('iteration.unassigned');
		const btn = row.createEl('button', { cls: 'pbl-iteration-person', attr: { type: 'button' } });
		btn.createSpan({
			cls: 'pbl-iteration-avatar',
			text: person.name ? Array.from(person.name)[0].toUpperCase() : t('iteration.unassignedAvatar'),
			attr: { 'aria-hidden': 'true' },
		});
		btn.createSpan({ cls: 'pbl-iteration-person-name', text: name });
		btn.createSpan({ cls: 'pbl-iteration-count', text: formatNumber(person.count) });
		return { btn, key: person.key, name };
	});
	const sync = (): void => {
		for (const chip of chips) {
			const pressed = host.spotlight === chip.key;
			chip.btn.setAttribute('aria-pressed', String(pressed));
			// Obsidian's tooltip is also the chip's `aria-label`, which REPLACES its content as
			// the accessible name — so both states name the person.
			const params = { name: chip.name };
			setTooltip(chip.btn, pressed ? t('iteration.spotlightClear', params) : t('iteration.spotlightTip', params));
		}
	};
	const spotlight = (key: string | null): void => {
		host.setSpotlight(key);
		applySpotlight(ctx, population);
		sync();
	};
	for (const chip of chips) {
		chip.btn.addEventListener('click', () => spotlight(host.spotlight === chip.key ? null : chip.key));
		chip.btn.addEventListener('keydown', (evt) => {
			if (evt.key !== 'Escape' || host.spotlight !== chip.key) return;
			evt.preventDefault();
			evt.stopPropagation();
			spotlight(null);
		});
	}
	sync();
}

/**
 * Dim every result card that is not the spotlit person's — visual only, so no count, no
 * column and no keyboard stop changes. A context card is never dimmed: it holds nobody's
 * work on this board. A spotlight whose person has no card left here — or with no assignee
 * property at all — clears itself.
 */
export function applySpotlight(ctx: RowContext, population: BacklogItem[]): void {
	const host: BacklogViewHost = ctx.host;
	const results = population.filter((item) => !item.outsideFilter);
	const held = host.settings.assigneeKey && results.some((item) => personKey(item) === host.spotlight);
	if (host.spotlight !== null && !held) host.setSpotlight(null);
	const spot = host.spotlight;
	for (const item of results) {
		ctx.rows.get(item.file.path)?.toggleClass('pbl-spot-dim', spot !== null && personKey(item) !== spot);
	}
}
