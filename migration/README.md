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

## Example Sentence Build

Every example sentence of #465 is generated (ADR 0020). `npm run build:dict` builds the sentence files from `sentences/generated.json`, after the premade lists. The build uses no network and no AI. The rules are in `exampleSentences.js`, and `build-dictionary.js` reads and writes the files.

Each record of `generated.json` has a `headword`, which is the HSK word that the sentence is for. The build gives each sentence to its headword only. A word outside HSK gets no sentences.

The build writes these files to `web-client/public/sentences/`. They are build output, and git ignores them:

| File | Contents |
|---|---|
| `<code point>.json` | The sentences of each word that starts with this character. `56fe.json` holds 图书馆. |
| `ATTRIBUTION.txt` | The source of each part of the files: Claude Code for the sentences, CC-CEDICT for the segments |
| `LICENSE.txt` | The licence of the files: CC BY-SA 4.0, because the segment glosses come from CC-CEDICT |

The build also prints a coverage report. The report lists each HSK word that has fewer than 5 sentences. A local run writes the report to `sentences/coverage.md`. CI only prints it. Commit `coverage.md` when it changes, so that a pull request shows the change in coverage.

The build stops on a malformed generated record, on a generated sentence that fails the grader, and on a sentence file over 2 MB. It does not stop on low coverage.

## Generated Sentences

Claude Code writes the sentences for the HSK words that have fewer than 5 (#468). A developer starts the session. `sentences/GENERATE.md` is the prompt and the procedure.

| Script | What it does |
|---|---|
| `sentence-gaps.js` | Writes `sentences/scratch/gaps.json`: each HSK word with fewer than 5 sentences, with its HSK level, its length cap and the number that it needs |
| `sentence-accept.js <file>` | Grades the candidates in the file with the rules of the build. Adds the passes to `sentences/generated.json` and prints each reject with its reason |

Both scripts run the build in memory, so they use the same rules as `npm run build:dict`. Git ignores `sentences/scratch/`.

Each run of the accept script is one round for each word of its candidates. `generated.json` counts the failed rounds of each word. A word that is still short after 3 rounds is unfilled. The gaps script leaves it out, and `coverage.md` lists it. A second session gets only the words that are still short.
