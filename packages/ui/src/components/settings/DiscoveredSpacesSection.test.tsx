import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RemoteSpace } from '@cept/core';
import { DiscoveredSpacesSection } from './DiscoveredSpacesSection.js';
import type { DiscoveredSpacesState, DiscoverySnapshot } from './discovered-spaces.js';

function remote(repo: string, path: string, extra: Partial<RemoteSpace> = {}): RemoteSpace {
  return {
    repo,
    url: `https://github.com/${repo}`,
    path,
    marker: 'space.cept.yaml',
    name: path || repo.split('/')[1],
    slug: path || 'root',
    branch: 'main',
    defaultBranch: 'main',
    private: false,
    errors: [],
    warnings: [],
    ...extra,
  };
}

function snapshot(extra: Partial<DiscoverySnapshot> = {}): DiscoverySnapshot {
  return {
    login: 'octocat',
    spaces: [],
    lost: [],
    warnings: [],
    complete: true,
    checkedAt: '2026-10-08T12:00:00.000Z',
    ...extra,
  };
}

function state(extra: Partial<DiscoveredSpacesState> = {}): DiscoveredSpacesState {
  return { status: 'done', snapshot: snapshot(), error: null, refresh: vi.fn(), ...extra };
}

describe('DiscoveredSpacesSection (REQ-WS-023)', () => {
  it('lists discovered spaces without opening or pinning any of them', () => {
    const onOpen = vi.fn();
    const onPin = vi.fn();
    render(
      <DiscoveredSpacesSection
        discovered={state({
          snapshot: snapshot({
            spaces: [remote('ann/notes', 'docs', { name: 'Docs' }), remote('ann/wiki', '')],
          }),
        })}
        addedSpaceIds={new Set()}
        onOpen={onOpen}
        onPin={onPin}
      />,
    );
    const docs = screen.getByTestId('discovered-space-github.com/ann/notes@main/docs');
    expect(docs.textContent).toContain('Docs');
    expect(docs.textContent).toContain('ann/notes/docs');
    expect(screen.getByTestId('discovered-space-github.com/ann/wiki@main')).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onPin).not.toHaveBeenCalled();
  });

  it('opens or pins the chosen space', () => {
    const onOpen = vi.fn();
    const onPin = vi.fn();
    const docs = remote('ann/notes', 'docs');
    render(
      <DiscoveredSpacesSection
        discovered={state({ snapshot: snapshot({ spaces: [docs] }) })}
        addedSpaceIds={new Set()}
        onOpen={onOpen}
        onPin={onPin}
      />,
    );
    fireEvent.click(screen.getByTestId('discovered-pin-github.com/ann/notes@main/docs'));
    expect(onPin).toHaveBeenCalledWith(docs);
    fireEvent.click(screen.getByTestId('discovered-open-github.com/ann/notes@main/docs'));
    expect(onOpen).toHaveBeenCalledWith(docs);
  });

  it('leaves out spaces already on this device, matching the declared branch', () => {
    render(
      <DiscoveredSpacesSection
        discovered={state({
          snapshot: snapshot({
            spaces: [remote('ann/notes', 'docs'), remote('ann/notes', 'team', { branch: 'cept' })],
          }),
        })}
        addedSpaceIds={new Set(['github.com/ann/notes@cept/team'])}
      />,
    );
    expect(screen.getByTestId('discovered-space-github.com/ann/notes@main/docs')).toBeTruthy();
    expect(screen.queryByTestId('discovered-space-github.com/ann/notes@cept/team')).toBeNull();
  });

  it('says so when every space found is already on this device', () => {
    render(
      <DiscoveredSpacesSection
        discovered={state({ snapshot: snapshot({ spaces: [remote('ann/wiki', '')] }) })}
        addedSpaceIds={new Set(['github.com/ann/wiki@main'])}
      />,
    );
    expect(screen.getByTestId('discovered-empty').textContent).toContain('already on this device');
  });

  it('cannot open or pin a space whose marker has errors, and shows why', () => {
    const bad = remote('ann/notes', 'bad', { errors: ['The marker has no slug.'] });
    render(
      <DiscoveredSpacesSection
        discovered={state({ snapshot: snapshot({ spaces: [bad] }) })}
        addedSpaceIds={new Set()}
        onOpen={vi.fn()}
        onPin={vi.fn()}
      />,
    );
    const id = 'github.com/ann/notes@main/bad';
    expect((screen.getByTestId(`discovered-open-${id}`) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId(`discovered-pin-${id}`) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId(`discovered-errors-${id}`).textContent).toContain('no slug');
  });

  it('flags lost spaces that are on this device and ignores the others', () => {
    render(
      <DiscoveredSpacesSection
        discovered={state({
          snapshot: snapshot({
            lost: [
              { space: remote('ann/gone', ''), reason: 'access' },
              { space: remote('ann/other', ''), reason: 'removed' },
            ],
          }),
        })}
        addedSpaceIds={new Set(['github.com/ann/gone@main'])}
      />,
    );
    const lost = screen.getByTestId('discovered-lost-github.com/ann/gone@main');
    expect(lost.textContent).toContain('can no longer read');
    expect(lost.textContent).toContain('copy on this device is kept');
    expect(screen.queryByTestId('discovered-lost-github.com/ann/other@main')).toBeNull();
  });

  it('says when the rate limit stopped discovery, and lists skipped repositories', () => {
    render(
      <DiscoveredSpacesSection
        discovered={state({
          snapshot: snapshot({
            complete: false,
            warnings: [
              { kind: 'access', repo: 'ann/secret', message: 'ann/secret could not be read' },
              { kind: 'rate-limited', message: 'rate limit' },
            ],
          }),
        })}
        addedSpaceIds={new Set()}
      />,
    );
    expect(screen.getByTestId('discovered-incomplete')).toBeTruthy();
    const notes = screen.getByTestId('discovered-warnings');
    expect(notes.textContent).toContain('1 note');
    expect(notes.textContent).toContain('ann/secret could not be read');
  });

  it('shows progress before the first result, errors, and looks again on request', () => {
    const refresh = vi.fn();
    const { rerender } = render(
      <DiscoveredSpacesSection
        discovered={state({ status: 'running', snapshot: null, refresh })}
        addedSpaceIds={new Set()}
      />,
    );
    expect(screen.getByTestId('discovered-running')).toBeTruthy();
    expect((screen.getByTestId('discovered-refresh') as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <DiscoveredSpacesSection
        discovered={state({ status: 'error', snapshot: null, error: 'offline', refresh })}
        addedSpaceIds={new Set()}
      />,
    );
    expect(screen.getByTestId('discovered-error').textContent).toContain('offline');
    fireEvent.click(screen.getByTestId('discovered-refresh'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
