# Component breakdown issues

A log of characters whose component breakdown looks wrong. We log each one
here and do not fix it straight away. Once there are enough entries, we look
for the causes they share and fix those causes in the build, rather than
patching one character at a time.

When you find one, add an entry below. Do not change the build or the data
files for it until the review.

## Patterns

Causes that more than one entry shares. Fill this in as entries repeat.

- **AnimCJK split by stroke count.** AnimCJK can split a character into a
  part that has the right number of strokes but the wrong strokes, and the
  build prefers AnimCJK to Make Me a Hanzi (`definitionOf` and `topDefinition`
  in `migration/componentBreakdown.js`). Entries: 酉.

## Entries

### 酉 (seen in 尊)

- **Status:** cause known
- **What looks wrong:** the inner horizontal line is treated as the bottom of
  the box, and the real bottom line is left out on its own.
- **What the build gives:**

  ```
  酉  wine jar
    西  west    strokes 0-5
      兀        0 3 4   (top line, the two inner legs)
      口        1 2 5   (sides, the inner line as its bottom)
    一          6       (the real bottom line)
  ```

- **What it should be:** 兀 laid over 日. 兀 is strokes 0 3 4, and 日 is
  strokes 1 2 5 6: the two sides, the inner line (the middle line of 日) and
  the real bottom line.
- **Cause:** AnimCJK defines 酉 as `酉.⿻西6一1` (in the hans, hant and ja
  sets). 西 has 6 strokes and 酉 has 7, so the split counts right but takes the
  wrong strokes. Make Me a Hanzi has the right split, `⿻兀日` with matches
  `[0] [1] [1] [0] [0] [1] [1]`, but the build ranks it last.
- **Affects:** every character that holds 酉, for example 酒 醒 配 醉 酸 醋
  尊 遵 酋.
- **Possible fix:** a definition of 酉 in `definitions.json`, or a rule that
  catches this kind of split for all characters. Decide at the review.
