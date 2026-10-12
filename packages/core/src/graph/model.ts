/**
 * The page graph model (REQ-EDT-020). Core builds it from the links between
 * pages (`link-graph.ts`); the UI's graph views draw it. This is the one graph
 * model: the UI adds only layout state on top.
 */

/** A page, or a link target that does not exist. */
export interface GraphNode {
  /** The page id: its path relative to the space root (see `space/tree.ts`). */
  id: string;
  title: string;
  icon?: string;
  /** A colour group, such as the page's top-level folder. */
  group?: string;
  /** True for a dead link's target: a page file that does not exist. */
  unresolved?: boolean;
}

/** `link`: a Markdown link from source to target. `parent`: the page tree. */
export type GraphLinkType = 'link' | 'parent';

/** An edge between two nodes, by id. */
export interface GraphLink {
  source: string;
  target: string;
  type: GraphLinkType;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
