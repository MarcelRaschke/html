---
name: dco-resolver
description: Diagnose and fix a failing DCO (Developer Certificate of Origin) check on a pull request or branch. Use this whenever a PR shows a failing or action_required "DCO" check, a probot/dco bot complains, commits are missing "Signed-off-by" trailers, the user mentions sign-off, signoff, --signoff, or asks why their PR cannot merge due to certificate-of-origin problems — even if they only paste the bot's error message.
---

# DCO Resolver

The DCO check (usually the probot "DCO" app) requires every commit in a PR to
carry a `Signed-off-by: Author Name <author@email>` trailer whose identity
matches the commit's author. A missing or mismatched trailer on any commit
turns the whole check red and blocks merging. Fixing it always means rewriting
the offending commits, so the central questions are *which commits*, *whose
identity*, and *is this branch yours to rewrite*.

## Step 1: Diagnose

Run the bundled checker (`scripts/dco_check.sh`, next to this SKILL.md) from
inside the repository being diagnosed — invoke it by its full path, since the
target repo is usually not the one the skill lives in. It prints one line per
commit (OK / MISSING / MISMATCH) and exits non-zero if anything fails DCO:

```bash
<path-to-this-skill>/scripts/dco_check.sh [BASE_REF] [HEAD_REF]
```

With no arguments it checks `merge-base(origin/<default branch>, HEAD)..HEAD`,
which is exactly the range a PR check sees. For a PR branch that isn't checked
out, fetch it first (`git fetch origin <branch>`) and pass refs explicitly.

Cross-check with the failing check run on GitHub when available — the DCO
bot's details page lists the offending SHAs and the exact identity string it
expects, which settles any doubt about which email must appear in the trailer.

## Step 2: Choose the fix

First, `git status` — stash or commit any dirty state before touching history.
Then pick the smallest rewrite that covers every failing commit:

| Situation | Fix |
|---|---|
| Only the HEAD commit fails | `git commit --amend --signoff --no-edit` |
| Several/all commits fail | `git rebase --signoff <BASE_REF>` |
| Sign-off present but MISMATCH | Align identities (below), then rebase as above |

`git rebase --signoff` replays each commit unchanged and appends a
`Signed-off-by` trailer using the **current committer identity**
(`git config user.name` / `user.email`). The bot requires the trailer to match
the **author**, so before rebasing confirm they agree:

```bash
git log --format='%an <%ae>' <BASE_REF>..HEAD | sort -u   # author identities
git config user.name && git config user.email              # what --signoff will write
```

- One author, same as current config → rebase directly.
- One author, different from config → set `git config user.name/user.email`
  to the author's identity for the rebase (or fix the author instead, if the
  author identity itself is wrong — e.g. a typo'd email).
- Multiple authors → each author must sign their own commits. Sign off the
  ones matching an identity you may use; report the rest to the user rather
  than forging a sign-off, since the DCO is a legal attestation by that person.

Commit messages, diffs, and order are preserved; only the trailer is added and
the SHAs change.

## Step 3: Verify locally, then push

Re-run the checker — it must print all OK and exit 0 — and confirm the diff is
untouched:

```bash
.claude/skills/dco-resolver/scripts/dco_check.sh <BASE_REF>
git diff <old_head_sha> HEAD   # must be empty: trailers only, no content change
```

Then update the PR branch. A sign-off rewrite is the one routine case where a
history rewrite on a PR branch is the documented remedy (the DCO bot itself
instructs it), but it still only applies to a branch you own:

```bash
git push --force-with-lease
```

- **Never `--force`** — `--force-with-lease` aborts if someone pushed in the
  meantime. If it is rejected, fetch, re-run the diagnosis on the new head,
  and redo the rebase on top of it; don't retry blindly.
- **Never rewrite someone else's branch.** If the PR head belongs to another
  contributor, stop after Step 1 and give them the diagnosis plus the exact
  commands (rebase line from the checker output, then
  `git push --force-with-lease`), or ask the user how to proceed.
- A force-push resets reviews on some repos and reruns CI — say so when
  reporting, and name any approval it dismissed.

## Step 4: Confirm the check

After pushing, the DCO check re-runs on the new head automatically. Verify it
reports success (check run conclusion `success`) before calling the task done;
if it still fails, read the bot's details page — it names the SHA and the
expected identity string — and loop back to Step 2 with that information.

## Prevention

Offer (don't silently apply) the standing fix so the problem stops recurring:
commit with `git commit -s`, or make it automatic for the repository:

```bash
git config alias.ci 'commit -s'
# or, blanket for this repo:
git config format.signoff true
```

A `prepare-commit-msg` hook is the heavier option; prefer the config knobs.

## Edge cases worth knowing

- **Merge commits** in the range: `git rebase` flattens them. If the branch
  history contains merges that must survive, use `git rebase --rebase-merges
  --signoff`; verify the result with `git log --graph` before pushing.
- **Empty range** (base == head): nothing to sign; the failing check is stale —
  re-request it or push any real change.
- **GitHub web-UI commits** (suggestions applied in the browser) never carry
  sign-offs; they always need this treatment afterwards.
- **Repo without the script**: the one-liner equivalent of Step 1 is
  `git log --format='%h %(trailers:key=Signed-off-by,valueonly)' BASE..HEAD`
  — any line with only a SHA is a missing sign-off.
