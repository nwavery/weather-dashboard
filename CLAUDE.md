# Weather Dashboard — notes for Claude

## Git / PRs in the remote environment

The local `main` ref does **not** track new merges to `origin/main` while you
work on a feature branch — it drifts behind (often by 100+ commits). As a
result, `git log main..<branch>` and `git diff main...<branch>` will list a pile
of commits that are *already merged* and make a one-file change look like a
whole session's work.

Before describing a PR or reasoning about what a branch actually changes:

- `git fetch origin main` first, then diff against `origin/main` (not local `main`).
- Or just read the PR's own computed diff: `pull_request_read` with
  `get_files` / `get_diff`, which GitHub computes against the live base.

Write the PR body from that real diff, not from `git log` against a stale ref.
