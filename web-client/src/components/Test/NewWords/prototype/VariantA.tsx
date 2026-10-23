// PROTOTYPE (#413) variant A, "Card and tiles": the word on the study card,
// and every character as a tile under it, already filled in. A tap on a tile
// opens a sheet with its strokes and parts. Throwaway.
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Box, ButtonBase, CircularProgress, Drawer } from '@mui/material';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import {
  Overline,
  PlayButton,
  StudyButton,
  StudyCard,
  hanziSize,
  hanziSx,
} from '../../Study/parts';
import { colors, fonts } from '../../../../theme';
import { Word } from '../../../../types/models';
import {
  CharInfo,
  Strokes,
  marks,
  meanings,
  protoCopy,
  useCharInfos,
  useCharSet,
  useParts,
  useSpeak,
} from './shared';

const CharSheet: React.FC<{ info: CharInfo | null; onClose: () => void }> = ({ info, onClose }) => {
  const parts = useParts(info?.char ?? null);
  const [replay, setReplay] = useState(0);
  return (
    <Drawer
      anchor="bottom"
      open={info !== null}
      onClose={onClose}
      PaperProps={{
        sx: {
          m: 2,
          mx: 'auto',
          width: 'calc(100% - 32px)',
          maxWidth: 408,
          boxSizing: 'border-box',
          borderRadius: 2,
          p: 2.5,
          fontFamily: fonts.body,
          color: colors.text,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        },
      }}
    >
      {info && (
        <>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ButtonBase onClick={() => setReplay((n) => n + 1)} aria-label={protoCopy.replay}>
              <Strokes char={info.char} size={128} replayKey={replay} />
            </ButtonBase>
            <Box sx={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <Box lang="zh-Latn" sx={{ fontSize: 22 }}>
                {info.pinyins.join(' / ')}
              </Box>
              <Box sx={{ fontSize: 15, color: colors.textSecondary, mt: 0.5 }}>
                {info.meanings.join(' · ')}
              </Box>
            </Box>
          </Box>
          <Box>
            <Overline sx={{ mb: 1 }}>{protoCopy.parts}</Overline>
            {parts === null ? (
              <CircularProgress size={20} />
            ) : parts.length === 0 ? (
              <Box sx={{ fontSize: 14, color: colors.textSecondary, textAlign: 'left' }}>
                {protoCopy.noParts}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {parts.map((p) => (
                  <Box
                    key={p.char}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.25,
                      py: 0.75,
                      border: `1px solid ${colors.divider}`,
                      borderRadius: 1,
                    }}
                  >
                    <Box lang="zh" sx={hanziSx(28)}>
                      {p.char}
                    </Box>
                    <Box sx={{ fontSize: 13, color: colors.textSecondary, textAlign: 'left' }}>
                      {p.pinyin && <Box>{p.pinyin}</Box>}
                      <Box>{p.meaning}</Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
};

interface Props {
  words: Word[];
  startTest?: () => void;
}

const VariantA: React.FC<Props> = ({ words, startTest }) => {
  const history = useHistory();
  const charSet = useCharSet();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<CharInfo | null>(null);
  const word = words[index];
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const infos = useCharInfos(chars, charSet);
  const { speak, loading } = useSpeak();
  const last = index === words.length - 1;

  useEffect(() => {
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
      <StudyCard
        height={220}
        sx={{ mt: 3, pt: 5 }}
        corner={
          <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
            <PlayButton size={44} loading={loading} onClick={() => speak(word[charSet])} />
          </Box>
        }
      >
        <Box lang="zh" sx={hanziSx(hanziSize(word[charSet], 'medium'))}>
          {word[charSet]}
        </Box>
        <Box lang="zh-Latn" sx={{ fontSize: 20 }}>
          {marks(word.pinyin)}
        </Box>
        <Box sx={{ fontSize: 16, color: colors.textSecondary }}>
          {meanings(word.meaning).join(' · ')}
        </Box>
      </StudyCard>

      <Overline sx={{ mt: 3, mb: 1 }}>{protoCopy.characters}</Overline>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {chars.map((char, i) => {
          const info = infos[i];
          return (
            <ButtonBase
              key={i}
              onClick={() => info && setOpen(info)}
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                gap: 2,
                p: 1.5,
                bgcolor: colors.card,
                border: `1px solid ${colors.divider}`,
                borderRadius: 1,
                textAlign: 'left',
                fontFamily: fonts.body,
              }}
            >
              <Box lang="zh" sx={hanziSx(40, { width: 48, textAlign: 'center' })}>
                {char}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box lang="zh-Latn" sx={{ fontSize: 16, color: colors.text }}>
                  {info?.pinyins.join(' / ')}
                </Box>
                <Box
                  sx={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {info?.meanings.join(' · ')}
                </Box>
              </Box>
              <Box sx={{ color: colors.textSecondary, fontSize: 20 }}>›</Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        {index > 0 && (
          <StudyButton onClick={() => setIndex(index - 1)} sx={{ flex: '0 0 35%' }}>
            {protoCopy.back}
          </StudyButton>
        )}
        <StudyButton variant="primary" onClick={() => (last ? startTest?.() : setIndex(index + 1))}>
          {last ? protoCopy.start : protoCopy.next}
        </StudyButton>
      </Box>
      <CharSheet info={open} onClose={() => setOpen(null)} />
    </StudyScreen>
  );
};

export default VariantA;
