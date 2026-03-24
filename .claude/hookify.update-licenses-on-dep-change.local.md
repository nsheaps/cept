---
name: update-licenses-on-dep-change
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: package\.json$
  - field: new_text
    operator: regex_match
    pattern: (dependencies|devDependencies)
---

**Dependencies changed — update license disclosures!**

When `package.json` dependencies change, the LICENSES array in the Settings modal
must be reviewed and updated to reflect added, removed, or changed packages.

**File to update:** `packages/ui/src/components/settings/SettingsModal.tsx`

Check the `LICENSES` constant and ensure every major runtime dependency is listed
with its correct license type. Run `bun pm ls` to see the current dependency tree.
