#!/usr/bin/env node
/**
 * Builds snippets/{php,yaml,twig}.json from the hand-written sources in src/.
 *
 * Sources are YAML lists so bodies can be written as literal blocks:
 *
 *   - name: Controller
 *     prefix: drupal_controller
 *     description: ...
 *     kind: file            # how the validator lints it (see validate.mjs)
 *     body: |
 *       <?php
 *       ...
 *
 * Body text is VS Code snippet syntax: escape PHP variables as \$var.
 * Macros expanded at build time:
 *   @@MODULE:n@@       tabstop n, default = module name from the file path
 *                      (.../mymodule/src/... or .../mymodule/tests/src/...)
 *   @@MODULE_FILE:n@@  tabstop n, default = module name from the file name
 *                      (mymodule.routing.yml -> mymodule)
 *   @@CLASS:n@@        tabstop n, default = file name (class name)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const SOURCES = [
	{ src: 'src/php.yml', out: 'snippets/php.json', language: 'php' },
	{ src: 'src/yaml.yml', out: 'snippets/yaml.json', language: 'yaml' },
	{ src: 'src/twig.yml', out: 'snippets/twig.json', language: 'twig' },
];

const MACROS = {
	MODULE: (n) =>
		`\${${n}:\${RELATIVE_FILEPATH/^(?:.*[\\\\\\/])?(?!tests[\\\\\\/])([^\\\\\\/]+)[\\\\\\/](?:tests[\\\\\\/])?src[\\\\\\/].*$/$1/}}`,
	MODULE_FILE: (n) => `\${${n}:\${TM_FILENAME_BASE/[.].*$//}}`,
	CLASS: (n) => `\${${n}:\${TM_FILENAME_BASE}}`,
};

export const applyMacros = (text) =>
	text.replace(/@@([A-Z_]+):(\d+)@@/g, (all, name, n) => {
		if (!MACROS[name]) throw new Error(`Unknown macro ${all}`);
		return MACROS[name](n);
	});

/** Loads a source file and returns its entries with macros applied. */
export const loadSource = (file) => {
	const doc = YAML.parseDocument(readFileSync(join(ROOT, file), 'utf8'));
	// An unquoted " #" turns the rest of a value into a YAML comment and silently
	// truncates it (e.g. "with the #[Block] attribute"). Fail instead.
	YAML.visit(doc, {
		Pair(_, pair) {
			if (pair.value?.comment) {
				throw new Error(`${file}: "${pair.key}" value is cut by a " #" comment; quote the value`);
			}
		},
	});
	const entries = doc.toJS();
	return entries.map((e) => ({ ...e, body: applyMacros(e.body.replace(/\n$/, '')) }));
};

const TITLES = { php: 'PHP', yaml: 'YAML', twig: 'Twig' };

/** Rewrites the snippet tables between the markers in README.md. */
const updateReadme = (tables) => {
	const file = join(ROOT, 'README.md');
	const readme = readFileSync(file, 'utf8');
	const start = '<!-- snippets:start -->';
	const end = '<!-- snippets:end -->';
	const i = readme.indexOf(start);
	const j = readme.indexOf(end);
	if (i < 0 || j < i) throw new Error('README.md is missing the snippets markers');
	const next = `${readme.slice(0, i + start.length)}\n${tables.trim()}\n${readme.slice(j)}`;
	if (next !== readme) writeFileSync(file, next);
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
	let tables = '';
	for (const { src, out, language } of SOURCES) {
		tables += `\n### ${TITLES[language]}\n\n| Prefix | Description |\n|---|---|\n`;
		for (const e of loadSource(src)) {
			tables += `| \`${e.prefix}\` | ${e.description.replace(/\|/g, '\\|')} |\n`;
		}
	}
	updateReadme(tables);

	for (const { src, out } of SOURCES) {
		const snippets = {};
		for (const e of loadSource(src)) {
			if (snippets[e.name]) throw new Error(`Duplicate snippet name "${e.name}" in ${src}`);
			snippets[e.name] = {
				prefix: e.prefix,
				description: e.description,
				body: e.body.split('\n'),
			};
		}
		writeFileSync(join(ROOT, out), JSON.stringify(snippets, null, '\t') + '\n');
		console.log(`${out}: ${Object.keys(snippets).length} snippets`);
	}
}
