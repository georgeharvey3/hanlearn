// PROTOTYPE (#407) Variant A, "Grouped rows": one scrolling page of grouped
// cards. Every row is a label on the left and its control on the right, so the
// session sheet is just the same rows, cut down. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Drawer from '@mui/material/Drawer';

import { colors, fonts, shadows } from '../../../theme';
import {
  Eyebrow,
  Priority,
  Proto,
  QUESTIONS_PER_SESSION_MAX,
  QUESTIONS_PER_SESSION_MIN,
  QUESTIONS_PER_SESSION_STEP,
  SKILLS,
  Segmented,
  Stepper,
  Switch,
  pc,
  quizOptions,
} from './shared';

const Group: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box sx={{ mb: 3 }}>
    <Eyebrow>{label}</Eyebrow>
    <Box
      sx={{
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  </Box>
);

const Row: React.FC<{
  label: React.ReactNode;
  hint?: string | null;
  control?: React.ReactNode;
  below?: React.ReactNode;
  dim?: boolean;
}> = ({ label, hint, control, below, dim }) => (
  <Box
    sx={{
      px: 2,
      py: 1.25,
      minHeight: 56,
      borderTop: `1px solid ${colors.divider}`,
      '&:first-of-type': { borderTop: 'none' },
    }}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        minHeight: 32,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ fontSize: 16, color: dim ? colors.textSecondary : colors.text }}>{label}</Box>
        {hint && <Box sx={{ fontSize: 13, color: colors.textSecondary, mt: 0.25 }}>{hint}</Box>}
      </Box>
      {control}
    </Box>
    {below && <Box sx={{ mt: 1.25 }}>{below}</Box>}
  </Box>
);

/** The rows the page and the session sheet share. */
const AnswerRows: React.FC<{ p: Proto; sheet?: boolean }> = ({ p, sheet }) => (
  <>
    <Row
      label={pc.meaning}
      control={
        <Segmented
          label={pc.meaning}
          size="sm"
          value={p.s.meaningQuizType}
          options={quizOptions}
          onChange={(v) => p.set('meaningQuizType', v)}
        />
      }
    />
    <Row
      label={pc.pinyin}
      control={
        <Segmented
          label={pc.pinyin}
          size="sm"
          value={p.s.pinyinQuizType}
          options={quizOptions}
          onChange={(v) => p.set('pinyinQuizType', v)}
        />
      }
    />
    {!sheet && (
      <Row
        label={pc.handwriting}
        control={
          <Switch
            label={pc.handwriting}
            checked={p.s.useHandwriting}
            onChange={(v) => p.set('useHandwriting', v)}
          />
        }
      />
    )}
    <Row
      label={pc.autoRecord}
      dim={!!p.disabled.useAutoRecord}
      hint={p.disabled.useAutoRecord}
      control={
        <Switch
          label={pc.autoRecord}
          checked={p.shown.useAutoRecord}
          disabled={!!p.disabled.useAutoRecord}
          onChange={(v) => p.set('useAutoRecord', v)}
        />
      }
    />
  </>
);

const SoundRows: React.FC<{ p: Proto }> = ({ p }) => (
  <>
    <Row
      label={pc.tts}
      dim={!!p.disabled.useSound}
      hint={p.disabled.useSound}
      control={
        <Switch
          label={pc.tts}
          checked={p.shown.useSound}
          disabled={!!p.disabled.useSound}
          onChange={(v) => p.set('useSound', v)}
        />
      }
    />
    <Row
      label={pc.effects}
      control={
        <Switch
          label={pc.effects}
          checked={p.s.useSoundEffects}
          onChange={(v) => p.set('useSoundEffects', v)}
        />
      }
    />
  </>
);

const Chip: React.FC<{
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ on, disabled, onClick, children }) => (
  <ButtonBase
    role="radio"
    aria-checked={on}
    disabled={disabled}
    onClick={onClick}
    sx={{
      height: 36,
      px: 1.5,
      borderRadius: '18px',
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: 600,
      border: `1px solid ${on ? colors.primaryDark : colors.borderStrong}`,
      bgcolor: on ? colors.successSurface : colors.card,
      color: disabled ? colors.disabledText : on ? colors.primaryDark : colors.text,
    }}
  >
    {children}
  </ButtonBase>
);

const VariantA: React.FC<{ p: Proto }> = ({ p }) => {
  const { s, set, disabled, shown } = p;
  const stage = (
    key: 'newWords' | 'sentenceRead' | 'sentenceWrite' | 'sentenceStagesForAllWords',
    label: string,
  ) => {
    const why = key === 'sentenceWrite' ? null : disabled[key];
    const checked = key === 'sentenceWrite' ? s.sentenceWrite : shown[key];
    return (
      <Row
        label={label}
        dim={!!why}
        hint={why}
        control={
          <Switch label={label} checked={checked} disabled={!!why} onChange={(v) => set(key, v)} />
        }
      />
    );
  };

  return (
    <Box
      sx={{
        maxWidth: 560,
        mx: 'auto',
        px: 2,
        pt: 3,
        pb: 16,
        fontFamily: fonts.body,
        textAlign: 'left',
      }}
    >
      <Box component="h1" sx={{ fontSize: 28, fontWeight: 700, m: 0, mb: 3 }}>
        {pc.title}
      </Box>

      <Group label={pc.session}>
        <Row
          label={pc.questionsPerSession}
          hint={pc.minutes(p.time)}
          control={
            <Stepper
              value={s.questionsPerSession}
              min={QUESTIONS_PER_SESSION_MIN}
              max={QUESTIONS_PER_SESSION_MAX}
              step={QUESTIONS_PER_SESSION_STEP}
              onChange={(v) => set('questionsPerSession', v)}
            />
          }
        />
        <Row
          label={pc.script}
          control={
            <Segmented
              label={pc.script}
              size="sm"
              value={s.charSet}
              options={[
                { value: 'simp', label: pc.simp },
                { value: 'trad', label: pc.trad },
              ]}
              onChange={(v) => set('charSet', v)}
            />
          }
        />
      </Group>

      <Group label={pc.answers}>
        <AnswerRows p={p} />
      </Group>

      <Group label={pc.focus}>
        <Row
          label={pc.focus}
          below={
            <Box role="radiogroup" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip on={s.priority === 'none'} onClick={() => set('priority', 'none')}>
                {pc.noFocus}
              </Chip>
              {SKILLS.map((k) => (
                <Chip
                  key={k.key}
                  on={s.priority === k.key}
                  disabled={k.key === 'CM' && !!disabled.CM}
                  onClick={() => set('priority', k.key as Priority)}
                >
                  {k.label}
                </Chip>
              ))}
            </Box>
          }
        />
        <Row
          label={pc.onlyFocus}
          dim={s.priority === 'none'}
          control={
            <Switch
              label={pc.onlyFocus}
              checked={s.onlyPriority && s.priority !== 'none'}
              disabled={s.priority === 'none'}
              onChange={(v) => set('onlyPriority', v)}
            />
          }
        />
      </Group>

      <Group label={pc.stages}>
        {stage('newWords', pc.newWords)}
        {stage('sentenceRead', pc.sentenceRead)}
        {stage('sentenceStagesForAllWords', pc.allWords)}
        {stage('sentenceWrite', pc.sentenceWrite)}
      </Group>

      <Group label={pc.sound}>
        <SoundRows p={p} />
      </Group>

      <Group label={pc.account}>
        <Row label={p.env.email ?? pc.notSignedIn} hint={p.env.email ? pc.signedInAs : null} />
        {p.env.email && (
          <ButtonBase
            onClick={p.env.onLogout}
            sx={{
              width: '100%',
              justifyContent: 'flex-start',
              px: 2,
              height: 52,
              borderTop: `1px solid ${colors.divider}`,
              fontFamily: fonts.body,
              fontSize: 16,
              color: colors.primaryLight,
            }}
          >
            {pc.logout}
          </ButtonBase>
        )}
      </Group>
    </Box>
  );
};

export const SheetA: React.FC<{ p: Proto; open: boolean; onClose: () => void }> = ({
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
        boxShadow: shadows.dialog,
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
    <Box sx={{ fontSize: 18, fontWeight: 700, mb: 2, px: 0.5 }}>{pc.sheetTitle}</Box>
    <Group label={pc.answers}>
      <AnswerRows p={p} sheet />
    </Group>
    <Group label={pc.sound}>
      <SoundRows p={p} />
    </Group>
  </Drawer>
);

export default VariantA;
