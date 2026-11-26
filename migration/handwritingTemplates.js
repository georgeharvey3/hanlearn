/**
 * The template file of the handwriting pad (#476): the strokes of each
 * character that the pad can offer as a candidate, for the matcher of
 * web-client/src/utils/handwriting.ts.
 *
 * The file holds each character of the committed stroke medians that has a
 * CC-CEDICT entry of its own, simplified and traditional. A character that
 * appears only inside longer words is left out: a tap on it would find no
 * entry of that character.
 *
 * The strokes are bytes, Base64-encoded, so the file stays near 1 MB. Each
 * character gives its stroke count, then each stroke gives its point count,
 * then the x and y of each point. The coordinates are those of the 1024 box
 * of Make Me a Hanzi, divided by 4, with y turned to run down, as on a screen.
 */

const TEMPLATE_VERSION = 1;

/** The baseline of the Make Me a Hanzi box: y runs up from 900. */
const BASELINE = 900;

const toByte = (value) => Math.max(0, Math.min(255, Math.round(value / 4)));

/**
 * The template file. `medians` gives the flat median lines of each character
 * ([x0, y0, x1, y1, ...]), `words` the CC-CEDICT entries, and `ranks` the HSK
 * rank `q` of each entry id. A character takes the best rank of the entries
 * that it is the whole of.
 */
function templatesOf({ medians, words, ranks }) {
  const own = new Set();
  const ranked = {};
  for (const word of words) {
    for (const form of new Set([word.simp, word.trad])) {
      if ([...form].length !== 1) continue;
      own.add(form);
      const q = ranks.get(word.id);
      if (q !== undefined && (ranked[form] === undefined || q < ranked[form])) ranked[form] = q;
    }
  }
  const chars = Object.keys(medians).filter((char) => own.has(char));
  const bytes = [];
  for (const char of chars) {
    const strokes = medians[char];
    bytes.push(strokes.length);
    if (strokes.length > 255) throw new Error(char + ' has more than 255 strokes');
    for (const median of strokes) {
      if (median.length / 2 > 255) throw new Error('A stroke of ' + char + ' has more than 255 points');
      bytes.push(median.length / 2);
      for (let i = 0; i < median.length; i += 2) {
        bytes.push(toByte(median[i]), toByte(BASELINE - median[i + 1]));
      }
    }
  }
  const ranksOfChars = Object.fromEntries(chars.filter((c) => ranked[c] !== undefined).map((c) => [c, ranked[c]]));
  return {
    version: TEMPLATE_VERSION,
    chars: chars.join(''),
    ranks: ranksOfChars,
    strokes: Buffer.from(bytes).toString('base64'),
  };
}

module.exports = { TEMPLATE_VERSION, templatesOf };
