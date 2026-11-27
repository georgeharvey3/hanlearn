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
- `meaning`: English definitions, divided by "/". Each meaning is a clean meaning (#488)

## Clean Meanings

The build cleans each CC-CEDICT meaning once, with the pure rule of `cleanMeaning.js` (#488). The dictionary, `char-definitions.json`, the premade lists, the sentence glosses and the chengyu character table all read the clean meaning.

- A pointer sense ("variant of", "abbr. for", "used in", "see") becomes the clean senses of its target. The rule follows a pointer to a pointer once at most.
- A parenthesis that holds Chinese goes: examples, measure words and pronunciations.
- A Chinese reference in the text goes, and the English around it stays.
- Labels such as `(fig.)` and classifier senses stay.

An entry with no sense left is not in the dictionary. The build writes these entries to `dictionary/emptied-entries.md`, sorted by HSK level and rank. The build fails when a meaning holds a Chinese character or a pinyin reference.

After a change to the chengyu characters or to the clean rule, run `node build-chengyu-char-meanings.mjs`. Then run Prettier on `web-client/src/data/chengyuCharMeanings.ts`.

### Saved Words

A saved word keeps the meaning that it had when the learner added it. To give the saved words the clean meaning, do these steps:

1. Run `npm run build:dict` at the repo root.
2. Run `node clean-saved-meanings.js --key <file>`. This dry run writes nothing. It prints the count of changed words, a sample, and the words with no entry.
3. If the result is correct, run the same command with `--write`.

The script changes only `wordData.meaning`. It never changes `amendedMeaning`. A second run changes nothing. Run it on staging first, and on production only after the maintainer approves.

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

The build gives each sentence of a word one pool in the field `pool`: `intro`, `comprehend` or `compose` (#581). The intro pool serves the word page, the new word introduction and the hint. A shuffle orders the picked sentences, and the pools take them in the order intro, Comprehend, Compose. The word and the ids of its picked sentences seed the shuffle, so each build gives the same pools. A word with 2 sentences has no Compose pool, and a word with 1 sentence has only an intro pool. The client then borrows a sentence for each empty pool.

Each segment shows the pinyin and the gloss of one CC-CEDICT entry (#479). An override always wins. Without one, an HSK word shows the entry of the premade-list resolver. A single character outside HSK shows the entry that the HSK words with this character read most often, so 居 is *jū* as in 居住. The gloss is the first 3 useful senses of the entry, divided by "; ".

`sentences/gloss-overrides.json` sets the entry and the gloss of one segment text. Each override names the entry by its pinyin with tone numbers, and by `trad` when two entries have the same pinyin. If a person finds a wrong pinyin or gloss in use, add an override for it. The build stops on an override that names no entry.

`sentences/near-miss-lists.json` holds the measure word list and the aspect word list of the tile mode of the Compose tab (#386). Each sentence of a word gets its tiles. First come the characters of the sentence, then the near-miss tiles. The total is twice the number of characters, and 28 at most. The near-miss tiles come in this order:

1. The homophones of the characters of the target word.
2. The other words of a list that holds a segment.
3. The homophones of the other characters.

A homophone is a character of an HSK word with the same syllable, in any tone. The build stops on a list word that is not one character.

`sentences/blocked.json` blocks a bad Tatoeba sentence for every word, or one credit of a sentence to one word (#485). Each entry has a sentence id, an optional `word`, a `reason` and the sentence text `simp` for the review. The build stops on an entry with no Tatoeba sentence of its id, with no reason, or with a word outside HSK. It also stops on a credit entry for a word that the sentence does not hold. See Checked Tatoeba Credits.

The build writes these files to `web-client/public/sentences/`. They are build output, and git ignores them:

| File | Contents |
|---|---|
| `<code point>.json` | The sentences of each word that starts with this character. `56fe.json` holds 图书馆. |
| `ATTRIBUTION.txt` | The source of each part of the files, and one line for each Tatoeba sentence with its id and its owners |
| `LICENSE.txt` | The licence of the files: CC BY-SA 4.0, because the segment glosses come from CC-CEDICT. The Tatoeba sentences are also CC BY 2.0 FR |

The build also prints a coverage report. The report lists each HSK word that has fewer than 3 sentences. A local run writes the report to `sentences/coverage.md`. CI only prints it. Commit `coverage.md` when it changes, so that a pull request shows the change in coverage.

The build stops on a gloss override that names no entry, on a bad block entry, on a malformed record, on a generated sentence that fails the grader, and on a sentence file over 2 MB. It does not stop on low coverage.

### Distractors

The Comprehend tab shows the English of each sentence with the English of 3 **distractors** (#601). `sentences/distractors.json` holds the distractor ids of each built sentence. The build writes the id and the English of each distractor into the sentence files, in the field `distractors`. Thus a corrected English translation needs no new run.

`node write-distractors.js` writes the file again. Run it after a change to the sentences, for example after `sentence-accept.js` or a new block in `sentences/blocked.json`. The script runs the sentence build in memory and embeds the English of each sentence with `Alibaba-NLP/gte-modernbert-base`, at a pinned revision (`embedder.js`). The first run downloads the model, about 600 MB. A run takes about 15 minutes on a laptop CPU. Run `npm install` in this directory first.

A candidate has an English cosine to the sentence of 0.60 to 0.83. It is not a sentence of the same word, and no segment of it has a gloss word of the target segment. Its English is not the English of the sentence or of another option. Its toneless pinyin is not the toneless pinyin of the sentence. The candidates rank by the Chinese content words that they share with the sentence, then by the cosine. If the band gives fewer than 3, the candidates with a cosine of 0.45 to 0.60 give the rest. The values are in `distractors.js`, and the rules are pure.

`sentences/blocked-distractors.json` blocks one pair of a sentence `id` and a `distractor`, with a `reason`. The script skips a blocked pair.

The build stops in these conditions:

- The sentence that the Comprehend tab shows has fewer than 3 distractors. Run `node write-distractors.js`.
- A distractor is not a built sentence, or `sentences/blocked.json` blocks it.
- The file holds a pair of the block list of distractors.

## Component Breakdown Build

`npm run build:dict` writes one component breakdown file for each character of the HSK words (#528). The file holds the tree of the parts of the character. Each part has its strokes and a label. The file also holds the origin of the character when the data has one (#569).

The build does not find a part by its shape, and it has no tolerance to tune. It reads definitions. A definition gives one character, drawn with a known number of strokes, as a list of parts. It gives each part its strokes.

### Sources

The committed sources are in `components/`:

- `components/source/animcjk.json`: the "acjk" text of each character of AnimCJK, at one pinned commit. The four sets are simplified Chinese (`hans`), traditional Chinese (`hant`), Japanese (`ja`) and Korean (`ko`). `animcjk-COPYING.txt` is the AnimCJK notice. The dictionary files of AnimCJK are LGPL 3.0 or later.
- `components/source/dictionary.txt`, `COPYING` and `LGPL`: Make Me a Hanzi at one pinned commit. `dictionary.txt` is LGPL 3.0 or later.
- `components/source/GPL`: the GPL 3.0 text, which the LGPL adds to.
- `components/source/stroke-counts.json` and `stroke-medians.json`: the stroke count of each character in `hanzi-writer-data@2.0.1`, and the median line of each stroke. The app draws this stroke data. The median lines are simplified with a tolerance of 16 units of the 1024 box, and the first and last point of each stroke stay exact ([strokeMedians.js](strokeMedians.js)). `hanzi-writer-ARPHICPL.txt` is the licence of this data.
- `components/source/wiktionary.json`: the Wiktionary composition of each character entry, from the Translingual dictionary of Wiktextract on kaikki.org. The file gives the date of the Wiktionary dump. `wiktionary-NOTICE.txt` gives the credit. The text is CC BY-SA 4.0. The build uses it only for the comparison below.
- `components/definitions.json`: the definitions file. It holds the acjk text of each form that the two sources do not have.
- `components/labels.json`: the labels file.

`npm --prefix migration run fetch:makemeahanzi` downloads the Make Me a Hanzi and Hanzi Writer files again. Then `npm --prefix migration run fetch:animcjk` downloads the AnimCJK file again. `npm --prefix migration run fetch:wiktionary` downloads the Wiktionary file again. kaikki.org keeps only its latest extraction, so a new download gives the data of a new dump. The build uses no network. The rules are pure, in `componentBreakdown.js`.

### The acjk text

An acjk text gives the parts of one character in stroke order, with the stroke count of each part: `續⿰糹.6賣15`. The first 6 strokes of 續 are 糹, and the next 15 are 賣. A count is the number of strokes that this character gives the part. AnimCJK names a part by the form that the character draws. The right side of 聯 is `𢇇11`, not 絲.

A text can give the parts of a part in place: `賣⿱士3買⿱罒5貝.7`. A group with no character has no name: `難⿰⿱廿4⿻口3夫4隹.8`. These marks follow a character:

| Mark | Meaning |
|---|---|
| `.` | The radical. The build does not use this mark. |
| `:` | The part is split, and other strokes come between its pieces: `可⿹丁:1口.3丁:1`. A letter after the mark tells two such parts apart. |
| `::` | Two parts share the strokes: `臼.⿱𠀉:3彐:2𠀉::彐:1`. |
| `~` | Two characters name one part: `舌~𠮷.6`. The build uses the second one. |

Some texts of AnimCJK do not have the operand count of their operator: `党⿳龸5兄⿱口3儿.2`. The strokes of each named part are still exact, because the counts are in stroke order. The build reads such a text and prints the number of these texts in use.

### The definition of a character

An acjk text counts the strokes of the AnimCJK drawing, and the app draws the Hanzi Writer data. `fetch:animcjk` compares the two drawings of each character and writes the result to `order` in `animcjk.json`. The two drawings agree when each stroke of one is the nearest stroke of its partner in the other. `order` has no entry for a character with the same strokes in the same order. It has a list for the same strokes in another order, and `null` for other strokes.

A top character takes the first of these definitions that has its Hanzi Writer stroke count:

1. A text of the definitions file.
2. The text of an AnimCJK set whose drawing has the strokes of Hanzi Writer: `hans`, `hant`, `ja`, then `ko`.
3. The Make Me a Hanzi entry. The entry gives one level of parts, and it counts the strokes of Hanzi Writer.

### The tree

The tree follows six rules:

- Every part splits until it is one stroke. A label never stops a split. So 賣 in 續 splits into 士 + 買, 買 into 罒 + 貝, and 口 into its 3 strokes.
- A part takes the definition of its character that has the same number of strokes. A definition with another number of strokes is another form, and the part never takes it. 朗 draws 良 with 6 strokes, and 良 alone has 7.
- The strokes of a part pair with the strokes of its definition in stroke order.
- A group with no name is not a step. Its pieces join the split directly, so 覽 is 臣 + 𠂉 + 一 + 皿 + 見. `groups` in the labels file can name a group: `⿱廿⿻口夫` is 𦰩, the left side of 難.
- A part with no definition splits into its strokes. The strokes have no name.
- A character never holds itself. A decomposition of Make Me a Hanzi names a group only when it holds every stroke of its character: 求 is `⿻一氺`, and the dot is in no piece. The build stops when a part has the name of a character above it.

A part looks for a definition in this order: the parts that its parent gives it in place, a text of the definitions file, the AnimCJK sets, then Make Me a Hanzi. The AnimCJK set of the parent comes first. Make Me a Hanzi is last, because it names a part by a form that has an entry. That form is not always the form drawn.

### Stroke order

A top character can draw a part in another stroke order than the part alone. 里 draws the 田 at its top as 丨 𠃍 一 一 丨, and 田 alone is 丨 𠃍 一 丨 一. The build reads the direction of each stroke from the first and last point of each line of `stroke-medians.json`. Four names give a direction: 一 runs across, 丨 and 亅 run down, and 丿 runs down to the left.

Two strokes change places only on a proof that both are in the wrong place. Neither stroke fits its own name, and each stroke fits the name of the other. The nearest pairs go first. A pair inside one part of the definition does not change places at that level, because that part pairs its own strokes later.

One stroke that does not fit its name proves nothing. A source can name a stroke loosely: AnimCJK calls the dot in 監 一. Such a stroke stays in its place. This rule has no tolerance. It compares the width of a stroke with its height.

### Origin

The origin of a character tells how its form came to carry its meaning (#569). It comes from the etymology of the Make Me a Hanzi entry of the character. A traditional character has its own entry. The `type` of the etymology gives the kind of origin:

- `ideographic` and `pictographic` give a story origin: the `hint` sentence, "A person 亻 leaning against a tree 木". A character of the story takes the strokes of the part that it is, at any level. The part nearest the top wins, and another form of the character also matches (人 matches 亻). `ORIGIN_FORMS` in `componentBreakdown.js` adds the variant glyphs that a text names for a part, for example 木 for 朩 and 乂 for 㐅. These forms apply to the origin only, so the Wiktionary comparison stays strict. A character that is no part stays in the text. The build does not repair the text.
- `pictophonetic` gives a meaning-and-sound origin. `semantic` names the meaning part, `hint` gives its gloss, and `phonetic` names the sound part. When the entry names only one of the two parts, the origin has only that side.
- Any other type, or no etymology, gives no origin.

The build finds the meaning part and the sound part with a stroke match. A top part matches when it is the character of the data. A part at any level matches when it has the strokes that the Make Me a Hanzi entry gives that character. So the meaning part of 跑 is 𧾷, though the data names 足. The 心 of 德 is below 𢛳, which Make Me a Hanzi does not have as a step. When the entry gives a part no strokes, the build finds the part by its character at any level, as for a story. Make Me a Hanzi gives 塗 as 涂 over 土, so 氵 has no strokes of its own. The sound part shows the pinyin of the part, or the pinyin of the data character.

`components/origins.json` is the overrides file. It gives a character an etymology in the shape of Make Me a Hanzi, in place of its own, or `null` for no origin. The build stops when an override names a character with no breakdown file.

The build writes `components/origin-mismatches.md`. The report lists each character of a story that is no part, and each meaning part or sound part that the stroke match does not find. A mismatch does not stop the build. For each row, add an override, or accept the source. Most rows are correct: a story can name another character ("Simplified form of 東", "compare 乒"). An override corrects a wrong part, a wrong form or a typo of the data. In CI, the build prints only the count.

### The definitions file

`definitions.json` holds a list of acjk texts. A text for a top character counts the strokes in the order of Hanzi Writer. The file has three uses:

- A form that no source has. The 艮 of 即 has 5 strokes: `艮⿰⿰𫜹3𠄌1丶1`.
- A text of AnimCJK that is wrong or does not parse. `𧘇⿰⿱丿1𠄌1⿺丿1㇏1` replaces a text with no stroke counts.
- A top character that only Make Me a Hanzi has, when its entry names another form or has a piece with no name. `嘆⿰口3⿱廿4⿻口3夫4` replaces an entry that calls the right side 堇.

The build stops when a named part of 2 or more strokes has no definition. The message names the part as `top > part/strokes`, for example `朗 > 良/6`. To correct it, add the acjk text of that form to the file. The build also stops when the file holds a text that no breakdown uses.

### Labels

`labels` in the labels file gives the label of a part. `names` gives a label and pinyin to a part that has no entry of its own (㐫 in 脑). An empty file is legal.

`shapes` in the labels file lists the parts that a source names only for their shape. Such a part shows its label and no pinyin. AnimCJK uses 丅 only for the shape of the top of 敢, 斤 and 華, so 丅 is "T shape", not "below", xià. A part in `shapes` has no meaning in any character, so do not add a part that has its meaning in other characters (扌, 厂).

A part with no entry in the labels file takes the first sense of its Make Me a Hanzi definition, then of its AnimCJK definition. The build prints each part character with no label from any source. It also prints the number of parts that still use this fallback label.

The labels file holds the learner label of the most frequent parts in HSK 1–7 (#531), and of every part of the HSK 1–3 trees of that time (#532). It also holds a label for each stroke and for the frequent forms that AnimCJK names. A side form takes its learner name (亻 is "person", not "man"). A character takes the sense that a learner needs inside other characters (凶 is "fierce", not "culprit").

The build stops when the labels file gives a label to a part that is in no breakdown. This occurs with a typo.

### The Wiktionary comparison

A source can name a part wrongly, and the tree rules cannot find this error (#563). So the build compares the parts of each named part with the Wiktionary composition of that part. It does this at every level of each tree, and the top character is a named part too. In 續, it compares 續 = 糹 + 賣, then 賣 = 士 + 買, then 買 = 罒 + 貝. A piece with no name and a stroke are not compared. Wiktionary does not replace a source, because it has no stroke data, so the comparison cannot find a part with the right name and the wrong strokes.

The comparison uses these rules:

- The parts match when they match one alternative of the composition. A composition can give an alternative for each region: `⿱亽㇇(G) or ⿱亼㇇(HTJKV)`.
- A group of the composition is not a step, the same rule as the tree.
- The order of the parts does not count.
- A side form and its full form are the same part (亻 and 人). The forms of one part are in `SAME_PART` in `componentBreakdown.js`. Two characters that both stand alone are never the same part, so 月 and 肉, and 王 and 玉, stay apart.
- A `㇯` group takes one part away from another. It is one part with no name, and it matches no part.
- A part that one side splits matches when its own composition gives the parts of the other side. 劳 is 艹 + 冖 + 力 in the breakdown and `⿱𫇦力` in Wiktionary, and 𫇦 is `⿱艹冖`.

A local run writes the differences to `components/wiktionary-differences.md`. CI only prints their number. A difference does not stop the build.

The report gives one row for each split of a part, with the HSK characters that hold it. The rows in the most characters come first, because one correction fixes all of them. The report has two tables:

- **Parts**: the breakdown splits the part into other parts than Wiktionary. A wrong part name is in this table.
- **Strokes**: the breakdown splits the part into strokes. Such a split names no wrong part, and Wiktionary often writes the strokes as other forms (口 is 丨 𠃍 一, and `⿱冂一`).

For each row, correct `definitions.json`, or accept the source.

The breakdown files hold no Wiktionary data, so their `LICENSE.txt` does not change. `ATTRIBUTION.txt` credits Wiktionary for the comparison.

### Output

The build writes these files to `web-client/public/breakdowns/`. They are build output, and git ignores them:

| File | Contents |
|---|---|
| `<code point>.json` | The breakdown of one character. `7919.json` holds 礙. |
| `ATTRIBUTION.txt` | The source of the files, the AnimCJK notice and the Make Me a Hanzi notice |
| `LICENSE.txt` | The licence of the files: LGPL 3.0, with the Unihan notice |
| `GPL.txt` | The GPL 3.0, which the LGPL adds to |

Each file is `{ c, p, o? }`: the character, its parts and its origin. `p` is `null` for a character of one stroke. Each part is `{ c, s, l, y?, p? }`. `c` is the character (`null` for a piece with no name), `s` the stroke indices in the top character, and `l` the label. `y` is the pinyin, and `p` holds the parts of the part. Only a part of one stroke has no `p`. Two parts can share a stroke (the 田 and the 土 of 里).

A story origin is `{ t }`. `t` is a list of segments: a text, or `{ c, s }` for a character that is a part, with the strokes of that part. A meaning-and-sound origin is `{ m?, n? }`. `m` is `{ c, l?, s? }`: the meaning part and its gloss. `n` is `{ c, y?, s? }`: the sound part and its pinyin. A side with no `s` matches no part. The app shows a part of the origin in the ink of the top part that holds its strokes.

### Review

The build prints these lists for a person to review:

- The number of top characters that each source defines.
- The pieces with no name that split into strokes.
- The number of parts that a top character draws in another stroke order.
- The number of AnimCJK texts in use with another operand count.

`node migration/review-breakdowns.js <characters> [output file]` writes a page that draws the breakdown of the characters. Each picture shows one part that splits, with its own parts in colors. The page reads the breakdown files of the last build, and the browser downloads the stroke outlines from the CDN.

## Handwriting Template Build

`build:dict` writes `web-client/public/handwriting/templates.json`, the template file of the handwriting pad of Add Words (#476). The source is `components/source/stroke-medians.json`. The file holds each character that has a CC-CEDICT entry of its own, simplified and traditional, and the best HSK rank `q` of those entries. The points are bytes in a box of 256, with y down. `ATTRIBUTION.txt` and `LICENSE.txt` (the Arphic Public License) go beside the file.

The matcher of the app is our own code, in `web-client/src/utils/handwriting.ts`. HanziLookupJS is GPL v3, so the app does not use it.

## Reported Part Meanings

A learner can report a wrong part meaning from the line of a tapped part in the breakdown (#533). Each report goes to `users/{userId}/partReports/{reportId}`. The report holds the character, the parent, the part, the stroke indices of the part and the label that the line showed. The parent is the character directly above the part. The part and the label are null for a piece with no name of its own.

1. Run `node export-part-reports.js`. It writes `part-reports.csv`, with one row for each report. The rows of one part are together.
2. For a wrong label, set the label of the part in `labels` in `components/labels.json`. Many labels come from Make Me a Hanzi and are not in the file yet.
3. For a piece with no name of its own, add the piece to `pieces` in `components/labels.json`, under the parent. The `strokes` column finds the piece in `char`.
4. Run `npm run build:dict`.

The script needs `service-account.json`, the same as `export-review-log.js`. Git ignores the CSV file. The rows are pure, in `partReportCsv.js`.

## Reported Sentences

A learner can report a bad sentence from the sentence stages (#469). Each report goes to `users/{userId}/sentenceReports/{sentenceId}`. A learner can also report one option of the Comprehend tab (#601). This report has the stage `option` and goes to `users/{userId}/sentenceReports/{sentenceId}-{distractorId}`.

1. Run `node export-sentence-reports.js`. It writes `sentence-reports.csv`, with one row for each reported sentence or option and the most reported first.
2. For a wrong pinyin or gloss, add an override to `sentences/gloss-overrides.json`.
3. For a bad generated sentence, change it or remove it in `sentences/generated.json`.
4. For an option that is also a true reading, add the pair to `sentences/blocked-distractors.json`. Then run `node write-distractors.js`.
5. Run `npm run build:dict`.

The script needs `service-account.json`, the same as `export-review-log.js`. Git ignores the CSV file.

## Review Log Report

The review log report shows the calibration of FSRS and the results of the study design for one learner (#446). It reads the CSV file of `export-review-log.js` and writes one Markdown file. It reads no Firestore, so it can run again on an old export.

1. Run `node export-review-log.js --uid <userId>`.
2. Run `npm run build:dict`, if `functions/data/dictionary.json` does not exist. Without the dictionary, the report shows word ids.
3. Run `node review-report.js review-log-<userId>.csv`. It writes `review-log-<userId>.md`.
4. Read the report. Open one issue for each finding that needs a change.

The id of a `userWords` document is the id of its dictionary entry. `build:dict` gives the ids in the order of CC-CEDICT. Thus a new CC-CEDICT file can move the ids, and an old export then shows wrong words. The CSV file holds no characters, so the script cannot find this error.

The options are `--out <file>`, `--since YYYY-MM-DD`, `--until YYYY-MM-DD` and `--scheduler <name>`. The dates are UTC days, and both days are in the range. With no `--scheduler`, the report uses the scheduler of the newest row.

The report has eight sections: calibration, directions, answer modes, hints, reveals, fatigue and sibling directions, repeated errors, and leeches. A group with fewer than 20 reviews is in italics and has the mark "too few". The rules are pure, in `reviewReport.js`. Git ignores the report, because it holds typed answers.

## Checked Tatoeba Credits

A Claude Code session checks each shipped Tatoeba credit, and the developer reviews the flagged credits (#485). `sentences/CHECK.md` is the prompt and the procedure.

`node sentence-check.js` prints the number of credits that are not checked, and writes the next batch to `sentences/scratch/check-batch.json`. The credits inside a longer CC-CEDICT word come first. `--list` prints every credit that is not checked. `--done` adds the blocks of the batch to `sentences/blocked.json` and marks its credits in `sentences/checked.json`. Only this script reads `checked.json`. The rules are pure, in `sentenceCheck.js`.

## Generated Sentences

Claude Code writes the sentences for the HSK words that have fewer than 3 (#468). A developer starts the session. `sentences/GENERATE.md` is the prompt and the procedure.

| Script | What it does |
|---|---|
| `sentence-gaps.js` | Writes `sentences/scratch/gaps.json`: each HSK word with fewer than 3 sentences, with its HSK level, its length cap and the number that it needs. The words of the learners' word lists come first, then HSK 1–3, then the other HSK words. The script reads the learners' words from Firestore, and `--no-learners` skips the read |
| `sentence-accept.js <file>` | Grades the candidates in the file with the rules of the build. Adds the passes to `sentences/generated.json` and prints each reject with its reason |

Both scripts run the build in memory, so they use the same rules as `npm run build:dict`. Git ignores `sentences/scratch/`.

Each run of the accept script is one round for each word of its candidates. `generated.json` counts the failed rounds of each word. A word that is still short after 3 rounds is unfilled. The gaps script leaves it out, and `coverage.md` lists it. A second session gets only the words that are still short.
