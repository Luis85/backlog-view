---
type: PBI
parent: "[[Every surface translated]]"
order: 20
status: Open
---

# Menus, modals and notices

The surfaces the user reads while deciding or after acting: 16 sites in `menu.ts`, 13 in
`ui/prompts.ts`, 8 in `backlogView.ts`, and the 14 `new Notice(...)` calls spread over
six files.

## What is here

**Context menu** — `Open in new tab`, `Open to the right`, `Clear parent link`, `Use
folder position`, the four move commands, `Outdent`, and the three submenus `Set state`,
`Edit tags`, `Set type`. The menu is also where the context-row rule shows: `Set type`,
`Set state` and the parent-link actions are *withheld* for an `outsideFilter` row. That
must stay a withheld item, not a translated-but-disabled one.

**Modals** (`ui/prompts.ts`) — the new-item modal's `Type`, `Title` and `Folder`
settings, the `Create` button, the placeholders (`Item title`, `Backlog`, `Sprint-12`),
the `Add tag` title, and the detail line that tells the user where the item will land
before they confirm.

**Notices** — every one of the 14, including the config gate's
`Fix the view options first: <problem>`, the filter refusal
(`That change would edit a note outside this base's filter, so nothing was written.`),
`Still applying the previous change — try again in a moment.`, `Nothing to undo.`, the
undo summary assembled from parts in `undo.ts:94-99`, and the two `See the developer
console for details.` failures.

**Command and view names** (`main.ts`) — the `Create backlog` command and the
`Product Backlog` view name registered with `registerBasesView`. Both are resolved once
at `onload`, which is correct: Obsidian needs a restart to change language.

## Acceptance criteria

- The new-item modal's detail line stays *true* at the moment of confirming — it is a
  function of the chosen type, not a fixed string, and translating it must not turn it
  back into one. `test/view/creation.test.ts` already guards the honesty of this line.
- The undo summary is one message per outcome, not English fragments joined with `'; '`.
  It has two counted clauses today (`conflicts`, `missing`), both with inline plural
  ternaries.
- `Fix the view options first: <problem>` takes the problem as a parameter, and the
  problem itself is translated — see `View options and config warnings`, which is where
  `configProblems` stops returning prose.
- Menu item order and the withheld-for-context-row set are unchanged. The
  `contextRowWrites` suite must pass untouched.
- The plugin name is not translated. Obsidian prefixes command names with it in the
  palette, and it is the plugin's identity in the community list.
- Notices that name a file quote the file's real name, never a translated one.
