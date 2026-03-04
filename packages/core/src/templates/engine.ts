/**
 * Template engine implementation.
 *
 * Templates are stored in `.cept/templates/` within the workspace.
 * Each template is a directory containing:
 *   - meta.yaml  — template metadata (name, description, type, icon, category)
 *   - content.md — page template content (for page templates)
 *   - schema.yaml — database schema (for database templates)
 *
 * When applying a template, the engine copies the content to the target path,
 * replacing placeholder variables ({{title}}, {{date}}, {{id}}).
 */
import type { StorageBackend } from '../storage/backend.js';
import type { TemplateEngine, TemplateMeta } from './index.js';

const TEMPLATES_DIR = '.cept/templates';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Read a text file from the backend, returning string or null. */
async function readText(backend: StorageBackend, path: string): Promise<string | null> {
  const data = await backend.readFile(path);
  if (!data) return null;
  return decoder.decode(data);
}

/** Write a text string to the backend. */
async function writeText(backend: StorageBackend, path: string, content: string): Promise<void> {
  await backend.writeFile(path, encoder.encode(content));
}

/** Parse a simple YAML-like key: value file (no nesting needed for manifests). */
function parseSimpleYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      result[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

/** Serialize a simple key-value object to YAML. */
function serializeSimpleYaml(data: Record<string, string | undefined>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join('\n') + '\n';
}

/** Generate a short unique ID. */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Replace template variables in content. */
function replaceVariables(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export class CeptTemplateEngine implements TemplateEngine {
  constructor(private backend: StorageBackend) {}

  async listTemplates(): Promise<TemplateMeta[]> {
    const templatesExist = await this.backend.exists(TEMPLATES_DIR);
    if (!templatesExist) return [];

    const entries = await this.backend.listDirectory(TEMPLATES_DIR);
    const templates: TemplateMeta[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory) continue;

      const metaPath = `${TEMPLATES_DIR}/${entry.name}/meta.yaml`;
      const metaContent = await readText(this.backend, metaPath);
      if (!metaContent) continue;

      const parsed = parseSimpleYaml(metaContent);

      templates.push({
        id: entry.name,
        name: parsed['name'] ?? entry.name,
        description: parsed['description'] ?? '',
        type: (parsed['type'] as 'page' | 'database') ?? 'page',
        icon: parsed['icon'],
        category: parsed['category'],
        path: `${TEMPLATES_DIR}/${entry.name}`,
      });
    }

    return templates;
  }

  async getTemplate(templateId: string): Promise<TemplateMeta | null> {
    const metaPath = `${TEMPLATES_DIR}/${templateId}/meta.yaml`;
    const metaContent = await readText(this.backend, metaPath);
    if (!metaContent) return null;

    const parsed = parseSimpleYaml(metaContent);

    return {
      id: templateId,
      name: parsed['name'] ?? templateId,
      description: parsed['description'] ?? '',
      type: (parsed['type'] as 'page' | 'database') ?? 'page',
      icon: parsed['icon'],
      category: parsed['category'],
      path: `${TEMPLATES_DIR}/${templateId}`,
    };
  }

  async applyTemplate(templateId: string, targetPath: string): Promise<void> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const vars: Record<string, string> = {
      title: targetPath.split('/').pop()?.replace(/\.\w+$/, '') ?? 'Untitled',
      date: new Date().toISOString().split('T')[0],
      id: generateId(),
      datetime: new Date().toISOString(),
    };

    if (template.type === 'page') {
      const contentPath = `${TEMPLATES_DIR}/${templateId}/content.md`;
      const content = await readText(this.backend, contentPath);
      if (!content) {
        throw new Error(`Template content not found: ${contentPath}`);
      }

      const processed = replaceVariables(content, vars);
      await writeText(this.backend, targetPath, processed);
    } else {
      const schemaPath = `${TEMPLATES_DIR}/${templateId}/schema.yaml`;
      const schema = await readText(this.backend, schemaPath);
      if (!schema) {
        throw new Error(`Template schema not found: ${schemaPath}`);
      }

      const processed = replaceVariables(schema, vars);
      await writeText(this.backend, targetPath, processed);
    }
  }

  async saveAsTemplate(
    sourcePath: string,
    meta: Omit<TemplateMeta, 'id' | 'path'>,
  ): Promise<string> {
    const id = generateId();
    const templateDir = `${TEMPLATES_DIR}/${id}`;

    // Write meta.yaml
    const metaYaml = serializeSimpleYaml({
      name: meta.name,
      description: meta.description,
      type: meta.type,
      icon: meta.icon,
      category: meta.category,
    });
    await writeText(this.backend, `${templateDir}/meta.yaml`, metaYaml);

    // Copy source content as binary (preserves encoding)
    const sourceData = await this.backend.readFile(sourcePath);
    if (!sourceData) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    if (meta.type === 'page') {
      await this.backend.writeFile(`${templateDir}/content.md`, sourceData);
    } else {
      await this.backend.writeFile(`${templateDir}/schema.yaml`, sourceData);
    }

    return id;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const templateDir = `${TEMPLATES_DIR}/${templateId}`;
    const exists = await this.backend.exists(templateDir);
    if (!exists) return;

    // Delete all files in the template directory
    const entries = await this.backend.listDirectory(templateDir);
    for (const entry of entries) {
      await this.backend.deleteFile(`${templateDir}/${entry.name}`);
    }

    // Delete the directory itself
    try {
      await this.backend.deleteFile(templateDir);
    } catch {
      // Some backends may not support deleting empty directories
    }
  }
}
