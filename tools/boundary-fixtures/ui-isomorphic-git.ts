// lint-as: packages/ui/src/fixture.ts
// expect: cept/restricted-imports [isomorphic-git]
import git from 'isomorphic-git';

export const clone = git.clone;
