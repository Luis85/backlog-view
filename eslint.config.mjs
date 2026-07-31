import tsparser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

/**
 * The layers, outermost first. Each may reach anything below it and nothing above:
 *
 *   main → commands → view → storage → domain
 *                       ↘________________↗
 *
 * `ui` is a leaf of reusable Obsidian dialogs that knows about none of them. The
 * rules below are what keep this a fact rather than an aspiration — a layering
 * documented only in prose is one commit away from being wrong.
 */
const forbidden = (layer, groups, reason) => ({
	files: [`src/${layer}/**/*.ts`],
	rules: {
		'no-restricted-imports': [
			'error',
			{ patterns: [{ group: groups.flatMap((g) => [`**/${g}/*`, `**/${g}/**/*`]), message: reason }] },
		],
	},
});

export default defineConfig([
	{
		ignores: ['main.js', 'node_modules/**', 'esbuild.config.mjs', 'version-bump.mjs', 'test/**', 'vitest.config.ts'],
	},
	...obsidianmd.configs.recommended,
	forbidden(
		'domain',
		['view', 'storage', 'ui', 'commands'],
		'domain/ is the backlog itself: tree shape, ranking, config. It may read the vault but must not reach the DOM, the writer or the plugin shell — that is what keeps it testable without Obsidian.',
	),
	forbidden(
		'storage',
		['view', 'ui', 'commands'],
		'storage/ persists what it is given. It may use domain types but must not reach into the view or the plugin shell.',
	),
	forbidden('ui', ['view', 'commands', 'domain', 'storage'], 'ui/ holds standalone dialogs; it must stay free of app structure.'),
	forbidden('view', ['commands'], 'The view is mounted by the plugin shell, not the other way round.'),
	{
		// The single most important rule in this codebase, made checkable: every
		// mutation of the vault goes through storage/, so the write-safety invariants
		// can be verified by reading one directory instead of trusting every call site.
		files: ['src/**/*.ts'],
		ignores: ['src/storage/**/*.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "MemberExpression[property.name='processFrontMatter']",
					message: 'All frontmatter writes go through src/storage/frontmatter.ts (applyWrites / createBacklogItem).',
				},
				{
					selector: "CallExpression[callee.property.name='create'][callee.object.property.name='vault']",
					message: 'Creating files in the vault belongs in src/storage/ (createBacklogItem / createBacklogBase).',
				},
				{
					selector: "MemberExpression[property.name=/^(save|load)LocalStorage$/]",
					message: 'Persisted view state goes through src/storage/collapseStore.ts.',
				},
			],
		},
	},
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: './tsconfig.json' },
		},
		rules: {
			// Un-awaited promises around frontmatter writes silently reorder the vault;
			// force every async call site to await or explicitly void.
			'@typescript-eslint/no-floating-promises': 'error',
			// Size and complexity budgets keep modules focused and reviewable.
			'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
			complexity: ['error', 16],
			'max-depth': ['error', 4],
			'max-params': ['error', 5],
		},
	},
]);
