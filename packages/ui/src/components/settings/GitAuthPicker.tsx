/**
 * Choose which saved git auth a new space is added with (REQ-AUTH-020). Shown
 * only when there is a choice: with one auth (or none) there is nothing to
 * pick, and the caller already names the account.
 */

import type { GitAuthRecord } from '@cept/core';

/** The working auths for `host`, in the order they were saved. */
export function authsForHost(auths: readonly GitAuthRecord[], host: string): GitAuthRecord[] {
  const wanted = host.toLowerCase();
  return auths.filter((a) => a.host.toLowerCase() === wanted && a.status === 'ok');
}

/** The host in a repository URL typed with or without a scheme, or ''. */
export function hostOfRepoUrl(url: string): string {
  const rest = url
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^[^@/]*@/, '');
  return (rest.split(/[/:]/)[0] ?? '').toLowerCase();
}

export interface GitAuthPickerProps {
  auths: readonly GitAuthRecord[];
  value: string | undefined;
  onChange: (authId: string) => void;
  /** The auth to suggest; it is marked "(Recommended)". */
  recommendedId?: string;
  label?: string;
  testId: string;
  disabled?: boolean;
}

export function GitAuthPicker({
  auths,
  value,
  onChange,
  recommendedId,
  label = 'Sign in with',
  testId,
  disabled,
}: GitAuthPickerProps) {
  if (auths.length < 2) return null;
  return (
    <label className="cept-wizard-label">
      {label}{' '}
      <select
        className="cept-wizard-input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      >
        {auths.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
            {a.id === recommendedId ? ' (Recommended)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
