# Images and Screenshots

## Image Syntax

- Use standard Markdown image syntax: `![alt text](url)`
- Fall back to GitHub Flavored Markdown (GFM) when standard Markdown is insufficient
- Never use raw HTML `<img>` tags in documentation content unless absolutely necessary (e.g., for sizing attributes that Markdown cannot express)
- Alt text is required for all images and should describe the content meaningfully

## Image Styling

- Images render at their **natural size** by default, centered within the content area, capped at `max-width: 100%`
- Do NOT set an explicit width on images unless the user or design specifically requires it
- The `ImageBlock` extension defaults to `width: null` (natural size) — do not change this to `100%` or any other fixed value
- Follow Notion's image presentation: centered, natural size, rounded corners, subtle hover shadow

## Screenshot Conventions

- All screenshots live in `docs/screenshots/` organized by category (e.g., `features/`, `guides/`)
- Screenshot filenames should be descriptive and kebab-case: `slash-menu.png`, `landing-page.png`
- Each screenshot should capture **only the relevant UI element or area**, not a full page, unless the screenshot is specifically meant to show a full page view (e.g., landing page, editor overview)
- Do not keep unused screenshots — if a screenshot is not referenced in docs content, remove it
- Do not keep duplicate screenshots under different names

## Screenshot References in Docs

- Use the `{{base}}` placeholder for asset paths in bundled docs content: `![alt]({{base}}screenshots/features/example.png)`
- The `{{base}}` placeholder is resolved at runtime to the correct base URL via `import.meta.env.BASE_URL`
- Never hardcode absolute paths like `/screenshots/...` or relative paths without `{{base}}`
