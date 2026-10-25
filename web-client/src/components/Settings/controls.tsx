import React, { useId } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

import { colors, fonts } from '../../theme';
import { copy } from '../../copy';

// The rows of the Settings page, which the session's settings sheet shares:
// a label on the left and its control on the right.

const visuallyHidden = {
  position: 'absolute',
  // Strings, because MUI reads the number 1 as 100%.
  width: '1px',
  height: '1px',
  margin: '-1px',
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

const rowBase = {
  width: '100%',
  boxSizing: 'border-box',
  px: 2,
  py: 1,
  borderTop: `1px solid ${colors.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 2,
  fontFamily: fonts.body,
  fontSize: 16,
  color: colors.text,
  textAlign: 'left',
} as const;

const hintSx = { fontSize: 13, color: colors.textSecondary };

const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <Box
    component="svg"
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={colors.textSecondary}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    sx={{
      flex: 'none',
      transition: 'transform 150ms ease',
      transform: open ? 'rotate(180deg)' : 'none',
    }}
  >
    <path d="M6 9l6 6 6-6" />
  </Box>
);

const cardSx = {
  bgcolor: colors.card,
  border: `1px solid ${colors.divider}`,
  borderRadius: 1,
  overflow: 'hidden',
};

interface FoldGroupProps {
  title: string;
  summary: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** A group that opens and closes. While closed, its header shows its values. */
export const FoldGroup: React.FC<FoldGroupProps> = ({
  title,
  summary,
  open,
  onToggle,
  children,
}) => {
  const id = useId();
  return (
    <Box component="section" aria-labelledby={id} sx={cardSx}>
      <Box component="h2" sx={{ m: 0, font: 'inherit' }}>
        <ButtonBase
          aria-expanded={open}
          onClick={onToggle}
          sx={{
            width: '100%',
            minHeight: 64,
            px: 2,
            py: 1.5,
            gap: 1.5,
            justifyContent: 'flex-start',
            textAlign: 'left',
            fontFamily: fonts.body,
            color: colors.text,
          }}
        >
          <Box
            component="span"
            sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}
          >
            <Box component="span" id={id} sx={{ fontSize: 17, fontWeight: 600 }}>
              {title}
            </Box>
            {!open && (
              <Box
                component="span"
                sx={{
                  fontSize: 14,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {summary}
              </Box>
            )}
          </Box>
          <Chevron open={open} />
        </ButtonBase>
      </Box>
      {open && children}
    </Box>
  );
};

/** Names in order, with an arrow between each two: the stages of a session. */
export const Trail: React.FC<{ names: string[] }> = ({ names }) => (
  <>
    {names.map((name, index) => (
      <React.Fragment key={name}>
        {index > 0 && (
          <>
            <Box component="span" sx={visuallyHidden}>
              {copy.settings.stageSeparator}
            </Box>
            <Box
              component="svg"
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
              sx={{ mx: 0.5, verticalAlign: '-2px' }}
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </Box>
          </>
        )}
        {name}
      </React.Fragment>
    ))}
  </>
);

/** A group that is always open, with a small caps title: the session sheet's. */
export const PlainGroup: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const id = useId();
  return (
    <Box component="section" aria-labelledby={id} sx={cardSx}>
      <Box
        component="h3"
        id={id}
        sx={{
          m: 0,
          px: 2,
          pt: 1.5,
          pb: 1,
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: colors.textSecondary,
        }}
      >
        {title}
      </Box>
      {children}
    </Box>
  );
};

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Why the switch is off. A blocked switch reads as off. */
  block?: string | null;
  disabled?: boolean;
}

/** A row that is one switch: a tap anywhere on it toggles the value. */
export const SwitchRow: React.FC<SwitchRowProps> = ({
  label,
  checked,
  onChange,
  block,
  disabled,
}) => {
  const off = !!block || !!disabled;
  const on = checked && !off;
  return (
    <ButtonBase
      role="switch"
      aria-checked={on}
      disabled={off}
      onClick={() => onChange(!checked)}
      sx={{
        ...rowBase,
        minHeight: block ? 64 : 56,
        color: off ? colors.textSecondary : colors.text,
        '&:focus-visible .switch': {
          outline: `2px solid ${colors.primaryDark}`,
          outlineOffset: '2px',
        },
      }}
    >
      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span>{label}</span>
        {block && (
          <Box component="span" sx={hintSx}>
            {block}
          </Box>
        )}
      </Box>
      <Box
        component="span"
        aria-hidden="true"
        className="switch"
        sx={{
          flex: 'none',
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: '10px',
          bgcolor: on ? colors.primaryDark : colors.borderStrong,
          opacity: off ? 0.5 : 1,
          transition: 'background-color 150ms ease',
        }}
      >
        <Box
          component="span"
          sx={{
            position: 'absolute',
            top: 2,
            left: on ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '8px',
            bgcolor: colors.white,
            transition: 'left 150ms ease',
          }}
        />
      </Box>
    </ButtonBase>
  );
};

interface Option<T extends string> {
  value: T;
  label: string;
}

/** A row with a label and two or more joined buttons, one of them chosen. */
export function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <Box sx={{ ...rowBase, minHeight: 56 }}>
      <span id={id}>{label}</span>
      <Box
        role="radiogroup"
        aria-labelledby={id}
        sx={{
          display: 'flex',
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {options.map((option) => {
          const on = option.value === value;
          return (
            <ButtonBase
              key={option.value}
              role="radio"
              aria-checked={on}
              onClick={() => onChange(option.value)}
              sx={{
                height: 40,
                px: 2,
                fontFamily: fonts.body,
                fontSize: 14,
                fontWeight: 600,
                bgcolor: on ? colors.primaryDark : colors.card,
                color: on ? colors.white : colors.text,
              }}
            >
              {option.label}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

const stepSx = {
  width: 44,
  height: 44,
  borderRadius: '22px',
  border: `1px solid ${colors.borderStrong}`,
  bgcolor: colors.card,
  color: colors.primaryDark,
  '&.Mui-disabled': { borderColor: colors.divider, color: colors.disabledText },
};

const StepIcon: React.FC<{ plus?: boolean }> = ({ plus }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={plus ? 'M12 5v14M5 12h14' : 'M5 12h14'} />
  </svg>
);

/** A row with a number and the buttons that step it. */
export const StepperRow: React.FC<{
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}> = ({ label, hint, value, min, max, step, onChange }) => {
  const id = useId();
  return (
    <Box sx={{ ...rowBase, minHeight: 72, py: 1.5 }}>
      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span id={id}>{label}</span>
        <Box component="span" sx={hintSx}>
          {hint}
        </Box>
      </Box>
      <Box role="group" aria-labelledby={id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ButtonBase
          aria-label={copy.settings.fewer}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          sx={stepSx}
        >
          <StepIcon />
        </ButtonBase>
        <Box
          component="span"
          sx={{
            minWidth: 36,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Box>
        <ButtonBase
          aria-label={copy.settings.more}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          sx={stepSx}
        >
          <StepIcon plus />
        </ButtonBase>
      </Box>
    </Box>
  );
};

/** A set of chips, one of them chosen. */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: (Option<T> & { disabled?: boolean })[];
  onChange: (value: T) => void;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      sx={{
        px: 2,
        pt: 1.5,
        pb: 2,
        borderTop: `1px solid ${colors.divider}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <ButtonBase
            key={option.value}
            role="radio"
            aria-checked={on}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            sx={{
              height: 40,
              px: 1.75,
              borderRadius: 1,
              border: `1px solid ${on ? colors.primaryDark : colors.borderStrong}`,
              bgcolor: on ? colors.primaryDark : colors.card,
              color: on ? colors.white : colors.text,
              fontFamily: fonts.body,
              fontSize: 14,
              fontWeight: 600,
              '&.Mui-disabled': { color: colors.disabledText },
            }}
          >
            {option.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
