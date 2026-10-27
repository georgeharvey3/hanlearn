# Environments

HanLearn has two Firebase projects. Each project has its own Firestore, Auth, Cloud Functions, and Hosting.

| Environment | Project | Branch | Workflow |
|---|---|---|---|
| Production | `hanlearn-dd14f` | `main` | `deploy.yml` |
| Staging | `hanlearn-35212`, named hanlearn-staging (alias `staging`) | `develop` | `deploy-staging.yml` |
| PR previews | the staging project, one channel for each PR | the PR branch | `firebase-hosting-preview.yml` |

No build other than production uses production data. The preview and staging workflows stop when the project ID is empty or is `hanlearn-dd14f`. They also stop when the build holds the production project ID. See issue #46.

## The release flow

1. A feature PR targets `develop`. Its preview channel deploys to the staging project, with a 7-day expiry.
2. A merge to `develop` deploys hosting, functions, rules, and indexes to the live channel of staging.
3. A PR from `develop` to `main` promotes the change. `deploy.yml` deploys it to production.

The previews and staging share one Firestore. A preview that changes the shape of the data can corrupt the staging data. If this occurs, reseed staging (see below).

## Set up the staging project

The owner of the Firebase account does these steps one time.

1. Create a Firebase project. The staging project is named hanlearn-staging, and its ID is `hanlearn-35212`.
2. Make sure that the `staging` alias in `.firebaserc` is the project ID, not the name.
3. Enable the Email/Password sign-in method in Authentication.
4. Create the Firestore database in the same region as production.
5. Enable Hosting.
6. Change the project to the Blaze plan. Set a budget alert on the billing account.
7. In AI Logic, enable the Gemini Developer API. The example sentences use it.
8. In Google Cloud, enable these APIs. The deploy account cannot enable an API, so the first deploy stops if one is missing.
   - Cloud Functions API, Cloud Build API, and Artifact Registry API, for the functions deploy
   - Cloud Billing API (`cloudbilling.googleapis.com`) and Firebase Extensions API (`firebaseextensions.googleapis.com`), for the functions deploy. Since firebase-functions 7, the deploy checks extensions and billing, also when the project has no extensions
   - Cloud Text-to-Speech API, for the audio
   - Agent Platform API (`aiplatform.googleapis.com`, earlier named Vertex AI API), for the sentence score
9. In Project settings > Service accounts, generate a key for the Firebase Admin SDK account. Add it as the GitHub secret `FIREBASE_SERVICE_ACCOUNT_STAGING`.
10. In Google Cloud IAM, give that account these roles: Cloud Functions Admin, Service Account User, Firebase Hosting Admin, Firebase Rules Admin, Cloud Datastore Index Admin, and Artifact Registry Administrator.
11. Add the web configuration as the GitHub secrets `STAGING_FIREBASE_API_KEY`, `STAGING_FIREBASE_AUTH_DOMAIN`, `STAGING_FIREBASE_PROJECT_ID`, `STAGING_FIREBASE_STORAGE_BUCKET`, `STAGING_FIREBASE_MESSAGING_SENDER_ID`, and `STAGING_FIREBASE_APP_ID`.
12. Run the `Deploy to Staging` workflow from the Actions tab. GitHub shows this button only when the workflow is on `develop`. A push to `develop` also starts it.
13. Seed the staging data.

If the build of one function fails with "Build error details not available", run the workflow again. On the first deploy, one function of eleven failed this way and the next run deployed it.

The first deploy uses `--force`. This flag sets the cleanup policy of Artifact Registry, so the function images stay in the free 0.5 GB. The first deploy set it on 2026-10-27, and it deletes images older than 1 day.

The preview channels that the old workflow opened on `hanlearn-dd14f` stay live until they expire. To remove them now, run `firebase hosting:channel:list --project hanlearn-dd14f`. Then run `firebase hosting:channel:delete <channel> --project hanlearn-dd14f` for each `pr-` channel.

## Seed the staging data

The seed writes a test account, `test@hanlearn.test`. The account has 13 words in two lists, General and Travel, and two words are in both lists. The seed also writes the chengyus and the dictionary entries of their characters, which the chengyu functions read from `words`.

1. Run `npm run build:dict` at the repo root.
2. Save the key of the staging service account as `migration/service-account-staging.json`. Git ignores this file.
3. Run `npm install` in `migration/`.
4. In `migration/`, run `STAGING_TEST_PASSWORD=<password> npm run seed:staging`.

The password is not in the repository, because the staging site is public. The seed stops if the key is for `hanlearn-dd14f`. A second run writes the same documents again, so you can use it to reseed.

## Roll back production

A production deploy changes four parts: hosting, functions, Firestore rules, and indexes. The hosting rollback is fast, but it changes only hosting. A revert PR deploys all four parts again.

1. In the Firebase console of `hanlearn-dd14f`, open Hosting > Release history.
2. On the last good release, select Rollback. Users get the earlier bundle on the next load.
3. Make a branch from `main` and revert the merge commit of the bad release: `git revert -m 1 <merge-commit>`.
4. Open a PR from this branch to `main`. When it merges, `deploy.yml` deploys the reverted functions, rules, and indexes.
5. Merge `main` back into `develop`, so that `develop` also holds the revert.

CAUTION: Do not roll back hosting alone after a change to the shape of the data. The old bundle can read the new shape incorrectly, and its backfill can write over the data.

Firestore has no rollback for data. Test each data migration on staging before the release. A migration that keeps the old field until the next release can be reverted. The `listIds` backfill of #428 is an example: the words kept their list in `listIds`.
