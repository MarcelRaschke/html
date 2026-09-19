---
name: format-source
description: Auto-format HTML Standard source according to CONTRIBUTING.md style guidelines
depends-on:
  - language: bash
  - language: perl
---

# Format HTML Standard Source

Automatically formats the HTML Standard `source` file according to WHATWG style and formatting guidelines. Enforces consistent spacing, removes trailing whitespace, and prepares changes for contribution.

## What it fixes

- **Trailing whitespace** — Removes spaces/tabs at end of lines
- **Line endings** — Ensures LF (Unix-style) line endings
- **Tag spacing** — Normalizes spacing around HTML tags
- **Indentation** — Validates indentation (spaces, not tabs)

## Run

```bash
./.claude/skills/format-source/driver.sh
```

Creates automatic backup before making changes:
```
source.bak.1694517600
```

## Output

**If changes made:**
```
Changes made:
  - Removed trailing whitespace
  - [other fixes]

Review changes:
  diff -u source.bak.1694517600 source

To revert:
  cp source.bak.1694517600 source
```

**If no changes needed:**
```
No changes needed - source already formatted correctly
```

## Workflow

Use before committing:

```bash
# 1. Edit source
# 2. Format
./.claude/skills/format-source/driver.sh

# 3. Review changes
diff -u source.bak.* source

# 4. If happy, commit
git add source && git commit -m "..."

# 5. Clean up backup
rm source.bak.*
```

## Integration with lint-source

- **lint-source** catches style violations
- **format-source** fixes them automatically (where possible)
- Some issues (e.g., algorithm markup) require manual fixing

Run both:
```bash
./.claude/skills/format-source/driver.sh
./.claude/skills/lint-source/driver.sh
```

---

_Skill author: Claude_
