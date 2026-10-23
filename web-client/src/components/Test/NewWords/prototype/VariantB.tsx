// PROTOTYPE (#413) variant B, "Tabbed card": the word stays at the top and
// one tall card swaps between four views of it: meaning, characters, strokes
// and parts. Nothing opens over the card. Throwaway.
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Box, ButtonBase, CircularProgress, IconButton } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import { PlayButton, StudyButton, hanziSize, hanziSx } from '../../Study/parts';
import { colors, fonts, shadows } from '../../../../theme';
import { Word } from '../../../../types/models';
import {
  Strokes,
  marks,
  meanings,
  protoCopy,
  useCharInfos,
  useCharSet,
  useParts,
  useSpeak,
} from './shared';

type Tab = 'meaning' | 'characters' | 'strokes' | 'parts';
const TABS: { key: Tab; label: string }[] = [
  { key: 'meaning', label: protoCopy.meaning },
  { key: 'characters', label: protoCopy.characters },
  { key: 'strokes', label: protoCopy.strokes },
  { key: 'parts', label: protoCopy.parts },
];

const CharPicker: React.FC<{ chars: string[]; current: number; onPick: (i: number) => void }> = ({
  chars,
  current,
  onPick,
}) =>
  chars.length < 2 ? null : (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
      {chars.map((c, i) => (
        <ButtonBase
          key={i}
          onClick={() => onPick(i)}
          aria-pressed={i === current}
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1,
            border: `1px solid ${i === current ? colors.primaryDark : colors.borderStrong}`,
            bgcolor: i === current ? colors.successSurface : 'transparent',
            ...hanziSx(24),
          }}
        >
          {c}
        </ButtonBase>
      ))}
    </Box>
  );

const PartsView: React.FC<{ char: string }> = ({ char }) => {
  const parts = useParts(char);
  if (parts === null) return <CircularProgress size={24} sx={{ mx: 'auto', mt: 4 }} />;
  if (parts.length === 0)
    return <Box sx={{ color: colors.textSecondary, mt: 4 }}>{protoCopy.noParts}</Box>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mt: 2 }}>
      <Box lang="zh" sx={hanziSx(72)}>
        {char}
      </Box>
      <Box sx={{ fontSize: 24, color: colors.textSecondary }}>=</Box>
      {parts.map((p, i) => (
        <React.Fragment key={p.char}>
          {i > 0 && <Box sx={{ fontSize: 24, color: colors.textSecondary }}>+</Box>}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Box lang="zh" sx={hanziSx(48, { color: colors.primaryLight })}>
              {p.char}
            </Box>
            <Box sx={{ fontSize: 12, color: colors.textSecondary, maxWidth: 72 }}>{p.meaning}</Box>
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
};

interface Props {
  words: Word[];
  startTest?: () => void;
}

const VariantB: React.FC<Props> = ({ words, startTest }) => {
  const history = useHistory();
  const charSet = useCharSet();
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('meaning');
  const [charIndex, setCharIndex] = useState(0);
  const [replay, setReplay] = useState(0);
  const word = words[index];
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const infos = useCharInfos(chars, charSet);
  const { speak, loading } = useSpeak();
  const last = index === words.length - 1;

  useEffect(() => {
    setTab('meaning');
    setCharIndex(0);
    speak(word[charSet]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  return (
    <StudyScreen>
      <StudyTop
        stage={protoCopy.stage}
        done={index}
        position={index + 1}
        total={words.length}
        onEnd={() => history.push('/')}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2.5, mb: 2 }}>
        <Box sx={{ flex: 1, textAlign: 'left' }}>
          <Box lang="zh" sx={hanziSx(hanziSize(word[charSet], 'small'))}>
            {word[charSet]}
          </Box>
          <Box lang="zh-Latn" sx={{ fontSize: 18, mt: 1 }}>
            {marks(word.pinyin)}
          </Box>
        </Box>
        <PlayButton size={56} loading={loading} onClick={() => speak(word[charSet])} />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 340,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: colors.card,
          border: `1px solid ${colors.divider}`,
          borderRadius: 1,
          boxShadow: shadows.card,
          overflow: 'hidden',
        }}
      >
        <Box role="tablist" sx={{ display: 'flex', borderBottom: `1px solid ${colors.divider}` }}>
          {TABS.map((t) => (
            <ButtonBase
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              sx={{
                flex: 1,
                height: 44,
                fontFamily: fonts.body,
                fontSize: 13,
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? colors.primaryDark : colors.textSecondary,
                borderBottom: `2px solid ${tab === t.key ? colors.primaryDark : 'transparent'}`,
              }}
            >
              {t.label}
            </ButtonBase>
          ))}
        </Box>
        <Box sx={{ flex: 1, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tab === 'meaning' && (
            <Box
              component="ol"
              sx={{ m: 0, pl: 3, textAlign: 'left', fontSize: 20, lineHeight: 1.6 }}
            >
              {meanings(word.meaning).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </Box>
          )}
          {tab === 'characters' &&
            chars.map((c, i) => (
              <Box
                key={i}
                sx={{ display: 'flex', gap: 2, alignItems: 'baseline', textAlign: 'left' }}
              >
                <Box lang="zh" sx={hanziSx(44)}>
                  {c}
                </Box>
                <Box>
                  <Box lang="zh-Latn" sx={{ fontSize: 17 }}>
                    {infos[i]?.pinyins.join(' / ')}
                  </Box>
                  <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
                    {infos[i]?.meanings.join(' · ')}
                  </Box>
                </Box>
              </Box>
            ))}
          {tab === 'strokes' && (
            <>
              <CharPicker chars={chars} current={charIndex} onPick={setCharIndex} />
              <Box sx={{ alignSelf: 'center' }}>
                <Strokes char={chars[charIndex]} size={200} replayKey={replay} />
              </Box>
              <StudyButton
                onClick={() => setReplay((n) => n + 1)}
                sx={{ width: 140, alignSelf: 'center' }}
              >
                {protoCopy.replay}
              </StudyButton>
            </>
          )}
          {tab === 'parts' && (
            <>
              <CharPicker chars={chars} current={charIndex} onPick={setCharIndex} />
              <PartsView char={chars[charIndex]} />
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.25, mt: 2.5, alignItems: 'center' }}>
        <IconButton
          aria-label={protoCopy.back}
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          sx={{
            width: 52,
            height: 52,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 1,
          }}
        >
          <ChevronLeftRoundedIcon />
        </IconButton>
        <StudyButton variant="primary" onClick={() => (last ? startTest?.() : setIndex(index + 1))}>
          {last ? protoCopy.start : protoCopy.next}
        </StudyButton>
      </Box>
    </StudyScreen>
  );
};

export default VariantB;
