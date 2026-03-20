# Design & Style Guide

This style guide documents Cept's visual design system — colors, typography, spacing, iconography, and interaction patterns. It serves as the single source of truth for contributors building UI, and ensures a consistent, accessible experience across all platforms and input modes.

---

## Design Philosophy

Cept's design is **content-first**. The interface stays out of the way until you need it. Every visual decision follows these principles:

1. **Minimal chrome** — Reduce visual clutter so content takes center stage
2. **Progressive disclosure** — Show controls on hover/focus, not by default
3. **Platform-native feel** — Respect OS conventions for scrolling, selection, and focus
4. **Accessibility by default** — WCAG 2.1 AA compliance is the floor, not a stretch goal
5. **Responsive without compromise** — Every feature works on every screen size and input method

---

## Color System

### Brand Colors

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Primary** | `#3b82f6` | `#60a5fa` | Buttons, links, focus rings, active states |
| **Primary Hover** | `#2563eb` | `#93bbfd` | Hover states on primary elements |
| **Primary Active** | `#1d4ed8` | `#a5b4fc` | Pressed/active states |
| **Accent** | `#6366f1` | `#818cf8` | Column resize handles, selection highlights, active indicators |
| **Accent Deep** | `#4338ca` / `#312e81` | `#312e81` | Active button backgrounds |

### Neutral Palette

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Text Primary** | `#111827` | `#e5e5e5` | Headings, body text |
| **Text Secondary** | `#6b7280` | `#a1a1aa` | Captions, metadata, placeholder |
| **Text Tertiary** | `#9ca3af` | `#71717a` | Disabled text, subtle labels |
| **Border** | `#e5e7eb` | `#404040` | Dividers, table borders, input outlines |
| **Border Subtle** | `#f3f4f6` | `#333333` | Hairline separators |
| **Surface** | `#ffffff` | `#262626` | Cards, modals, panels |
| **Surface Raised** | `#f9fafb` | `#1e1e1e` | Table headers, code blocks, inset areas |
| **Background** | `#fbfbfa` | `#1a1a1a` | Page background |

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Info** | `rgba(219, 234, 254, 0.5)` | `rgba(59, 130, 246, 0.15)` | Blue callouts, info banners |
| **Success** | `rgba(220, 252, 231, 0.5)` | `rgba(34, 197, 94, 0.15)` | Green callouts, confirmations |
| **Warning** | `rgba(254, 249, 195, 0.5)` | `rgba(234, 179, 8, 0.15)` | Yellow callouts, caution states |
| **Danger** | `rgba(254, 226, 226, 0.5)` | `rgba(239, 68, 68, 0.15)` | Red callouts, destructive actions |
| **Purple** | `rgba(243, 232, 255, 0.5)` | `rgba(168, 85, 247, 0.15)` | Purple callouts |
| **Neutral** | `rgba(235, 236, 233, 0.3)` | `rgba(255, 255, 255, 0.05)` | Default callout background |

### Syntax Highlighting

| Token | Value | Usage |
|---|---|---|
| Comment | `#a0aec0` | Code comments |
| Keyword | `#805ad5` | Language keywords |
| String | `#38a169` | String literals |
| Number | `#dd6b20` | Numeric literals |
| Type | `#d69e2e` | Type names, built-ins |
| Function | `#3182ce` | Function/method names |
| Error | `#e53e3e` | Errors, deletions |

### Inline Element Colors

| Element | Light Mode | Dark Mode |
|---|---|---|
| Page mentions | `#2383e2` | `#60a5fa` |
| Date mentions | `#e16b20` | `#f59e0b` |
| Inline code bg | `rgba(135, 131, 120, 0.15)` | `rgba(255, 255, 255, 0.1)` |
| Link text | `#2563eb` | `#60a5fa` |
| Link underline | `rgba(37, 99, 235, 0.4)` | `rgba(96, 165, 250, 0.4)` |

### Color Accessibility Requirements

- All text must meet **WCAG 2.1 AA** contrast ratios: 4.5:1 for body text, 3:1 for large text (18px+ or 14px bold)
- Interactive elements must have a **3:1** contrast ratio against their background
- Never rely on color alone to convey meaning — always pair with icons, text, or patterns
- Selection and highlight colors use alpha transparency to remain legible on any background
- Focus indicators use a visible `2px` outline with primary color, not just color change

---

## Typography

### Font Stacks

| Role | Stack | Rationale |
|---|---|---|
| **Body / UI** | System font stack (Tailwind default) | Fast load, native feel on every OS |
| **Monospace** | `'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace` | Code blocks, inline code, formulas |

Cept uses the operating system's native font rather than loading a web font. This ensures zero font-loading latency, consistent rendering with the host OS, and smaller bundle size.

### Type Scale

| Element | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| **Page Title** | `2rem` (32px) | 700 | 1.2 | Top-level page heading |
| **H1** | `2.25rem` (36px) | 700 | 1.2 | Section headings in content |
| **H2** | `1.75rem` (28px) | 600 | 1.3 | Sub-section headings |
| **H3** | `1.375rem` (22px) | 600 | 1.4 | Tertiary headings |
| **Body** | `1rem` (16px) | 400 | 1.65 | Paragraph text |
| **UI Label** | `0.8125rem` (13px) | 500 | 1.4 | Sidebar items, button labels |
| **Caption** | `0.75rem` (12px) | 400 | 1.4 | Timestamps, metadata |
| **Micro** | `0.6875rem` (11px) | 400 | 1.3 | Badges, counters |

### Typography Accessibility

- Minimum body text size is **16px** — never go smaller for paragraph content
- Line height for body text is **1.65** for comfortable reading
- Heading hierarchy must be sequential (H1 > H2 > H3) — never skip levels
- Long-form content has a maximum width of **900px** for optimal readability (~65-75 characters per line)
- Text is never disabled by reducing opacity below **0.5** — use the tertiary text color instead

---

## Spacing & Layout

### Base Grid

Cept uses a **4px base grid**. All spacing values are multiples of 4px to maintain vertical rhythm and alignment.

### Key Dimensions

| Element | Value | Notes |
|---|---|---|
| Sidebar width | `260px` | Collapsible on mobile |
| Editor max-width | `900px` | Centered with auto margins |
| Content gap | `0.75em` (12px) | Space between blocks |
| Sidebar padding | `0.5rem` (8px) | Internal padding |
| Modal width (small) | `560px` | Command palette |
| Modal width (medium) | `600px` | Search panel |
| Modal width (large) | `640px` | Settings dialog |

### Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| **> 768px** (Desktop) | Full sidebar visible, multi-column layouts available |
| **<= 767px** (Tablet / Mobile) | Sidebar becomes a fixed overlay with backdrop, single-column layouts |
| **<= 480px** (Small Mobile) | Reduced padding, compact controls, full-bleed content |

### Responsive Design Rules

1. **Sidebar**: Collapses to an overlay drawer on screens <= 767px. Dismiss on backdrop tap or navigation.
2. **Modals**: Scale to `95%` width on mobile with appropriate max-width constraints and `max-height: 85dvh`.
3. **Editor**: Stretches full-width on mobile (no max-width constraint). Padding reduces to maintain reading width.
4. **Tables**: Horizontally scrollable on narrow screens. Never break table layout.
5. **Touch targets**: All interactive elements are at minimum **44x44px** on touch interfaces (per WCAG 2.5.8).

---

## Shadows & Elevation

| Level | Value | Usage |
|---|---|---|
| **Subtle** | `0 1px 3px rgba(0, 0, 0, 0.06)` | Cards, sidebar items on hover |
| **Medium** | `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)` | Dropdown menus, tooltips |
| **Heavy** | `0 8px 32px rgba(0, 0, 0, 0.2)` | Modals, dialogs |
| **Overlay** | `0 16px 48px rgba(0, 0, 0, 0.2)` | Full-screen overlays, image lightbox |
| **Sidebar (mobile)** | `4px 0 16px rgba(0, 0, 0, 0.1)` | Sidebar overlay on mobile |

In dark mode, shadow intensity increases slightly since dark backgrounds absorb more light. Shadows use darker opacity values to remain visible.

### Border Radius

| Size | Value | Usage |
|---|---|---|
| **Small** | `3px` – `4px` | Buttons, inputs, tags |
| **Medium** | `6px` – `8px` | Modals, menus, cards |
| **Large** | `10px` | Settings dialog, feature panels |

---

## Iconography

- **Icon set**: Lucide React icons (consistent, open-source, tree-shakeable)
- **Default size**: `16px` for inline/UI icons, `20px` for standalone buttons, `24px` for empty states
- **Stroke width**: `1.5px` (Lucide default — visually balanced with text)
- **Color**: Inherits from `currentColor` so icons match surrounding text automatically
- **Page icons**: Emoji characters rendered natively — no icon font needed. Supports custom emoji as a future roadmap item.

### Icon Accessibility

- Decorative icons (next to a text label) use `aria-hidden="true"`
- Standalone icon buttons require `aria-label` describing the action
- Never use icons as the sole indicator of state — pair with text or a tooltip

---

## Interaction Patterns

### Light Mode & Dark Mode

Cept follows the operating system preference via `prefers-color-scheme`. There is no manual toggle in the current release.

**Design implications:**
- Every color must be defined for both light and dark modes — never hard-code a single value
- Test all new UI in both modes before committing
- Use semantic color tokens (e.g., "text-primary", "surface") rather than raw hex values in components
- Dark mode is not an inversion — it is a distinct palette tuned for legibility on dark backgrounds

### Motion & Animation

| Pattern | Duration | Easing | Usage |
|---|---|---|---|
| Hover transitions | `0.1s` – `0.15s` | `ease` | Background, color changes |
| Fade in/out | `0.15s` | `ease` | Drag handles, overlays |
| Save confirmation | `1.5s` | custom | Fade-in then fade-out toast |
| Loading spinner | `1s` | `linear infinite` | Progress indicators |

**Motion accessibility:**
- Respect `prefers-reduced-motion` — disable all non-essential animation when this media query matches
- Essential animations (loading spinners) should still run but may simplify (e.g., opacity pulse instead of rotation)
- Never use animation to convey information that is not also available statically

### Focus Management

- All interactive elements must be reachable via **Tab** key
- Focus order follows visual reading order (left-to-right, top-to-bottom)
- Focus indicators use a **2px solid** outline in the primary color with a **2px offset** for visibility
- Modals and dialogs trap focus — Tab cycles within the modal until dismissed
- On modal close, focus returns to the element that triggered it
- Skip-to-content link is available for keyboard users

---

## Platform-Specific Considerations

### Desktop (Keyboard & Mouse)

- **Hover states**: All interactive elements show a subtle background change on hover
- **Right-click context menus**: Available on pages, blocks, and sidebar items
- **Keyboard shortcuts**: Extensive shortcut coverage (see [Keyboard Shortcuts](keyboard-shortcuts.md))
- **Drag-and-drop**: Blocks, pages, and database rows support mouse-based drag-and-drop
- **Multi-select**: Shift+click for range selection, Cmd/Ctrl+click for individual selection
- **Resize handles**: Column widths, sidebar width, and table columns are mouse-resizable

### Tablet (Touch + Optional Keyboard)

- **Touch targets**: Minimum 44x44px for all tappable elements
- **Swipe gestures**: Swipe right to reveal sidebar, swipe left to dismiss
- **Long-press**: Triggers context menu (equivalent to right-click)
- **On-screen keyboard**: Editor adjusts viewport to keep cursor visible above the keyboard
- **Split-view**: Supports iPad Split View and Android multi-window

### Mobile (Touch-First)

- **Simplified toolbar**: Inline formatting toolbar becomes a bottom sheet
- **Sidebar**: Full-screen overlay with large touch targets
- **Block actions**: Tap-and-hold to reorder; action menu via explicit button (no hover)
- **Navigation**: Bottom navigation bar for primary sections (on very small screens)
- **Safe areas**: Respects `env(safe-area-inset-*)` for notch/rounded-corner devices

### Input Mode Adaptations

| Feature | Mouse/Keyboard | Touch |
|---|---|---|
| Block hover menu | Visible on hover | Hidden; use tap-and-hold or explicit button |
| Drag handle | Visible on block hover | Visible on block tap/focus |
| Slash command | Type `/` in editor | Type `/` or tap "+" button |
| Context menu | Right-click | Long-press |
| Text selection | Click-and-drag | Native OS selection handles |
| Resize columns | Drag border | Not available (auto-fit) |
| Tooltips | Hover delay | Not shown (info in labels) |

---

## Power User vs. Guided Experience

Cept serves both power users who prefer keyboard-driven workflows and users who prefer visual, point-and-click interaction. The design system accounts for both.

### Power User Features

- **Command palette** (`Cmd+K` / `Ctrl+K`): Search and execute any action without touching the mouse
- **Slash commands**: Type `/` to insert any block type by name
- **Keyboard shortcuts**: Every common action has a shortcut (see [Keyboard Shortcuts](keyboard-shortcuts.md))
- **Markdown shortcuts**: Type Markdown syntax directly in the editor (e.g., `##` for H2, `- [ ]` for checkbox)
- **Quick search** (`Cmd+P` / `Ctrl+P`): Jump to any page by name
- **Breadcrumb navigation**: Click any breadcrumb segment to navigate or see siblings
- **Vim-style future**: Roadmap includes optional keyboard-only navigation mode

### Guided Experience Features

- **Slash command menu**: Visual menu with icons and descriptions for every block type
- **Inline formatting toolbar**: Appears on text selection with labeled buttons
- **Block action menu**: Three-dot menu with named actions (duplicate, delete, move, etc.)
- **Drag handles**: Visible grip icon on hover/focus for visual reordering
- **Onboarding**: Demo mode pre-populates sample content to teach by example
- **Empty states**: Helpful messages with action buttons when a page or view is empty
- **Tooltips**: Keyboard shortcut hints shown alongside button tooltips

### Design Rule

> Every action must be discoverable through the GUI. Keyboard shortcuts are accelerators, never the only path. Conversely, power users must never be forced to use the mouse for common operations.

---

## Accessibility Checklist (For Contributors)

Before submitting UI changes, verify:

- [ ] **Color contrast** meets WCAG 2.1 AA (4.5:1 body text, 3:1 large text and UI elements)
- [ ] **Keyboard navigation** works for all new interactive elements (Tab, Enter, Escape, Arrow keys)
- [ ] **Focus indicator** is visible on all focusable elements
- [ ] **ARIA attributes** are correct: `aria-label` on icon buttons, `role` on custom widgets, `aria-expanded` on toggles
- [ ] **Screen reader** announces content and state changes correctly (use `role="status"` for live updates)
- [ ] **Dark mode** renders correctly with proper contrast
- [ ] **Reduced motion** is respected (`prefers-reduced-motion` disables non-essential animation)
- [ ] **Touch targets** are >= 44x44px on touch interfaces
- [ ] **Zoom**: Layout does not break at 200% browser zoom
- [ ] **Semantic HTML**: Use `<button>`, `<nav>`, `<main>`, `<section>` over generic `<div>` with roles
- [ ] **Screen reader only text**: Use `.cept-sr-only` class for content needed by assistive tech but not visually

### Existing Accessibility Patterns in the Codebase

| Pattern | Implementation | Example |
|---|---|---|
| Screen reader text | `.cept-sr-only` class | Hidden labels for icon buttons |
| Loading states | `role="status"` + `aria-label` | `<LoadingSpinner />` component |
| Breadcrumbs | `<nav aria-label="Breadcrumbs">` | Topbar breadcrumb navigation |
| Current page | `aria-current="page"` | Active breadcrumb segment |
| Decorative icons | `aria-hidden="true"` | Breadcrumb separators |
| Touch manipulation | `touch-action: manipulation` | Toggle/details elements |
| Minimum touch target | `min-height: 44px` | Toggle summaries on mobile |

---

## PWA & Branding

### Theme Meta

| Property | Value | Usage |
|---|---|---|
| Theme color | `#1a1a2e` | Browser chrome, status bar |
| Background color | `#ffffff` | Splash screen background |

### Logo & Wordmark

The Cept logo is a minimal geometric mark. Usage guidelines:

- Minimum clear space: 1x the logo height on all sides
- Minimum size: 24px height for digital, 10mm for print
- Do not stretch, rotate, or recolor the logo outside the brand palette
- On dark backgrounds, use the light variant; on light backgrounds, use the dark variant

---

## CSS Architecture

### File Organization

Styles are organized by component in co-located CSS files:

```
packages/ui/src/
├── styles/globals.css          # Imports all component styles
├── components/
│   ├── editor/editor-styles.css
│   ├── sidebar/sidebar-styles.css
│   ├── topbar/topbar-styles.css
│   ├── command-palette/command-palette-styles.css
│   ├── search/search-styles.css
│   ├── knowledge-graph/knowledge-graph-styles.css
│   ├── database/database-styles.css
│   ├── page-header/page-header-styles.css
│   ├── app-menu/app-menu-styles.css
│   ├── settings/settings-styles.css
│   └── git/git-styles.css
```

### Styling Rules

1. **Tailwind CSS v4** for utility classes. Use Tailwind utilities for layout, spacing, and simple visual properties.
2. **Component CSS files** for complex, multi-property styles. Co-locate CSS with the component it styles.
3. **No CSS-in-JS** — all styles are plain CSS or Tailwind utilities.
4. **CSS custom properties** with `--cept-` prefix for theme tokens (e.g., `var(--cept-text-primary, #333)`). Always provide a fallback value.
5. **Dark mode** via `@media (prefers-color-scheme: dark)` blocks in the same CSS file — never in a separate file.
6. **Class naming**: Use `cept-` prefix for global classes (e.g., `.cept-sr-only`, `.cept-editor-content`). Tailwind handles the rest.
7. **No `!important`** except to override third-party library defaults (TipTap, Leaflet).
8. **Transitions**: Keep durations between `0.1s` and `0.15s` for hover/focus. Longer durations (up to `0.3s`) only for layout shifts.
