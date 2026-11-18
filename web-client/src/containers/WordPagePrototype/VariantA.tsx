// PROTOTYPE (#562), variant A: one long reference page, in the order of the
// issue. Header, meanings, other readings, example, characters, progress.
import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { colors, fonts } from '../../theme';
import { BANK_LABELS } from '../../utils/scheduling';
import {
  AddButton,
  Cover,
  LeechChip,
  LevelPips,
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
  useCharInfo,
  wordSenses,
  formName,
  otherSet,
} from './parts';
import { p } from './prototypeCopy';

export const name = 'Reference page';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box
    component="section"
    sx={{ py: 2.5, borderTop: `1px solid ${colors.divider}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}
  >
    <Overline>{title}</Overline>
    {children}
  </Box>
);

const VariantA: React.FC<{ data: PageData }> = ({ data }) => {
  const { entry, owned, charSet } = data;
  const word = owned ?? entry;
  const chars = hanziOf(word[charSet]);
  const infoAt = useCharInfo(word, charSet);
  const otherChars = hanziOf(word[otherSet(charSet)]);
  const sentence = useFirstSentence(word, charSet);

  if (data.covered) return <Cover onShow={data.onShow} />;

  const other = otherForm(word, charSet);
  return (
    <Box sx={{ textAlign: 'left' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, pt: 2, pb: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 1.5 }}>
            <Box lang="zh" sx={hanzi(72, { whiteSpace: 'nowrap' })}>
              {word[charSet]}
            </Box>
            {other && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box lang="zh" sx={hanzi(34, { color: colors.textSecondary, whiteSpace: 'nowrap' })}>
                  {other}
                </Box>
                <Box sx={{ fontSize: 11, color: colors.textSecondary, mt: 0.5 }}>
                  {formName(otherSet(charSet))}
                </Box>
              </Box>
            )}
          </Box>
          <Box lang="zh-Latn" sx={{ mt: 1, fontSize: 20, color: colors.primaryDark, fontWeight: 600 }}>
            {word.pinyin}
          </Box>
          {chars.length > 1 && (
            <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
              {chars.map((char, i) => (
                <React.Fragment key={`${char}-${i}`}>
                  {i > 0 && <Box sx={{ color: colors.textSecondary }}>+</Box>}
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 0.75,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: colors.card,
                      border: `1px solid ${colors.divider}`,
                    }}
                  >
                    <Box lang="zh" sx={hanzi(20)}>
                      {char}
                    </Box>
                    <Box sx={{ fontSize: 13, color: colors.textSecondary }}>
                      {wordSenses(infoAt(i), 1) || '…'}
                    </Box>
                  </Box>
                </React.Fragment>
              ))}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pt: 1 }}>
          <Speaker text={word[charSet]} />
          {!owned && <AddButton onAdd={data.onAdd} />}
        </Box>
      </Box>

      <Section title={p.senses}>
        {owned?.ammended_meaning && (
          <Box sx={{ p: 1.5, bgcolor: colors.successSurface, borderRadius: 1 }}>
            <Overline sx={{ mb: 0.5 }}>{p.yourMeaning}</Overline>
            <Box sx={{ fontSize: 16 }}>{owned.ammended_meaning}</Box>
          </Box>
        )}
        <Box component="ol" sx={{ m: 0, pl: 3, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {sensesOf(entry.meaning).map((s) => (
            <Box component="li" key={s} sx={{ fontSize: 16 }}>
              {s}
            </Box>
          ))}
        </Box>
      </Section>

      {data.otherReadings.length > 0 && (
        <Section title={p.otherReadings}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {data.otherReadings.map((r) => (
              <ButtonBase
                key={r.id}
                onClick={() => data.onOpenReading(r)}
                sx={{
                  px: 1.5,
                  height: 36,
                  borderRadius: 1,
                  border: `1px solid ${colors.borderStrong}`,
                  fontFamily: fonts.body,
                  fontSize: 14,
                  gap: 1,
                }}
              >
                <Box lang="zh" sx={hanzi(18)}>
                  {r[charSet]}
                </Box>
                <Box lang="zh-Latn">{r.pinyin}</Box>
              </ButtonBase>
            ))}
          </Box>
        </Section>
      )}

      {sentence && (
        <Section title={p.example}>
          <SentenceView sentence={sentence} charSet={charSet} word={word} />
        </Section>
      )}

      {chars.length > 0 && (
        <Section title={p.characters}>
          {chars.map((char, i) => {
            const info = infoAt(i);
            const reading = info?.inWord ?? info?.others[0];
            const alt = otherChars[i] && otherChars[i] !== char ? otherChars[i] : null;
            const others = info ? info.others.filter((r) => r !== reading) : [];
            return (
              <Box
                key={`${char}-${i}`}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  pb: 2,
                  borderBottom: i < chars.length - 1 ? `1px dashed ${colors.divider}` : 'none',
                }}
              >
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
                  <StrokePlayer char={char} size={104} />
                  {alt && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <StrokePlayer char={alt} size={64} />
                      <Box sx={{ fontSize: 11, color: colors.textSecondary }}>
                        {formName(otherSet(charSet))}
                      </Box>
                    </Box>
                  )}
                </Box>
                <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {reading && (
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Box lang="zh-Latn" sx={{ flex: 'none', fontSize: 16, fontWeight: 600, color: colors.primaryDark }}>
                        {reading.pinyin}
                      </Box>
                      <Box sx={{ fontSize: 15 }}>{reading.senses.slice(0, 4).join(' · ')}</Box>
                    </Box>
                  )}
                  {!reading && <Box sx={{ fontSize: 14, color: colors.textSecondary }}>{wordSenses(info)}</Box>}
                  {others.length > 0 && (
                    <Box sx={{ mt: 0.5, fontSize: 13, color: colors.textSecondary }}>
                      {others.slice(0, 3).map((r) => `${r.pinyin} ${r.senses.slice(0, 2).join(', ')}`).join('  ·  ')}
                    </Box>
                  )}
                </Box>
                <MaybeBreakdown char={char} />
              </Box>
            );
          })}
        </Section>
      )}

      {owned && (
        <Section title={p.yourProgress}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LevelPips level={owned.level ?? 1} size={10} />
            <Box sx={{ fontSize: 15, fontWeight: 600 }}>{BANK_LABELS[owned.level ?? 1]}</Box>
            <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
              {p.next} · {nextDue(owned)}
            </Box>
          </Box>
          <Box sx={{ border: `1px solid ${colors.divider}`, borderRadius: 1, bgcolor: colors.card }}>
            {directionRows(owned).map((row, i, all) => (
              <Box
                key={row.direction}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  rowGap: 0.5,
                  borderBottom: i < all.length - 1 ? `1px solid ${colors.divider}` : 'none',
                }}
              >
                <Box sx={{ fontSize: 14 }}>{row.label}</Box>
                <LevelPips level={row.level} />
                <Box sx={{ fontSize: 13, color: colors.textSecondary, display: 'flex', gap: 1.5 }}>
                  <span>{row.due}</span>
                  {row.lapses > 0 && <span>{p.lapses(row.lapses)}</span>}
                </Box>
                <Box>{row.leech && <LeechChip />}</Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ fontSize: 14 }}>
            <Box component="span" sx={{ color: colors.textSecondary }}>
              {p.lists}:{' '}
            </Box>
            {data.listNames.join(', ')}
          </Box>
        </Section>
      )}
    </Box>
  );
};

export default VariantA;
