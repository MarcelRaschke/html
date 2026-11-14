---
tags: [dco-resolver]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

probot/dco is blocking my PR — it says every commit on my branch is missing a Signed-off-by line. The clone is in ./repo with branch "feature/phase-x" checked out (base is "main", and the remote "origin" is already configured and has the branch). Please fix the DCO failure and update the remote branch so the check can re-run. Make sure none of my actual changes or commit messages get lost.
