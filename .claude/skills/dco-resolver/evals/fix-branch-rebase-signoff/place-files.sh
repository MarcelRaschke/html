#!/usr/bin/env bash
# Builds a fixture: bare origin + clone with 4 unsigned commits on feature/phase-x.
set -eu
git init -q --bare origin.git
git init -q -b main repo
cd repo
git config user.name "Dev One"
git config user.email "dev@example.com"
git remote add origin ../origin.git
echo "# App" > README.md
git add README.md
git commit -q -s -m "Initial commit"
git push -q origin main
git checkout -q -b feature/phase-x
for n in 1 2 3 4; do
  echo "feature part $n" > "feature$n.js"
  git add "feature$n.js"
  git commit -q -m "Phase X.$n: add feature part $n"
done
git push -q -u origin feature/phase-x
git log --format='%H %T' origin/main..HEAD > ../commits-before.txt
