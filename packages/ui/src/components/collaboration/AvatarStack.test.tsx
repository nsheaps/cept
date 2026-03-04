import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AvatarStack } from './AvatarStack.js';
import type { AwarenessUser } from '@cept/core';

function makeUser(id: string, name: string, color = '#3b82f6'): AwarenessUser {
  return { id, name, color };
}

describe('AvatarStack', () => {
  it('renders empty state when no users', () => {
    render(<AvatarStack users={[]} />);
    expect(screen.getByTestId('avatar-empty')).toBeDefined();
  });

  it('renders avatars for users', () => {
    const users = [makeUser('u1', 'Alice'), makeUser('u2', 'Bob')];
    render(<AvatarStack users={users} />);

    expect(screen.getByTestId('avatar-u1')).toBeDefined();
    expect(screen.getByTestId('avatar-u2')).toBeDefined();
  });

  it('shows user initial', () => {
    render(<AvatarStack users={[makeUser('u1', 'Alice')]} />);
    expect(screen.getByTestId('avatar-u1').textContent).toContain('A');
  });

  it('shows title with user name', () => {
    render(<AvatarStack users={[makeUser('u1', 'Alice')]} />);
    expect(screen.getByTestId('avatar-u1').getAttribute('title')).toBe('Alice');
  });

  it('limits visible avatars to maxVisible', () => {
    const users = Array.from({ length: 8 }, (_, i) =>
      makeUser(`u${i}`, `User ${i}`),
    );
    render(<AvatarStack users={users} maxVisible={3} />);

    expect(screen.getByTestId('avatar-u0')).toBeDefined();
    expect(screen.getByTestId('avatar-u1')).toBeDefined();
    expect(screen.getByTestId('avatar-u2')).toBeDefined();
    expect(screen.queryByTestId('avatar-u3')).toBeNull();
  });

  it('shows overflow indicator', () => {
    const users = Array.from({ length: 8 }, (_, i) =>
      makeUser(`u${i}`, `User ${i}`),
    );
    render(<AvatarStack users={users} maxVisible={3} />);

    const overflow = screen.getByTestId('avatar-overflow');
    expect(overflow.textContent).toBe('+5');
  });

  it('does not show overflow when users fit', () => {
    const users = [makeUser('u1', 'Alice'), makeUser('u2', 'Bob')];
    render(<AvatarStack users={users} maxVisible={5} />);
    expect(screen.queryByTestId('avatar-overflow')).toBeNull();
  });

  it('highlights current user avatar differently from others', () => {
    const users = [makeUser('u1', 'Alice'), makeUser('u2', 'Bob')];
    render(<AvatarStack users={users} currentUserId="u1" />);

    const current = screen.getByTestId('avatar-u1');
    const other = screen.getByTestId('avatar-u2');
    // Current user gets a visible border, others get transparent
    expect(current.style.border).not.toBe(other.style.border);
  });

  it('calls onUserClick when avatar is clicked', () => {
    const onClick = vi.fn();
    const user = makeUser('u1', 'Alice');
    render(<AvatarStack users={[user]} onUserClick={onClick} />);

    fireEvent.click(screen.getByTestId('avatar-u1'));
    expect(onClick).toHaveBeenCalledWith(user);
  });

  it('shows cursor indicator when user has cursor', () => {
    const user: AwarenessUser = {
      id: 'u1',
      name: 'Alice',
      color: '#3b82f6',
      cursor: { anchor: 0, head: 5 },
    };
    render(<AvatarStack users={[user]} />);
    expect(screen.getByTestId('cursor-indicator-u1')).toBeDefined();
  });

  it('hides cursor indicator when user has no cursor', () => {
    render(<AvatarStack users={[makeUser('u1', 'Alice')]} />);
    expect(screen.queryByTestId('cursor-indicator-u1')).toBeNull();
  });

  it('uses custom size', () => {
    render(<AvatarStack users={[makeUser('u1', 'Alice')]} size={48} />);
    const avatar = screen.getByTestId('avatar-u1');
    expect(avatar.style.width).toBe('48px');
    expect(avatar.style.height).toBe('48px');
  });

  it('applies user color as background', () => {
    render(<AvatarStack users={[makeUser('u1', 'Alice', '#ff0000')]} />);
    const avatar = screen.getByTestId('avatar-u1');
    expect(avatar.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('uses white text on dark backgrounds', () => {
    render(<AvatarStack users={[makeUser('u1', 'Alice', '#000000')]} />);
    const avatar = screen.getByTestId('avatar-u1');
    expect(avatar.style.color).toBe('rgb(255, 255, 255)');
  });

  it('uses black text on light backgrounds', () => {
    render(<AvatarStack users={[makeUser('u1', 'Alice', '#ffffff')]} />);
    const avatar = screen.getByTestId('avatar-u1');
    expect(avatar.style.color).toBe('rgb(0, 0, 0)');
  });
});
