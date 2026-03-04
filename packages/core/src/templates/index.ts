/**
 * Template engine interface.
 *
 * Templates are stored in .cept/templates/ as Markdown (page templates)
 * or YAML (database templates).
 */

/** Template types */
export type TemplateType = 'page' | 'database';

/** Template metadata */
export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  icon?: string;
  category?: string;
  path: string;
}

/** Template engine interface */
export interface TemplateEngine {
  /** List all available templates */
  listTemplates(): Promise<TemplateMeta[]>;

  /** Get a template by ID */
  getTemplate(templateId: string): Promise<TemplateMeta | null>;

  /** Create a new page/database from a template */
  applyTemplate(templateId: string, targetPath: string): Promise<void>;

  /** Save an existing page/database as a template */
  saveAsTemplate(sourcePath: string, meta: Omit<TemplateMeta, 'id' | 'path'>): Promise<string>;

  /** Delete a template */
  deleteTemplate(templateId: string): Promise<void>;
}
