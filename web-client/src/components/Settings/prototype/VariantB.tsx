// PROTOTYPE (#407) Variant B, "Session recipe": the page draws the session the
// settings make. Its size and time sit on top with the split by skill, the
// stages run down a timeline, and the skills are four tiles. Sound and the
// microphone are icon toggles, and the session sheet reuses those. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Drawer from '@mui/material/Drawer';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MicIcon from '@mui/icons-material/Mic';

import { colors, fonts, levelInk, shadows } from '../../../theme';
import { Direction } from '../../../types/models';
import {
  Eyebrow,
  Proto,
  QUESTIONS_PER_SESSION_MAX,
  QUESTIONS_PER_SESSION_MIN,
  QUESTIONS_PER_SESSION_STEP,
  SKILLS,
  Segmented,
  Switch,
  pc,
  quizOptions,
} from './shared';

// The Dashboard's names for the five directions.
const DIRECTION_NAMES: Record<Direction, string> = {
  MC: 'Reading',
  MP: 'Listening',
  PM: 'Speaking',
  PC: 'Pronouncing',
  CM: 'Writing',
};
const DIRECTION_ORDER: Direction[] = ['MP', 'PM', 'MC', 'PC', 'CM'];

const card = {
  bgcolor: colors.card,
  border: `1px solid ${colors.divider}`,
  borderRadius: '14px',
  boxShadow: shadows.card,
};

const RoundButton: React.FC<{
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, disabled, onClick, children }) => (
  <ButtonBase
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    sx={{
      width: 48,
      height: 48,
      borderRadius: '24px',
      border: `1px solid ${colors.borderStrong}`,
      color: colors.primaryDark,
      fontSize: 24,
      bgcolor: colors.card,
      '&.Mui-disabled': { color: colors.disabledText },
    }}
  >
    {children}
  </ButtonBase>
);

/** The size of the session, its time, and the split of its questions by skill. */
const Hero: React.FC<{ p: Proto }> = ({ p }) => {
  const n = p.s.questionsPerSession;
  const counts = DIRECTION_ORDER.map((d) => ({
    d,
    n: p.directions.filter((x) => x === d).length,
  })).filter((c) => c.n > 0);
  return (
    <Box sx={{ ...card, p: 2.5, mb: 3 }}>
      <Eyebrow>{pc.session}</Eyebrow>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <RoundButton
          label={pc.fewer}
          disabled={n <= QUESTIONS_PER_SESSION_MIN}
          onClick={() => p.set('questionsPerSession', n - QUESTIONS_PER_SESSION_STEP)}
        >
          −
        </RoundButton>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {n}
          </Box>
          <Box sx={{ fontSize: 14, color: colors.textSecondary, mt: 0.5 }}>
            {pc.questions} · {pc.minutes(p.time)}
          </Box>
        </Box>
        <RoundButton
          label={pc.more}
          disabled={n >= QUESTIONS_PER_SESSION_MAX}
          onClick={() => p.set('questionsPerSession', n + QUESTIONS_PER_SESSION_STEP)}
        >
          +
        </RoundButton>
      </Box>
      <Box
        sx={{
          display: 'flex',
          height: 10,
          borderRadius: '5px',
          overflow: 'hidden',
          mt: 2.5,
          gap: '2px',
        }}
      >
        {counts.map((c, i) => (
          <Box
            key={c.d}
            sx={{ flex: c.n, bgcolor: levelInk[Math.min(4, i + (5 - counts.length))] }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5, mt: 1 }}>
        {counts.map((c, i) => (
          <Box
            key={c.d}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '2px',
                bgcolor: levelInk[Math.min(4, i + (5 - counts.length))],
              }}
            />
            {DIRECTION_NAMES[c.d]} {c.n}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/** One stop on the stage timeline. */
const Stop: React.FC<{
  label: string;
  on: boolean;
  fixed?: boolean;
  why?: string | null;
  last?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}> = ({ label, on, fixed, why, last, onToggle, children }) => (
  <Box sx={{ display: 'flex', gap: 1.5 }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
      <ButtonBase
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={fixed || !!why}
        onClick={onToggle}
        sx={{
          mt: '10px',
          width: 22,
          height: 22,
          flex: 'none',
          borderRadius: '11px',
          border: `2px solid ${on ? colors.primaryDark : colors.borderStrong}`,
          bgcolor: on ? colors.primaryDark : colors.card,
          color: colors.white,
          fontSize: 13,
        }}
      >
        {on ? '✓' : ''}
      </ButtonBase>
      {!last && <Box sx={{ flex: 1, width: 2, bgcolor: colors.divider, minHeight: 16 }} />}
    </Box>
    <Box sx={{ flex: 1, pb: last ? 0 : 1.5 }}>
      <ButtonBase
        disabled={fixed || !!why}
        onClick={onToggle}
        sx={{
          display: 'block',
          textAlign: 'left',
          width: '100%',
          py: 1,
          fontFamily: fonts.body,
          fontSize: 16,
          fontWeight: 600,
          color: on ? colors.text : colors.textSecondary,
          textDecoration: on || fixed ? 'none' : 'line-through',
          textDecorationColor: colors.borderStrong,
        }}
      >
        {label}
        {why && (
          <Box component="span" sx={{ display: 'block', fontSize: 13, fontWeight: 400 }}>
            {why}
          </Box>
        )}
      </ButtonBase>
      {children}
    </Box>
  </Box>
);

const SkillTile: React.FC<{ p: Proto; k: (typeof SKILLS)[number] }> = ({ p, k }) => {
  const focus = p.s.priority === k.key;
  const off = k.key === 'CM' && !p.s.useHandwriting;
  return (
    <Box
      sx={{
        ...card,
        boxShadow: 'none',
        position: 'relative',
        borderColor: focus ? colors.primaryDark : colors.divider,
        borderWidth: focus ? 2 : 1,
        bgcolor: off ? colors.blankDay : colors.card,
      }}
    >
      <ButtonBase
        aria-pressed={focus}
        disabled={off}
        onClick={() => p.set('priority', focus ? 'none' : k.key)}
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          p: 1.5,
          pt: 1,
          fontFamily: fonts.body,
          borderRadius: '14px',
        }}
      >
        <Box
          sx={{
            fontFamily: fonts.hanzi,
            fontSize: 40,
            lineHeight: 1.2,
            color: off ? colors.disabledText : focus ? colors.primaryDark : colors.text,
          }}
        >
          {k.hanzi}
        </Box>
        <Box sx={{ fontSize: 14, fontWeight: 600, color: off ? colors.disabledText : colors.text }}>
          {k.label}
        </Box>
        <Box sx={{ fontSize: 12, color: colors.primaryDark, minHeight: 18, fontWeight: 700 }}>
          {focus ? pc.focus : ''}
        </Box>
      </ButtonBase>
      {k.key === 'CM' && (
        <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
          <Switch
            label={pc.handwriting}
            checked={p.s.useHandwriting}
            onChange={(v) => p.set('useHandwriting', v)}
          />
        </Box>
      )}
    </Box>
  );
};

/** Sound, effects and the microphone as three round toggles with a label. */
const IconToggles: React.FC<{ p: Proto }> = ({ p }) => {
  const items = [
    {
      key: 'useSound' as const,
      label: pc.tts,
      icon: <VolumeUpIcon />,
      on: p.shown.useSound,
      why: p.disabled.useSound,
    },
    {
      key: 'useSoundEffects' as const,
      label: pc.effects,
      icon: <MusicNoteIcon />,
      on: p.s.useSoundEffects,
      why: null,
    },
    {
      key: 'useAutoRecord' as const,
      label: pc.autoRecord,
      icon: <MicIcon />,
      on: p.shown.useAutoRecord,
      why: p.disabled.useAutoRecord,
    },
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
      {items.map((it) => (
        <ButtonBase
          key={it.key}
          role="switch"
          aria-checked={it.on}
          disabled={!!it.why}
          onClick={() => p.set(it.key, !it.on)}
          sx={{
            flexDirection: 'column',
            gap: 0.75,
            py: 1.5,
            px: 0.5,
            borderRadius: '12px',
            fontFamily: fonts.body,
            border: `1px solid ${it.on ? colors.primaryDark : colors.divider}`,
            bgcolor: it.on ? colors.successSurface : colors.card,
            color: it.why ? colors.disabledText : it.on ? colors.primaryDark : colors.textSecondary,
          }}
        >
          {it.icon}
          <Box sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>
            {it.label}
          </Box>
          <Box sx={{ fontSize: 11, lineHeight: 1.2, textAlign: 'center' }}>
            {it.why ?? (it.on ? pc.on : pc.off)}
          </Box>
        </ButtonBase>
      ))}
    </Box>
  );
};

const AnswerCards: React.FC<{ p: Proto }> = ({ p }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
    {(
      [
        ['meaningQuizType', pc.meaning],
        ['pinyinQuizType', pc.pinyin],
      ] as const
    ).map(([key, label]) => (
      <Box key={key} sx={{ ...card, boxShadow: 'none', p: 1.5 }}>
        <Box sx={{ fontSize: 14, fontWeight: 600, mb: 1 }}>{label}</Box>
        <Segmented
          label={label}
          size="sm"
          value={p.s[key]}
          options={quizOptions}
          onChange={(v) => p.set(key, v)}
        />
      </Box>
    ))}
  </Box>
);

const ScriptToggle: React.FC<{ p: Proto }> = ({ p }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
    {(
      [
        ['simp', '学', pc.simp],
        ['trad', '學', pc.trad],
      ] as const
    ).map(([value, glyph, label]) => {
      const on = p.s.charSet === value;
      return (
        <ButtonBase
          key={value}
          role="radio"
          aria-checked={on}
          onClick={() => p.set('charSet', value)}
          sx={{
            ...card,
            boxShadow: 'none',
            py: 1.5,
            gap: 1.5,
            fontFamily: fonts.body,
            borderColor: on ? colors.primaryDark : colors.divider,
            borderWidth: on ? 2 : 1,
          }}
        >
          <Box sx={{ fontFamily: fonts.hanzi, fontSize: 36, lineHeight: 1 }}>{glyph}</Box>
          <Box sx={{ fontSize: 14, fontWeight: 600, color: on ? colors.primaryDark : colors.text }}>
            {label}
          </Box>
        </ButtonBase>
      );
    })}
  </Box>
);

const VariantB: React.FC<{ p: Proto }> = ({ p }) => {
  const { s, set, disabled, shown } = p;
  return (
    <Box
      sx={{
        maxWidth: 560,
        mx: 'auto',
        px: 2,
        pt: 3,
        pb: 16,
        textAlign: 'left',
        fontFamily: fonts.body,
        color: colors.text,
      }}
    >
      <Box component="h1" sx={{ fontSize: 28, fontWeight: 700, m: 0, mb: 2 }}>
        {pc.title}
      </Box>

      <Hero p={p} />

      <Eyebrow>{pc.stages}</Eyebrow>
      <Box sx={{ mb: 3, px: 0.5 }}>
        <Stop
          label={pc.newWords}
          on={shown.newWords}
          why={disabled.newWords}
          onToggle={() => set('newWords', !s.newWords)}
        />
        <Stop label={pc.test} on fixed />
        <Stop
          label={pc.sentenceRead}
          on={shown.sentenceRead}
          why={disabled.sentenceRead}
          onToggle={() => set('sentenceRead', !s.sentenceRead)}
        >
          {shown.sentenceRead && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Switch
                label={pc.allWords}
                checked={shown.sentenceStagesForAllWords}
                onChange={(v) => set('sentenceStagesForAllWords', v)}
              />
              <Box sx={{ fontSize: 14, color: colors.textSecondary }}>{pc.allWords}</Box>
            </Box>
          )}
        </Stop>
        <Stop
          label={pc.sentenceWrite}
          on={s.sentenceWrite}
          last
          onToggle={() => set('sentenceWrite', !s.sentenceWrite)}
        />
      </Box>

      <Eyebrow>{pc.skills}</Eyebrow>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
        {SKILLS.map((k) => (
          <SkillTile key={k.key} p={p} k={k} />
        ))}
      </Box>
      {s.priority !== 'none' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
          <Switch
            label={pc.onlyFocus}
            checked={s.onlyPriority}
            onChange={(v) => set('onlyPriority', v)}
          />
          <Box sx={{ fontSize: 14 }}>{pc.onlyFocus}</Box>
        </Box>
      )}
      <Box sx={{ mb: 3 }} />

      <Eyebrow>{pc.answers}</Eyebrow>
      <Box sx={{ mb: 1 }}>
        <AnswerCards p={p} />
      </Box>
      <Box sx={{ mb: 3 }}>
        <IconToggles p={p} />
      </Box>

      <Eyebrow>{pc.script}</Eyebrow>
      <Box sx={{ mb: 4 }}>
        <ScriptToggle p={p} />
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          pt: 2,
          borderTop: `1px solid ${colors.divider}`,
          fontSize: 14,
          color: colors.textSecondary,
        }}
      >
        <Box sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.env.email ?? pc.notSignedIn}
        </Box>
        {p.env.email && (
          <ButtonBase
            onClick={p.env.onLogout}
            sx={{
              fontFamily: fonts.body,
              fontSize: 14,
              fontWeight: 600,
              color: colors.primaryLight,
              p: 1,
            }}
          >
            {pc.logout}
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
};

export const SheetB: React.FC<{ p: Proto; open: boolean; onClose: () => void }> = ({
  p,
  open,
  onClose,
}) => (
  <Drawer
    anchor="bottom"
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxWidth: 480,
        mx: 'auto',
        bgcolor: colors.paper,
        px: 2,
        pt: 1.5,
        // PROTOTYPE: room for the floating switcher.
        pb: 12,
        textAlign: 'left',
        fontFamily: fonts.body,
        color: colors.text,
      },
    }}
  >
    <Box
      sx={{
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 1,
        bgcolor: colors.borderStrong,
        mb: 2,
      }}
    />
    <Box sx={{ fontSize: 18, fontWeight: 700, mb: 2 }}>{pc.sheetTitle}</Box>
    <Box sx={{ mb: 1 }}>
      <AnswerCards p={p} />
    </Box>
    <IconToggles p={p} />
  </Drawer>
);

export default VariantB;
