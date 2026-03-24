import type React from 'react';
import type { ThemeMode } from './SettingsModal.js';

const MODES: ThemeMode[] = ['dark', 'system', 'light'];

const LABELS: Record<ThemeMode, string> = {
  dark: 'Dark',
  system: 'System',
  light: 'Light',
};

// Moon icon
function MoonIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ opacity: active ? 1 : 0.4 }}>
      <path d="M13.5 8.5a5.5 5.5 0 01-7-7A5.5 5.5 0 1013.5 8.5z" />
    </svg>
  );
}

// Computer/monitor icon
function MonitorIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ opacity: active ? 1 : 0.4 }}>
      <rect x="1.5" y="2" width="13" height="9" rx="1.5" />
      <path d="M5.5 14h5M8 11v3" />
    </svg>
  );
}

// Sun icon
function SunIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ opacity: active ? 1 : 0.4 }}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </svg>
  );
}

const ICONS: Record<ThemeMode, (active: boolean) => React.JSX.Element> = {
  dark: (a) => <MoonIcon active={a} />,
  system: (a) => <MonitorIcon active={a} />,
  light: (a) => <SunIcon active={a} />,
};

export interface ThemeToggleProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  /** Compact variant for use in menus */
  compact?: boolean;
}

export function ThemeToggle({ value, onChange, compact }: ThemeToggleProps) {
  const idx = MODES.indexOf(value);

  return (
    <div
      className={`cept-theme-toggle ${compact ? 'cept-theme-toggle--compact' : ''}`}
      role="radiogroup"
      aria-label="Theme mode"
      data-testid="theme-toggle"
    >
      <div className="cept-theme-toggle-track">
        <div
          className="cept-theme-toggle-thumb"
          style={{ transform: `translateX(${idx * 100}%)` }}
        />
        {MODES.map((mode) => (
          <button
            key={mode}
            className={`cept-theme-toggle-option ${value === mode ? 'is-active' : ''}`}
            onClick={() => onChange(mode)}
            role="radio"
            aria-checked={value === mode}
            aria-label={LABELS[mode]}
            title={LABELS[mode]}
            data-testid={`theme-toggle-${mode}`}
          >
            {ICONS[mode](value === mode)}
          </button>
        ))}
      </div>
    </div>
  );
}
