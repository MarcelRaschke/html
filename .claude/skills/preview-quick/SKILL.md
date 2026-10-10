---
name: preview-quick
description: Quick preview of HTML Standard source (instant, no compilation)
depends-on:
  - language: bash
---

# Quick Preview (Instant)

Instantly copies the source file and creates a lightweight preview index—no compilation needed. Use this to inspect raw Wattsi syntax before running the full build.

## Purpose

- **Instant feedback** — 0 seconds vs ~5-10 minutes for full build
- **Raw source review** — See the Wattsi syntax directly
- **Syntax checking** — Validate without rendering HTML
- **Workflow debugging** — Spot issues before long builds

## Run

```bash
./.claude/skills/preview-quick/driver.sh
```

Completes instantly. Outputs:
```
Raw source: file:///tmp/html-preview/source.wattsi
Index:      file:///tmp/html-preview/index.html
```

## Output

Preview directory (`/tmp/html-preview/`):
- `source.wattsi` — Copy of your source file (raw Wattsi syntax)
- `index.html` — Navigation page with links to next steps

## Workflow

**Rapid iteration:**

```bash
# 1. Edit source
# 2. Quick preview (instant)
./.claude/skills/preview-quick/driver.sh

# 3. Review source at file:///tmp/html-preview/source.wattsi
# 4. Format if needed
./.claude/skills/format-source/driver.sh

# 5. Lint check (<1s)
./.claude/skills/lint-source/driver.sh

# 6. Full build when ready (~5-10 min)
./.claude/skills/build-html/driver.sh
```

## When to use each skill

| Skill | Time | Purpose |
|-------|------|---------|
| preview-quick | <1s | Inspect raw Wattsi syntax |
| lint-source | <1s | Check style violations |
| format-source | <1s | Auto-fix formatting |
| build-html | 5-10 min | Full HTML compilation with rendering |

---

_Skill author: Claude_
