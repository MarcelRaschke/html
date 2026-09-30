#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

BUILD_DIR="${BUILD_DIR:-/tmp/html-build}"
TIMEOUT="${TIMEOUT:-300}"

echo "=== HTML Standard Builder ==="
echo "Repo: $REPO_ROOT"
echo "Build dir: $BUILD_DIR"
echo ""

# Clone html-build if not present
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

# Install prerequisites (silent if already installed)
echo "Checking prerequisites..."
for cmd in curl grep perl unzip; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "Installing $cmd..."
        apt-get update -qq && apt-get install -y "$cmd" > /dev/null
    fi
done

if ! command -v cargo &> /dev/null; then
    echo "Installing Rust/Cargo..."
    apt-get update -qq && apt-get install -y cargo > /dev/null
fi
echo "Prerequisites OK"
echo ""

# Build
echo "Building HTML Standard from: $REPO_ROOT"
echo "(This takes ~5 minutes on subsequent runs, ~10 minutes on first run)"
echo ""

timeout "$TIMEOUT" env HTML_SOURCE="$REPO_ROOT" bash build.sh 2>&1 | tail -20

if [ ${PIPESTATUS[0]} -eq 124 ]; then
    echo "ERROR: Build timed out after ${TIMEOUT}s" >&2
    exit 1
fi

echo ""
echo "=== Build complete ==="
echo ""
echo "Output:"
echo "  Single-page: file://$BUILD_DIR/output/index.html"
echo "  Multi-page:  file://$BUILD_DIR/output/multipage/index.html"
echo "  Dev edition: file://$BUILD_DIR/output/dev/index.html"
echo ""
echo "Or serve locally:"
echo "  python3 -m http.server 8000 -d $BUILD_DIR/output"
echo "  Then: http://localhost:8000/index.html"
