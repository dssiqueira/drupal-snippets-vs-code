# Drupal Snippets for VS Code

Snippets for **Drupal 10, 11 and 12**: every core hook in both styles (classic procedural and the OOP `#[Hook]` attribute from Drupal 11.1), classes and plugins with PHP attributes, YAML files and Twig templates.

- **290 hooks** generated straight from the `*.api.php` files of Drupal core 11.4, with the real signatures and type hints.
- **279 OOP hook methods** with `#[Hook]` for classes in `src/Hook`.
- **63 hand-written snippets** for controllers, forms, plugins, Drush commands, tests, services, routing, libraries, Single Directory Components, Twig and more.
- Names are filled in for you: the module name comes from the file or folder (`mymodule.module`, `mymodule.routing.yml`, `.../mymodule/src/...`) and the class name from the file name.
- Every snippet is validated in CI with VS Code's own snippet parser, then linted: `php -l` for PHP, a YAML parser for YAML.

## Usage

Type a prefix and pick the snippet from the suggestions. Press <kbd>Tab</kbd> to jump between fields.

| You type | You get |
|---|---|
| `hook_form_alter` | `function mymodule_form_alter(&$form, FormStateInterface $form_state, $form_id): void` in `mymodule.module` |
| `hook_form_alter_oop` | `#[Hook('form_alter')] public function formAlter(...)` inside a hook class |
| `hook_form_FORM_ID_alter_oop` | Type `node_article_form` and the attribute and method name (`formNodeArticleFormAlter`) follow |
| `drupal_block` | A complete block plugin with the `#[Block]` attribute, namespace included |
| `drupal_route` | A route in `mymodule.routing.yml` pointing to your controller |

### Hooks

- `hook_NAME`: procedural implementation for `.module`, `.install`, `.theme` and `.inc` files.
- `hook_NAME_oop`: method with the `#[Hook]` attribute (Drupal 11.1+). Start a class with `drupal_hooks_class` in `src/Hook`; Drupal discovers it automatically.
- Hooks that Drupal still calls only procedurally (`hook_install`, `hook_update_N`, `hook_schema`, `hook_requirements`…) have no OOP version.
- Hooks deprecated in Drupal 11 and removed in Drupal 12 are not included.

## Classes, YAML and Twig

<!-- snippets:start -->
### PHP

| Prefix | Description |
|---|---|
| `drupal_hooks_class` | Class for OOP hooks in src/Hook (Drupal 11.1+). Add methods with the hook_*_oop snippets. |
| `drupal_controller` | Controller extending ControllerBase (src/Controller). |
| `drupal_form` | Form extending FormBase (src/Form). |
| `drupal_config_form` | Settings form extending ConfigFormBase with #config_target (Drupal 10.2+). Needs a config schema (drupal_config_schema). |
| `drupal_block` | Block plugin with the #[Block] attribute (Drupal 10.2+, src/Plugin/Block). |
| `drupal_event_subscriber` | Event subscriber (src/EventSubscriber). Register it with drupal_service_event_subscriber. |
| `drupal_service_class` | Service class with constructor property promotion. Register it with drupal_service. |
| `drupal_drush_command` | Drush 12+ command with attributes (src/Drush/Commands). |
| `drupal_queue_worker` | Queue worker plugin with the #[QueueWorker] attribute (Drupal 10.3+, src/Plugin/QueueWorker). |
| `drupal_field_formatter` | Field formatter plugin with the #[FieldFormatter] attribute (Drupal 10.3+, src/Plugin/Field/FieldFormatter). |
| `drupal_field_widget` | Field widget plugin with the #[FieldWidget] attribute (Drupal 10.3+, src/Plugin/Field/FieldWidget). |
| `drupal_kernel_test` | Kernel test (tests/src/Kernel). |
| `drupal_functional_test` | Functional (browser) test (tests/src/Functional). |
| `drupal_create` | Constructor + create() for controllers and forms (ContainerInjectionInterface). |
| `drupal_plugin_create` | Constructor + create() for plugins (ContainerFactoryPluginInterface). |
| `drupal_entity_load` | Load an entity by ID. |
| `drupal_entity_load_by_properties` | Load entities matching property values. |
| `drupal_entity_query` | Entity query (accessCheck() is mandatory since Drupal 10). |
| `drupal_logger` | Log a message to the module channel. |
| `drupal_messenger` | Show a message to the user. |
| `drupal_config_get` | Read a value from simple configuration. |
| `drupal_config_set` | Write a value to simple configuration. |
| `drupal_url` | Build a Url object from a route. |
| `drupal_link` | Build a Link object from a route. |
| `drupal_render_theme` | Render array using a theme hook, with cache metadata. |
| `drupal_cache_metadata` | #cache key for a render array. |
| `drupal_cache` | Read from the cache, computing and storing the value on a miss. |
| `drupal_batch` | Start a batch with BatchBuilder. |
| `drupal_access_result` | Return an AccessResult based on a permission. |

### YAML

| Prefix | Description |
|---|---|
| `drupal_info_module` | mymodule.info.yml for a module. |
| `drupal_info_theme` | mytheme.info.yml for a theme. |
| `drupal_route` | Route to a controller method (mymodule.routing.yml). |
| `drupal_route_form` | Route to a form, e.g. a settings page (mymodule.routing.yml). |
| `drupal_route_param` | Upcast a route parameter to an entity (inside a route definition). |
| `drupal_service` | Service definition with autowiring (mymodule.services.yml). |
| `drupal_service_args` | Service definition with explicit arguments (mymodule.services.yml). |
| `drupal_service_event_subscriber` | Register an event subscriber (mymodule.services.yml). |
| `drupal_library` | Asset library (mymodule.libraries.yml). |
| `drupal_permission` | Permission (mymodule.permissions.yml). |
| `drupal_menu_link` | Menu link (mymodule.links.menu.yml). |
| `drupal_local_task` | Local task / tab (mymodule.links.task.yml). |
| `drupal_local_action` | Local action button (mymodule.links.action.yml). |
| `drupal_config_schema` | Schema for simple configuration (config/schema/mymodule.schema.yml). |
| `drupal_component` | Single Directory Component metadata (components/name/name.component.yml). |

### Twig

| Prefix | Description |
|---|---|
| `drupal_t` | Translatable string with the \|t filter. |
| `drupal_trans` | {% trans %} block with a variable. |
| `drupal_attach_library` | Attach an asset library from a template. |
| `drupal_path` | Relative URL for a route. |
| `drupal_url` | Absolute URL for a route. |
| `drupal_link` | Link from text and a Url object. |
| `drupal_file_url` | Public URL for a file URI. |
| `drupal_classes` | Element with BEM-style classes added to attributes. |
| `drupal_add_class` | Add a class to attributes. |
| `drupal_create_attribute` | Create a new Attribute object. |
| `drupal_without` | Render content without some fields. |
| `drupal_if_field` | Render a block only if the field has output. |
| `drupal_format_date` | Format a timestamp with a date format. |
| `drupal_clean_class` | Make a string safe to use as a CSS class. |
| `drupal_include` | Include another template with isolated variables. |
| `drupal_component_include` | Render a Single Directory Component with props. |
| `drupal_component_embed` | Embed a Single Directory Component filling a slot. |
| `drupal_theme_asset` | Path to an asset inside the active theme. |
| `drupal_dump` | Dump available variable names (needs Twig debug). |
<!-- snippets:end -->

## File types

The extension also maps Drupal file extensions to the right language: `.module`, `.install`, `.inc`, `.profile`, `.theme` and `.engine` open as PHP, and `.twig` as Twig. For Twig syntax highlighting, install a Twig extension; these snippets work with any of them.

## Contributing

```bash
npm install
npm run check          # build snippets from src/ and validate everything (needs PHP CLI)
```

- Hand-written snippets live in `src/*.yml` (YAML block scalars, no JSON escaping). Run `npm run build` to regenerate `snippets/`.
- Hook snippets are generated from Drupal core:

  ```bash
  git clone --depth 1 --branch 11.4.12 https://github.com/drupal/core /tmp/core
  npm run generate:hooks -- /tmp/core
  ```

## License

[MIT](LICENSE)
