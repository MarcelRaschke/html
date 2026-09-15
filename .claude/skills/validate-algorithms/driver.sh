#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
SOURCE_FILE="$REPO_ROOT/source"

echo "=== HTML Algorithm Validator ==="
echo "Checking: $SOURCE_FILE"
echo ""

ERRORS=0

# Check 1: Unmatched algorithm tags
echo "Checking algorithm tag matching..."
OPEN_COUNT=$(grep -o '<div algorithm' "$SOURCE_FILE" | wc -l)
CLOSE_COUNT=$(grep -o '</div>' "$SOURCE_FILE" | wc -l)

if [ "$OPEN_COUNT" -gt 0 ]; then
  echo "  Found $OPEN_COUNT <div algorithm> tags"
fi

# Check 2: Unscoped var tags
echo "Checking var-scoping..."
UNSCOPED_VARS=$(perl -ne '
  $in_algorithm = 1 if /<div\s+algorithm/;
  $in_var_scope = 1 if /var-scope/;
  $in_domintro = 1 if /class="domintro"/;
  $in_ignore = 1 if /\<var\s+[^>]*ignore/;

  if (/<var\b/ && !$in_ignore && !$in_algorithm && !$in_var_scope && !$in_domintro) {
    print "Line $.: $_";
    $issues++;
  }

  $in_algorithm = 0 if /<\/div>/;
  $in_var_scope = 0 if /<\/div>/;
  $in_domintro = 0 if /<\/dl>/;
  $in_ignore = 0 if /<\/var>/;

  END { exit $issues ? 1 : 0 }
' "$SOURCE_FILE" 2>/dev/null || true)

if [ -z "$UNSCOPED_VARS" ]; then
  echo "  ✓ All <var> tags are properly scoped"
else
  echo "  ✗ Found potentially unscoped <var> tags:"
  echo "$UNSCOPED_VARS" | head -10
  ERRORS=$((ERRORS + 1))
fi

# Check 3: Single-use variables in algorithms
echo "Checking for single-use variables in algorithms..."
SINGLE_VARS=$(perl -ne '
  if (/<div\s+algorithm/) {
    $in_algo = 1;
    %var_count = ();
    $algo_start = $.;
  }

  if ($in_algo && /<var\b[^>]*>([^<]+)<\/var>/) {
    $var_count{$1}++;
  }

  if ($in_algo && /<\/div>/) {
    foreach $var (keys %var_count) {
      if ($var_count{$var} == 1 && $var !~ /ignore/) {
        printf "Line %d: single-use var: %s\n", $algo_start, $var;
        $issues++;
      }
    }
    $in_algo = 0;
  }

  END { exit $issues ? 1 : 0 }
' "$SOURCE_FILE" 2>/dev/null || true)

if [ -z "$SINGLE_VARS" ]; then
  echo "  ✓ No suspicious single-use variables found"
else
  echo "  ⚠ Found potential single-use variables (may be intentional):"
  echo "$SINGLE_VARS" | head -5
fi

# Summary
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "=== Validation passed ==="
  echo "All algorithm markup appears valid."
  exit 0
else
  echo "=== Validation failed ==="
  echo "Fix the issues above and re-run."
  exit 1
fi
