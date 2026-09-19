#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
SOURCE_FILE="$REPO_ROOT/source"
BACKUP_FILE="${SOURCE_FILE}.bak.$(date +%s)"

echo "=== HTML Source Formatter ==="
echo "Source: $SOURCE_FILE"
echo "Backup: $BACKUP_FILE"
echo ""

# Create backup
cp "$SOURCE_FILE" "$BACKUP_FILE"
echo "Backup created"
echo ""

# Format the source
echo "Formatting source..."
perl -i.tmp -pe '
  # Remove trailing whitespace
  s/\s+$//;

  # Convert tabs to spaces (not ideal but catches some issues)
  # We do NOT convert existing tabs - just flag them

  # Ensure proper spacing in certain patterns
  s/></>>/g;  # Fix space between tags

' "$SOURCE_FILE"

rm -f "${SOURCE_FILE}.tmp"

echo "Formatting complete"
echo ""

# Show summary
DIFF_LINES=$(diff -u "$BACKUP_FILE" "$SOURCE_FILE" 2>/dev/null | wc -l)
if [ "$DIFF_LINES" -gt 0 ]; then
  echo "Changes made:"
  echo "  - Removed trailing whitespace"
  echo ""
  echo "Review changes:"
  echo "  diff -u $BACKUP_FILE $SOURCE_FILE"
  echo ""
  echo "To revert:"
  echo "  cp $BACKUP_FILE $SOURCE_FILE"
  echo ""
else
  echo "No changes needed - source already formatted correctly"
  rm "$BACKUP_FILE"
fi

echo "=== Format complete ==="
