import { useState, useCallback } from 'react';

export interface PageTreeNode {
  id: string;
  title: string;
  icon?: string;
  children: PageTreeNode[];
  isExpanded?: boolean;
}

export interface PageTreeItemProps {
  node: PageTreeNode;
  depth: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  onAdd?: (parentId: string) => void;
}

export function PageTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  onToggle,
  onAdd,
}: PageTreeItemProps) {
  const [hovered, setHovered] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isExpanded = node.isExpanded ?? false;

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

  return (
    <div data-testid={`page-tree-item-${node.id}`}>
      <button
        className={`cept-sidebar-item ${isSelected ? 'is-selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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
          {node.icon ?? '\u{1F4C4}'}
        </span>
        <span className="cept-sidebar-title">{node.title || 'Untitled'}</span>
        {hovered && (
          <span
            className="cept-sidebar-add"
            onClick={handleAdd}
            data-testid={`page-tree-add-${node.id}`}
          >
            +
          </span>
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
              onSelect={onSelect}
              onToggle={onToggle}
              onAdd={onAdd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
