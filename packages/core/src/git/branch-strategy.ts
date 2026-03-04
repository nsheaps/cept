/**
 * BranchStrategy — Manages automatic branch creation and naming for Cept workspaces.
 *
 * Strategies:
 * - 'single': All changes go to a single branch (e.g. 'main'). Simple, no conflicts.
 * - 'per-device': Each device gets its own branch (e.g. 'cept/device-abc'). Merged periodically.
 * - 'per-session': A new branch per editing session (e.g. 'cept/session-2026-03-04-xyz').
 */

import type { GitStorageBackend, Branch, MergeResult } from '../storage/backend.js';

export type BranchStrategyType = 'single' | 'per-device' | 'per-session';

export interface BranchStrategyConfig {
  /** The branching strategy to use. Default: 'single' */
  strategy: BranchStrategyType;
  /** The main/trunk branch. Default: 'main' */
  mainBranch?: string;
  /** Unique device identifier (for per-device strategy) */
  deviceId?: string;
  /** Branch prefix. Default: 'cept/' */
  prefix?: string;
}

export interface BranchInfo {
  name: string;
  strategy: BranchStrategyType;
  isMainBranch: boolean;
  createdAt?: number;
}

const DEFAULT_PREFIX = 'cept/';
const DEFAULT_MAIN_BRANCH = 'main';

/**
 * Generates a branch name based on the strategy.
 */
export function generateBranchName(config: BranchStrategyConfig): string {
  const prefix = config.prefix ?? DEFAULT_PREFIX;
  const mainBranch = config.mainBranch ?? DEFAULT_MAIN_BRANCH;

  switch (config.strategy) {
    case 'single':
      return mainBranch;

    case 'per-device': {
      const deviceId = config.deviceId ?? generateDeviceId();
      return `${prefix}device-${deviceId}`;
    }

    case 'per-session': {
      const date = new Date().toISOString().split('T')[0];
      const sessionId = generateSessionId();
      return `${prefix}session-${date}-${sessionId}`;
    }
  }
}

/**
 * Checks if a branch name belongs to the Cept branch namespace.
 */
export function isCeptBranch(branchName: string, prefix?: string): boolean {
  return branchName.startsWith(prefix ?? DEFAULT_PREFIX);
}

/**
 * Parses a Cept branch name to extract strategy info.
 */
export function parseBranchName(branchName: string, prefix?: string): BranchInfo | null {
  const p = prefix ?? DEFAULT_PREFIX;

  if (!branchName.startsWith(p)) {
    return null;
  }

  const rest = branchName.slice(p.length);

  if (rest.startsWith('device-')) {
    return {
      name: branchName,
      strategy: 'per-device',
      isMainBranch: false,
    };
  }

  if (rest.startsWith('session-')) {
    return {
      name: branchName,
      strategy: 'per-session',
      isMainBranch: false,
    };
  }

  return null;
}

/**
 * Lists all Cept-managed branches.
 */
export async function listCeptBranches(
  backend: GitStorageBackend,
  prefix?: string,
): Promise<BranchInfo[]> {
  const branches = await backend.branch.list();
  const p = prefix ?? DEFAULT_PREFIX;

  return branches
    .filter((b: Branch) => b.name.startsWith(p))
    .map((b: Branch) => parseBranchName(b.name, p))
    .filter((info): info is BranchInfo => info !== null);
}

/**
 * Generates a short random device ID.
 */
export function generateDeviceId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generates a short random session ID.
 */
export function generateSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export class BranchStrategyManager {
  private backend: GitStorageBackend;
  private config: Required<BranchStrategyConfig>;
  private currentBranch: string | null = null;

  constructor(backend: GitStorageBackend, config: BranchStrategyConfig) {
    this.backend = backend;
    this.config = {
      strategy: config.strategy,
      mainBranch: config.mainBranch ?? DEFAULT_MAIN_BRANCH,
      deviceId: config.deviceId ?? generateDeviceId(),
      prefix: config.prefix ?? DEFAULT_PREFIX,
    };
  }

  /**
   * Ensures the working branch exists and is checked out.
   * Creates it from main if needed.
   */
  async ensureBranch(): Promise<string> {
    const branchName = this.getBranchName();
    this.currentBranch = branchName;

    if (branchName === this.config.mainBranch) {
      return branchName;
    }

    const branches = await this.backend.branch.list();
    const exists = branches.some((b: Branch) => b.name === branchName);

    if (!exists) {
      await this.backend.branch.create(branchName, this.config.mainBranch);
    }

    const current = await this.backend.branch.current();
    if (current !== branchName) {
      await this.backend.branch.switch(branchName);
    }

    return branchName;
  }

  /**
   * Merges the working branch back into main.
   */
  async mergeToMain(): Promise<MergeResult> {
    const branchName = this.currentBranch ?? this.getBranchName();

    if (branchName === this.config.mainBranch) {
      return { ok: true, conflicts: [] };
    }

    // Switch to main, merge working branch, switch back
    await this.backend.branch.switch(this.config.mainBranch);
    const result = await this.backend.branch.merge(branchName, this.config.mainBranch);

    if (result.ok) {
      // Stay on main after successful merge
      this.currentBranch = this.config.mainBranch;
    } else {
      // Switch back to working branch on conflict
      await this.backend.branch.switch(branchName);
    }

    return result;
  }

  /**
   * Cleans up old Cept branches that have been merged.
   * Returns the names of deleted branches.
   */
  async cleanup(): Promise<string[]> {
    const branches = await this.backend.branch.list();
    const current = await this.backend.branch.current();
    const deleted: string[] = [];

    for (const branch of branches) {
      if (branch.name === this.config.mainBranch) continue;
      if (branch.name === current) continue;
      if (!isCeptBranch(branch.name, this.config.prefix)) continue;

      try {
        await this.backend.branch.delete(branch.name);
        deleted.push(branch.name);
      } catch {
        // Branch may have unmerged changes, skip
      }
    }

    return deleted;
  }

  /** Get the branch name for the current strategy */
  getBranchName(): string {
    return generateBranchName(this.config);
  }

  /** Get current strategy type */
  getStrategy(): BranchStrategyType {
    return this.config.strategy;
  }

  /** Get main branch name */
  getMainBranch(): string {
    return this.config.mainBranch;
  }
}
