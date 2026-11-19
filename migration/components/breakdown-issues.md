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
  in `migration/componentBreakdown.js`). Entries: 酉 (fixed), 獄.
- **A shape name given a meaning.** AnimCJK sometimes names a group of
  strokes by a character with the same shape, only as a shape. The labels
  file then gives that character its meaning, and the app shows a meaning
  and pinyin that have nothing to do with the strokes. Entries: 丅 (fixed),
  那, 击, 我, 皮.
- **Found by the Wiktionary check.** `wiktionary-differences.md` lists each
  split that differs from Wiktionary (#563). The check found 獄, 击, 那, 我
  and 皮. It cannot find 酉 or 丅, because Wiktionary gives the same split.

## Entries

### 酉 (seen in 尊)

- **Status:** fixed (#563): `definitions.json` gives 酉 as
  `酉⿻兀:1日:2兀:2日:2`. Wiktionary gives `⿴西一`, so 酉 stays in the
  Wiktionary report.
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

### 丅 (seen in 嚴, from 敢)

- **Status:** fixed (#563): `shapes` in `labels.json` lists 丅. A part in
  this list shows its label, "T shape", and no pinyin.
- **What looks wrong:** the two top strokes of 敢 (a horizontal and a short
  vertical) show as "below xià".
- **What the build gives:** a part 丅 with the label "below" and the pinyin
  xià.
- **What it should be:** two plain strokes with no meaning or pinyin, or a
  shape name. In the old forms of 敢 these strokes come from a hand, not
  from 下, so "below" is wrong.
- **Cause:** AnimCJK defines 敢 as `敢⿰⿱丅2耳6攵.4` (hant and ja sets). It
  uses 丅 only for the shape. `labels.json` gives 丅 the label "below", and
  the pinyin comes from its dictionary entry. Make Me a Hanzi marks the same
  strokes as unknown: `⿰⿱？耳攵`.
- **Affects:** every character that AnimCJK splits with 丅: 敢 斤 瓦 華 鬲,
  and the characters that hold them, for example 嚴 憨 新 近 所 瓶 曄 隔
  融.
- **Possible fix:** treat 丅 as a shape with no label and no pinyin. A label
  of "hand" just for 敢 would not work, because a label applies to a part
  everywhere, and it is wrong in 斤 and 華. Decide at the review.

### 獄 (found by the Wiktionary check)

- **Status:** cause known
- **What looks wrong:** the right side shows as 訧 "fault", split into 言
  and 尤 "especially".
- **What the build gives:** 犭 0-2, then 訧 3-13 (言 3-9, 尤 10-13).
- **What it should be:** 犭 + 言 + 犬. Strokes 10-13 are 犬, a second dog.
- **Cause:** only the AnimCJK ja set has 獄: `獄⿰犭.3訧11`. 訧 and 言 + 犬
  both have 11 strokes, so the split counts right. Make Me a Hanzi has
  `⿰犭⿰言犬`.
- **Affects:** 獄 and the characters that hold it.

### 那 (found by the Wiktionary check)

- **Status:** cause known
- **What looks wrong:** the left side shows as 丑 "ugly", chǒu, split into
  刀 "knife" and 二 "two".
- **What the build gives:** 丑 0-3 (刀 0 3, 二 1 2), then 阝 4-5.
- **What it should be:** a shape with no meaning. Make Me a Hanzi does not
  name the left side: `⿰⿹？？阝`.
- **Cause:** AnimCJK gives `那⿰⿻刀:1二2刀:1阝.2`. The labels name 丑 by its
  shape.
- **Affects:** 那 哪 挪 娜.

### 击 (found by the Wiktionary check)

- **Status:** cause known
- **What looks wrong:** the top shows as 扌 "hand", shǒu.
- **What the build gives:** 扌 0-2, then 凵 3-4.
- **What it should be:** 击 is the simplified form of 擊, and it holds no
  hand. Wiktionary gives `⿻二山`. Make Me a Hanzi does not name the top:
  `⿱？凵`.
- **Cause:** AnimCJK gives `击⿶扌3凵.2`. It names the strokes by the shape
  of 扌.
- **Affects:** 击 and the characters that hold it.

### 我 (found by the Wiktionary check)

- **Status:** cause known
- **What looks wrong:** the left side shows as 千 "thousand", qiān.
- **What the build gives:** 千 0 2 3, then 戈 1 4 5 6.
- **What it should be:** a hand holding a weapon. Make Me a Hanzi gives
  `⿰扌戈`.
- **Cause:** AnimCJK gives `我⿻千:1戈.:1千:2戈.:3`. It names the strokes by
  the shape of 千.
- **Affects:** 我 and the characters that hold it, for example 俄 饿 鹅 哦
  義 議.

### 皮 (found by the Wiktionary check)

- **Status:** cause known
- **What looks wrong:** the top shows as 厂 "cliff", chǎng.
- **What the build gives:** 厂 0-1, 丨 2, 又 3-4.
- **What it should be:** a shape with no meaning. Make Me a Hanzi does not
  name it: `⿸？攴`.
- **Cause:** AnimCJK gives `皮.⿻厂2⿱丨1又2`. It names the strokes by the
  shape of 厂.
- **Affects:** 皮 and the characters that hold it, for example 波 被 破 披
  疲 坡.
- **Note:** a fix in `shapes` is not correct for 厂, 扌 or 千, because these
  parts have their meaning in other characters. A fix for this pattern
  must apply to one split, not to a part everywhere.
