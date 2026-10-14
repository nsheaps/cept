import { useState, useCallback } from 'react';

export interface PageTreeNode {
  id: string;
  title: string;
  icon?: string;
  cover?: string;
  /** Sort position among siblings, from the page's `order` front matter (REQ-NTN-012). */
  order?: number;
  children: PageTreeNode[];
  isExpanded?: boolean;
  /** A file that is not a page (an image, a PDF): previewed read-only, no page actions. */
  foreign?: boolean;
  /** A folder with no page of its own: it has no file to hold an `order`. */
  noPage?: boolean;
  /** Open comments on the page, when it has any (REQ-NTN-008). */
  comments?: number;
}

export interface PageTreeItemProps {
  node: PageTreeNode;
  depth: number;
  selectedId?: string;
  readOnly?: boolean;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  onAdd?: (parentId: string) => void;
  onContextMenu?: (
    id: string,
    title: string,
    position: { x: number; y: number },
    foreign?: boolean,
  ) => void;
  /** The page being dragged, if any, so rows can show where it would land. */
  draggedId?: string | null;
  /** Whether `draggedId` may be dropped next to `targetId` (same parent). */
  canDrop?: (draggedId: string, targetId: string) => boolean;
  onDragStartPage?: (id: string) => void;
  onDragEndPage?: () => void;
  /** Move `id` just before or after `targetId`, among the same siblings. */
  onReorder?: (id: string, targetId: string, position: 'before' | 'after') => void;
  /** Whether `draggedId` may be nested under `targetId` (dropped on the middle of its row). */
  canNest?: (draggedId: string, targetId: string) => boolean;
  /** Move `id` into the page `targetId`. */
  onMoveInto?: (id: string, targetId: string) => void;
  /** Keyboard reorder: Alt+Up / Alt+Down moves `id` one place. */
  onNudge?: (id: string, direction: -1 | 1) => void;
}

export function PageTreeItem({
  node,
  depth,
  selectedId,
  readOnly,
  onSelect,
  onToggle,
  onAdd,
  onContextMenu,
  draggedId,
  canDrop,
  canNest,
  onDragStartPage,
  onDragEndPage,
  onReorder,
  onMoveInto,
  onNudge,
}: PageTreeItemProps) {
  const [hovered, setHovered] = useState(false);
  const [dropAt, setDropAt] = useState<'before' | 'after' | 'into' | null>(null);
  const draggable = !readOnly && (!!onMoveInto || (!node.foreign && !node.noPage && !!onReorder));
  const canSort = (): boolean =>
    !!draggedId && draggedId !== node.id && !!canDrop?.(draggedId, node.id);
  const canMove = (): boolean => !!draggedId && !!canNest?.(draggedId, node.id);
  /**
   * Where a drop on this row lands: the top and bottom quarters place the page
   * before or after it (among the same siblings); the middle nests it under this
   * page. Pages that are not siblings can only nest.
   */
  const dropFor = (e: React.DragEvent): 'before' | 'after' | 'into' | null => {
    const sort = canSort();
    const move = canMove();
    if (!sort && !move) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / (rect.height || 1);
    if (move && (!sort || (y >= 0.25 && y <= 0.75))) return 'into';
    return y < 0.5 ? 'before' : 'after';
  };
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isExpanded = node.isExpanded ?? false;
  const showActions = !readOnly && !node.foreign && (hovered || isSelected);

  const handleClick = useCallback(() => {
    onSelect?.(node.id);
  }, [node.id, onSelect]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle?.(node.id);
    },
    [node.id, onToggle],
  );

  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAdd?.(node.id);
    },
    [node.id, onAdd],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(node.id, node.title, { x: e.clientX, y: e.clientY }, node.foreign);
    },
    [node.id, node.title, node.foreign, onContextMenu],
  );

  return (
    <div data-testid={`page-tree-item-${node.id}`}>
      <button
        className={`cept-sidebar-item ${isSelected ? 'is-selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', node.id);
          onDragStartPage?.(node.id);
        }}
        onDragEnd={() => {
          setDropAt(null);
          onDragEndPage?.();
        }}
        onDragOver={(e) => {
          const drop = dropFor(e);
          if (!drop) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropAt(drop);
        }}
        onDragLeave={() => setDropAt(null)}
        onDrop={(e) => {
          const drop = dropFor(e);
          if (!drop || !draggedId) return;
          e.preventDefault();
          setDropAt(null);
          if (drop === 'into') onMoveInto?.(draggedId, node.id);
          else onReorder?.(draggedId, node.id, drop);
        }}
        onKeyDown={(e) => {
          if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
          if (readOnly || node.foreign || node.noPage || !onNudge) return;
          e.preventDefault();
          onNudge(node.id, e.key === 'ArrowUp' ? -1 : 1);
        }}
        data-drop={dropAt ?? undefined}
        data-testid={`page-tree-button-${node.id}`}
      >
        <span
          className={`cept-sidebar-toggle ${hasChildren ? '' : 'invisible'}`}
          onClick={handleToggle}
          data-testid={`page-tree-toggle-${node.id}`}
        >
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
        <span className="cept-sidebar-icon">
          {node.icon ?? (node.foreign ? '\u{1F4CE}' : '\u{1F4C4}')}
        </span>
        <span className="cept-sidebar-title">{node.title || 'Untitled'}</span>
        {node.comments !== undefined && node.comments > 0 && (
          <span
            className="cept-sidebar-comments"
            title={`${node.comments} open ${node.comments === 1 ? 'comment' : 'comments'}`}
            aria-label={`${node.comments} open ${node.comments === 1 ? 'comment' : 'comments'}`}
            data-testid={`page-tree-comments-${node.id}`}
          >
            {'\u{1F4AC}'} {node.comments}
          </span>
        )}
        {showActions && (
          <>
            <span
              className="cept-sidebar-add"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                onContextMenu?.(node.id, node.title, { x: rect.left, y: rect.bottom });
              }}
              title="More actions"
              data-testid={`page-tree-menu-${node.id}`}
            >
              ···
            </span>
            <span
              className="cept-sidebar-add"
              onClick={handleAdd}
              data-testid={`page-tree-add-${node.id}`}
            >
              +
            </span>
          </>
        )}
      </button>
      {isExpanded && hasChildren && (
        <div data-testid={`page-tree-children-${node.id}`}>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              readOnly={readOnly}
              onSelect={onSelect}
              onToggle={onToggle}
              onAdd={onAdd}
              onContextMenu={onContextMenu}
              draggedId={draggedId}
              canDrop={canDrop}
              canNest={canNest}
              onDragStartPage={onDragStartPage}
              onDragEndPage={onDragEndPage}
              onReorder={onReorder}
              onMoveInto={onMoveInto}
              onNudge={onNudge}
            />
          ))}
        </div>
      )}
    </div>
  );
}
