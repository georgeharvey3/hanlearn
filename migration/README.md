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

`npm run build:dict` builds the example sentence files of #465 from two committed sources, after the premade lists (ADR 0020):

- `sentences/tatoeba.json`: the Tatoeba sentences of native Mandarin writers, with their English translations. `npm run fetch:tatoeba` downloads the file again. The rules are in `tatoeba.js`.
- `sentences/generated.json`: the sentences that Claude Code wrote (see Generated Sentences).

The build uses no network and no AI. The rules are in `exampleSentences.js`, and `build-dictionary.js` reads and writes the files.

Each sentence goes to every HSK word that it holds and passes the grader for. A generated sentence must pass the grader for its `headword`, or the build stops. The build drops a Tatoeba sentence with fewer than 6 Han characters or with a name. A word outside HSK gets no sentences. Each word keeps 3 sentences at most (#482).

Each segment shows the pinyin and the gloss of one CC-CEDICT entry (#479). An override always wins. Without one, an HSK word shows the entry of the premade-list resolver. A single character outside HSK shows the entry that the HSK words with this character read most often, so 居 is *jū* as in 居住. The gloss is the first 3 useful senses of the entry, divided by "; ".

`sentences/gloss-overrides.json` sets the entry and the gloss of one segment text. Each override names the entry by its pinyin with tone numbers, and by `trad` when two entries have the same pinyin. If a person finds a wrong pinyin or gloss in use, add an override for it. The build stops on an override that names no entry.

The build writes these files to `web-client/public/sentences/`. They are build output, and git ignores them:

| File | Contents |
|---|---|
| `<code point>.json` | The sentences of each word that starts with this character. `56fe.json` holds 图书馆. |
| `ATTRIBUTION.txt` | The source of each part of the files, and one line for each Tatoeba sentence with its id and its owners |
| `LICENSE.txt` | The licence of the files: CC BY-SA 4.0, because the segment glosses come from CC-CEDICT. The Tatoeba sentences are also CC BY 2.0 FR |

The build also prints a coverage report. The report lists each HSK word that has fewer than 3 sentences. A local run writes the report to `sentences/coverage.md`. CI only prints it. Commit `coverage.md` when it changes, so that a pull request shows the change in coverage.

The build stops on a gloss override that names no entry, on a malformed record, on a generated sentence that fails the grader, and on a sentence file over 2 MB. It does not stop on low coverage.

## Component Breakdown Build

`npm run build:dict` writes one component breakdown file for each character of the HSK words (#528). The file holds the tree of the parts of the character. Each part has its strokes, a label, and a meaning clue or a sound clue when the data has one. The source is Make Me a Hanzi, the data behind Hanzi Writer.

The committed sources are in `components/`:

- `components/source/dictionary.txt`, `COPYING` and `LGPL`: Make Me a Hanzi at one pinned commit. `dictionary.txt` is LGPL 3.0 or later.
- `components/source/GPL`: the GPL 3.0 text, which the LGPL adds to.
- `components/source/stroke-counts.json`: the stroke count of each character in `hanzi-writer-data@2.0.1`, the stroke data that the app loads.
- `components/source/stroke-ends.json`: the first and last point of the median line of each stroke in the same data. The shape check reads it.
- `components/labels.json`: the labels file. `labels` gives the label of a part. A part with a label does not split, but the top character always splits. `groups` names a group that is a real character (`⿱亠凶` is 㐫). `pieces` names an unnamed piece of one character by its path in the decomposition (the `1.2` of 赢 is 凡). An empty file is legal.

`npm --prefix migration run fetch:makemeahanzi` downloads the sources again. The build uses no network. The rules are pure, in `componentBreakdown.js`.

The tree follows three rules (#527):

- A group with no name of its own is not a step. Its pieces join the split directly, so 疑 is 匕 + 矢 + an unnamed piece + 疋.
- Splitting stops at a part with a label in the labels file, so the 口 of 礙 does not split into 冂 + 一. The top character always splits, because most HSK characters (是, 道) are also a labelled part of another character. So the breakdown of 口 itself shows 冂 + 一.
- An unnamed piece never stops a split. It is a part with no character and no label.

A part splits only when its strokes in the parent agree with the part alone. The stroke count must be the same. The shape must also be the same: each stroke must start and end near the same place, after the build scales both to the same size. The data can name a part by a character in another form. The left side of 難 is 𦰩, but the data calls it 堇, and the split of 堇 shows 土 for the 大 of 𦰩. A part that fails either check stays whole, and the build prints the count of these parts.

A part with no entry in the labels file takes the first sense of its Make Me a Hanzi definition. The build prints each part character with no label from either source. It also prints the number of parts that still use this fallback label.

The labels file holds the learner label of the most frequent parts in HSK 1–7 (#531), and of every part in the HSK 1–3 trees, simplified and traditional (#532). The one exception is 㐫: a label stops its split, and 脑 must show 凶. A side form takes its learner name (亻 is "person", not "man"). A character takes the sense that a learner needs inside other characters (凶 is "fierce", not "culprit").

The build stops when the labels file gives a label to a part that is in no breakdown. This occurs with a typo. It also occurs when a part only shows inside a part with a label, because that part does not split. For example, 丄 only shows inside 工.

The build stops when the Hanzi Writer stroke data has no HSK character, or gives it a different stroke count from Make Me a Hanzi. The data often gives a part fewer strokes than the part has alone: 斤 holds a 下 of 2 strokes. Such a part keeps its strokes and its label, but it does not split. The build prints the number of these parts.

The build writes these files to `web-client/public/breakdowns/`. They are build output, and git ignores them:

| File | Contents |
|---|---|
| `<code point>.json` | The breakdown of one character. `7919.json` holds 礙. |
| `ATTRIBUTION.txt` | The source of the files and the Make Me a Hanzi notice |
| `LICENSE.txt` | The licence of the files: LGPL 3.0, with the Unihan notice |
| `GPL.txt` | The GPL 3.0, which the LGPL adds to |

Each file is `{ c, p }`: the character and its parts, or `p: null` when it does not split. Each part is `{ c, s, l, y?, r?, p? }`. `c` is the character (null for an unnamed piece), `s` the stroke indices in the top character, and `l` the label. `y` is the pinyin, `r` is `meaning` or `sound`, and `p` holds the parts of the part.

## Reported Part Meanings

A learner can report a wrong part meaning from the line of a tapped part in the breakdown (#533). Each report goes to `users/{userId}/partReports/{reportId}`. The report holds the character, the parent, the part, the stroke indices of the part and the label that the line showed. The parent is the character directly above the part. The part and the label are null for a piece with no name of its own.

1. Run `node export-part-reports.js`. It writes `part-reports.csv`, with one row for each report. The rows of one part are together.
2. For a wrong label, set the label of the part in `labels` in `components/labels.json`. Many labels come from Make Me a Hanzi and are not in the file yet. A part with a label in the file does not split, but the top character always splits.
3. For a piece with no name of its own, add the piece to `pieces` in `components/labels.json`, under the parent. The `strokes` column finds the piece in `char`.
4. Run `npm run build:dict`.

The script needs `service-account.json`, the same as `export-review-log.js`. Git ignores the CSV file. The rows are pure, in `partReportCsv.js`.

## Reported Sentences

A learner can report a bad sentence from the sentence stages (#469). Each report goes to `users/{userId}/sentenceReports/{sentenceId}`.

1. Run `node export-sentence-reports.js`. It writes `sentence-reports.csv`, with one row for each reported sentence and the most reported first.
2. For a wrong pinyin or gloss, add an override to `sentences/gloss-overrides.json`.
3. For a bad generated sentence, change it or remove it in `sentences/generated.json`.
4. Run `npm run build:dict`.

The script needs `service-account.json`, the same as `export-review-log.js`. Git ignores the CSV file.

## Generated Sentences

Claude Code writes the sentences for the HSK words that have fewer than 3 (#468). A developer starts the session. `sentences/GENERATE.md` is the prompt and the procedure.

| Script | What it does |
|---|---|
| `sentence-gaps.js` | Writes `sentences/scratch/gaps.json`: each HSK word with fewer than 3 sentences, with its HSK level, its length cap and the number that it needs |
| `sentence-accept.js <file>` | Grades the candidates in the file with the rules of the build. Adds the passes to `sentences/generated.json` and prints each reject with its reason |

Both scripts run the build in memory, so they use the same rules as `npm run build:dict`. Git ignores `sentences/scratch/`.

Each run of the accept script is one round for each word of its candidates. `generated.json` counts the failed rounds of each word. A word that is still short after 3 rounds is unfilled. The gaps script leaves it out, and `coverage.md` lists it. A second session gets only the words that are still short.
