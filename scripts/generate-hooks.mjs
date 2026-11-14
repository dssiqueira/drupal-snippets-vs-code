#!/usr/bin/env node
/**
 * Generates snippets/hooks.json from the *.api.php files of a Drupal core
 * checkout.
 *
 * Usage:
 *   git clone --depth 1 --branch 11.4.12 https://github.com/drupal/core /tmp/core
 *   node scripts/generate-hooks.mjs /tmp/core
 *
 * For every documented hook it creates:
 *   - `hook_NAME`      procedural implementation for .module/.install/.theme
 *                      files (module name taken from the file name);
 *   - `hook_NAME_oop`  method with the #[Hook] attribute (Drupal 11.1+), for
 *                      classes in src/Hook. Skipped for hooks that can only be
 *                      procedural (install/update/meta hooks).
 *
 * Hooks marked @deprecated, or announced as removed in Drupal 12, are skipped.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const corePath = process.argv[2];
if (!corePath) {
	console.error('Usage: node scripts/generate-hooks.mjs <path-to-drupal-core>');
	process.exit(1);
}

// Hooks that Drupal still only invokes procedurally.
// Source: https://www.drupal.org/node/3442349 ("Hooks that remain procedural").
const PROCEDURAL_ONLY = new Set([
	'hook_hook_info',
	'hook_module_implements_alter',
	'hook_install',
	'hook_install_tasks',
	'hook_install_tasks_alter',
	'hook_post_update_NAME',
	'hook_removed_post_updates',
	'hook_requirements',
	'hook_schema',
	'hook_uninstall',
	'hook_update_dependencies',
	'hook_update_last_removed',
	'hook_update_N',
]);

// Default values for the UPPERCASE parts of hook names. Anything else defaults
// to the token in lowercase (FORM_ID -> form_id), which keeps the generated
// method name readable (formFormIdAlter) until the user types the real value.
const TOKEN_DEFAULTS = {
	N: '11001',
	NAME: 'update_name',
};
const tokenDefault = (token) => TOKEN_DEFAULTS[token] ?? token.toLowerCase();

const coreVersion = (() => {
	try {
		const src = readFileSync(join(corePath, 'lib/Drupal.php'), 'utf8');
		return src.match(/const VERSION = '([^']+)'/)?.[1] ?? 'unknown';
	} catch {
		return 'unknown';
	}
})();

const findApiFiles = (dir) => {
	const out = [];
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'tests' || entry.startsWith('.')) continue;
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) out.push(...findApiFiles(full));
		else if (entry.endsWith('.api.php')) out.push(full);
	}
	return out;
};

/** Escapes text so VS Code inserts it literally ($, }, \ have meaning in snippets). */
const escapeSnippet = (text) => text.replace(/[\\$}]/g, (c) => `\\${c}`);

/** First sentence of a docblock, cleaned. */
const summaryOf = (doc) => {
	const lines = doc
		.split('\n')
		.map((l) => l.replace(/^\s*\*\s?/, '').trim());
	const para = [];
	for (const l of lines) {
		if (!l) {
			if (para.length) break;
			continue;
		}
		if (l.startsWith('@')) break;
		para.push(l);
	}
	return para.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Splits "form_FORM_ID_alter" into literal and token parts:
 * [{lit:'form_'}, {token:'FORM_ID'}, {lit:'_alter'}].
 */
const splitName = (name) => {
	const parts = [];
	const re = /(?<![A-Za-z0-9])[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)*(?![A-Za-z0-9])/g;
	let last = 0;
	for (const m of name.matchAll(re)) {
		if (m.index > last) parts.push({ lit: name.slice(last, m.index) });
		parts.push({ token: m[0] });
		last = m.index + m[0].length;
	}
	if (last < name.length) parts.push({ lit: name.slice(last) });
	return parts;
};

/** Builds the snippet text of a hook name, turning tokens into tabstops. */
const nameWithTabstops = (parts, firstIndex) => {
	const indexes = new Map();
	let next = firstIndex;
	const text = parts
		.map((p) => {
			if (p.lit !== undefined) return p.lit;
			if (!indexes.has(p.token)) {
				indexes.set(p.token, next++);
				return `\${${indexes.get(p.token)}:${tokenDefault(p.token)}}`;
			}
			return `\${${indexes.get(p.token)}}`;
		})
		.join('');
	return { text, indexes, next };
};

/** camelCase method name, with tokens mirrored through a pascalcase/camelcase transform. */
const methodName = (parts, indexes) => {
	let first = true;
	let out = '';
	for (const p of parts) {
		if (p.lit !== undefined) {
			for (const w of p.lit.split('_').filter(Boolean)) {
				out += first ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase();
				first = false;
			}
		} else {
			const i = indexes.get(p.token);
			out += `\${${i}/(.*)/\${1:/${first ? 'camelcase' : 'pascalcase'}}/}`;
			first = false;
		}
	}
	return out;
};

const hooks = new Map();
const skipped = [];

for (const file of findApiFiles(corePath).sort()) {
	const src = readFileSync(file, 'utf8');
	const rel = relative(corePath, file);
	const moduleMatch = rel.match(/^modules\/([^/]+)\//);
	const provider = moduleMatch ? moduleMatch[1] : 'core';

	// Docblock, optional attribute / "// phpcs" lines, then the function signature.
	const re = /\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*\n((?:\s*(?:#\[[^\n]*\]|\/\/[^\n]*)\s*\n)*)function (hook_\w+)\(([^)]*)\)\s*(?::\s*([^\s{]+))?\s*\{/g;
	for (const m of src.matchAll(re)) {
		const [, doc, , fn, params, returnType] = m;
		if (/@deprecated/.test(doc) || /will be removed in (Drupal )?12/i.test(doc)) {
			skipped.push(fn);
			continue;
		}
		if (hooks.has(fn)) continue;
		hooks.set(fn, {
			fn,
			name: fn.slice('hook_'.length),
			params: params.trim(),
			returnType: returnType ?? '',
			summary: summaryOf(doc),
			provider,
		});
	}
}

const snippets = {};
for (const hook of [...hooks.values()].sort((a, b) => a.fn.localeCompare(b.fn))) {
	const parts = splitName(hook.name);
	const params = escapeSnippet(hook.params);
	const ret = hook.returnType ? `: ${escapeSnippet(hook.returnType)}` : '';
	const where = hook.provider === 'core' ? '' : ` [${hook.provider}]`;
	const docLine = ` * Implements ${hook.fn}().`;

	// Procedural: module name defaults to the current file name (mymodule.module -> mymodule).
	const proc = nameWithTabstops(parts, 2);
	snippets[hook.fn] = {
		prefix: hook.fn,
		description: `${hook.summary}${where}`,
		body: [
			'/**',
			docLine,
			' */',
			`function \${1:\${TM_FILENAME_BASE}}_${proc.text}(${params})${ret} {`,
			'  $0',
			'}',
		],
	};

	if (!PROCEDURAL_ONLY.has(hook.fn)) {
		const oop = nameWithTabstops(parts, 1);
		snippets[`${hook.fn} (OOP)`] = {
			prefix: `${hook.fn}_oop`,
			description: `#[Hook] method (Drupal 11.1+). ${hook.summary}${where}`,
			body: [
				'/**',
				docLine,
				' */',
				`#[Hook('${oop.text}')]`,
				`public function ${methodName(parts, oop.indexes)}(${params})${ret} {`,
				'  $0',
				'}',
			],
		};
	}
}

const out = join(ROOT, 'snippets', 'hooks.json');
writeFileSync(out, JSON.stringify(snippets, null, '\t') + '\n');

const total = hooks.size;
const oop = Object.keys(snippets).length - total;
console.log(`Drupal core ${coreVersion}: ${total} hooks -> ${total} procedural + ${oop} OOP snippets (${basename(out)})`);
if (skipped.length) console.log(`Skipped (deprecated/removed in 12): ${skipped.join(', ')}`);
