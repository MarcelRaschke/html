---
name: build-html
description: Build the HTML Standard specification from source into HTML output (single-page, multi-page, and developer variants)
depends-on:
  - language: bash
  - package-manager: apt
---

# Build HTML Standard

Compiles the HTML Standard `source` file into publishable HTML specifications using [html-build](https://github.com/whatwg/html-build). Produces single-page, multi-page, and developer-edition variants ready for preview and deployment.

## Prerequisites

```bash
apt-get update && apt-get install -y curl grep perl unzip cargo
```

All are typically pre-installed. `cargo` is the only frequent install.

## Build

The driver script handles everything:

```bash
./.claude/skills/build-html/driver.sh
```

On first run, it:
1. Clones [html-build](https://github.com/whatwg/html-build) to `/tmp/html-build`
2. Sets `HTML_SOURCE` to the current repo's location
3. Runs `build.sh` to compile from `source` into HTML

Subsequent runs reuse the clone and rebuild in ~4–5 minutes.

## Output locations

Compiled specs land in `/tmp/html-build/output/`:

- **Single-page spec:** `/tmp/html-build/output/index.html` (15MB, searchable, all sections in one document)
- **Multi-page spec:** `/tmp/html-build/output/multipage/` (sections split across files, faster to navigate)
- **Developer edition:** `/tmp/html-build/output/dev/` (omits IDL and low-level implementation details)
- **Review drafts:** `/tmp/html-build/output/review-drafts/`
- **Commit snapshots:** `/tmp/html-build/output/commit-snapshots/`

Stylesheets, fonts, and assets are in `output/`.

## Preview in browser

After build completes:

```bash
# Single-page
open /tmp/html-build/output/index.html

# Multi-page (start here for navigation)
open /tmp/html-build/output/multipage/index.html

# Developer edition
open /tmp/html-build/output/dev/index.html
```

Or serve locally:

```bash
python3 -m http.server 8000 -d /tmp/html-build/output
# Then: http://localhost:8000/
```

## Gotchas

- **First build takes ~10 minutes** on a fresh container (Wattsi compilation + Rust release build). Subsequent builds are ~5 min.
- **Large files:** The single-page spec is 15MB and heavy in browsers. Multi-page is more responsive.
- **`HTML_SOURCE` must be absolute.** The driver sets it automatically; if running `build.sh` directly, use `/home/user/html`, not `.`.
- **Wattsi binary:** The build downloads a pre-compiled Wattsi binary if not present. On first run, this adds ~30s. Cached thereafter.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `cargo: command not found` | `apt-get install -y cargo` |
| `Downloading wattsi...` (takes 30s+) | First build downloads; expected. Subsequent builds skip it. |
| `perl: can't find...` | `apt-get install -y perl` |
| Output files are stale | Run the driver again; it rebuilds the current `source` state. |
| Build hangs or timeouts | Increase timeout in `driver.sh` (default 300s). Some containers are slower. |

---

_Skill author: Claude_
