import { BacklogItem, BacklogModel, inPlan } from './model';
import { ownWorkflowReading } from './board';
import { inCatalog, isMarkerType } from './itemTypes';
import { ResourceNote } from './readItems';
import { ScopeRow, scopeRows } from './scopeRows';

/**
 * The picked person, looked up on the ROSTER rather than in `byPath`.
 *
 * `divertResource` keeps a `Resource` note on `model.resources` and returns null instead
 * of a `BacklogItem`, which is the whole of "a person is not in the backlog" — so a
 * person's path is never a key in `byPath`, and a guard asking `byPath` about a valid
 * pick answers no every time. The roster is short (one entry per declared person), so a
 * scan is the right shape and no second index has to be kept in step.
 *
 * Takes a NULLABLE model, `resourceLabelsOf`'s own shape and for its reason: "no model
 * yet" is one answer given once here rather than a null test at each call site, and the
 * two callers that ask this question — the view's body and its toolbar — must ask it
 * identically or a control outlives the screen it belongs to.
 */
export function pickedResource(model: BacklogModel | null, personPath: string): ResourceNote | null {
	return model?.resources.find((person) => person.file.path === personPath) ?? null;
}

/**
 * Whose work this item is — the assignee link's own TARGET, never its text.
 *
 * The note, because [[The roster comes from the notes]] made a resource a note rather than
 * a name: two spellings of one person must not be two people, and a value resolving to
 * nothing names nobody this view can draw a tree for.
 */
export function assignedTo(item: BacklogItem, personPath: string): boolean {
	return item.assigneeEntry?.file?.path === personPath;
}

/**
 * One person's tree — of every type, per [[My work]]. The membership predicate widens the
 * population past `inPlan` alone: `inPlan` refuses the whole test catalog ladder
 * (`inCatalog` — a `Test suite`, a `Test case`, and a `Task` chained onto either), and a
 * test case somebody is assigned is still work they do. The union with `inCatalog` admits
 * that ladder while changing nothing about the other two `inPlan` refuses: a `Release`
 * and an `Iteration` are containers work is put IN rather than work somebody does, so
 * `inPlan`'s own refusal of them stands, and `isMarkerType` refuses every marker (a
 * `Milestone` included) the same way it always has. The marker refusal and this union are
 * `inIteration`'s own three refusals minus `outsideFilter` — placement is not membership,
 * and `scopeRows` answers that one itself, in the one place both screens read it from.
 */
export function assignedRows(model: BacklogModel, personPath: string): ScopeRow[] {
	return scopeRows(model, (item) => !isMarkerType(item.typeName) && (inPlan(item) || inCatalog(item)) && assignedTo(item, personPath));
}

/**
 * What is next: the first unfinished MEMBER in plan order, because plan order already says
 * what the product owner ranked highest. There is no personal rank — a second `order` per
 * person is a second ranking graph, and this register refuses those.
 *
 * Never a context row. The walk goes THROUGH one and never stops on it: a row the Base
 * excluded is not actionable, so offering it as what to do next would name the one row
 * this surface also refuses to write to.
 */
export function nextAssigned(rows: ScopeRow[]): ScopeRow | null {
	return rows.find((row) => !row.context && !ownWorkflowReading(row.item).done) ?? null;
}
