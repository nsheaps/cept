import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GitAuthRecord } from '@cept/core';
import { GitAuthPicker, authsForHost } from './GitAuthPicker.js';

function auth(id: string, login: string, extra: Partial<GitAuthRecord> = {}): GitAuthRecord {
  return {
    id,
    host: 'github.com',
    username: 'x-access-token',
    label: `@${login}`,
    status: 'ok',
    createdAt: '2026-01-01T00:00:00.000Z',
    account: { login, name: null, avatarUrl: '' },
    grants: { kind: 'classic', scopes: ['repo'] },
    ...extra,
  };
}

describe('authsForHost (REQ-AUTH-020)', () => {
  it('keeps the working auths of the host, oldest first', () => {
    const list = [
      auth('a', 'alice'),
      auth('b', 'bob', { status: 'rejected' }),
      auth('c', 'carol', { host: 'git.example.com' }),
      auth('d', 'dave'),
    ];
    expect(authsForHost(list, 'github.com').map((a) => a.id)).toEqual(['a', 'd']);
  });

  it('matches the host without case', () => {
    expect(authsForHost([auth('a', 'alice')], 'GitHub.com')).toHaveLength(1);
  });
});

describe('GitAuthPicker (REQ-AUTH-020)', () => {
  it('shows nothing when there is at most one auth to choose', () => {
    const { container, rerender } = render(
      <GitAuthPicker auths={[]} value={undefined} onChange={vi.fn()} testId="p" />,
    );
    expect(container.textContent).toBe('');
    rerender(
      <GitAuthPicker auths={[auth('a', 'alice')]} value="a" onChange={vi.fn()} testId="p" />,
    );
    expect(container.textContent).toBe('');
  });

  it('lists the auths, recommends one, and reports the choice', () => {
    const onChange = vi.fn();
    render(
      <GitAuthPicker
        auths={[auth('a', 'alice'), auth('b', 'bob')]}
        value="a"
        recommendedId="a"
        onChange={onChange}
        testId="p"
      />,
    );
    const select = screen.getByTestId('p') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['@alice (Recommended)', '@bob']);
    expect(select.value).toBe('a');
    fireEvent.change(select, { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('names the picker for assistive technology', () => {
    render(
      <GitAuthPicker
        auths={[auth('a', 'alice'), auth('b', 'bob')]}
        value="a"
        onChange={vi.fn()}
        testId="p"
        label="Sign in with"
      />,
    );
    expect(screen.getByLabelText('Sign in with')).toBeTruthy();
  });
});
