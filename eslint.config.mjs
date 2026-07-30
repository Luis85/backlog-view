import tsparser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
	{
		ignores: ['main.js', 'node_modules/**', 'esbuild.config.mjs', 'version-bump.mjs', 'test/**', 'vitest.config.ts'],
	},
	...obsidianmd.configs.recommended,
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
		},
	},
]);
