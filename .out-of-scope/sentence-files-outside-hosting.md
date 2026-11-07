# Example sentence files outside the client build

The example sentence files stay in the client build. `build:dict` writes them to
`web-client/public/sentences/`, and Firebase Hosting serves them as static files.
The app does not move them to Firestore, Cloud Storage or a separate host.

## Why this is out of scope

[ADR 0019](../docs/adr/0019-example-sentences-are-a-committed-build.md) records
the decision: the sentences are a committed build, with no network and no AI at
run time. Static files on Hosting are the simplest way to serve that build.

The files do not make the app slower to load:

- The files are not part of the JS bundle. Vite copies them from `public/` to
  `dist/` as they are.
- `sentenceService` fetches only the file for the first character of a word, and
  keeps it in memory for the session. The largest file is about 216 KB before
  gzip.
- Firebase Hosting uploads only the files whose hash changed. A deploy with no
  sentence change uploads none of them.

The only cost is the size of the deploy artifact. In November 2026 the folder held
2,486 files and 29 MB, against 14 MB for `dist/assets`. That cost does not
justify a second store and a second deploy path.

A move becomes worth a new look when one of these occurs:

- A sentence change must reach learners without a client deploy.
- The folder grows enough to slow the deploy, or it reaches a Hosting limit.

Each of these changes ADR 0019, so it needs a new ADR.

## Prior requests

- #500: "Move sentences out of the client build"
