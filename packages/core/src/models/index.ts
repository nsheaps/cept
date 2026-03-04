/**
 * Core data models for Cept documents, databases, and blocks.
 */

/** UUID string type */
export type UUID = string;

/** ISO 8601 datetime string */
export type ISODateTime = string;

/** Page front matter */
export interface PageMeta {
  id: UUID;
  title: string;
  icon?: string;
  cover?: string;
  parent?: string;
  created: ISODateTime;
  modified: ISODateTime;
  template?: string | null;
  tags: string[];
  properties: Record<string, unknown>;
  locked?: boolean;
}

/** Block types supported by the editor */
export type BlockType =
  // Standard Markdown
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'todoList'
  | 'blockquote'
  | 'codeBlock'
  | 'horizontalRule'
  // Cept extensions
  | 'callout'
  | 'toggle'
  | 'columns'
  | 'embed'
  | 'bookmark'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'equation'
  | 'mermaid'
  | 'tableOfContents'
  | 'syncedBlock'
  | 'database'
  | 'mention'
  | 'table';

/** A block in the editor */
export interface Block {
  id: UUID;
  type: BlockType;
  content: string;
  attrs: Record<string, unknown>;
  children: Block[];
}

/** Database property types */
export type PropertyType =
  | 'title'
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'person'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'formula'
  | 'relation'
  | 'rollup'
  | 'created_time'
  | 'last_edited_time'
  | 'created_by'
  | 'last_edited_by'
  | 'files'
  | 'location';

/** Select option with color */
export interface SelectOption {
  value: string;
  color: string;
}

/** Database property definition */
export interface PropertyDefinition {
  type: PropertyType;
  options?: SelectOption[];
  format?: string;
  targetDatabase?: string;
  expression?: string;
}

/** Database view types */
export type ViewType = 'table' | 'board' | 'calendar' | 'map' | 'gallery' | 'list';

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Sort configuration */
export interface SortConfig {
  property: string;
  direction: SortDirection;
}

/** Filter operator */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal';

/** Filter configuration */
export interface FilterConfig {
  property: string;
  operator: FilterOperator;
  value: unknown;
}

/** Database view configuration */
export interface ViewConfig {
  id: string;
  name: string;
  type: ViewType;
  filter?: FilterConfig | null;
  sort?: SortConfig[];
  visibleProperties?: string[];
  groupBy?: string;
  dateProperty?: string;
  locationProperty?: string;
}

/** Database schema */
export interface DatabaseSchema {
  id: string;
  title: string;
  icon?: string;
  properties: Record<string, PropertyDefinition>;
  views: ViewConfig[];
}

/** Database row */
export interface DatabaseRow {
  id: string;
  page?: string;
  properties: Record<string, unknown>;
}

/** Location type for map view */
export interface Location {
  lat: number;
  lng: number;
  label?: string;
}
