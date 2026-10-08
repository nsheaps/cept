// lint-as: packages/web/src/fixture.ts
// expect: cept/no-cors-proxy-literal git-proxy.ts
const host = 'example';
export const proxy = `https://cors.isomorphic-git.org/${host}`;
