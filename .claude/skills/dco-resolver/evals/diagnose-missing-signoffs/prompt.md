---
tags: [dco-resolver]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write]
---

The DCO check on our pull request just went red and I don't understand why — I thought we were signing everything. The working copy is in ./repo (feature branch "feature/login" is checked out, base branch is "main"). Can you figure out exactly which commits are failing the DCO check and what's wrong with each one? Write your findings to dco-report.md. Don't rewrite any history yet — I want to see the diagnosis first.
