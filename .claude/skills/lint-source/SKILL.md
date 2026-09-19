---
name: lint-source
description: Check HTML Standard source for style violations and common errors
depends-on:
  - language: bash
  - package-manager: git
---

# Lint HTML Standard Source

Validates the HTML Standard `source` file against WHATWG style and formatting guidelines using the official html-build linter. Catches common errors, style violations, and deviations from contributing standards before build.

## What it checks

The linter validates:

- **Markup structure**: Unclosed tags, malformed algorithm definitions, missing variable scopes
- **Line formatting**: 100-character line width violations, trailing whitespace, tabs
- **Spelling**: American English (e.g., `-ize` not `-ise`), common typos (`teh`, `recieve`, `occured`)
- **Grammar**: Proper use of "a" vs. "an", RFC 2119 keywords in non-normative sections
- **Encoding**: No unescaped non-breaking spaces, proper UTF-8

## Run

The driver script handles everything:

```bash
./.claude/skills/lint-source/driver.sh
```

On first run, it:
1. Clones [html-build](https://github.com/whatwg/html-build) to `/tmp/html-build`
2. Updates to latest
3. Runs the linter against `source`

Subsequent runs reuse the clone and complete in < 1 second.

## Output

**If all checks pass:**
```
=== Lint check passed ===
No style issues found.
```
Exit code: `0`

**If violations are found:**
```
=== Lint check failed ===
Possible copypasta:
  123: <span>foo</span>
  ...

Possible typos:
  456: recieve
  ...

Trailing whitespace:
  789: ...   
```
Exit code: `1` — lists each category of issues with line numbers.

## Common fixes

| Issue | Fix |
|-------|-----|
| Line too long | Break after 100 chars; wrap inside attributes or between inline elements (not inside their content) |
| Trailing space | Remove whitespace at line end |
| Tab character | Use 1 space per indent level |
| Unescaped &nbsp; | Use `&nbsp;` HTML entity |
| "apropriate" typo | Use "appropriate" |
| "a" before vowel | Change to "an" (use `<!--grammar-check-override-->` to override) |

## Workflow

Typical contribution workflow:

1. Edit `source`
2. Run linter: `./.claude/skills/lint-source/driver.sh`
3. Fix any issues reported
4. Build to preview: `./.claude/skills/build-html/driver.sh`
5. Review output and commit

## Integration with build

The linter is **optional** — it checks style, not correctness. The build process (`build-html` skill) will always compile your changes, even if the linter finds issues. However, PRs to the HTML Standard should pass linting before merging, so run this before committing:

```bash
./.claude/skills/lint-source/driver.sh && ./.claude/skills/build-html/driver.sh
```

---

_Skill author: Claude_
