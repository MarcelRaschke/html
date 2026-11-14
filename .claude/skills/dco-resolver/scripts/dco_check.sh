#!/usr/bin/env bash
# dco_check.sh [BASE_REF] [HEAD_REF]
#
# Reports the DCO (Signed-off-by) status of every commit in BASE_REF..HEAD_REF.
# Defaults: BASE_REF = merge-base of origin's default branch and HEAD, HEAD_REF = HEAD.
#
# For each commit prints one line:
#   OK        <sha> <subject>            - has a Signed-off-by matching the author
#   MISSING   <sha> <subject>            - no Signed-off-by trailer at all
#   MISMATCH  <sha> <subject>            - has sign-off(s), none matches "Author Name <author@email>"
#
# Exit code: 0 if every commit is OK, 1 otherwise. Prints a summary and the
# suggested fix command on stderr.
set -eu

HEAD_REF="${2:-HEAD}"
if [ -n "${1:-}" ]; then
  BASE_REF="$1"
else
  DEFAULT_BRANCH=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || true)
  [ -n "$DEFAULT_BRANCH" ] || DEFAULT_BRANCH=$(git branch -r --list 'origin/main' 'origin/master' --format='%(refname:short)' | head -1 | sed 's|^origin/||')
  [ -n "$DEFAULT_BRANCH" ] || { echo "error: cannot determine base; pass BASE_REF explicitly" >&2; exit 2; }
  BASE_REF=$(git merge-base "origin/$DEFAULT_BRANCH" "$HEAD_REF")
fi

total=0; bad=0
while IFS= read -r sha; do
  total=$((total + 1))
  author=$(git log -1 --format='%an <%ae>' "$sha")
  subject=$(git log -1 --format='%s' "$sha")
  signoffs=$(git log -1 --format='%(trailers:key=Signed-off-by,valueonly)' "$sha" | sed '/^$/d')
  if [ -z "$signoffs" ]; then
    printf 'MISSING   %s %s\n' "$(git rev-parse --short "$sha")" "$subject"
    bad=$((bad + 1))
  elif printf '%s\n' "$signoffs" | grep -qxF "$author"; then
    printf 'OK        %s %s\n' "$(git rev-parse --short "$sha")" "$subject"
  else
    printf 'MISMATCH  %s %s (author: %s)\n' "$(git rev-parse --short "$sha")" "$subject" "$author"
    bad=$((bad + 1))
  fi
done < <(git rev-list --reverse "$BASE_REF..$HEAD_REF")

{
  echo
  echo "Checked $total commit(s) in $BASE_REF..$HEAD_REF: $bad failing DCO."
  if [ "$bad" -gt 0 ]; then
    echo "Suggested fix (rewrites history; only on a branch you own):"
    echo "  git rebase --signoff $BASE_REF && git push --force-with-lease"
  fi
} >&2

[ "$bad" -eq 0 ]
