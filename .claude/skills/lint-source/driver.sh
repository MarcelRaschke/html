#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
SOURCE_FILE="$REPO_ROOT/source"

BUILD_DIR="${BUILD_DIR:-/tmp/html-build}"
LINT_SCRIPT="$BUILD_DIR/lint.sh"

echo "=== HTML Source Linter ==="
echo "Source: $SOURCE_FILE"
echo ""

# Ensure html-build is present
if [ ! -d "$BUILD_DIR" ]; then
    echo "Cloning html-build..."
    git clone https://github.com/whatwg/html-build.git "$BUILD_DIR"
    echo ""
fi

# Update html-build to latest
cd "$BUILD_DIR"
echo "Updating html-build..."
git pull --quiet
echo ""

# Run linter
echo "Checking source for style issues..."
echo ""

if bash "$LINT_SCRIPT" "$SOURCE_FILE"; then
    echo ""
    echo "=== Lint check passed ==="
    echo "No style issues found."
    exit 0
else
    echo ""
    echo "=== Lint check failed ==="
    echo ""
    echo "Fix the issues above according to CONTRIBUTING.md:"
    echo "  - Use 100-character line width"
    echo "  - No trailing whitespace or tabs"
    echo "  - Proper algorithm markup and var scoping"
    echo "  - Correct American English spelling"
    echo ""
    exit 1
fi
