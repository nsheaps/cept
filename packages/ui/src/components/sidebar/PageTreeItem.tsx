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
  onDragStartPage,
  onDragEndPage,
  onReorder,
  onNudge,
}: PageTreeItemProps) {
  const [hovered, setHovered] = useState(false);
  const [dropAt, setDropAt] = useState<'before' | 'after' | null>(null);
  const draggable = !readOnly && !node.foreign && !node.noPage && !!onReorder;
  const positionOf = (e: React.DragEvent): 'before' | 'after' => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  };
  const droppable = (): boolean =>
    !!draggedId && draggedId !== node.id && !!canDrop?.(draggedId, node.id);
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
          if (!droppable()) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropAt(positionOf(e));
        }}
        onDragLeave={() => setDropAt(null)}
        onDrop={(e) => {
          if (!droppable() || !draggedId) return;
          e.preventDefault();
          const position = positionOf(e);
          setDropAt(null);
          onReorder?.(draggedId, node.id, position);
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
              onDragStartPage={onDragStartPage}
              onDragEndPage={onDragEndPage}
              onReorder={onReorder}
              onNudge={onNudge}
            />
          ))}
        </div>
      )}
    </div>
  );
}
