// lint-as: packages/web/src/fixture.ts
// expect: cept/restricted-imports [isomorphic-git]
export const loadHttp = () => import('isomorphic-git/http/web');
