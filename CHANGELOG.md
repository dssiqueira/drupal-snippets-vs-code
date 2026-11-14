# Changelog

## 1.0.0 - 2026-11-13

The extension is back, rebuilt for Drupal 10, 11 and 12. It keeps its ID, so existing installs update in place.

### Added
- All 290 core hooks generated from the Drupal 11.4 API files, with real signatures, type hints and return types.
- OOP versions (`hook_NAME_oop`) of 279 hooks with the `#[Hook]` attribute (Drupal 11.1+).
- 29 PHP snippets: hook class, controller, forms (including `ConfigFormBase` with `#config_target`), block/queue worker/field plugins with attributes, event subscriber, service, Drush 12+ command, kernel and functional tests, dependency injection, entity load/query, logger, config, cache, batch and more.
- 15 YAML snippets: module/theme info, routes, services, event subscribers, libraries, permissions, menu links, local tasks/actions, config schema and Single Directory Components.
- 19 Twig snippets: translation, libraries, URLs, attributes and classes, components (`include`/`embed`) and common filters.
- Module and class names filled in from the file name or path.
- Validation in CI: every snippet is parsed with VS Code's snippet parser and the result is linted (`php -l`, YAML parser).
- Automatic publishing to the VS Code Marketplace and Open VSX.

### Changed
- Display name: "Drupal 8 Snippets" → "Drupal Snippets".
- Procedural hooks now use the module name instead of a literal `hook_` prefix.
- PHP variables in snippets are escaped correctly.
- Minimum VS Code version: 1.80.

### Removed
- Hooks deprecated in Drupal 11 and removed in Drupal 12.
- Drupal 7 file associations (`.info`, `.make`, `.test`).

## 0.0.2 - 2018-03-27
- Hooks for Drupal 8.6.x.
