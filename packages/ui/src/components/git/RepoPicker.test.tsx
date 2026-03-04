import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepoPicker } from './RepoPicker.js';
import type { RepoInfo } from '@cept/core';

const mockUser = {
  login: 'octocat',
  name: 'Octocat',
  avatarUrl: 'https://avatars.github.com/u/1',
};

const mockRepos: RepoInfo[] = [
  {
    name: 'notes',
    fullName: 'octocat/notes',
    url: 'https://github.com/octocat/notes',
    httpsUrl: 'https://github.com/octocat/notes.git',
    sshUrl: 'git@github.com:octocat/notes.git',
    private: false,
    description: 'My notes workspace',
    defaultBranch: 'main',
  },
  {
    name: 'private-docs',
    fullName: 'octocat/private-docs',
    url: 'https://github.com/octocat/private-docs',
    httpsUrl: 'https://github.com/octocat/private-docs.git',
    sshUrl: 'git@github.com:octocat/private-docs.git',
    private: true,
    description: 'Private documentation',
    defaultBranch: 'main',
  },
  {
    name: 'project',
    fullName: 'org/project',
    url: 'https://github.com/org/project',
    httpsUrl: 'https://github.com/org/project.git',
    sshUrl: 'git@github.com:org/project.git',
    private: false,
    defaultBranch: 'develop',
  },
];

describe('RepoPicker', () => {
  describe('unauthenticated state', () => {
    it('renders sign-in prompt when no user', () => {
      render(<RepoPicker user={null} repos={[]} />);
      expect(screen.getByTestId('repo-picker')).toBeDefined();
      expect(screen.getByTestId('repo-picker-auth')).toBeDefined();
      expect(screen.getByTestId('repo-picker-message')).toBeDefined();
    });

    it('shows sign-in button', () => {
      const onSignIn = vi.fn();
      render(<RepoPicker user={null} repos={[]} onSignIn={onSignIn} />);
      const btn = screen.getByTestId('repo-picker-signin');
      expect(btn.textContent).toContain('Sign in');
    });

    it('calls onSignIn when button clicked', () => {
      const onSignIn = vi.fn();
      render(<RepoPicker user={null} repos={[]} onSignIn={onSignIn} />);
      fireEvent.click(screen.getByTestId('repo-picker-signin'));
      expect(onSignIn).toHaveBeenCalledOnce();
    });
  });

  describe('authenticated state', () => {
    it('shows user info', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      expect(screen.getByTestId('repo-picker-username').textContent).toBe('Octocat');
      expect(screen.getByTestId('repo-picker-avatar')).toBeDefined();
    });

    it('uses login when name is null', () => {
      render(<RepoPicker user={{ ...mockUser, name: null }} repos={mockRepos} />);
      expect(screen.getByTestId('repo-picker-username').textContent).toBe('octocat');
    });

    it('shows sign-out button', () => {
      const onSignOut = vi.fn();
      render(<RepoPicker user={mockUser} repos={mockRepos} onSignOut={onSignOut} />);
      fireEvent.click(screen.getByTestId('repo-picker-signout'));
      expect(onSignOut).toHaveBeenCalledOnce();
    });
  });

  describe('repository list', () => {
    it('renders all repos', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      expect(screen.getByTestId('repo-picker-item-octocat/notes')).toBeDefined();
      expect(screen.getByTestId('repo-picker-item-octocat/private-docs')).toBeDefined();
      expect(screen.getByTestId('repo-picker-item-org/project')).toBeDefined();
    });

    it('shows private badge on private repos', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      const item = screen.getByTestId('repo-picker-item-octocat/private-docs');
      expect(item.textContent).toContain('Private');
    });

    it('shows description when present', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      const item = screen.getByTestId('repo-picker-item-octocat/notes');
      expect(item.textContent).toContain('My notes workspace');
    });

    it('shows default branch', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      const item = screen.getByTestId('repo-picker-item-org/project');
      expect(item.textContent).toContain('develop');
    });

    it('calls onSelectRepo when repo clicked', () => {
      const onSelectRepo = vi.fn();
      render(<RepoPicker user={mockUser} repos={mockRepos} onSelectRepo={onSelectRepo} />);
      fireEvent.click(screen.getByTestId('repo-picker-item-octocat/notes'));
      expect(onSelectRepo).toHaveBeenCalledWith(mockRepos[0]);
    });
  });

  describe('search', () => {
    it('filters repos by name', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      fireEvent.change(screen.getByTestId('repo-picker-search'), { target: { value: 'notes' } });
      expect(screen.getByTestId('repo-picker-item-octocat/notes')).toBeDefined();
      expect(screen.queryByTestId('repo-picker-item-org/project')).toBeNull();
    });

    it('filters repos by description', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      fireEvent.change(screen.getByTestId('repo-picker-search'), { target: { value: 'documentation' } });
      expect(screen.getByTestId('repo-picker-item-octocat/private-docs')).toBeDefined();
      expect(screen.queryByTestId('repo-picker-item-octocat/notes')).toBeNull();
    });

    it('shows empty state when no matches', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      fireEvent.change(screen.getByTestId('repo-picker-search'), { target: { value: 'zzz-nothing' } });
      expect(screen.getByTestId('repo-picker-empty')).toBeDefined();
    });
  });

  describe('visibility filter', () => {
    it('filters by public repos', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      fireEvent.click(screen.getByTestId('repo-picker-filter-public'));
      expect(screen.getByTestId('repo-picker-item-octocat/notes')).toBeDefined();
      expect(screen.queryByTestId('repo-picker-item-octocat/private-docs')).toBeNull();
    });

    it('filters by private repos', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      fireEvent.click(screen.getByTestId('repo-picker-filter-private'));
      expect(screen.getByTestId('repo-picker-item-octocat/private-docs')).toBeDefined();
      expect(screen.queryByTestId('repo-picker-item-octocat/notes')).toBeNull();
    });

    it('shows all when all filter selected', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      fireEvent.click(screen.getByTestId('repo-picker-filter-private'));
      fireEvent.click(screen.getByTestId('repo-picker-filter-all'));
      expect(screen.getByTestId('repo-picker-item-octocat/notes')).toBeDefined();
      expect(screen.getByTestId('repo-picker-item-octocat/private-docs')).toBeDefined();
    });

    it('marks active filter', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      expect(screen.getByTestId('repo-picker-filter-all').className).toContain('is-active');
      fireEvent.click(screen.getByTestId('repo-picker-filter-public'));
      expect(screen.getByTestId('repo-picker-filter-public').className).toContain('is-active');
    });
  });

  describe('loading state', () => {
    it('shows loading indicator', () => {
      render(<RepoPicker user={mockUser} repos={[]} loading={true} />);
      expect(screen.getByTestId('repo-picker-loading')).toBeDefined();
    });

    it('hides loading when not loading', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} loading={false} />);
      expect(screen.queryByTestId('repo-picker-loading')).toBeNull();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      render(<RepoPicker user={mockUser} repos={[]} error="Failed to load repos" />);
      expect(screen.getByTestId('repo-picker-error').textContent).toBe('Failed to load repos');
    });

    it('hides error when null', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} />);
      expect(screen.queryByTestId('repo-picker-error')).toBeNull();
    });
  });

  describe('refresh', () => {
    it('shows refresh button', () => {
      const onRefresh = vi.fn();
      render(<RepoPicker user={mockUser} repos={mockRepos} onRefresh={onRefresh} />);
      expect(screen.getByTestId('repo-picker-refresh')).toBeDefined();
    });

    it('calls onRefresh when clicked', () => {
      const onRefresh = vi.fn();
      render(<RepoPicker user={mockUser} repos={mockRepos} onRefresh={onRefresh} />);
      fireEvent.click(screen.getByTestId('repo-picker-refresh'));
      expect(onRefresh).toHaveBeenCalledOnce();
    });

    it('disables refresh when loading', () => {
      render(<RepoPicker user={mockUser} repos={[]} loading={true} onRefresh={() => {}} />);
      expect((screen.getByTestId('repo-picker-refresh') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('create repository', () => {
    it('shows new repository button', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} onCreateRepo={() => {}} />);
      expect(screen.getByTestId('repo-picker-new')).toBeDefined();
    });

    it('switches to create form', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} onCreateRepo={() => {}} />);
      fireEvent.click(screen.getByTestId('repo-picker-new'));
      expect(screen.getByTestId('repo-picker-create')).toBeDefined();
      expect(screen.getByTestId('repo-picker-create-name')).toBeDefined();
      expect(screen.getByTestId('repo-picker-create-desc')).toBeDefined();
      expect(screen.getByTestId('repo-picker-create-private')).toBeDefined();
    });

    it('goes back to list', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} onCreateRepo={() => {}} />);
      fireEvent.click(screen.getByTestId('repo-picker-new'));
      fireEvent.click(screen.getByTestId('repo-picker-back'));
      expect(screen.getByTestId('repo-picker-list')).toBeDefined();
    });

    it('calls onCreateRepo with form data', () => {
      const onCreateRepo = vi.fn();
      render(<RepoPicker user={mockUser} repos={mockRepos} onCreateRepo={onCreateRepo} />);
      fireEvent.click(screen.getByTestId('repo-picker-new'));
      fireEvent.change(screen.getByTestId('repo-picker-create-name'), {
        target: { value: 'my-workspace' },
      });
      fireEvent.change(screen.getByTestId('repo-picker-create-desc'), {
        target: { value: 'My workspace' },
      });
      fireEvent.click(screen.getByTestId('repo-picker-create-submit'));
      expect(onCreateRepo).toHaveBeenCalledWith({
        name: 'my-workspace',
        description: 'My workspace',
        private: true,
      });
    });

    it('disables submit when name empty', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} onCreateRepo={() => {}} />);
      fireEvent.click(screen.getByTestId('repo-picker-new'));
      expect(
        (screen.getByTestId('repo-picker-create-submit') as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('toggles private checkbox', () => {
      const onCreateRepo = vi.fn();
      render(<RepoPicker user={mockUser} repos={mockRepos} onCreateRepo={onCreateRepo} />);
      fireEvent.click(screen.getByTestId('repo-picker-new'));
      fireEvent.change(screen.getByTestId('repo-picker-create-name'), {
        target: { value: 'pub-repo' },
      });
      fireEvent.click(screen.getByTestId('repo-picker-create-private'));
      fireEvent.click(screen.getByTestId('repo-picker-create-submit'));
      expect(onCreateRepo).toHaveBeenCalledWith({
        name: 'pub-repo',
        description: '',
        private: false,
      });
    });

    it('returns to list after creating', () => {
      render(<RepoPicker user={mockUser} repos={mockRepos} onCreateRepo={() => {}} />);
      fireEvent.click(screen.getByTestId('repo-picker-new'));
      fireEvent.change(screen.getByTestId('repo-picker-create-name'), {
        target: { value: 'new-repo' },
      });
      fireEvent.click(screen.getByTestId('repo-picker-create-submit'));
      expect(screen.getByTestId('repo-picker-list')).toBeDefined();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no repos', () => {
      render(<RepoPicker user={mockUser} repos={[]} />);
      expect(screen.getByTestId('repo-picker-empty').textContent).toContain('No repositories found');
    });
  });
});
