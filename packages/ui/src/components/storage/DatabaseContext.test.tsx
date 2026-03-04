import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DatabaseProvider, useDatabaseEngine } from './DatabaseContext.js';
import { MemoryBackend } from './test-helpers.js';

function TestConsumer() {
  const engine = useDatabaseEngine();
  return <div data-testid="engine-available">{engine ? 'yes' : 'no'}</div>;
}

describe('DatabaseContext', () => {
  it('provides a CeptDatabaseEngine instance', () => {
    const backend = new MemoryBackend();
    render(
      <DatabaseProvider backend={backend}>
        <TestConsumer />
      </DatabaseProvider>,
    );
    expect(screen.getByTestId('engine-available').textContent).toBe('yes');
  });

  it('throws when used outside provider', () => {
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useDatabaseEngine must be used within a DatabaseProvider');
  });
});
