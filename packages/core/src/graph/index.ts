/**
 * Knowledge Graph data model and builder interface.
 *
 * The graph builder scans all pages to extract links, mentions,
 * database relations, and tag co-occurrence to build a graph.
 */

/** Node types in the knowledge graph */
export type GraphNodeType = 'page' | 'tag' | 'attachment' | 'unresolved';

/** Edge types in the knowledge graph */
export type GraphEdgeType = 'link' | 'mention' | 'tag' | 'relation';

/** A node in the knowledge graph */
export interface GraphNode {
  id: string;
  title: string;
  path: string;
  type: GraphNodeType;
  created: string;
  connections: number;
  tags: string[];
  group?: string;
}

/** An edge in the knowledge graph */
export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
}

/** Complete graph data */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Color group for graph visualization */
export interface GraphColorGroup {
  id: string;
  query: string;
  color: string;
}

/** Graph filter configuration */
export interface GraphFilters {
  searchQuery?: string;
  showTags: boolean;
  showAttachments: boolean;
  showOrphans: boolean;
  existingFilesOnly: boolean;
  excludePatterns: string[];
  colorGroups: GraphColorGroup[];
}

/** Graph physics configuration */
export interface GraphPhysics {
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
}
