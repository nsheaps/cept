import { describe, it, expect } from 'vitest';
import { DEFAULT_GIT_CORS_PROXY, gitCorsProxy } from './git-proxy.js';

describe('gitCorsProxy (D-39)', () => {
  it('uses the public proxy when the build sets none', () => {
    expect(gitCorsProxy('')).toBe(DEFAULT_GIT_CORS_PROXY);
    expect(gitCorsProxy('   ')).toBe(DEFAULT_GIT_CORS_PROXY);
  });

  it('uses the proxy the build sets', () => {
    expect(gitCorsProxy('https://git.example.dev')).toBe('https://git.example.dev');
    expect(gitCorsProxy(' https://git.example.dev\n')).toBe('https://git.example.dev');
  });

  it('defaults outside a Vite build, where the setting is not defined', () => {
    expect(gitCorsProxy()).toBe(DEFAULT_GIT_CORS_PROXY);
  });
});
