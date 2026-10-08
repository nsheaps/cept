/**
 * Serve local bare repositories to the app over git smart HTTP: requests to
 * the CORS proxy URL are answered by `git http-backend`.
 */

import type { Route } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';

export const PROXY = 'https://cors.isomorphic-git.org';

export function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'E2E',
      GIT_AUTHOR_EMAIL: 'e2e@example.com',
      GIT_COMMITTER_NAME: 'E2E',
      GIT_COMMITTER_EMAIL: 'e2e@example.com',
    },
  });
}

/** Answer a proxied smart-HTTP request from `git http-backend`. */
export async function serveGit(
  route: Route,
  root: string,
  repoPath: string,
  repoName: string,
): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: corsHeaders() });
    return;
  }
  if (!url.pathname.startsWith(`${repoPath}/`) && !url.pathname.startsWith(`${repoPath}.git/`)) {
    await route.fulfill({ status: 404, headers: corsHeaders(), body: 'not found' });
    return;
  }
  const rest = url.pathname.slice(repoPath.length).replace(/^\.git/, '');
  const result = spawnSync('git', ['http-backend'], {
    input: request.postDataBuffer() ?? Buffer.alloc(0),
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_PROJECT_ROOT: root,
      GIT_HTTP_EXPORT_ALL: '1',
      PATH_INFO: `/${repoName}${rest}`,
      QUERY_STRING: url.search.replace(/^\?/, ''),
      REQUEST_METHOD: request.method(),
      CONTENT_TYPE: request.headers()['content-type'] ?? '',
    },
  });
  const out = result.stdout;
  const split = out.indexOf('\r\n\r\n');
  const head = out.subarray(0, split).toString('utf8');
  const body = out.subarray(split + 4);
  const headers: Record<string, string> = corsHeaders();
  let status = 200;
  for (const line of head.split('\r\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name.toLowerCase() === 'status') status = Number.parseInt(value, 10);
    else headers[name] = value;
  }
  await route.fulfill({ status, headers, body });
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': '*',
  };
}
