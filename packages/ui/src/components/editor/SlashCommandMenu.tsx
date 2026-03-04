import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';
import type { SlashCommandItem } from './extensions/slash-command.js';

export interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [items, command],
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) =>
          prev <= 0 ? items.length - 1 : prev - 1,
        );
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) =>
          prev >= items.length - 1 ? 0 : prev + 1,
        );
        return true;
      }

      if (event.key === 'Enter') {
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

  // Group items by category
  const grouped = new Map<string, SlashCommandItem[]>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
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
                  <span className="cept-slash-menu-description">
                    {item.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';
