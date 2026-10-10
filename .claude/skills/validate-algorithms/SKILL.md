---
name: validate-algorithms
description: Validate algorithm markup structure in HTML Standard source
depends-on:
  - language: bash
  - language: perl
---

# Validate Algorithm Markup

Analyzes algorithm definitions in the HTML Standard source for structural correctness. Catches missing var-scopes, unmatched tags, and suspicious variable usage patterns.

## What it checks

- **Var-scoping** — All `<var>` tags must be inside one of:
  - `<div algorithm>` block
  - `<div var-scope>` block  
  - `<dl class="domintro">` block
  - Have `ignore` attribute

- **Tag matching** — Validates algorithm tag structure

- **Single-use variables** — Warns about variables appearing only once in an algorithm (often a mistake)

## Run

```bash
./.claude/skills/validate-algorithms/driver.sh
```

Exit code: `0` if valid, `1` if issues found.

## Output

**Pass:**
```
✓ All <var> tags are properly scoped
✓ No suspicious single-use variables found

=== Validation passed ===
```

**Fail (example):**
```
✗ Found potentially unscoped <var> tags:
Line 12345: <var>foo</var>
Line 12346: <var>bar</var>

=== Validation failed ===
```

## Algorithm structure

Valid algorithm markup:

```html
<!-- Option 1: div algorithm block -->
<div algorithm>
  <p>To do something with <var>x</var>:</p>
  <ol>
    <li><p>Let <var>result</var> be...</p></li>
    <li><p>Return <var>result</var>.</p></li>
  </ol>
</div>

<!-- Option 2: var-scope wrapper -->
<div var-scope>
  <p>When <var>x</var> changes...</p>
  <!-- References to <var>x</var> here -->
</div>

<!-- Option 3: domintro (WebIDL intro) -->
<dl class="domintro">
  <dt>method(<var>arg</var>)</dt>
  <dd>Does something with <var>arg</var>.</dd>
</dl>

<!-- Option 4: var with ignore attribute -->
<p>The <var ignore>x</var> in the equation...</p>
```

## Workflow

Use with other validation skills:

```bash
# Format code
./.claude/skills/format-source/driver.sh

# Check style
./.claude/skills/lint-source/driver.sh

# Validate algorithm markup
./.claude/skills/validate-algorithms/driver.sh

# Full build
./.claude/skills/build-html/driver.sh
```

---

_Skill author: Claude_
