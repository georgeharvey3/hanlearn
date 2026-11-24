# Check the Tatoeba credits

This file is the prompt for a Claude Code session that checks the shipped
Tatoeba credits. A credit is one Tatoeba sentence of one HSK word. The build
gives a sentence to every HSK word that it holds. No rule of the build finds
every bad sentence or every bad credit. See issue #485.

The check writes two files:

- `blocked.json`: the blocked sentences and credits, each with a reason and
  the sentence text. The build reads this file.
- `checked.json`: the credits that a session checked, by sentence id. Only
  the check script reads this file.

The build stays a committed build (ADR 0019). It makes no network call and
no AI call.

## Start the session

1. Run `node migration/sentence-check.js` from the repository root.
2. Give Claude Code this file and `migration/sentences/scratch/check-batch.json`.
3. When the batch is done, run `node migration/sentence-check.js --done`.
4. Do steps 1 to 3 again until the script gives 0 credits that are not checked.
5. Run `npm run build:dict`.
6. Commit `blocked.json`, `checked.json` and `coverage.md`.

The developer reviews each new entry of `blocked.json` in the pull request.
Each entry holds the sentence text and the reason, so the diff is the review.

`node migration/sentence-check.js --list` prints every credit that is not
checked. `--limit <n>` sets the size of a batch. The default is 150.

## The order

The script gives the credits whose target is inside a longer CC-CEDICT word
first. About 1 in 5 of these credits is bad. Then it gives the other credits.

A blocked sentence or credit frees a place, so the next build can pick a new
sentence for the word. The new credit is not checked, and the next batch
gives it. A change to the pick or the split also gives new credits only.

## The batch

Each line of `check-batch.json` is one credit.

| Field | Meaning |
|---|---|
| `id` | The sentence id: a hash of the text |
| `word` | The HSK word that gets the sentence |
| `simp`, `english` | The Tatoeba sentence and its English |
| `gloss` | The gloss that the app shows for the word in this sentence |
| `longer` | The longest CC-CEDICT word of the sentence that holds the word, or `null` |

## Flag a credit

To flag a bad credit, add two fields to its line in `check-batch.json`:

- `"block": "sentence"` when the sentence is bad for every word.
- `"block": "credit"` when the sentence is good, but bad for this word only.
- `"reason"`: one short sentence that gives the fault.

Do not change the other fields. Do not remove a line. The script marks every
line of the batch as checked, flagged or not.

If one credit of a sentence gets `"block": "sentence"`, the other credits of
that sentence need no flag.

## The faults

Block the sentence for every word when:

1. The English is wrong. For example, 你知不知道思念的滋味？ is not "Do you
   know the taste of thought?"
2. The sentence holds a name that CC-CEDICT does not know, for example 德米特里,
   雅尼 or 海蒂.
3. The sentence is rude or sexual, for example 吸一口气，妈的！
4. The sentence is a fragment, or it has no meaning without its context, for
   example 那些狗不停的叫声。 or 我的寂寞是一条蛇。

Block the credit for its word only when:

5. The sentence does not really hold the word. The splitter cut a longer word
   into HSK words. For example, 青 in 青花菜 and 葱 in 洋葱 are not the words
   青 and 葱.
6. The gloss gives the wrong sense of the word in this sentence.

Most credits inside a longer word are good. 一 in 一点, 河 in 河边 and 高中
in 高中生 are good credits. Flag a credit only when the learner sees the
wrong word or the wrong sense.

Do not flag a sentence that is only difficult or unusual. The grader of the
build controls the length and the HSK level.
