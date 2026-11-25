/**
 * The pure rules that compare a Compose attempt with the reference sentence
 * (#597). The task makes no AI call, so the compare works offline.
 */
import { CharSet, toCharSet } from './charSet';

/** The mark of one character of an attempt, or of a place where reference characters are missing. */
export type AttemptMark =
  | { kind: 'placed' | 'misplaced' | 'extra'; char: string }
  | { kind: 'gap' };

export interface AttemptCheck {
  /** The attempt after normalization equals the reference after normalization. */
  match: boolean;
  /** The marks of the normalized attempt, in reading order. */
  marks: AttemptMark[];
}

/**
 * Anything that is not a letter or a number: punctuation of both widths, and
 * spaces. A constructor, because the compile target does not allow the `u`
 * flag in a literal.
 */
const NOT_LETTER_OR_NUMBER = new RegExp('[^\\p{L}\\p{N}]', 'gu');
const DIGIT_RUN = /\d+(?:\.\d+)?/g;

const DIGITS = '零一二三四五六七八九';
const UNITS = ['', '十', '百', '千'];

/** The digit-by-digit reading of a digit string, with 零 or with 〇 for zero. */
const digitByDigit = (digits: string, zero: string): string =>
  Array.from(digits, (d) => (d === '0' ? zero : DIGITS[Number(d)])).join('');

/** 0 to 9999, with 二 for each 2. `inner` keeps the 一 of 一十 inside a larger number. */
function underTenThousand(n: number, inner: boolean): string {
  if (n === 0) return '';
  const digits = String(n).padStart(4, '0');
  let out = '';
  let zero = false;
  for (let i = 0; i < 4; i++) {
    const d = Number(digits[i]);
    const unit = UNITS[3 - i];
    if (d === 0) {
      if (out !== '') zero = true;
      continue;
    }
    if (zero) out += '零';
    zero = false;
    out += d === 1 && unit === '十' && out === '' && !inner ? '十' : DIGITS[d] + unit;
  }
  return out;
}

/** The cardinal reading of a whole number below 10^8, with 二 for each 2, or null. */
function cardinal(n: number): string | null {
  if (n >= 1e8) return null;
  if (n === 0) return '零';
  const high = Math.floor(n / 1e4);
  const low = n % 1e4;
  if (high === 0) return underTenThousand(low, false);
  const lowText = low === 0 ? '' : (low < 1000 ? '零' : '') + underTenThousand(low, true);
  return `${underTenThousand(high, false)}万${lowText}`;
}

/**
 * The readings of one run of digits, and the usual one: the cardinal, or
 * digit by digit for a leading zero. A number of 10^8 or more has no usual
 * reading.
 */
function readings(run: string): { usual: string | null; all: string[] } {
  const [whole, fraction] = run.split('.');
  const all: string[] = [];
  const add = (text: string) => {
    if (!all.includes(text)) all.push(text);
  };
  const leadingZero = /^0\d/.test(whole);
  const n = Number(whole);
  const usual = leadingZero ? null : cardinal(n);
  if (usual !== null) {
    const tail = fraction === undefined ? '' : `点${digitByDigit(fraction, '零')}`;
    add(usual + tail);
    // 两 counts things: 两个, 两点, 两百, 两千, 两万. It is never 两十.
    add((n === 2 ? '两' : usual.replace(/二(?=[百千万])/g, '两')) + tail);
  }
  if (fraction === undefined) {
    add(digitByDigit(whole, '零'));
    add(digitByDigit(whole, '〇'));
  }
  return { usual: usual !== null || (leadingZero && fraction === undefined) ? all[0] : null, all };
}

/**
 * The text of an attempt or a reference, ready to compare: no punctuation and
 * no spaces, Latin letters in lower case, and digits as hanzi. A zh-CN
 * recognizer writes numbers as digits, so 2点 matches 两点. Of the readings of
 * a number (二 or 两, a year digit by digit with 零 or 〇), the one that the
 * reference holds wins. With none in the reference, a whole number reads as a
 * cardinal, and one with a leading zero digit by digit. A number of 10^8 or
 * more stays as digits.
 */
export function normalizeAnswer(text: string, reference: string): string {
  const strip = (value: string) => value.replace(NOT_LETTER_OR_NUMBER, '').toLowerCase();
  const target = strip(reference.normalize('NFKC'));
  const source = text.normalize('NFKC');
  // Each run of digits, with its readings. A run with no reading stays as digits.
  const runs = Array.from(source.matchAll(DIGIT_RUN), ([raw]) => {
    const { usual, all } = readings(raw);
    return { usual: usual ?? raw, all: all.length > 0 ? all : [raw] };
  });
  const fill = (pick: (run: number) => string) => {
    let at = 0;
    return strip(source.replace(DIGIT_RUN, () => pick(at++)));
  };

  // Each number of the reference can read another way (第二次两点), so the
  // readings that give the whole reference win. A few numbers give few choices.
  const choices = runs.reduce((count, run) => count * run.all.length, 1);
  if (runs.length > 0 && choices <= 256) {
    for (let index = 0; index < choices; index++) {
      let rest = index;
      const picks = runs.map((run) => {
        const pick = run.all[rest % run.all.length];
        rest = Math.floor(rest / run.all.length);
        return pick;
      });
      const candidate = fill((run) => picks[run]);
      if (candidate === target) return candidate;
    }
  }
  return fill((run) => {
    const { usual, all } = runs[run];
    return all.find((reading) => target.includes(reading)) ?? usual;
  });
}

/**
 * The marks of a normalized attempt against a normalized reference. The
 * characters of a longest common subsequence are `placed`, so one missing
 * character does not move the marks of the characters after it. Of the other
 * characters, one that the reference still holds is `misplaced`, and the rest
 * are `extra`. Each run of reference characters with no placed character is
 * one `gap`, after the attempt characters at that place. A gap does not show
 * how many characters are missing.
 */
export function alignAttempt(attempt: string, reference: string): AttemptMark[] {
  const a = Array.from(attempt);
  const r = Array.from(reference);
  // lcs[i][j]: the length of a longest common subsequence of a[i..] and r[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(r.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = r.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === r[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Walk both texts: each step places a pair, or skips an attempt or a reference character.
  type Step = { attempt: number } | { reference: number } | { placed: number };
  const steps: Step[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < r.length) {
    if (i < a.length && j < r.length && a[i] === r[j]) {
      steps.push({ placed: i });
      i++;
      j++;
    } else if (j < r.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      steps.push({ reference: j });
      j++;
    } else {
      steps.push({ attempt: i });
      i++;
    }
  }

  const unplaced = new Map<string, number>();
  for (const step of steps) {
    if ('reference' in step)
      unplaced.set(r[step.reference], (unplaced.get(r[step.reference]) ?? 0) + 1);
  }

  const marks: AttemptMark[] = [];
  let missing = false;
  for (const step of steps) {
    if ('reference' in step) {
      missing = true;
      continue;
    }
    if ('placed' in step && missing) {
      marks.push({ kind: 'gap' });
      missing = false;
    }
    if ('placed' in step) {
      marks.push({ kind: 'placed', char: a[step.placed] });
      continue;
    }
    const char = a[step.attempt];
    const left = unplaced.get(char) ?? 0;
    if (left > 0) unplaced.set(char, left - 1);
    marks.push({ kind: left > 0 ? 'misplaced' : 'extra', char });
  }
  if (missing) marks.push({ kind: 'gap' });
  return marks;
}

/**
 * Compare one attempt with the reference sentence, both in the character set
 * of the learner: an IME or the recognizer can give simplified text.
 *
 * The rule is strict: only the reference sentence matches, so a valid
 * paraphrase does not. No ADR records this. It is a UI and a new log
 * version, and the old entries stay readable, so it is not hard to reverse.
 * The log keeps every attempt, so a looser rule can come later (#597).
 */
export async function checkAttempt(
  attempt: string,
  reference: string,
  charSet: CharSet,
): Promise<AttemptCheck> {
  const [attemptText, referenceText] = await Promise.all([
    toCharSet(attempt, charSet),
    toCharSet(reference, charSet),
  ]);
  const target = normalizeAnswer(referenceText, referenceText);
  const answer = normalizeAnswer(attemptText, referenceText);
  return { match: target !== '' && answer === target, marks: alignAttempt(answer, target) };
}
