/**
 * The page graph: links between pages and the graph built from them
 * (REQ-EDT-018, REQ-EDT-020, D-32).
 */

export type { GraphData, GraphLink, GraphLinkType, GraphNode } from './model.js';
export {
  extractDestinations,
  extractLinks,
  resolveLink,
  resolvePath,
  baseFileOfPage,
  pageIdForPath,
  headingSlugs,
} from './links.js';
export type { Destination, ExtractedLink, ResolvedLink } from './links.js';
export { buildLinkGraph, backlinksOf, readLinkGraph } from './link-graph.js';
export type { LinkGraph, LinkGraphOptions, LinkGraphPage, PageReference } from './link-graph.js';
export { mapPath, planLinkRewrites, rewriteLinks } from './rewrite.js';
export type { LinkRewrite } from './rewrite.js';
