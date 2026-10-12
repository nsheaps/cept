import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GitAuthRecord } from '@cept/core';
import { SpaceAuthRow } from './SpaceAuthRow.js';

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

const URL = 'https://github.com/octo/notes';

describe('SpaceAuthRow (REQ-AUTH-020)', () => {
  it('switches to another auth for the same host', () => {
    const onChange = vi.fn();
    render(
      <SpaceAuthRow
        authId="a"
        remoteUrl={URL}
        auths={[auth('a', 'alice'), auth('b', 'bob'), auth('c', 'carol', { host: 'gitlab.com' })]}
        onChange={onChange}
      />,
    );
    const select = screen.getByTestId('space-auth-select') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['@alice', '@bob']);
    expect(select.value).toBe('a');
    fireEvent.change(select, { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('only names the auth when it is the one choice', () => {
    render(
      <SpaceAuthRow authId="a" remoteUrl={URL} auths={[auth('a', 'alice')]} onChange={vi.fn()} />,
    );
    expect(screen.queryByTestId('space-auth-select')).toBeNull();
    expect(screen.getByTestId('space-auth-current').textContent).toBe('@alice');
  });

  it('shows the first working auth for a space with none chosen', () => {
    render(
      <SpaceAuthRow
        remoteUrl={URL}
        auths={[auth('a', 'alice'), auth('b', 'bob')]}
        onChange={vi.fn()}
      />,
    );
    expect((screen.getByTestId('space-auth-select') as HTMLSelectElement).value).toBe('a');
  });

  it('says so and offers the other auths when the auth was removed', () => {
    const onChange = vi.fn();
    render(
      <SpaceAuthRow
        authId="gone"
        remoteUrl={URL}
        auths={[auth('a', 'alice'), auth('b', 'bob')]}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('space-auth-lost').textContent).toContain('has been removed');
    const select = screen.getByTestId('space-auth-select') as HTMLSelectElement;
    expect(select.value).toBe('');
    fireEvent.change(select, { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('offers a single remaining auth when the space auth was rejected', () => {
    render(
      <SpaceAuthRow
        authId="a"
        remoteUrl={URL}
        auths={[auth('a', 'alice', { status: 'rejected' }), auth('b', 'bob')]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('space-auth-lost').textContent).toContain('no longer accepts');
    const options = [...(screen.getByTestId('space-auth-select') as HTMLSelectElement).options];
    expect(options.map((o) => o.textContent)).toEqual(['Choose a token…', '@bob']);
  });

  it('points to Settings > Auth when nothing can be offered', () => {
    render(<SpaceAuthRow authId="gone" remoteUrl={URL} auths={[]} onChange={vi.fn()} />);
    expect(screen.getByTestId('space-auth-lost')).toBeTruthy();
    expect(screen.getByTestId('space-auth-none').textContent).toContain('github.com');
    expect(screen.queryByTestId('space-auth-select')).toBeNull();
  });

  it("treats an auth for another host as lost and offers the right host's auths", () => {
    render(
      <SpaceAuthRow
        authId="g"
        remoteUrl={URL}
        auths={[auth('g', 'gl', { host: 'gitlab.com' }), auth('a', 'alice'), auth('b', 'bob')]}
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByTestId('space-auth-select') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Choose a token…',
      '@alice',
      '@bob',
    ]);
    expect(screen.getByTestId('space-auth-lost')).toBeTruthy();
  });
});
