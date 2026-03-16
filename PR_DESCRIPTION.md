## Summary

Sets up a continuous deployment pipeline using GitHub Actions. Feature branches merge into `develop`; production releases happen automatically when `develop` is merged into `main`.

- **New deploy workflow** (`deploy.yml`): Triggered on push to `main`, builds and deploys web-client, Cloud Functions, Firestore rules, and indexes to Firebase
- **New release workflow** (`release.yml`): Triggered after successful deploy, creates a date-based GitHub Release (e.g. `v1.2026.0316`) with auto-generated changelog
- **Updated CI** (`ci.yml`): Now runs on PRs targeting both `develop` and `main`
- **Scoped preview deploys** (`firebase-hosting-preview.yml`): Preview channels only for PRs targeting `develop` (not the develop→main release PR)
- **New deploy scripts** in `package.json`: `deploy:functions` and `deploy:all` for convenience
- **Updated CLAUDE.md**: Documents new branching model and release process

## Key implementation details

- Deploy workflow uses `concurrency` group to queue simultaneous deploys rather than running in parallel
- Release tags use `v1.YYYY.MMDD` format with automatic sequence suffix for same-day deploys (e.g. `v1.2026.0316.2`)
- Deploy is a single `firebase deploy` command covering hosting, functions, rules, and indexes to keep them in sync
- Uses existing `FIREBASE_SERVICE_ACCOUNT` secret and `google-github-actions/auth@v2` for authentication

## Decisions and trade-offs

- **No staging environment**: Deploys go directly to production. A staging Firebase project could be added later but is out of scope
- **workflow_run trigger for releases**: The release workflow runs after deploy succeeds, keeping concerns separated and avoiding releases on failed deploys
- **Date-based versioning**: Chose `v1.YYYY.MMDD` over semver since the app is a continuously deployed web app without a public API

## Manual setup required

1. Change default branch to `develop` in GitHub repo settings
2. Add branch protection rules for `main` (require PR, CI, review) and `develop` (require PR, CI)
3. Verify `FIREBASE_SERVICE_ACCOUNT` has permissions for Cloud Functions, Firestore rules, and indexes (needs `Firebase Admin` or `Editor` role + `Cloud Functions Developer`)

## Files modified

- `.github/workflows/ci.yml` — added `branches: [develop, main]` filter
- `.github/workflows/firebase-hosting-preview.yml` — scoped to `branches: [develop]`
- `.github/workflows/deploy.yml` — **new** production deploy workflow
- `.github/workflows/release.yml` — **new** GitHub Release creation workflow
- `package.json` — added `deploy:functions` and `deploy:all` scripts
- `CLAUDE.md` — updated Git Conventions with branching model and release process
