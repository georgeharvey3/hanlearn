// PROTOTYPE (#562), variant C: the strokes are the header. The word draws
// itself, one box per character with its syllable and gloss under it. The
// progress is a strip of five columns right under it, then the meanings and
// the sentence. The parts of each character come last, behind a picker.
import React, { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';

import { colors, fonts, levelInk } from '../../theme';
import { BANK_LABELS } from '../../utils/scheduling';
import {
  glossLine,
  useCharacterGlosses,
} from '../../components/Test/ComponentReview/useCharacterGlosses';
import CharacterBreakdown from '../../components/Test/ComponentReview/CharacterBreakdown';
import {
  AddButton,
  Cover,
  LeechChip,
  Overline,
  PageData,
  SentenceView,
  Speaker,
  StrokePlayer,
  directionRows,
  hanzi,
  hanziOf,
  nextDue,
  otherForm,
  sensesOf,
  useFirstSentence,
  useHasBreakdown,
} from './parts';
import { p } from './prototypeCopy';

export const name = 'Strokes first';

/** A picker chip that shows only when the character has a breakdown. */
const PartChip: React.FC<{ char: string; selected: boolean; onSelect: () => void }> = ({
  char,
  selected,
  onSelect,
}) => {
  const has = useHasBreakdown(char);
  if (!has) return null;
  return (
    <ButtonBase
      aria-pressed={selected}
      onClick={onSelect}
      sx={{
        width: 48,
        height: 48,
        borderRadius: 1,
        border: `2px solid ${selected ? colors.primaryDark : colors.divider}`,
        bgcolor: colors.card,
      }}
    >
      <Box lang="zh" sx={hanzi(28)}>
        {char}
      </Box>
    </ButtonBase>
  );
};

const VariantC: React.FC<{ data: PageData }> = ({ data }) => {
  const { entry, owned, charSet } = data;
  const word = owned ?? entry;
  const chars = hanziOf(word[charSet]);
  const glossFor = useCharacterGlosses(chars, charSet);
  const sentence = useFirstSentence(word, charSet);
  const [partChar, setPartChar] = useState<string | null>(chars[0] ?? null);

  if (data.covered) return <Cover onShow={data.onShow} />;

  const syllables = word.pinyin.split(/\s+/);
  const perChar = syllables.length === chars.length;
  // Phone width less the gutters, shared by the boxes, at most 150 each.
  const box = Math.min(150, Math.floor((340 - 8 * (chars.length - 1)) / Math.max(chars.length, 1)));
  const other = otherForm(word, charSet);

  return (
    <Box sx={{ textAlign: 'left', pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* The word, drawn */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
        {chars.map((char, i) => (
          <Box
            key={`${char}-${i}`}
            sx={{ width: box, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
          >
            <StrokePlayer char={char} size={box} />
            {perChar && (
              <Box lang="zh-Latn" sx={{ fontSize: 17, fontWeight: 600, color: colors.primaryDark }}>
                {syllables[i]}
              </Box>
            )}
            <Box
              sx={{
                fontSize: 12,
                color: colors.textSecondary,
                textAlign: 'center',
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {glossLine(glossFor(char))}
            </Box>
          </Box>
        ))}
        {chars.length === 0 && (
          <Box lang="zh" sx={hanzi(64)}>
            {word[charSet]}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
        {!perChar && (
          <Box lang="zh-Latn" sx={{ fontSize: 18, fontWeight: 600, color: colors.primaryDark }}>
            {word.pinyin}
          </Box>
        )}
        {other && (
          <Box lang="zh" sx={hanzi(20, { color: colors.textSecondary })}>
            {other}
          </Box>
        )}
        <Speaker text={word[charSet]} />
        {!owned && <AddButton onAdd={data.onAdd} />}
      </Box>

      {/* Progress strip: five columns, one per direction */}
      {owned && (
        <Box sx={{ p: 1.5, bgcolor: colors.card, border: `1px solid ${colors.divider}`, borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.25 }}>
            <Box sx={{ fontSize: 14, fontWeight: 600 }}>{BANK_LABELS[owned.level ?? 1]}</Box>
            <Box sx={{ fontSize: 13, color: colors.textSecondary }}>
              {p.next} · {nextDue(owned)}
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 0.5 }}>
            {directionRows(owned).map((row) => (
              <Box
                key={row.direction}
                aria-label={`${row.label}, ${BANK_LABELS[row.level]}, ${row.due}`}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column-reverse', gap: '2px', width: 22 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        height: 7,
                        borderRadius: '1px',
                        bgcolor: i <= row.level ? levelInk[row.level - 1] : colors.blankDay,
                        outline: row.leech ? `1px solid ${colors.warning}` : 'none',
                      }}
                    />
                  ))}
                </Box>
                <Box sx={{ fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                  {row.label.split(' → ')[0]}
                  <br />
                  {'→ '}
                  {row.label.split(' → ')[1]}
                </Box>
                <Box sx={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center' }}>{row.due.replace('Due in ', '')}</Box>
                {row.lapses > 0 && (
                  <Box sx={{ fontSize: 11, color: row.leech ? colors.warningText : colors.textSecondary }}>
                    {p.lapses(row.lapses)}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
          {directionRows(owned).some((r) => r.leech) && (
            <Box sx={{ mt: 1 }}>
              <LeechChip />
            </Box>
          )}
          <Box sx={{ mt: 1, fontSize: 12, color: colors.textSecondary }}>
            {p.lists}: {data.listNames.join(', ')}
          </Box>
        </Box>
      )}

      <Box>
        {owned?.ammended_meaning && (
          <Box sx={{ fontSize: 17, fontWeight: 600, mb: 1 }}>{owned.ammended_meaning}</Box>
        )}
        <Box
          component="ol"
          sx={{ m: 0, pl: 3, color: owned?.ammended_meaning ? colors.textSecondary : colors.text }}
        >
          {sensesOf(entry.meaning).map((s) => (
            <Box component="li" key={s} sx={{ fontSize: 15 }}>
              {s}
            </Box>
          ))}
        </Box>
        {data.otherReadings.length > 0 && (
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Overline>{p.otherReadings}</Overline>
            {data.otherReadings.map((r) => (
              <ButtonBase
                key={r.id}
                onClick={() => data.onOpenReading(r)}
                sx={{ fontFamily: fonts.body, fontSize: 14, fontWeight: 600, color: colors.primaryDark }}
              >
                {r.pinyin}
              </ButtonBase>
            ))}
          </Box>
        )}
      </Box>

      {sentence && (
        <Box sx={{ borderLeft: `3px solid ${colors.primaryDark}`, pl: 1.5 }}>
          <SentenceView sentence={sentence} charSet={charSet} word={word} size={22} />
        </Box>
      )}

      {chars.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Overline sx={{ flex: 1 }}>{p.characters}</Overline>
            {Array.from(new Set(chars)).map((c) => (
              <PartChip key={c} char={c} selected={partChar === c} onSelect={() => setPartChar(c)} />
            ))}
          </Box>
          {partChar && <PartsOf key={partChar} char={partChar} />}
        </Box>
      )}
    </Box>
  );
};

const PartsOf: React.FC<{ char: string }> = ({ char }) =>
  useHasBreakdown(char) ? <CharacterBreakdown char={char} /> : null;

export default VariantC;
