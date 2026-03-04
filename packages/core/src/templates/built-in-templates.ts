/**
 * Built-in Template Library — Pre-packaged templates for common use cases.
 *
 * These templates are embedded in the application and don't require
 * a storage backend. They serve as starting points for new pages
 * and databases.
 */

import type { TemplateMeta, TemplateType } from './index.js';

export interface BuiltInTemplate extends TemplateMeta {
  /** Template content (Markdown for pages, YAML for databases) */
  content: string;
}

export type TemplateCategory =
  | 'personal'
  | 'work'
  | 'education'
  | 'project'
  | 'engineering'
  | 'blank';

const PAGE: TemplateType = 'page';
const DB: TemplateType = 'database';

const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  // Blank templates
  {
    id: 'blank-page',
    name: 'Blank Page',
    description: 'Start with an empty page',
    type: PAGE,
    icon: '📄',
    category: 'blank',
    path: '_builtin/blank-page',
    content: '# {{title}}\n\n',
  },
  {
    id: 'blank-database',
    name: 'Blank Database',
    description: 'Start with an empty database',
    type: DB,
    icon: '🗃️',
    category: 'blank',
    path: '_builtin/blank-database',
    content: `name: {{title}}
properties:
  - name: Name
    type: title
  - name: Tags
    type: multi_select
  - name: Created
    type: date
views:
  - name: All Items
    type: table
`,
  },

  // Personal
  {
    id: 'journal',
    name: 'Daily Journal',
    description: 'Daily journal entry with prompts',
    type: PAGE,
    icon: '📔',
    category: 'personal',
    path: '_builtin/journal',
    content: `# {{date}} — Journal

## Morning
- **Intention for today:**
- **Grateful for:**

## Notes


## Evening Reflection
- **What went well:**
- **What to improve:**
`,
  },
  {
    id: 'reading-notes',
    name: 'Reading Notes',
    description: 'Notes template for books and articles',
    type: PAGE,
    icon: '📚',
    category: 'personal',
    path: '_builtin/reading-notes',
    content: `# {{title}}

**Author:**
**Source:**
**Date Read:** {{date}}

## Key Ideas


## Quotes


## My Thoughts


## Action Items
- [ ]
`,
  },
  {
    id: 'habit-tracker',
    name: 'Habit Tracker',
    description: 'Track daily habits in a database',
    type: DB,
    icon: '✅',
    category: 'personal',
    path: '_builtin/habit-tracker',
    content: `name: {{title}}
properties:
  - name: Habit
    type: title
  - name: Frequency
    type: select
    options:
      - Daily
      - Weekly
      - Monthly
  - name: Status
    type: checkbox
  - name: Date
    type: date
  - name: Notes
    type: text
views:
  - name: All Habits
    type: table
  - name: By Frequency
    type: board
    group_by: Frequency
`,
  },

  // Work
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Structured meeting notes with action items',
    type: PAGE,
    icon: '🤝',
    category: 'work',
    path: '_builtin/meeting-notes',
    content: `# {{title}}

**Date:** {{date}}
**Attendees:**
**Facilitator:**

## Agenda
1.

## Discussion Notes


## Decisions Made


## Action Items
- [ ] **[Owner]** Task description — Due: YYYY-MM-DD
`,
  },
  {
    id: 'project-brief',
    name: 'Project Brief',
    description: 'Project overview and planning document',
    type: PAGE,
    icon: '📋',
    category: 'work',
    path: '_builtin/project-brief',
    content: `# {{title}}

## Overview
Brief description of the project.

## Goals
-

## Scope
### In Scope
-
### Out of Scope
-

## Timeline
| Milestone | Date | Status |
|-----------|------|--------|
| Kickoff | {{date}} | ✅ |
| | | |

## Team
| Role | Person |
|------|--------|
| Lead | |

## Risks
-

## Success Metrics
-
`,
  },
  {
    id: 'task-board',
    name: 'Task Board',
    description: 'Kanban-style task management',
    type: DB,
    icon: '📌',
    category: 'work',
    path: '_builtin/task-board',
    content: `name: {{title}}
properties:
  - name: Task
    type: title
  - name: Status
    type: select
    options:
      - Backlog
      - To Do
      - In Progress
      - Review
      - Done
  - name: Priority
    type: select
    options:
      - Low
      - Medium
      - High
      - Urgent
  - name: Assignee
    type: text
  - name: Due Date
    type: date
  - name: Tags
    type: multi_select
views:
  - name: Board
    type: board
    group_by: Status
  - name: All Tasks
    type: table
  - name: Calendar
    type: calendar
    date_property: Due Date
`,
  },

  // Engineering
  {
    id: 'bug-report',
    name: 'Bug Report',
    description: 'Structured bug report template',
    type: PAGE,
    icon: '🐛',
    category: 'engineering',
    path: '_builtin/bug-report',
    content: `# {{title}}

**Reported:** {{date}}
**Severity:** (Critical / High / Medium / Low)
**Status:** Open

## Description
What happened?

## Steps to Reproduce
1.
2.
3.

## Expected Behavior


## Actual Behavior


## Environment
- **OS:**
- **Browser:**
- **Version:**

## Screenshots


## Additional Context
`,
  },
  {
    id: 'sprint-tracker',
    name: 'Sprint Tracker',
    description: 'Track sprint tasks and velocity',
    type: DB,
    icon: '🏃',
    category: 'engineering',
    path: '_builtin/sprint-tracker',
    content: `name: {{title}}
properties:
  - name: Story
    type: title
  - name: Status
    type: select
    options:
      - Backlog
      - Sprint
      - In Progress
      - Testing
      - Done
  - name: Points
    type: number
  - name: Assignee
    type: text
  - name: Sprint
    type: select
  - name: Type
    type: select
    options:
      - Feature
      - Bug
      - Tech Debt
      - Spike
views:
  - name: Sprint Board
    type: board
    group_by: Status
  - name: All Stories
    type: table
`,
  },

  // Education
  {
    id: 'lecture-notes',
    name: 'Lecture Notes',
    description: 'Notes template for classes and lectures',
    type: PAGE,
    icon: '🎓',
    category: 'education',
    path: '_builtin/lecture-notes',
    content: `# {{title}}

**Course:**
**Date:** {{date}}
**Instructor:**

## Key Concepts


## Notes


## Questions
-

## Summary
`,
  },
  {
    id: 'study-plan',
    name: 'Study Plan',
    description: 'Organize study topics and progress',
    type: DB,
    icon: '📖',
    category: 'education',
    path: '_builtin/study-plan',
    content: `name: {{title}}
properties:
  - name: Topic
    type: title
  - name: Subject
    type: select
  - name: Status
    type: select
    options:
      - Not Started
      - Learning
      - Reviewing
      - Mastered
  - name: Priority
    type: select
    options:
      - Low
      - Medium
      - High
  - name: Due Date
    type: date
  - name: Resources
    type: url
  - name: Notes
    type: text
views:
  - name: All Topics
    type: table
  - name: By Subject
    type: board
    group_by: Subject
`,
  },
];

/**
 * Get all built-in templates.
 */
export function getBuiltInTemplates(): BuiltInTemplate[] {
  return [...BUILT_IN_TEMPLATES];
}

/**
 * Get built-in templates by category.
 */
export function getTemplatesByCategory(category: TemplateCategory): BuiltInTemplate[] {
  return BUILT_IN_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get a specific built-in template by ID.
 */
export function getBuiltInTemplate(id: string): BuiltInTemplate | null {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Get all unique template categories.
 */
export function getTemplateCategories(): TemplateCategory[] {
  const categories = new Set(BUILT_IN_TEMPLATES.map((t) => t.category).filter(Boolean));
  return [...categories] as TemplateCategory[];
}

/**
 * Apply variable substitution to template content.
 */
export function applyTemplateVariables(
  content: string,
  variables?: Record<string, string>,
): string {
  const defaultVars: Record<string, string> = {
    title: 'Untitled',
    date: new Date().toISOString().split('T')[0],
    datetime: new Date().toISOString(),
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  };

  const vars = { ...defaultVars, ...variables };
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Search templates by query.
 */
export function searchTemplates(query: string): BuiltInTemplate[] {
  const lowerQuery = query.toLowerCase();
  return BUILT_IN_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      (t.category?.toLowerCase().includes(lowerQuery) ?? false),
  );
}
