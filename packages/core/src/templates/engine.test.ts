import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend } from '../storage/browser-fs.js';
import { CeptTemplateEngine } from './engine.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Helper to write text to the backend. */
async function writeText(backend: BrowserFsBackend, path: string, content: string) {
  await backend.writeFile(path, enc.encode(content));
}

/** Helper to read text from the backend. */
async function readText(backend: BrowserFsBackend, path: string): Promise<string> {
  const data = await backend.readFile(path);
  if (!data) throw new Error(`File not found: ${path}`);
  return dec.decode(data);
}

describe('CeptTemplateEngine', () => {
  let backend: BrowserFsBackend;
  let engine: CeptTemplateEngine;

  beforeEach(async () => {
    backend = new BrowserFsBackend(`test-templates-${Date.now()}-${Math.random()}`);
    await backend.initialize({ name: 'test-workspace' });
    engine = new CeptTemplateEngine(backend);
  });

  afterEach(async () => {
    await backend.close();
  });

  describe('listTemplates', () => {
    it('returns empty array when no templates exist', async () => {
      const templates = await engine.listTemplates();
      expect(templates).toEqual([]);
    });

    it('lists templates with metadata', async () => {
      await writeText(backend, '.cept/templates/meeting-notes/meta.yaml',
        'name: Meeting Notes\ndescription: Template for meeting notes\ntype: page\nicon: notes\ncategory: work\n');
      await writeText(backend, '.cept/templates/meeting-notes/content.md',
        '# {{title}}\n\n**Date:** {{date}}\n\n## Attendees\n\n## Action Items\n');

      const templates = await engine.listTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('meeting-notes');
      expect(templates[0].name).toBe('Meeting Notes');
      expect(templates[0].description).toBe('Template for meeting notes');
      expect(templates[0].type).toBe('page');
      expect(templates[0].icon).toBe('notes');
      expect(templates[0].category).toBe('work');
    });
  });

  describe('getTemplate', () => {
    it('returns null for non-existent template', async () => {
      const template = await engine.getTemplate('nonexistent');
      expect(template).toBeNull();
    });

    it('returns template metadata', async () => {
      await writeText(backend, '.cept/templates/daily-log/meta.yaml',
        'name: Daily Log\ndescription: Daily journal entry\ntype: page\n');
      await writeText(backend, '.cept/templates/daily-log/content.md', '# {{date}} Log\n');

      const template = await engine.getTemplate('daily-log');
      expect(template).not.toBeNull();
      expect(template!.name).toBe('Daily Log');
      expect(template!.type).toBe('page');
    });
  });

  describe('applyTemplate', () => {
    it('creates a page from a page template with variable substitution', async () => {
      await writeText(backend, '.cept/templates/note/meta.yaml',
        'name: Note\ndescription: Simple note\ntype: page\n');
      await writeText(backend, '.cept/templates/note/content.md',
        '---\ntitle: {{title}}\ncreated: {{datetime}}\n---\n\n# {{title}}\n\nCreated on {{date}}.\n');

      await engine.applyTemplate('note', 'pages/my-note.md');

      const content = await readText(backend, 'pages/my-note.md');
      expect(content).toContain('# my-note');
      expect(content).toContain('title: my-note');
      expect(content).not.toContain('{{title}}');
      expect(content).not.toContain('{{date}}');
    });

    it('creates a database from a database template', async () => {
      await writeText(backend, '.cept/templates/task-db/meta.yaml',
        'name: Task Tracker\ndescription: Project tasks\ntype: database\n');
      await writeText(backend, '.cept/templates/task-db/schema.yaml',
        'id: {{id}}\ntitle: {{title}}\nproperties:\n  status:\n    type: select\n');

      await engine.applyTemplate('task-db', '.cept/databases/tasks.yaml');

      const content = await readText(backend, '.cept/databases/tasks.yaml');
      expect(content).not.toContain('{{id}}');
      expect(content).toContain('title: tasks');
    });

    it('throws for non-existent template', async () => {
      await expect(engine.applyTemplate('nonexistent', 'pages/test.md'))
        .rejects.toThrow('Template not found');
    });
  });

  describe('saveAsTemplate', () => {
    it('saves a page as a template and returns the ID', async () => {
      await writeText(backend, 'pages/my-page.md',
        '---\ntitle: My Page\n---\n\n# My Page\n\nSome content here.\n');

      const id = await engine.saveAsTemplate('pages/my-page.md', {
        name: 'My Template',
        description: 'Saved from my page',
        type: 'page',
      });

      expect(id).toBeTruthy();

      const template = await engine.getTemplate(id);
      expect(template).not.toBeNull();
      expect(template!.name).toBe('My Template');

      const content = await readText(backend, `.cept/templates/${id}/content.md`);
      expect(content).toContain('# My Page');
    });

    it('saves a database schema as a template', async () => {
      await writeText(backend, '.cept/databases/projects.yaml',
        'id: proj-db\ntitle: Projects\nproperties:\n  name:\n    type: title\n');

      const id = await engine.saveAsTemplate('.cept/databases/projects.yaml', {
        name: 'Projects DB',
        description: 'Project tracking',
        type: 'database',
        icon: 'chart',
      });

      const template = await engine.getTemplate(id);
      expect(template!.type).toBe('database');
      expect(template!.icon).toBe('chart');

      const schema = await readText(backend, `.cept/templates/${id}/schema.yaml`);
      expect(schema).toContain('Projects');
    });
  });

  describe('deleteTemplate', () => {
    it('deletes an existing template', async () => {
      await writeText(backend, '.cept/templates/to-delete/meta.yaml',
        'name: Temp\ndescription: Will be deleted\ntype: page\n');
      await writeText(backend, '.cept/templates/to-delete/content.md', '# Temp\n');

      await engine.deleteTemplate('to-delete');

      const template = await engine.getTemplate('to-delete');
      expect(template).toBeNull();
    });

    it('does nothing for non-existent template', async () => {
      await engine.deleteTemplate('nonexistent');
    });
  });

  describe('roundtrip', () => {
    it('save then apply produces equivalent content', async () => {
      const originalContent = '# Project Plan\n\n## Goals\n\n- Goal 1\n- Goal 2\n';
      await writeText(backend, 'pages/project.md', originalContent);

      const id = await engine.saveAsTemplate('pages/project.md', {
        name: 'Project Plan',
        description: 'Planning template',
        type: 'page',
      });

      await engine.applyTemplate(id, 'pages/new-project.md');

      const applied = await readText(backend, 'pages/new-project.md');
      expect(applied).toBe(originalContent);
    });
  });
});
