#!/usr/bin/env node
/**
 * Validates every snippet shipped in snippets/*.json:
 *   1. structure (prefix, body, description) and unique prefixes per language;
 *   2. parses the body with VS Code's own snippet parser and rejects unknown
 *      variables (an unescaped PHP "$var" shows up as a VS Code variable);
 *   3. expands the snippet with all defaults and lints the result:
 *      PHP with `php -l`, YAML with a YAML parser, Twig by checking delimiters.
 *
 * Exits with code 1 on any error.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { expand } from './lib/expand.mjs';
import { SOURCES, loadSource } from './build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// Values used for VS Code variables while expanding.
const CONTEXT = {
	php: {
		TM_FILENAME_BASE: 'ExampleClass',
		RELATIVE_FILEPATH: 'web/modules/custom/mymodule/src/Form/ExampleClass.php',
	},
	phpModuleFile: { TM_FILENAME_BASE: 'mymodule', RELATIVE_FILEPATH: 'web/modules/custom/mymodule/mymodule.module' },
	yaml: { TM_FILENAME_BASE: 'mymodule.routing', RELATIVE_FILEPATH: 'web/modules/custom/mymodule/mymodule.routing.yml' },
	twig: { TM_FILENAME_BASE: 'node--article.html', RELATIVE_FILEPATH: 'web/themes/custom/mytheme/templates/node--article.html.twig' },
};

// How each hand-written PHP snippet must be wrapped to be linted.
const kinds = new Map();
for (const { src, language } of SOURCES) {
	if (language !== 'php') continue;
	for (const e of loadSource(src)) kinds.set(e.prefix, e.kind);
}
const phpKind = (prefix) => {
	if (kinds.has(prefix)) return kinds.get(prefix);
	if (prefix.startsWith('hook_')) return prefix.endsWith('_oop') ? 'member' : 'function';
	return undefined;
};
const wrapPhp = (code, kind) => {
	switch (kind) {
		case 'file':
			return code;
		case 'function':
			return `<?php\n${code}\n`;
		// Members and statements may use parent::, static:: and $this, so they are
		// linted inside a class with a (never loaded) parent.
		case 'member':
			return `<?php\nuse Drupal\\Core\\Hook\\Attribute\\Hook;\nfinal class LintWrapper extends LintParent {\n${code}\n}\n`;
		case 'statement':
			return `<?php\nfinal class LintWrapper extends LintParent {\npublic function lint() {\n${code}\n}\n}\n`;
		case 'expression':
			return `<?php\n$lint = ${code};\n`;
		case 'array_item':
			return `<?php\n$lint = [\n${code}\n];\n`;
		default:
			throw new Error(`unknown kind "${kind}"`);
	}
};

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const phpJobs = [];
let count = 0;

const files = pkg.contributes.snippets;
const prefixesByLanguage = new Map();

for (const { language, path } of files) {
	const file = path.replace(/^\.\//, '');
	let data;
	try {
		data = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
	} catch (e) {
		fail(file, `invalid JSON: ${e.message}`);
		continue;
	}
	const seen = prefixesByLanguage.get(language) ?? new Map();
	prefixesByLanguage.set(language, seen);

	for (const [name, s] of Object.entries(data)) {
		count++;
		const where = `${file} > ${name}`;
		if (typeof s.prefix !== 'string' || !s.prefix) fail(where, 'missing prefix');
		if (!Array.isArray(s.body) || !s.body.length) fail(where, 'missing body');
		if (typeof s.description !== 'string' || !s.description.trim()) fail(where, 'missing description');
		if (seen.has(s.prefix)) fail(where, `prefix "${s.prefix}" also used by "${seen.get(s.prefix)}"`);
		seen.set(s.prefix, name);
		if (!Array.isArray(s.body)) continue;

		const isProceduralHook = file.endsWith('hooks.json') && !s.prefix.endsWith('_oop');
		const ctx =
			language === 'php' ? (isProceduralHook ? CONTEXT.phpModuleFile : CONTEXT.php) : CONTEXT[language];
		const { text, unknownVariables } = expand(s.body.join('\n'), ctx);
		if (unknownVariables.length) {
			fail(where, `unknown snippet variable(s) ${unknownVariables.map((v) => `$${v}`).join(', ')} (escape PHP variables as \\$)`);
		}
		if (/\$\{|\$\d/.test(text)) fail(where, `unexpanded snippet syntax left in output:\n${text}`);

		if (language === 'php') {
			const kind = phpKind(s.prefix);
			if (!kind) fail(where, 'no lint kind');
			else phpJobs.push({ where, code: wrapPhp(text, kind) });
		} else if (language === 'yaml') {
			try {
				YAML.parse(text, { strict: true, uniqueKeys: true });
			} catch (e) {
				fail(where, `invalid YAML: ${e.message}\n${text}`);
			}
		} else if (language === 'twig') {
			for (const [open, close] of [['{{', '}}'], ['{%', '%}']]) {
				const o = text.split(open).length - 1;
				const c = text.split(close).length - 1;
				if (o !== c) fail(where, `unbalanced ${open} ${close} (${o} vs ${c})\n${text}`);
			}
		}
	}
}

// Lint all PHP in one php process per file, in parallel batches.
const php = spawnSync('php', ['--version'], { encoding: 'utf8' });
if (php.status !== 0) {
	fail('php', 'PHP CLI not found; cannot lint PHP snippets');
} else {
	const dir = mkdtempSync(join(tmpdir(), 'drupal-snippets-'));
	try {
		phpJobs.forEach((job, i) => {
			job.file = join(dir, `s${i}.php`);
			writeFileSync(job.file, job.code);
		});
		for (const job of phpJobs) {
			const r = spawnSync('php', ['-l', job.file], { encoding: 'utf8' });
			if (r.status !== 0) {
				const msg = (r.stdout + r.stderr).replace(new RegExp(job.file, 'g'), 'snippet').trim();
				fail(job.where, `${msg}\n${job.code}`);
			}
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

const total = [...prefixesByLanguage.values()].reduce((n, m) => n + m.size, 0);
if (errors.length) {
	console.error(errors.join('\n\n'));
	console.error(`\n${errors.length} error(s) in ${count} snippets.`);
	process.exit(1);
}
console.log(`OK: ${total} snippets validated (${phpJobs.length} PHP linted with ${php.stdout.split('\n')[0]}).`);
