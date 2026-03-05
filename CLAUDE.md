# MDMbox Documentation

This is a documentation repository for MDMbox. It uses Health Samurai's `docs-tools` for linting, image optimization, and OG image generation.

All documentation is written in **English**.

## Structure

```
docs/           — markdown files (documentation pages)
assets/         — images and downloadable files
assets/og/      — auto-generated Open Graph images (do not edit)
SUMMARY.md      — table of contents and navigation
docs-lint.yaml  — linter configuration
redirects.yaml  — URL redirects
```

## Writing Documentation

### Setup

Run `bun install` once after cloning — this installs docs-tools and sets up git hooks.

### Creating a New Page

1. Create a `.md` file in `docs/` (or a subdirectory)
2. Start the file with a single `# Title` heading
3. Add the page to `SUMMARY.md` in the correct section
4. Run `bun lint` to verify everything is correct

### Frontmatter (optional)

Pages can have YAML frontmatter:

```markdown
---
hidden: true
description: Page description for SEO
---
# Page Title
```

- `hidden: true` — page is excluded from orphan-pages lint check

### SUMMARY.md Format

```markdown
# Table of contents

## Section Name

* [Page Title](page-file.md)
* [Another Page](subdir/page.md)
```

Rules:
- Page title in SUMMARY.md must match the `# H1` heading in the file
- Use "and" instead of "&" in titles
- Every `.md` file in `docs/` must be listed in SUMMARY.md

### Images

Place images in `assets/` directory (use subdirectories to organize, e.g. `assets/getting-started/`).

```markdown
![Description of the image](../assets/screenshot.png)
```

- Always provide meaningful alt text — linter warns on empty `![](image.png)`
- Supported formats: PNG, JPG, JPEG, GIF, SVG, WebP, AVIF
- CI automatically converts images to AVIF and updates references — commit as PNG/JPG, optimization happens on push
- To optimize locally before pushing: `bun images:optimize`
- Do not edit files in `assets/og/` — these are auto-generated Open Graph images

### Markdown Rules

- Exactly one `# H1` per file (the page title)
- Do not skip heading levels (H1 → H3 is wrong, use H1 → H2 → H3)
- No empty headings
- All internal links must point to existing files
- All referenced images must exist in `assets/`
- Images should have meaningful alt text

### Redirects

When renaming or moving a page, add a redirect in `redirects.yaml` so old URLs keep working:

```yaml
redirects:
  old/path/slug: new/path/to/page.md
  another/old/slug: some/page.md#section-anchor
```

- **Keys** — old URL slugs (no leading `/`, no `.md` extension)
- **Values** — relative paths to `.md` files in `docs/` directory
- Section anchors are supported: `page.md#section` redirects to a specific section
- The linter checks that target `.md` files exist — missing targets cause an error

## Supported Widgets

Widgets can be nested inside each other (e.g. hints inside tabs, code blocks inside steps).

### Hint (callout box)

```markdown
{% hint style="info" %}
Informational message.
{% endhint %}
```

Styles: `info`, `success`, `warning`, `danger`

### Tabs

`{% tab %}` must be inside `{% tabs %}`.

```markdown
{% tabs %}
{% tab title="First Tab" %}
Content for tab 1.
{% endtab %}
{% tab title="Second Tab" %}
Content for tab 2.
{% endtab %}
{% endtabs %}
```

### Stepper (numbered steps)

`{% step %}` must be inside `{% stepper %}`.

```markdown
{% stepper %}
{% step %}
First step content.
{% endstep %}
{% step %}
Second step content.
{% endstep %}
{% endstepper %}
```

### Code Block with Title

```markdown
{% code title="config.yaml" %}
```yaml
key: value
```
{% endcode %}
```

### Embed (YouTube or link card)

```markdown
{% embed url="https://www.youtube.com/watch?v=VIDEO_ID" / %}

{% embed url="https://example.com" / %}
```

### Content Reference (link card to another page)

```markdown
{% content-ref %}
[Page Title](path/to/page.md)
{% endcontent-ref %}
```

### File Download

```markdown
{% file src="/assets/document.pdf" / %}

{% file src="/assets/archive.zip" %}
Download Archive
{% endfile %}
```

### Carousel (image slideshow)

```markdown
{% carousel %}
![First image](image1.png)
![Second image](image2.png)
{% endcarousel %}
```

### Quote (testimonial)

```markdown
{% quote author="Name" title="Position" %}
Quote text here.
{% endquote %}
```

## Available Commands

```
bun lint          — fix lint issues automatically
bun lint:check    — check for issues without fixing
bun images:check  — find unoptimized images
bun images:optimize — convert images to AVIF format
```

## Git Workflow

- Commit directly to `main` branch
- After committing, ask the user before pushing

### Pre-push Checks

A pre-push git hook runs `bun lint` automatically before every push. If lint fails, the push is blocked.

**Before pushing, always run `bun lint` yourself first.** If there are errors:
1. Show the user what failed
2. Fix the issues (most are auto-fixable by `bun lint` without `--check`)
3. Commit the fixes
4. Only then push

Common lint errors and how to fix them:
- **summary-sync** — file exists but not in SUMMARY.md (or vice versa). Add/remove the entry.
- **title-mismatch** — H1 in file differs from title in SUMMARY.md. Make them match.
- **broken-links** — internal link points to non-existent file. Fix the path.
- **missing-images** — referenced image not found in `assets/`. Add the image or fix the path.
- **h1-headers** — more than one `# H1` in a file. Keep only one.
- **empty-headers** — heading with no text (`## `). Add text or remove.
- **heading-order** — skipped heading level (e.g. H1 → H3). Add the missing level.
- **unparsed-widgets** — unclosed or mismatched widget tags. Close `{% hint %}` with `{% endhint %}`, etc.
- **broken-references** — leftover GitBook `broken-reference` placeholder. Replace with real link.
- **image-alt** (warning) — image without alt text. Add `![description](image.png)`.
- **deprecated-links** — link points to a page in a deprecated directory. Update to current page.
- **absolute-links** — hardcoded absolute URL to own docs domain. Use relative markdown links instead.

CI automatically optimizes images and generates OG images on push.
