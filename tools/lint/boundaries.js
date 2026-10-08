// @ts-check
/**
 * Import boundaries that Nx tags cannot express: platform modules in core and
 * ui (CLAUDE.md rule 1), concrete backends in ui (rule 3) and isomorphic-git
 * outside GitBackend (rule 5). Unlike `no-restricted-imports` this also checks
 * `import()`, re-exports and `require()`, and its baseline names single
 * imports, so a baselined file still fails on any new forbidden import.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE_FILE = path.join(ROOT, 'tools/lint/boundary-baseline.json');

/**
 * @typedef {object} Group
 * @property {string} id
 * @property {string[]} files Path prefixes (relative to the repo root) the group applies to.
 * @property {string[]} [except] Files exempt from the group.
 * @property {RegExp} modules Module specifiers the group forbids.
 * @property {string[]} [names] When set, only these named (value) imports are forbidden.
 * @property {string} message
 */

/** @type {Group[]} */
export const GROUPS = [
  {
    id: 'platform',
    files: ['packages/core/src/', 'packages/ui/src/'],
    modules: /^(node:|fs(\/|$)|path$|electron(\/|$)|electrobun(\/|$)|@capacitor\/)/,
    message: 'core and ui never import platform modules (CLAUDE.md rule 1)',
  },
  {
    id: 'isomorphic-git',
    files: ['packages/'],
    except: ['packages/core/src/storage/git-backend.ts'],
    modules: /^isomorphic-git(\/|$)/,
    message: 'only GitBackend imports isomorphic-git (CLAUDE.md rule 5)',
  },
  {
    id: 'concrete-backend',
    files: ['packages/ui/src/'],
    modules: /^@cept\/core$/,
    names: ['BrowserFsBackend', 'GitBackend', 'LocalFsBackend'],
    message: 'ui depends on StorageBackend, never a concrete backend (CLAUDE.md rule 3)',
  },
];

/**
 * @typedef {object} BaselineEntry
 * @property {string} file
 * @property {string} group
 * @property {string} module
 * @property {string} [name]
 * @property {string} removedBy
 */

/** @returns {BaselineEntry[]} */
export function readBaseline() {
  return JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).entries;
}

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** @param {string} file @returns {Group[]} */
function groupsFor(file) {
  if (TEST_FILE.test(file)) return [];
  return GROUPS.filter(
    (g) => g.files.some((prefix) => file.startsWith(prefix)) && !g.except?.includes(file),
  );
}

/** @type {import('eslint').Rule.RuleModule} */
const restrictedImports = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid imports that cross Cept architecture boundaries' },
    schema: [
      {
        type: 'object',
        properties: { baseline: { type: 'array' } },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden: '{{what}} is forbidden here: {{message}}. [{{group}}]',
    },
  },
  create(context) {
    const file = path.relative(ROOT, context.filename).split(path.sep).join('/');
    const groups = groupsFor(file);
    if (groups.length === 0) return {};
    /** @type {BaselineEntry[]} */
    const baseline = (context.options[0]?.baseline ?? []).filter(
      (/** @type {BaselineEntry} */ e) => e.file === file,
    );

    /**
     * @param {import('eslint').Rule.Node} node
     * @param {string} module
     * @param {string[] | null} names Value names imported, or null when the import is not by name.
     */
    function check(node, module, names) {
      for (const group of groups) {
        if (!group.modules.test(module)) continue;
        const hits = group.names
          ? (names ?? []).filter((n) => group.names?.includes(n))
          : [undefined];
        for (const name of hits) {
          const allowed = baseline.some(
            (e) => e.group === group.id && e.module === module && e.name === name,
          );
          if (allowed) continue;
          context.report({
            node,
            messageId: 'forbidden',
            data: {
              what: name ? `"${name}" from "${module}"` : `"${module}"`,
              message: group.message,
              group: group.id,
            },
          });
        }
      }
    }

    /** @param {any} source */
    const literal = (source) =>
      source && source.type === 'Literal' && typeof source.value === 'string' ? source.value : null;

    return {
      /** @param {any} node */
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;
        const names = node.specifiers
          .filter((/** @type {any} */ s) => s.type === 'ImportSpecifier' && s.importKind !== 'type')
          .map((/** @type {any} */ s) => s.imported.name ?? s.imported.value);
        check(node, node.source.value, names);
      },
      /** @param {any} node */
      ImportExpression(node) {
        const module = literal(node.source);
        if (module) check(node, module, null);
      },
      /** @param {any} node */
      ExportNamedDeclaration(node) {
        const module = literal(node.source);
        if (!module || node.exportKind === 'type') return;
        const names = node.specifiers
          .filter((/** @type {any} */ s) => s.exportKind !== 'type')
          .map((/** @type {any} */ s) => s.local.name ?? s.local.value);
        check(node, module, names);
      },
      /** @param {any} node */
      ExportAllDeclaration(node) {
        const module = literal(node.source);
        if (module && node.exportKind !== 'type') check(node, module, null);
      },
      /** @param {any} node */
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') return;
        const module = literal(node.arguments[0]);
        if (module) check(node, module, null);
      },
    };
  },
};

export default {
  meta: { name: 'cept-boundaries' },
  rules: { 'restricted-imports': restrictedImports },
};
