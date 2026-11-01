# HanLearn Data Migration

Build static dictionary file from CC-CEDICT for client-side lookups.

## Why Static Dictionary?

Instead of storing ~124K dictionary entries in Firestore (which incurs read costs), the dictionary is served as a static JSON file. This eliminates database costs while keeping user-specific data (word banks, progress) in Firestore.

## Prerequisites

1. Node.js installed
2. CC-CEDICT dictionary file

## Steps

### 1. CC-CEDICT Dictionary

The repository holds `cedict_ts.u8`, the CC-CEDICT release of 2026-01-02. Do not replace it with a newer release.

The ID of an entry is its position in the file, and each `userWords` document uses this ID as its document ID. A newer release moves the IDs. For this reason, `build-dictionary.js` stops if the SHA-256 of the file changes. Before you change the file, migrate the `userWords` IDs. See issue #427.

### 2. Build the Dictionary

```bash
cd migration
node build-dictionary.js
```

This generates `web-client/public/dictionary.json` (~15 MB, 124K entries).

### 3. Deploy

The dictionary file will be served from `/dictionary.json` when the frontend is deployed.

## What's in the Dictionary

Each entry contains:
- `id`: The position of the entry in `cedict_ts.u8`, starting at 1
- `simp`: Simplified Chinese
- `trad`: Traditional Chinese
- `pinyin`: Romanization
- `meaning`: English definitions

## Architecture

- **Static dictionary** (`/dictionary.json`): Served from web host, loaded lazily on first search
- **User data** (Firestore): Auth, word banks, spaced repetition progress
- **Chengyus**: Still loaded from the chengyus.txt file (small dataset)

## Legacy: Firestore Import (Not Recommended)

The `import_firestore.ts` script can import the dictionary to Firestore, but this incurs costs:
- ~124K write operations to populate
- Read costs every time users search

Use the static dictionary approach instead.

## Sentence Sources

The example sentences of #465 come from one committed source file for each sentence source. The build reads these source files, so it needs no network. The source files are in `sentences/`:

| Source file | Made by | Licence |
|---|---|---|
| `sentences/tatoeba.json` | `fetch-tatoeba.js` | CC BY 2.0 FR |
| `sentences/wiktionary.json` | `fetch-wiktionary.js` | CC BY-SA 4.0 |
| `sentences/sentence-cache.json` | `export-sentence-cache.js` | None (Gemini output) |

A source file holds its source, its download date and its licence, then one source record on each line. `sentenceSources.js` holds the rules and gives the fields of a record. A new download shows as a line diff in a pull request.

### Download Tatoeba or Wiktionary again

1. Make sure that `bunzip2` is on the `PATH`. The Tatoeba script needs it.
2. Run the fetch script of the source:

   ```bash
   cd migration
   node fetch-tatoeba.js
   node fetch-wiktionary.js
   ```

3. Read the diff of the source file, then commit it.

The Tatoeba script keeps the Mandarin sentences that have a direct link to an English sentence. It drops the sentences with a tag that marks them as wrong, and the sentences that mix simplified and traditional characters. The Wiktionary script keeps the Mandarin usage examples that have an English translation.

### Export sentenceCache

The export script reads the `sentenceCache` collection of production. It does not write to Firestore.

1. Save a service account key of the production project as `service-account.json` in this directory. A key with the Cloud Datastore Viewer role is sufficient.
2. Run `npm install` in this directory.
3. Run `node export-sentence-cache.js`.
4. Commit `sentences/sentence-cache.json`.

## Example Sentence Build

`npm run build:dict` builds the example sentences from the source files, after the premade lists. The build uses no network and no AI. The rules are in `exampleSentences.js`, and `build-dictionary.js` reads and writes the files.

The build writes these files to `web-client/public/sentences/`. They are build output, and git ignores them:

| File | Contents |
|---|---|
| `<code point>.json` | The sentences of each word that starts with this character. `56fe.json` holds 图书馆. |
| `ATTRIBUTION.txt` | One line for each sentence: its id, its source and its author |
| `LICENSE.txt` | The licence of the files (CC BY-SA 4.0) and of each source |

The build also prints a coverage report. A local run writes the report to `sentences/coverage.md`. CI only prints it. Commit `coverage.md` when it changes, so that a pull request shows the change in coverage.

The build stops on a malformed source record, on a generated sentence that fails the grader, and on a sentence file over 2 MB. It does not stop on low coverage.

If `sentences/generated.json` exists, the build reads it. Each record has the fields of a source record and a `headword`, which is the word that the sentence is for. Issue #468 adds this file.
