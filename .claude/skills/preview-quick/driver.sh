#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

BUILD_DIR="${BUILD_DIR:-/tmp/html-build}"
PREVIEW_DIR="${PREVIEW_DIR:-/tmp/html-preview}"

echo "=== HTML Quick Preview ==="
echo "Source: $REPO_ROOT/source"
echo "Preview dir: $PREVIEW_DIR"
echo ""

# Ensure html-build is present
if [ ! -d "$BUILD_DIR" ]; then
    echo "Cloning html-build..."
    git clone https://github.com/whatwg/html-build.git "$BUILD_DIR"
    echo ""
fi

# Create minimal preview directory structure
mkdir -p "$PREVIEW_DIR"

# Copy source to preview directory for quick inspection
echo "Generating preview..."
cp "$REPO_ROOT/source" "$PREVIEW_DIR/source.wattsi"

# Extract first few sections for preview
echo "Creating index..."
cat > "$PREVIEW_DIR/index.html" << 'HTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>HTML Standard Quick Preview</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 20px; line-height: 1.6; }
        h1 { color: #2c5282; }
        .info { background: #e6f2ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .tip { background: #fff5e6; padding: 15px; border-radius: 5px; margin: 20px 0; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>HTML Standard - Quick Preview</h1>
    
    <div class="info">
        <strong>Note:</strong> This is a quick preview for inspection. For full compilation with styling and navigation, use <code>./.claude/skills/build-html/driver.sh</code>
    </div>
    
    <div class="tip">
        <strong>What's here:</strong>
        <ul>
            <li><code>source.wattsi</code> — Raw Wattsi syntax (the source file)</li>
            <li>This index page</li>
        </ul>
    </div>
    
    <h2>Next steps:</h2>
    <ol>
        <li>Review <code>source.wattsi</code> for syntax</li>
        <li>Run linter: <code>./.claude/skills/lint-source/driver.sh</code></li>
        <li>Full build: <code>./.claude/skills/build-html/driver.sh</code></li>
    </ol>
    
    <h2>Build options:</h2>
    <ul>
        <li><strong>Quick preview:</strong> <code>./.claude/skills/preview-quick/driver.sh</code> (instant)</li>
        <li><strong>Lint check:</strong> <code>./.claude/skills/lint-source/driver.sh</code> (&lt;1s)</li>
        <li><strong>Full build:</strong> <code>./.claude/skills/build-html/driver.sh</code> (~5-10 min)</li>
    </ul>
</body>
</html>
HTML

echo ""
echo "=== Preview ready ==="
echo ""
echo "Files:"
echo "  Raw source: file://$PREVIEW_DIR/source.wattsi"
echo "  Index:      file://$PREVIEW_DIR/index.html"
echo ""
echo "Or serve locally:"
echo "  python3 -m http.server 8000 -d $PREVIEW_DIR"
echo "  Then: http://localhost:8000/"
