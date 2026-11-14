#!/usr/bin/env bash
# Fixture: bare origin + clone; fix/typo has 2 signed commits and 1 unsigned HEAD.
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
git checkout -q -b fix/typo
echo "fix one" > a.txt
git add a.txt
git commit -q -s -m "Fix first typo"
echo "fix two" > b.txt
git add b.txt
git commit -q -s -m "Fix second typo"
echo "fix three" > c.txt
git add c.txt
git commit -q -m "Fix third typo"        # MISSING sign-off (HEAD)
git push -q -u origin fix/typo
git rev-parse HEAD~2 HEAD~1 > ../shas-before.txt
