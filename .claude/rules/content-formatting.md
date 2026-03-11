# Content Formatting

All user-facing content (documentation, page content, inline help) follows these formatting rules.

## Markdown Syntax

- Use **standard Markdown** as the primary content format
- Fall back to **GitHub Flavored Markdown (GFM)** when standard Markdown is insufficient (e.g., tables, task lists, strikethrough)
- Avoid raw HTML in content unless absolutely necessary for features that neither standard Markdown nor GFM can express
- When HTML is required, use semantic elements with `data-type` attributes (e.g., `<div data-type="callout">`) rather than presentational markup

## Images

- Use standard Markdown image syntax: `![alt text](url)`
- Alt text is required for all images and should describe the content meaningfully
- Never use raw HTML `<img>` tags in documentation content
- Images render at their **natural size** by default, centered, capped at `max-width: 100%`
- Do NOT set an explicit width on images unless the user or design specifically requires it
- The `ImageBlock` extension defaults to `width: null` (natural size) — do not change this to `100%` or any fixed value
- Follow Notion's image presentation: centered, natural size, rounded corners, subtle hover shadow

## Screenshots

- All screenshots live in `docs/screenshots/` organized by category (e.g., `features/`, `guides/`)
- Filenames are descriptive and kebab-case: `slash-menu.png`, `landing-page.png`
- Each screenshot captures **only the relevant UI element or area**, not a full page, unless the screenshot is specifically meant to show a full page view (e.g., landing page, editor overview)
- Do not keep unused screenshots — if a screenshot is not referenced in docs content, remove it
- Do not keep duplicate screenshots under different names

## Asset References in Bundled Docs

- Use the `{{base}}` placeholder for asset paths: `![alt]({{base}}screenshots/features/example.png)`
- `{{base}}` is resolved at runtime to the correct base URL via `import.meta.env.BASE_URL`
- Never hardcode absolute paths like `/screenshots/...` or relative paths without `{{base}}`

## Links

- Use standard Markdown link syntax: `[text](url)`
- Prefer descriptive link text over bare URLs
- Internal page references use wiki-link style when supported

## Code

- Use fenced code blocks with language tags: ` ```javascript `
- Use inline code for short references: `` `functionName` ``
- Mermaid diagrams use fenced code blocks with the `mermaid` language tag
- Math uses LaTeX: `$$block$$` and `$inline$`
