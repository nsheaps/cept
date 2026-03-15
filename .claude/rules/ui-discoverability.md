# UI Discoverability Rule

## Command Palette is a Power-User Feature

The command palette is a convenience shortcut for power users. It must NEVER be the only way to access functionality.

## Requirements

1. **Every command palette action MUST have a clickable UI equivalent** — a button, menu item, or other tappable/clickable element that is visible and reachable without opening the command palette.
2. **The clickable equivalent MUST work across all form factors**: desktop, tablet, and mobile. Responsive layouts should ensure the control remains accessible on smaller screens (e.g., collapsing into a menu or toolbar overflow rather than disappearing entirely).
3. **The command palette should be equally fully featured** — it mirrors the UI, not the other way around. Any action available via a button or menu should also be available in the command palette.
4. **Discoverability over memorability** — new users should be able to find every feature through visible UI elements. Keyboard shortcuts and the command palette are accelerators, not gates.
5. **No "palette-only" features** — if a feature exists only in the command palette and has no clickable UI surface, it is a bug. File an issue and fix it before shipping.
