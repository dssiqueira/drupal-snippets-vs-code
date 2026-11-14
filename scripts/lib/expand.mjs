/**
 * Expands a VS Code snippet body to the text VS Code would insert with all
 * defaults accepted, using VS Code's own snippet parser (shipped in
 * monaco-editor). Used by the validator to lint the generated code.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// monaco-editor's "exports" map hides its internals, so load the file by path.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const parserPath = join(ROOT, 'node_modules/monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetParser.js');
const { SnippetParser, Text, Placeholder, Variable, Choice } = await import(pathToFileURL(parserPath).href);

/** Variables VS Code resolves in snippets. Anything else is a typo or an unescaped "$". */
export const KNOWN_VARIABLES = new Set([
	'TM_SELECTED_TEXT', 'TM_CURRENT_LINE', 'TM_CURRENT_WORD', 'TM_LINE_INDEX', 'TM_LINE_NUMBER',
	'TM_FILENAME', 'TM_FILENAME_BASE', 'TM_DIRECTORY', 'TM_FILEPATH', 'RELATIVE_FILEPATH',
	'CLIPBOARD', 'WORKSPACE_NAME', 'WORKSPACE_FOLDER', 'CURSOR_INDEX', 'CURSOR_NUMBER',
	'CURRENT_YEAR', 'CURRENT_YEAR_SHORT', 'CURRENT_MONTH', 'CURRENT_MONTH_NAME', 'CURRENT_MONTH_NAME_SHORT',
	'CURRENT_DATE', 'CURRENT_DAY_NAME', 'CURRENT_DAY_NAME_SHORT', 'CURRENT_HOUR', 'CURRENT_MINUTE',
	'CURRENT_SECOND', 'CURRENT_SECONDS_UNIX', 'CURRENT_TIMEZONE_OFFSET', 'RANDOM', 'RANDOM_HEX', 'UUID',
	'BLOCK_COMMENT_START', 'BLOCK_COMMENT_END', 'LINE_COMMENT',
]);

/**
 * @param {string} body Snippet body (lines joined with "\n").
 * @param {Record<string,string>} vars Values for VS Code variables.
 * @returns {{ text: string, unknownVariables: string[], placeholders: number[] }}
 */
export function expand(body, vars) {
	const snippet = new SnippetParser().parse(body, true, true);
	const unknownVariables = [];
	snippet.walk((m) => {
		if (m instanceof Variable && !KNOWN_VARIABLES.has(m.name)) unknownVariables.push(m.name);
		return true;
	});
	snippet.resolveVariables({ resolve: (v) => vars[v.name] });

	// The default value of a tabstop is defined by its first occurrence with content.
	const values = new Map();
	const render = (m) => {
		if (m instanceof Text) return m.value;
		if (m instanceof Choice) return m.options[0].value;
		if (m instanceof Placeholder) {
			const base = values.has(m.index) ? values.get(m.index) : m.children.map(render).join('');
			return m.transform ? m.transform.resolve(base) : base;
		}
		if (m instanceof Variable) return m.children.length ? m.children.map(render).join('') : m.name;
		return m.children.map(render).join('');
	};
	for (const p of snippet.placeholders) {
		if (!values.has(p.index) && p.children.length) values.set(p.index, p.children.map(render).join(''));
	}

	return {
		text: snippet.children.map(render).join(''),
		unknownVariables,
		placeholders: [...new Set(snippet.placeholders.map((p) => p.index))].sort((a, b) => a - b),
	};
}
