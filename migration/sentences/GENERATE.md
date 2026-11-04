# Generate example sentences

This file is the prompt for a Claude Code session that writes example
sentences for the HSK words that have fewer than 3. The Tatoeba sentences
fill most words, and the generated sentences fill the gaps (ADR 0020). A
developer starts the session. See issues #468 and #482.

The build does not read this file. It reads `generated.json`, which the
accept script writes, and `tatoeba.json`.

## Start the session

1. Run `node migration/sentence-gaps.js` from the repository root.
2. Give Claude Code this file and `migration/sentences/scratch/gaps.json`.
3. When the session is done, run `npm run build:dict`.
4. Commit `generated.json` and `coverage.md`.

If a session stops before it is done, start a new session with the same
steps. The gaps script reads `generated.json`, so the new session gets only
the words that are still short.

## The gaps

Each line of `gaps.json` is one HSK word:

| Field | Meaning |
|---|---|
| `word` | The simplified word |
| `hskLevel` | The HSK level of the word: 1 to 6, or 7 for HSK 7–9 |
| `lengthCap` | The most Han characters and digits in a sentence. `null` is no limit. |
| `needed` | The number of sentences that the word needs |
| `pinyin`, `gloss` | The dictionary entry of the word. Use this sense of the word. |
| `has` | The sentences that the word has now |

`scratch/hsk-1.txt` to `scratch/hsk-6.txt` give the words of each HSK level.

## Rules for each sentence

1. Write a natural, everyday Mandarin sentence in simplified characters.
2. Use the word itself, as one word, in the sense that `gloss` gives.
3. Use only words at the HSK level of the word or below.
4. Keep the sentence to `lengthCap` Han characters or fewer.
5. Write a correct, natural English translation of the whole sentence.
6. Use Chinese punctuation, and end the sentence with `。`, `？` or `！`.
7. Do not use Latin letters, and do not use digits.
8. Make each sentence different from the other sentences of the word.

The grader removes names, numbers and the word itself before it counts the
HSK level of a sentence. Two sentences of one word are too alike when more
than half of their other words are the same.

A sentence for an HSK 7–9 word has no level limit and no length limit. Even
so, use common words and keep the sentence short.

Do not write a sentence that is only the word. Do not write a sentence that is
a list of words, a title, or a fragment.

## Write and grade a batch

1. Take a batch of about 100 words from `gaps.json`.
2. For each word, write `needed` candidates. Then write one more candidate.
3. Write the batch to a JSON file in `migration/sentences/scratch/`.
4. Run `node migration/sentence-accept.js <file>`.
5. For each `REJECT` line, read the reason.
6. Write a new candidate for each word that is still short.
7. Run the accept script again on the new candidates.

A candidate is one object:

```json
{ "word": "图书馆", "simp": "我在图书馆看书。", "english": "I read in the library." }
```

A candidates file is a JSON array of these objects.

Each run of the accept script is one round for each word in its file. If a
word is still short after 3 rounds, the word is unfilled. The accept script
then rejects all new candidates for it, and `coverage.md` lists it.

The reasons for a reject:

| Reason | Fix |
|---|---|
| `segments above HSK n: ...` | Replace the listed words with words at HSK n or below |
| `longer than the cap of n characters` | Write a shorter sentence |
| `no segment is ...` | The splitter did not find the word. The reason gives the segments. Change the words next to it. |
| `too like ...` | Write a sentence with different words |
| `is already a sentence` | Write a different sentence |
| `holds Latin letters` | Remove the letters and digits |
| `holds only the word` | Add more words to the sentence |
| `the word needs no more sentences` | No fix. The word is full. |
| `the word failed 3 rounds` | No fix. The word stays unfilled. |
