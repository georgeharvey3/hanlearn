/**
 * PROTOTYPE, throwaway. The reverse tile mode of the Comprehend tab: the
 * learner hears or reads the Chinese and builds the English.
 *
 * - D "Build from tiles": the tiles are the reference words and the false
 *   tiles, shuffled. The grade ignores the order and the optional words of the
 *   sentence. A match is right at once (`gradedBy: 'auto'`). Any other answer
 *   shows next to the reference, and the learner says if the meaning is the
 *   same (`gradedBy: 'self'`): a committed answer, not a feeling.
 * - E "Choose each slot": the English shows with a gap at each choice point
 *   (the target, and each swapped pronoun). The learner fills every gap.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';

import { StudyBody } from '../../components/Test/Study/StudyScreen';
import { PillToggle, PlayButton, StudyButton, StudyCard } from '../../components/Test/Study/parts';
import { colors, fonts } from '../../theme';
import { TileSentence } from './tileData';

const text = {
  showText: 'Show text',
  hideText: 'Hide text',
  check: 'Check',
  next: 'Next',
  right: 'Right',
  wrong: 'Wrong',
  buildPrompt: 'Build the meaning',
  slotPrompt: 'Fill each gap',
  noSlots: 'No choice points',
  missing: 'Missing:',
  gap: '____',
  sameMeaning: 'Same meaning?',
  yours: 'Yours',
  reference: 'Reference',
  same: 'Same',
  different: 'Different',
};

export type TileVariant = 'D' | 'E';

export interface TileLog {
  variant: TileVariant;
  word: string;
  sentenceId: string;
  mode: 'audio' | 'text';
  grade: 'right' | 'wrong' | 'none';
  gradedBy?: 'auto' | 'self';
  answer: string[];
  falseTilesUsed: string[];
  missing: string[];
  falseTilesShown: number;
  textSeen: boolean;
  answerMs: number;
}

const now = () => Date.now();

const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const speakZh = (sentence: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(sentence);
  u.lang = 'zh-CN';
  window.speechSynthesis.speak(u);
};

interface Tile {
  id: number;
  word: string;
  real: boolean;
}

// A false tile never repeats a word of the reference or another false tile:
// two tiles with one word would be one right and one wrong.
const falseWords = (s: TileSentence) =>
  [...s.targetDecoys, ...s.swaps.map((x) => x.decoy), ...s.fillers].filter(
    (w, i, all) => !s.tokens.includes(w) && all.indexOf(w) === i,
  );

const Chip: React.FC<{
  tone: 'idle' | 'right' | 'wrong' | 'active' | 'missing';
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ tone, onClick, children }) => (
  <ButtonBase
    onClick={onClick}
    disabled={!onClick}
    sx={{
      px: 1.25,
      py: 0.75,
      borderRadius: 1,
      fontSize: 17,
      fontFamily: fonts.body,
      border: `1px solid ${
        tone === 'right'
          ? colors.success
          : tone === 'wrong'
            ? colors.primaryLight
            : tone === 'active'
              ? colors.text
              : tone === 'missing'
                ? colors.warning
                : colors.borderStrong
      }`,
      bgcolor:
        tone === 'right'
          ? colors.successSurface
          : tone === 'wrong'
            ? colors.errorSurface
            : tone === 'missing'
              ? colors.warningSurface
              : colors.card,
      color: colors.text,
    }}
  >
    {children}
  </ButtonBase>
);

const multisetEqual = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/**
 * Whether an answer holds exactly the reference words, in any order, when an
 * optional word of the sentence may be there or not.
 */
const matchesReference = (words: string[], s: TileSentence) => {
  const required = s.tokens.filter((_, i) => !s.optional.includes(i));
  const optional = s.optional.map((i) => s.tokens[i]);
  const core = [...words];
  optional.forEach((w) => {
    const at = core.indexOf(w);
    if (at >= 0) core.splice(at, 1);
  });
  return multisetEqual(core, required);
};

export const TileTask: React.FC<{
  variant: TileVariant;
  sentence: TileSentence;
  useSound: boolean;
  onLog: (entry: TileLog) => void;
  onNext: () => void;
}> = ({ variant, sentence, useSound, onLog, onNext }) => {
  const [textShown, setTextShown] = useState(!useSound);
  const [checked, setChecked] = useState(false);
  const textSeen = useRef(!useSound);
  const shownAt = useRef(0);

  // D: the tile pool and the answer row.
  const [tiles] = useState<Tile[]>(() =>
    shuffle([
      ...sentence.tokens.map((word, i) => ({ id: i, word, real: true })),
      ...falseWords(sentence).map((word, i) => ({ id: 100 + i, word, real: false })),
    ]),
  );
  const [answer, setAnswer] = useState<number[]>([]);
  // D: the answer did not match, and waits for the learner's "Same meaning?".
  const [judging, setJudging] = useState(false);
  const [selfRight, setSelfRight] = useState<boolean | null>(null);

  // E: the choice points and the options of each.
  const slotIndexes = [
    ...(sentence.target !== null ? [sentence.target] : []),
    ...sentence.swaps.map((x) => x.index),
  ].sort((a, b) => a - b);
  const [slotOptions] = useState<Record<number, string[]>>(() => {
    const out: Record<number, string[]> = {};
    if (sentence.target !== null) {
      out[sentence.target] = shuffle([sentence.tokens[sentence.target], ...sentence.targetDecoys]);
    }
    sentence.swaps.forEach((x) => {
      out[x.index] = shuffle([sentence.tokens[x.index], x.decoy]);
    });
    return out;
  });
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [activeSlot, setActiveSlot] = useState<number | null>(slotIndexes[0] ?? null);

  useEffect(() => {
    shownAt.current = now();
    if (useSound) speakZh(sentence.simp);
  }, [sentence, useSound]);

  const byId = (id: number) => tiles.find((t) => t.id === id)!;

  const autoRight = matchesReference(
    answer.map((id) => byId(id).word),
    sentence,
  );

  const check = (judged?: boolean) => {
    if (variant === 'D' && !autoRight && judged === undefined) {
      setJudging(true);
      setTextShown(true);
      return;
    }
    setJudging(false);
    setChecked(true);
    setTextShown(true);
    if (judged !== undefined) setSelfRight(judged);
    let words: string[];
    let right: boolean;
    if (variant === 'D') {
      words = answer.map((id) => byId(id).word);
      right = judged ?? autoRight;
    } else {
      words = slotIndexes.map((i) => choices[i]);
      right = slotIndexes.every((i) => choices[i] === sentence.tokens[i]);
    }
    const used =
      variant === 'D'
        ? answer
            .map(byId)
            .filter((t) => !t.real)
            .map((t) => t.word)
        : [];
    const missing =
      variant === 'D'
        ? tiles
            .filter((t) => t.real && !answer.includes(t.id) && !sentence.optional.includes(t.id))
            .map((t) => t.word)
        : [];
    onLog({
      variant,
      word: sentence.word,
      sentenceId: sentence.id,
      mode: useSound ? 'audio' : 'text',
      grade: variant === 'E' && slotIndexes.length === 0 ? 'none' : right ? 'right' : 'wrong',
      gradedBy: variant === 'D' ? (judged === undefined ? 'auto' : 'self') : undefined,
      answer: words,
      falseTilesUsed:
        variant === 'D'
          ? used
          : slotIndexes.filter((i) => choices[i] !== sentence.tokens[i]).map((i) => choices[i]),
      missing,
      falseTilesShown: falseWords(sentence).length,
      textSeen: textSeen.current,
      answerMs: now() - shownAt.current,
    });
  };

  const right =
    variant === 'D'
      ? (selfRight ?? autoRight)
      : slotIndexes.every((i) => choices[i] === sentence.tokens[i]);

  const canCheck =
    variant === 'D' ? answer.length > 0 : slotIndexes.every((i) => choices[i] !== undefined);

  return (
    <>
      <StudyBody>
        <StudyCard
          height={checked ? undefined : 200}
          sx={{ mt: 3, gap: 2, justifyContent: 'center' }}
        >
          {useSound && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <PlayButton
                size={textShown ? 44 : 88}
                loading={false}
                onClick={() => speakZh(sentence.simp)}
              />
            </Box>
          )}
          {textShown && (
            <Box
              component="p"
              lang="zh"
              sx={{ m: 0, fontFamily: fonts.hanzi, fontSize: 32, lineHeight: 1.6 }}
            >
              {sentence.simp}
            </Box>
          )}
          {checked && (
            <>
              <Box
                component="p"
                lang="zh-Latn"
                sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}
              >
                {sentence.pinyin}
              </Box>
              <Box component="p" sx={{ m: 0, fontSize: 17 }}>
                {sentence.english}
              </Box>
            </>
          )}
          {useSound && !checked && !judging && (
            <PillToggle
              pressed={textShown}
              onClick={() => {
                textSeen.current = true;
                setTextShown((v) => !v);
              }}
            >
              {textShown ? text.hideText : text.showText}
            </PillToggle>
          )}
        </StudyCard>

        {variant === 'D' && (
          <Box sx={{ mt: 2, textAlign: 'left' }}>
            <Box sx={{ fontSize: 14, color: colors.textSecondary, mb: 1 }}>{text.buildPrompt}</Box>
            <Box
              sx={{
                minHeight: 52,
                p: 1,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.75,
                borderBottom: `2px solid ${colors.divider}`,
              }}
            >
              {answer.map((id) => {
                const t = byId(id);
                return (
                  <Chip
                    key={id}
                    tone={checked ? (t.real ? 'right' : 'wrong') : 'idle'}
                    onClick={
                      checked || judging
                        ? undefined
                        : () => setAnswer((a) => a.filter((x) => x !== id))
                    }
                  >
                    {t.word}
                  </Chip>
                );
              })}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {tiles
                .filter((t) => !answer.includes(t.id))
                .map((t) => (
                  <Chip
                    key={t.id}
                    tone={
                      checked && t.real && !sentence.optional.includes(t.id) ? 'missing' : 'idle'
                    }
                    onClick={checked || judging ? undefined : () => setAnswer((a) => [...a, t.id])}
                  >
                    {t.word}
                  </Chip>
                ))}
            </Box>
          </Box>
        )}

        {variant === 'E' && (
          <Box sx={{ mt: 2, textAlign: 'left' }}>
            <Box sx={{ fontSize: 14, color: colors.textSecondary, mb: 1 }}>
              {slotIndexes.length ? text.slotPrompt : text.noSlots}
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.75,
                fontSize: 18,
              }}
            >
              {sentence.tokens.map((word, i) =>
                slotIndexes.includes(i) ? (
                  <Chip
                    key={i}
                    tone={
                      checked
                        ? choices[i] === word
                          ? 'right'
                          : 'wrong'
                        : activeSlot === i
                          ? 'active'
                          : 'idle'
                    }
                    onClick={checked ? undefined : () => setActiveSlot(i)}
                  >
                    {choices[i] ?? text.gap}
                  </Chip>
                ) : (
                  <span key={i}>{word}</span>
                ),
              )}
            </Box>
            {!checked && activeSlot !== null && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {slotOptions[activeSlot].map((option) => (
                  <Chip
                    key={option}
                    tone={choices[activeSlot] === option ? 'active' : 'idle'}
                    onClick={() => {
                      const next = { ...choices, [activeSlot]: option };
                      setChoices(next);
                      const open = slotIndexes.find((i) => next[i] === undefined);
                      setActiveSlot(open ?? activeSlot);
                    }}
                  >
                    {option}
                  </Chip>
                ))}
              </Box>
            )}
          </Box>
        )}

        {judging && (
          <Box sx={{ mt: 2, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ fontSize: 14, color: colors.textSecondary }}>{text.yours}</Box>
            <Box sx={{ fontSize: 18 }}>{answer.map((id) => byId(id).word).join(' ')}</Box>
            <Box sx={{ fontSize: 14, color: colors.textSecondary }}>{text.reference}</Box>
            <Box sx={{ fontSize: 18 }}>{sentence.english}</Box>
            <Box sx={{ mt: 1, fontWeight: 600 }}>{text.sameMeaning}</Box>
          </Box>
        )}

        {checked && (variant === 'D' || slotIndexes.length > 0) && (
          <Box sx={{ mt: 2, fontWeight: 600, color: right ? colors.success : colors.primaryLight }}>
            {right ? text.right : text.wrong}
          </Box>
        )}
      </StudyBody>

      {checked ? (
        <StudyButton variant="primary" onClick={onNext}>
          {text.next}
        </StudyButton>
      ) : judging ? (
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          <StudyButton onClick={() => check(false)}>{text.different}</StudyButton>
          <StudyButton variant="primary" onClick={() => check(true)}>
            {text.same}
          </StudyButton>
        </Box>
      ) : (
        <StudyButton variant="primary" disabled={!canCheck} onClick={() => check()}>
          {text.check}
        </StudyButton>
      )}
    </>
  );
};
