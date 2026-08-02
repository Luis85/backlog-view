import { BacklogSettings } from './settings';
import { cell, code } from './readmeText';

/**
 * The dates this view writes by itself — which states stamp them, the rows that name
 * them, and the rule that says a state change is what does it. Its own module because
 * the generated document is one file per question and this is the question with three
 * answers that have to agree: a key named, a state list that reaches it, and a rule
 * about who writes it.
 */

/**
 * Whether this view ever stamps a start, and whether it ever stamps a finish. Both ride
 * a state write (`stampWrites`), so neither fires without a state property, and a start
 * additionally needs states that count as started. The row and the rule both ask through
 * these — the key is still named when the answer is no (the backfill creates it), but
 * nothing then claims a state change writes it.
 */
const stampsStart = (s: BacklogSettings): boolean => s.stateKey !== '' && s.startedDateKey !== '' && s.startedStates.length > 0;
const stampsFinish = (s: BacklogSettings): boolean => s.stateKey !== '' && s.finishedDateKey !== '';

/**
 * The two dates the view fills in, named whenever the key is CONFIGURED rather than only
 * when a state can stamp it: the backfill stubs every configured key, so gating the row
 * on stamping would leave the view creating one this document never mentions.
 */
export function stampRows(s: BacklogSettings): string[] {
	const unstamped = ', which nothing in this view stamps — the key is only ever created empty, for you to fill';
	const row = (key: string, stamps: boolean, what: string, how: string): string =>
		`| ${cell(key)} | ${stamps ? 'Stamped by the view' : 'Yours to fill'} | The date work ${what}, ${code('YYYY-MM-DD')}${stamps ? how : unstamped} |`;
	const how = {
		started: '. Written when the state is changed **in the view** to a started one, and only while the key is empty — a date you write by hand stands',
		finished: '. Written when the state is changed **in the view** to a done one, and removed when a change there leaves one',
	};
	return [
		...(s.startedDateKey ? [row(s.startedDateKey, stampsStart(s), 'started', how.started)] : []),
		...(s.finishedDateKey ? [row(s.finishedDateKey, stampsFinish(s), 'finished', how.finished)] : []),
	];
}

/**
 * Which states start the clock, named the way the done values are. The start stamp
 * fires on entering one of them, and nothing else in the document says which they are:
 * a reader could otherwise not tell whether writing `Doing` is about to put a date on
 * their note. Like `unlistedDone`, it names values the workflow does not offer, since
 * matching runs against the configured list rather than against the table.
 */
export function startedStates(settings: BacklogSettings, stateValues: string[]): string[] {
	if (!stampsStart(settings)) return [];
	const listed = new Set(stateValues.map((v) => v.toLowerCase()));
	const unlisted = settings.startedStates.filter((v) => v && !listed.has(v.toLowerCase()));
	return [
		'',
		`Work counts as **started** at ${settings.startedStates.map(code).join(', ')} — entering one ` +
			`of those is what stamps ${code(settings.startedDateKey)}.` +
			(unlisted.length > 0
				? ` ${unlisted.map(code).join(', ')} ${unlisted.length === 1 ? 'is' : 'are'} not offered as ` +
					`${unlisted.length === 1 ? 'a state' : 'states'} here, and still counts: the stamp reads ` +
					'this list, not the workflow above.'
				: ''),
	];
}

/**
 * The stamped dates, stated as the exception they are: everything else in this document
 * is written because someone asked for it, and these two are written because a state
 * changed. A reader told only "these are the properties" would keep them by hand, or
 * read a date that moved as an edit somebody made.
 */
export function stampRule(settings: BacklogSettings): string[] {
	const keys = [stampsStart(settings) && settings.startedDateKey, stampsFinish(settings) && settings.finishedDateKey];
	const named = keys.filter((k): k is string => k !== false && k !== '');
	if (named.length === 0) return [];
	return [
		`- **${named.map(code).join(' and ')} ${named.length === 1 ? 'is' : 'are'} written for you, by a ` +
			'state change made in the view.** The one thing here written as a side effect of ' +
			'something else — and in the same edit as the state, so one undo takes back both. ' +
			'Editing the state property directly, here or in any other editor, stamps nothing: ' +
			'the dates record what the view was asked to do, so a history it never saw is a ' +
			'history it cannot write. **Assign missing properties** adds these keys *empty* to ' +
			'items that lack them, which is the one way one appears without a state change. ' +
			(stampsStart(settings)
				? 'The start is written only into an empty property, so a date you record yourself is kept. '
				: '') +
			(stampsFinish(settings)
				? 'The finish follows the boundary in both directions: reaching a done state writes it, and leaving one removes it again.'
				: ''),
	];
}

