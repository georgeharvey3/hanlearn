// PROTOTYPE (#407) Variant C, "Index and detail": the page is a short index.
// Each row names a group and shows its current values; a tap opens the group.
// On a phone the group replaces the index, with a back button; on a desktop it
// sits beside the index. The controls are selection lists with a tick, not
// segmented buttons. The session sheet is the index itself: a tap on a row
// steps to its next value. Throwaway.
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Drawer from '@mui/material/Drawer';
import Slider from '@mui/material/Slider';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CheckIcon from '@mui/icons-material/Check';

import { colors, fonts } from '../../../theme';
import {
  Eyebrow,
  Priority,
  Proto,
  QUESTIONS_PER_SESSION_MAX,
  QUESTIONS_PER_SESSION_MIN,
  QUESTIONS_PER_SESSION_STEP,
  SKILLS,
  Switch,
  pc,
  quizName,
  quizOptions,
  summary,
} from './shared';
import type { Group } from './shared';

const GROUPS: { key: Group; label: string }[] = [
  { key: 'session', label: pc.session },
  { key: 'answers', label: pc.answers },
  { key: 'focus', label: pc.focus },
  { key: 'stages', label: pc.stages },
  { key: 'sound', label: pc.sound },
  { key: 'account', label: pc.account },
];

const IndexRow: React.FC<{
  label: string;
  value: string;
  active?: boolean;
  onClick: () => void;
  chevron?: boolean;
}> = ({ label, value, active, onClick, chevron = true }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      textAlign: 'left',
      px: 2,
      py: 1.5,
      minHeight: 64,
      fontFamily: fonts.body,
      borderBottom: `1px solid ${colors.divider}`,
      bgcolor: active ? colors.successSurface : 'transparent',
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ fontSize: 17, fontWeight: 600, color: colors.text }}>{label}</Box>
      <Box
        sx={{
          fontSize: 14,
          color: colors.textSecondary,
          mt: 0.25,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </Box>
    </Box>
    {chevron && <ChevronRightIcon sx={{ color: colors.placeholder }} />}
  </ButtonBase>
);

/** A selection list: one row per option, a tick on the chosen one. */
function Pick<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: string | null }[];
  onChange: (v: T) => void;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Eyebrow>{label}</Eyebrow>
      <Box role="radiogroup" aria-label={label} sx={listSx}>
        {options.map((o) => (
          <ButtonBase
            key={o.value}
            role="radio"
            aria-checked={o.value === value}
            disabled={!!o.disabled}
            onClick={() => onChange(o.value)}
            sx={{ ...itemSx, color: o.disabled ? colors.disabledText : colors.text }}
          >
            <Box sx={{ flex: 1, textAlign: 'left' }}>
              {o.label}
              {o.disabled && (
                <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{o.disabled}</Box>
              )}
            </Box>
            {o.value === value && <CheckIcon sx={{ color: colors.primaryDark }} />}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

const listSx = {
  bgcolor: colors.card,
  border: `1px solid ${colors.divider}`,
  borderRadius: '10px',
  overflow: 'hidden',
};

const itemSx = {
  width: '100%',
  minHeight: 52,
  px: 2,
  py: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  fontFamily: fonts.body,
  fontSize: 16,
  borderTop: `1px solid ${colors.divider}`,
  '&:first-of-type': { borderTop: 'none' },
};

const Toggles: React.FC<{
  label?: string;
  items: { label: string; checked: boolean; why?: string | null; onChange: (v: boolean) => void }[];
}> = ({ label, items }) => (
  <Box sx={{ mb: 3 }}>
    {label && <Eyebrow>{label}</Eyebrow>}
    <Box sx={listSx}>
      {items.map((it) => (
        <Box
          key={it.label}
          component="div"
          sx={{ ...itemSx, color: it.why ? colors.textSecondary : colors.text }}
        >
          <Box sx={{ flex: 1 }}>
            {it.label}
            {it.why && <Box sx={{ fontSize: 13 }}>{it.why}</Box>}
          </Box>
          <Switch
            label={it.label}
            checked={it.checked}
            disabled={!!it.why}
            onChange={it.onChange}
          />
        </Box>
      ))}
    </Box>
  </Box>
);

const Detail: React.FC<{ p: Proto; group: Group }> = ({ p, group }) => {
  const { s, set, disabled, shown } = p;
  switch (group) {
    case 'session':
      return (
        <>
          <Eyebrow>{pc.questionsPerSession}</Eyebrow>
          <Box sx={{ ...listSx, px: 2.5, pt: 2, pb: 1, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Box sx={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {s.questionsPerSession}
              </Box>
              <Box sx={{ fontSize: 15, color: colors.textSecondary }}>{pc.minutes(p.time)}</Box>
            </Box>
            <Slider
              sx={{ color: colors.primaryDark }}
              value={s.questionsPerSession}
              min={QUESTIONS_PER_SESSION_MIN}
              max={QUESTIONS_PER_SESSION_MAX}
              step={QUESTIONS_PER_SESSION_STEP}
              marks
              onChange={(_e, v) => set('questionsPerSession', v as number)}
              aria-label={pc.questionsPerSession}
            />
          </Box>
          <Pick
            label={pc.script}
            value={s.charSet}
            options={[
              { value: 'simp', label: `${pc.simp}  学` },
              { value: 'trad', label: `${pc.trad}  學` },
            ]}
            onChange={(v) => set('charSet', v)}
          />
        </>
      );
    case 'answers':
      return (
        <>
          <Pick
            label={pc.meaning}
            value={s.meaningQuizType}
            options={quizOptions}
            onChange={(v) => set('meaningQuizType', v)}
          />
          <Pick
            label={pc.pinyin}
            value={s.pinyinQuizType}
            options={quizOptions}
            onChange={(v) => set('pinyinQuizType', v)}
          />
          <Toggles
            items={[
              {
                label: pc.handwriting,
                checked: s.useHandwriting,
                onChange: (v) => set('useHandwriting', v),
              },
              {
                label: pc.autoRecord,
                checked: shown.useAutoRecord,
                why: disabled.useAutoRecord,
                onChange: (v) => set('useAutoRecord', v),
              },
            ]}
          />
        </>
      );
    case 'focus':
      return (
        <>
          <Pick<Priority>
            label={pc.focus}
            value={s.priority}
            options={[
              { value: 'none', label: pc.noFocus },
              ...SKILLS.map((k) => ({
                value: k.key as Priority,
                label: k.label,
                disabled: k.key === 'CM' ? disabled.CM : null,
              })),
            ]}
            onChange={(v) => set('priority', v)}
          />
          {s.priority !== 'none' && (
            <Toggles
              items={[
                {
                  label: pc.onlyFocus,
                  checked: s.onlyPriority,
                  onChange: (v) => set('onlyPriority', v),
                },
              ]}
            />
          )}
        </>
      );
    case 'stages':
      return (
        <Toggles
          items={[
            {
              label: pc.newWords,
              checked: shown.newWords,
              why: disabled.newWords,
              onChange: (v) => set('newWords', v),
            },
            {
              label: pc.sentenceRead,
              checked: shown.sentenceRead,
              why: disabled.sentenceRead,
              onChange: (v) => set('sentenceRead', v),
            },
            {
              label: pc.allWords,
              checked: shown.sentenceStagesForAllWords,
              why: disabled.sentenceStagesForAllWords,
              onChange: (v) => set('sentenceStagesForAllWords', v),
            },
            {
              label: pc.sentenceWrite,
              checked: s.sentenceWrite,
              onChange: (v) => set('sentenceWrite', v),
            },
          ]}
        />
      );
    case 'sound':
      return (
        <Toggles
          items={[
            {
              label: pc.tts,
              checked: shown.useSound,
              why: disabled.useSound,
              onChange: (v) => set('useSound', v),
            },
            {
              label: pc.effects,
              checked: s.useSoundEffects,
              onChange: (v) => set('useSoundEffects', v),
            },
          ]}
        />
      );
    case 'account':
      return (
        <Box sx={listSx}>
          <Box sx={{ ...itemSx, display: 'block', py: 1.5 }}>
            <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{pc.signedInAs}</Box>
            {p.env.email ?? pc.notSignedIn}
          </Box>
          {p.env.email && (
            <ButtonBase onClick={p.env.onLogout} sx={{ ...itemSx, color: colors.primaryLight }}>
              {pc.logout}
            </ButtonBase>
          )}
        </Box>
      );
  }
};

const VariantC: React.FC<{ p: Proto }> = ({ p }) => {
  // The open group. On a desktop the first group is open from the start.
  const [open, setOpen] = useState<Group | null>(null);
  const label = GROUPS.find((g) => g.key === open)?.label;

  const index = (desktop: boolean) => (
    <Box sx={{ borderTop: `1px solid ${colors.divider}` }}>
      {GROUPS.map((g) => (
        <IndexRow
          key={g.key}
          label={g.label}
          value={summary(p, g.key)}
          active={desktop && g.key === (open ?? 'session')}
          onClick={() => setOpen(g.key)}
        />
      ))}
    </Box>
  );

  return (
    <Box
      sx={{
        maxWidth: 960,
        mx: 'auto',
        pt: 3,
        pb: 16,
        textAlign: 'left',
        fontFamily: fonts.body,
        color: colors.text,
      }}
    >
      {/* Phone: index, or one group full width. */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {open === null ? (
          <>
            <Box component="h1" sx={{ fontSize: 28, fontWeight: 700, m: 0, mb: 2, px: 2 }}>
              {pc.title}
            </Box>
            {index(false)}
          </>
        ) : (
          <Box sx={{ px: 2 }}>
            <ButtonBase
              onClick={() => setOpen(null)}
              sx={{
                fontFamily: fonts.body,
                fontSize: 15,
                color: colors.primaryDark,
                ml: -1,
                mb: 1,
                p: 1,
              }}
            >
              <ChevronLeftIcon fontSize="small" />
              {pc.title}
            </ButtonBase>
            <Box component="h1" sx={{ fontSize: 28, fontWeight: 700, m: 0, mb: 2.5 }}>
              {label}
            </Box>
            <Detail p={p} group={open} />
          </Box>
        )}
      </Box>

      {/* Desktop: index and the open group side by side. */}
      <Box
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: '320px 1fr',
          gap: 4,
          px: 3,
        }}
      >
        <Box>
          <Box component="h1" sx={{ fontSize: 28, fontWeight: 700, m: 0, mb: 2 }}>
            {pc.title}
          </Box>
          {index(true)}
        </Box>
        <Box sx={{ pt: 7 }}>
          <Detail p={p} group={open ?? 'session'} />
        </Box>
      </Box>
    </Box>
  );
};

/** The sheet: the index rows of the session's settings; a tap steps the value. */
export const SheetC: React.FC<{ p: Proto; open: boolean; onClose: () => void }> = ({
  p,
  open,
  onClose,
}) => {
  const { s, set, shown, disabled } = p;
  const flip = (v: string) => (v === 'input' ? 'flashcard' : 'input');
  const onOff = (b: boolean) => (b ? pc.on : pc.off);
  const rows = [
    {
      label: pc.meaning,
      value: quizName(s.meaningQuizType),
      go: () => set('meaningQuizType', flip(s.meaningQuizType)),
    },
    {
      label: pc.pinyin,
      value: quizName(s.pinyinQuizType),
      go: () => set('pinyinQuizType', flip(s.pinyinQuizType)),
    },
    {
      label: pc.tts,
      value: disabled.useSound ?? onOff(shown.useSound),
      go: disabled.useSound ? undefined : () => set('useSound', !s.useSound),
    },
    {
      label: pc.effects,
      value: onOff(s.useSoundEffects),
      go: () => set('useSoundEffects', !s.useSoundEffects),
    },
    {
      label: pc.autoRecord,
      value: disabled.useAutoRecord ?? onOff(shown.useAutoRecord),
      go: disabled.useAutoRecord ? undefined : () => set('useAutoRecord', !s.useAutoRecord),
    },
  ];
  return (
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
      <Box sx={{ fontSize: 18, fontWeight: 700, mb: 1, px: 2 }}>{pc.sheetTitle}</Box>
      <Box sx={{ borderTop: `1px solid ${colors.divider}` }}>
        {rows.map((r) => (
          <ButtonBase
            key={r.label}
            disabled={!r.go}
            onClick={r.go}
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              px: 2,
              minHeight: 52,
              fontFamily: fonts.body,
              fontSize: 16,
              borderBottom: `1px solid ${colors.divider}`,
              color: r.go ? colors.text : colors.textSecondary,
            }}
          >
            {r.label}
            <Box
              component="span"
              sx={{ fontWeight: 600, color: r.go ? colors.primaryDark : colors.disabledText }}
            >
              {r.value}
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </Drawer>
  );
};

export default VariantC;
