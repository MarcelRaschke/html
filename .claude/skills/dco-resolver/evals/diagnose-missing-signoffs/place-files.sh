#!/usr/bin/env bash
# Builds a fixture repo: main + feature/login with one unsigned commit,
# one mismatched sign-off, and one correct sign-off.
set -eu
git init -q -b main repo
cd repo
git config user.name "Dev One"
git config user.email "dev@example.com"
echo "# App" > README.md
git add README.md
git commit -q -s -m "Initial commit"
git checkout -q -b feature/login
echo "login form" > login.js
git add login.js
git commit -q -m "Add login form"                       # MISSING sign-off
echo "validation" > validate.js
git add validate.js
git commit -q -m "Add validation" -m "Signed-off-by: Other Person <other@example.com>"  # MISMATCH
echo "logout" > logout.js
git add logout.js
git commit -q -s -m "Add logout button"                 # OK
git rev-parse HEAD > ../head-before.txt
