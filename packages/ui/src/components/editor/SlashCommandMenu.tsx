import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, useCallback } from 'react';
import type { SlashCommandItem } from './extensions/slash-command.js';

export interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // The menu lists items grouped by category, and a category's items need not be
    // contiguous in `items`; the highlight and the click index follow the grouped order.
    const { grouped, ordered } = useMemo(() => {
      const byCategory = new Map<string, SlashCommandItem[]>();
      for (const item of items) {
        const list = byCategory.get(item.category) ?? [];
        list.push(item);
        byCategory.set(item.category, list);
      }
      return { grouped: byCategory, ordered: Array.from(byCategory.values()).flat() };
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = ordered[index];
        if (item) {
          command(item);
        }
      },
      [ordered, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
          return true;
        }

        if (event.key === 'Enter') {
          // With nothing to choose, Enter belongs to the editor (a newline).
          if (items.length === 0) return false;
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="cept-slash-menu" data-testid="slash-command-menu">
          <div className="cept-slash-menu-empty">No results</div>
        </div>
      );
    }

    let flatIndex = 0;

    return (
      <div className="cept-slash-menu" data-testid="slash-command-menu">
        {Array.from(grouped.entries()).map(([category, categoryItems]) => (
          <div key={category} className="cept-slash-menu-group">
            <div className="cept-slash-menu-category">{category}</div>
            {categoryItems.map((item) => {
              const currentIndex = flatIndex++;
              return (
                <button
                  key={item.title}
                  className={`cept-slash-menu-item ${
                    currentIndex === selectedIndex ? 'is-selected' : ''
                  }`}
                  onClick={() => selectItem(currentIndex)}
                  data-testid={`slash-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span className="cept-slash-menu-icon">{item.icon}</span>
                  <div className="cept-slash-menu-text">
                    <span className="cept-slash-menu-title">{item.title}</span>
                    <span className="cept-slash-menu-description">{item.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);

SlashCommandMenu.displayName = 'SlashCommandMenu';
