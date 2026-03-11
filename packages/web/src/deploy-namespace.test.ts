import { describe, it, expect } from 'vitest';
import { getDeploymentId, getDbName, namespacedKey, namespacedCache } from './deploy-namespace.js';

describe('getDeploymentId', () => {
  it('returns empty string for local dev (root path)', () => {
    expect(getDeploymentId('/')).toBe('');
  });

  it('returns empty string for production deployment', () => {
    expect(getDeploymentId('/cept/app/')).toBe('');
  });

  it('returns slug for PR preview deployment', () => {
    expect(getDeploymentId('/cept/pr-42/')).toBe('cept-pr-42');
  });

  it('returns slug for different PR numbers', () => {
    expect(getDeploymentId('/cept/pr-1/')).toBe('cept-pr-1');
    expect(getDeploymentId('/cept/pr-999/')).toBe('cept-pr-999');
  });

  it('handles paths without trailing slash', () => {
    expect(getDeploymentId('/cept/pr-5')).toBe('cept-pr-5');
  });

  it('handles arbitrary deployment paths', () => {
    expect(getDeploymentId('/staging/')).toBe('staging');
    expect(getDeploymentId('/cept/feature-branch/')).toBe('cept-feature-branch');
  });
});

describe('getDbName', () => {
  it('returns default name for production', () => {
    expect(getDbName('/')).toBe('cept-workspace');
    expect(getDbName('/cept/app/')).toBe('cept-workspace');
  });

  it('returns namespaced name for preview deployments', () => {
    expect(getDbName('/cept/pr-42/')).toBe('cept-workspace--cept-pr-42');
    expect(getDbName('/cept/pr-7/')).toBe('cept-workspace--cept-pr-7');
  });
});

describe('namespacedKey', () => {
  it('returns key unchanged for production', () => {
    expect(namespacedKey('/', 'cept-sw-updated')).toBe('cept-sw-updated');
    expect(namespacedKey('/cept/app/', 'cept-sw-updated')).toBe('cept-sw-updated');
  });

  it('prefixes key for preview deployments', () => {
    expect(namespacedKey('/cept/pr-42/', 'cept-sw-updated')).toBe('cept-pr-42::cept-sw-updated');
  });
});

describe('namespacedCache', () => {
  it('returns cache name unchanged for production', () => {
    expect(namespacedCache('/', 'cept-v1')).toBe('cept-v1');
    expect(namespacedCache('/cept/app/', 'cept-static-v1')).toBe('cept-static-v1');
  });

  it('prefixes cache name for preview deployments', () => {
    expect(namespacedCache('/cept/pr-42/', 'cept-v1')).toBe('cept-pr-42::cept-v1');
    expect(namespacedCache('/cept/pr-42/', 'cept-static-v1')).toBe('cept-pr-42::cept-static-v1');
  });
});
