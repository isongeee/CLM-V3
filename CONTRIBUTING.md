# Branching workflow

This repo uses three long-lived branches:
- `development`: active development (default merge target for features)
- `staging`: release candidate branch
- `main`: production branch

## Day-to-day flow

1) Create a feature branch from `development`:
- `git fetch origin --prune`
- `git switch development`
- `git pull --ff-only`
- `git switch -c feature/my-change`

2) Commit and push:
- `git add -A`
- `git commit -m "Describe change"`
- `git push -u origin feature/my-change`

3) Open a PR:
- `feature/my-change` → `development`

4) Promote to staging when ready:
- Run GitHub Action: **Promote Branch**
- Select `development_to_staging`
- Merge the resulting PR after CI passes

5) Promote to production:
- Run GitHub Action: **Promote Branch**
- Select `staging_to_main`
- Merge the resulting PR after CI passes

## Recommended GitHub branch protection

In GitHub → Settings → Branches:
- Protect `main` and `staging`
  - Require a pull request before merging
  - Require status checks to pass: `CI`
  - Require linear history (optional but recommended)
  - Block force pushes and deletions
- Optionally protect `development` similarly (lighter rules).

