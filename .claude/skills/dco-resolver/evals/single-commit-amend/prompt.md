---
tags: [dco-resolver]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

ugh, the DCO bot just failed my PR again — I forgot the -s on my last commit. The repo is ./repo, branch "fix/typo" is checked out, base is "main", origin has the branch already. The earlier commits on the branch were signed properly, it's just the newest one. Can you sort it out and push? I'd rather not have the whole branch history churn if it's only one commit.
