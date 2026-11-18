// PROTOTYPE (#562), variant B: a compact sticky header and three tabs.
// No long scroll: Meaning, Characters (one character at a time, large),
// Progress (only for the learner's word).
import React, { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';

import { colors, fonts, levelInk } from '../../theme';
import { BANK_LABELS } from '../../utils/scheduling';
import { toneMarks } from '../../utils/pinyinMarks';
import {
  glossLine,
  useCharacterGlosses,
} from '../../components/Test/ComponentReview/useCharacterGlosses';
import {
  AddButton,
  Cover,
  LeechChip,
  MaybeBreakdown,
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
} from './parts';
import { p } from './prototypeCopy';

export const name = 'Header + tabs';

type Tab = 'meaning' | 'characters' | 'progress';

const VariantB: React.FC<{ data: PageData }> = ({ data }) => {
  const { entry, owned, charSet } = data;
  const word = owned ?? entry;
  const chars = hanziOf(word[charSet]);
  const glossFor = useCharacterGlosses(chars, charSet);
  const sentence = useFirstSentence(word, charSet);
  const [tab, setTab] = useState<Tab>('meaning');
  const [charIndex, setCharIndex] = useState(0);

  if (data.covered) return <Cover onShow={data.onShow} />;

  const tabs: [Tab, string][] = [
    ['meaning', p.tabMeaning],
    ...(chars.length > 0 ? ([['characters', p.tabCharacters]] as [Tab, string][]) : []),
    ...(owned ? ([['progress', p.tabProgress]] as [Tab, string][]) : []),
  ];
  const other = otherForm(word, charSet);
  const char = chars[Math.min(charIndex, chars.length - 1)];
  const gloss = char ? glossFor(char) : undefined;

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: colors.paper,
          pt: 1.5,
          borderBottom: `1px solid ${colors.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box lang="zh" sx={hanzi(48)}>
            {word[charSet]}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box lang="zh-Latn" sx={{ fontSize: 17, fontWeight: 600, color: colors.primaryDark }}>
              {word.pinyin}
              {other && (
                <Box component="span" lang="zh" sx={hanzi(16, { color: colors.textSecondary, ml: 1 })}>
                  {other}
                </Box>
              )}
            </Box>
            <Box
              sx={{
                fontSize: 13,
                color: colors.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {owned?.ammended_meaning || sensesOf(entry.meaning)[0]}
            </Box>
          </Box>
          <Speaker text={word[charSet]} />
          {!owned && <AddButton onAdd={data.onAdd} sx={{ px: 2 }} />}
        </Box>
        <Box role="tablist" sx={{ display: 'flex', mt: 1.5 }}>
          {tabs.map(([key, label]) => (
            <ButtonBase
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              sx={{
                flex: 1,
                height: 44,
                fontFamily: fonts.body,
                fontSize: 14,
                fontWeight: 600,
                color: tab === key ? colors.text : colors.textSecondary,
                borderBottom: `2px solid ${tab === key ? colors.primaryDark : 'transparent'}`,
              }}
            >
              {label}
            </ButtonBase>
          ))}
        </Box>
      </Box>

      {tab === 'meaning' && (
        <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {owned?.ammended_meaning && (
            <Box>
              <Overline sx={{ mb: 0.5 }}>{p.yourMeaning}</Overline>
              <Box sx={{ fontSize: 17 }}>{owned.ammended_meaning}</Box>
            </Box>
          )}
          <Box component="ol" sx={{ m: 0, pl: 3 }}>
            {sensesOf(entry.meaning).map((s) => (
              <Box component="li" key={s} sx={{ fontSize: 16, py: 0.25 }}>
                {s}
              </Box>
            ))}
          </Box>
          {data.otherReadings.length > 0 && (
            <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
              {p.otherReadings}:{' '}
              {data.otherReadings.map((r, i) => (
                <React.Fragment key={r.id}>
                  {i > 0 && ', '}
                  <ButtonBase
                    onClick={() => data.onOpenReading(r)}
                    sx={{ fontFamily: fonts.body, fontSize: 14, fontWeight: 600, color: colors.primaryDark }}
                  >
                    {r[charSet]} {r.pinyin}
                  </ButtonBase>
                </React.Fragment>
              ))}
            </Box>
          )}
          {sentence && (
            <Box
              sx={{ p: 2, bgcolor: colors.card, border: `1px solid ${colors.divider}`, borderRadius: 1 }}
            >
              <SentenceView sentence={sentence} charSet={charSet} word={word} size={26} pinyin />
            </Box>
          )}
        </Box>
      )}

      {tab === 'characters' && char && (
        <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {chars.length > 1 && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {chars.map((c, i) => (
                <ButtonBase
                  key={`${c}-${i}`}
                  aria-pressed={i === charIndex}
                  onClick={() => setCharIndex(i)}
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 1,
                    border: `2px solid ${i === charIndex ? colors.primaryDark : colors.divider}`,
                    bgcolor: colors.card,
                  }}
                >
                  <Box lang="zh" sx={hanzi(30)}>
                    {c}
                  </Box>
                </ButtonBase>
              ))}
            </Box>
          )}
          <StrokePlayer key={`${char}-${charIndex}`} char={char} size={220} />
          <Box sx={{ textAlign: 'center' }}>
            {gloss && gloss.pinyins.length > 0 && (
              <Box lang="zh-Latn" sx={{ fontSize: 18, fontWeight: 600, color: colors.primaryDark }}>
                {gloss.pinyins.map(toneMarks).join(' / ')}
              </Box>
            )}
            <Box sx={{ fontSize: 15, color: colors.textSecondary }}>{glossLine(gloss)}</Box>
          </Box>
          <MaybeBreakdown key={`b-${char}-${charIndex}`} char={char} />
        </Box>
      )}

      {tab === 'progress' && owned && (
        <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
            <Box sx={{ fontSize: 28, fontWeight: 700 }}>{BANK_LABELS[owned.level ?? 1]}</Box>
            <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
              {p.next} · {nextDue(owned)}
            </Box>
          </Box>
          {directionRows(owned).map((row) => (
            <Box key={row.direction} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{row.label}</Box>
                {row.leech && <LeechChip />}
              </Box>
              {/* One bar per direction, filled to its level. */}
              <Box sx={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      flex: 1,
                      height: 10,
                      borderRadius: '2px',
                      bgcolor: i <= row.level ? levelInk[row.level - 1] : colors.blankDay,
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ fontSize: 13, color: colors.textSecondary, display: 'flex', gap: 1.5 }}>
                <span>{BANK_LABELS[row.level]}</span>
                <span>{row.due}</span>
                {row.lapses > 0 && <span>{p.lapses(row.lapses)}</span>}
              </Box>
            </Box>
          ))}
          <Box sx={{ fontSize: 14, pt: 1, borderTop: `1px solid ${colors.divider}` }}>
            <Overline sx={{ mb: 0.5 }}>{p.lists}</Overline>
            {data.listNames.join(', ')}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default VariantB;
