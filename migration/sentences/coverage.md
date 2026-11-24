# Example sentence coverage

The build of `npm run build:dict` writes this report. The sentences come from native writers on Tatoeba and from generation (ADR 0020). A word is filled when it has 3 sentences.

The counts are after the block list of `blocked.json`. The block list drops 106 sentences and 188 credits.

## HSK words

| Level | Words | Filled | Fewer than 3 | None | Unfilled |
| --- | --: | --: | --: | --: | --: |
| HSK 1 | 505 | 501 | 4 | 0 | 0 |
| HSK 2 | 745 | 742 | 3 | 0 | 0 |
| HSK 3 | 951 | 945 | 6 | 0 | 0 |
| HSK 4 | 970 | 954 | 16 | 0 | 0 |
| HSK 5 | 1058 | 1046 | 12 | 0 | 0 |
| HSK 6 | 1120 | 1094 | 26 | 2 | 0 |
| HSK 7–9 | 5592 | 5542 | 50 | 2 | 0 |
| All | 10941 | 10824 | 117 | 4 | 0 |

## Not filled

These words have fewer than 3 sentences. `node sentence-gaps.js` gives them to the next round.

- HSK 1: 唱, 妈, 子, 雨
- HSK 2: 场, 流, 脏
- HSK 3: 代, 明确, 皮, 福, 管, 证
- HSK 4: 兵, 卷, 咸, 圈, 散, 方, 松, 沉, 牌, 盘, 结, 聚, 自, 贴, 长途, 闹
- HSK 5: 动机, 寸, 射, 拔, 气象, 琴, 甲, 立, 迟, 铃, 青, 鼓
- HSK 6: 井, 偏, 公, 判, 吊, 塔, 形, 惨, 扣, 景, 智慧, 服, 枝, 样, 洋, 混, 滴, 爆, 理, 田, 端, 精, 超, 足, 险, 露
- HSK 7–9: 丁, 丸, 主权, 乐器, 交叉, 享, 优, 凸, 创, 割, 即, 受害, 呈现, 坠, 姜, 姨, 宗, 审, 弦, 徒步, 忌, 忘不了, 急性, 慢性, 截, 探, 撇, 攀, 斩, 曲, 核, 橡皮, 氧, 漫, 火花, 猩猩, 瓦, 筒, 精神病, 绿灯, 缩, 罩, 胎, 萝卜, 葱, 邪, 酥, 须, 魂, 魅力

## Files

The largest sentence file is `4e0d.json` (the words that start with 不), at 267 KB. The limit is 2 MB.
