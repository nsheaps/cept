import { useState, useCallback, useEffect, useRef } from 'react';

export interface CommandItem {
  id: string;
  title: string;
  icon?: string;
  category: string;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  items: CommandItem[];
  onClose: () => void;
}

export function CommandPalette({ isOpen, items, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filterCommands(items, query);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [filtered, selectedIndex, onClose],
  );

  if (!isOpen) return null;

  const grouped = groupByCategory(filtered);

  return (
    <div className="cept-command-overlay" onClick={onClose} data-testid="command-palette-overlay">
      <div
        className="cept-command-palette"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        <input
          ref={inputRef}
          className="cept-command-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          data-testid="command-input"
        />
        <div className="cept-command-list" data-testid="command-list">
          {filtered.length === 0 ? (
            <div className="cept-command-empty" data-testid="command-empty">
              No results found
            </div>
          ) : (
            grouped.map(([category, groupItems]) => (
              <div key={category}>
                <div className="cept-command-category">{category}</div>
                {groupItems.map((item) => {
                  const globalIndex = filtered.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      className={`cept-command-item ${globalIndex === selectedIndex ? 'is-selected' : ''}`}
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      data-testid={`command-item-${item.id}`}
                    >
                      {item.icon && <span className="cept-command-icon">{item.icon}</span>}
                      <span>{item.title}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function filterCommands(items: CommandItem[], query: string): CommandItem[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q),
  );
}

function groupByCategory(items: CommandItem[]): [string, CommandItem[]][] {
  const groups = new Map<string, CommandItem[]>();
  for (const item of items) {
    const existing = groups.get(item.category);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.category, [item]);
    }
  }
  return Array.from(groups.entries());
}
