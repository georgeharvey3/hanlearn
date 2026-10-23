// PROTOTYPE (#408 epic, copied from prototype/dashboard-403): a floating bar that flips between design variants on
// one route. It never renders in a production build. Throwaway; lives on a
// prototype branch only.
import React, { useCallback, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export interface PrototypeVariant {
  /** The `?variant=` value. An empty key means "no param": the current app. */
  key: string;
  name: string;
}

export interface PrototypeState {
  /** The `?state=` value. An empty key means "no param": the normal state. */
  key: string;
  name: string;
}

interface Props {
  variants: PrototypeVariant[];
  /** Preview states of the page, set by `?state=`. */
  states?: PrototypeState[];
  /** One-shot actions, such as "show a toast". */
  actions?: { name: string; run: () => void }[];
}

export const usePrototypeParam = (name: string): string => {
  const location = useLocation();
  return new URLSearchParams(location.search).get(name) ?? '';
};

const stickyKey = (name: string) => `prototype:${name}`;

const readSticky = (name: string): string => {
  try {
    return sessionStorage.getItem(stickyKey(name)) ?? '';
  } catch {
    return '';
  }
};

const writeSticky = (name: string, value: string): void => {
  try {
    if (value) sessionStorage.setItem(stickyKey(name), value);
    else sessionStorage.removeItem(stickyKey(name));
  } catch {
    // A private window: the param just won't follow in-app links.
  }
};

/**
 * A param that survives in-app links, which drop the query string: the last
 * value set stays for this tab and is put back on the URL.
 */
export const useStickyPrototypeParam = (name: string): string => {
  const history = useHistory();
  const location = useLocation();
  const fromUrl = usePrototypeParam(name);
  const value = fromUrl || readSticky(name);

  useEffect(() => {
    if (fromUrl) {
      writeSticky(name, fromUrl);
    } else if (value) {
      const params = new URLSearchParams(location.search);
      params.set(name, value);
      history.replace({ pathname: location.pathname, search: `?${params}` });
    }
  }, [fromUrl, value, name, history, location.pathname, location.search]);

  return value;
};

const isEditable = (el: Element | null): boolean =>
  !!el &&
  (el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    (el as HTMLElement).isContentEditable === true);

const PrototypeSwitcher: React.FC<Props> = ({ variants, states = [], actions = [] }) => {
  const history = useHistory();
  const location = useLocation();
  const current = useStickyPrototypeParam('variant');
  const currentState = usePrototypeParam('state');
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  const setParam = useCallback(
    (name: string, value: string) => {
      writeSticky(name, value);
      const params = new URLSearchParams(location.search);
      if (value) params.set(name, value);
      else params.delete(name);
      const search = params.toString();
      history.replace({ pathname: location.pathname, search: search ? `?${search}` : '' });
    },
    [history, location.pathname, location.search],
  );

  const step = useCallback(
    (delta: number) => {
      const next = variants[(index + delta + variants.length) % variants.length];
      setParam('variant', next.key);
    },
    [index, setParam, variants],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement)) return;
      if (!e.shiftKey) return; // The Test uses bare arrow keys; Shift+arrow cycles.
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  if (import.meta.env.PROD) return null;

  const v = variants[index];
  const pill = {
    color: '#fff',
    minWidth: 0,
    px: { xs: 0.75, sm: 1 },
    py: 0.25,
    fontSize: { xs: 11, sm: 12 },
    borderRadius: 999,
    textTransform: 'none',
  } as const;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        // #414: under the buttons; each variant leaves a gap at its foot for it.
        bottom: 8,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        gap: 0.25,
        px: 0.5,
        py: 0.5,
        maxWidth: 'calc(100vw - 16px)',
        bgcolor: '#111',
        color: '#fff',
        borderRadius: 999,
        boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: { xs: 11, sm: 13 },
      }}
    >
      <IconButton
        size="small"
        onClick={() => step(-1)}
        sx={{ color: '#fff', p: 0.5 }}
        aria-label="Previous variant"
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <Box sx={{ textAlign: 'center', fontWeight: 600 }}>
        {v.key ? `${v.key} · ${v.name}` : v.name}
      </Box>
      <IconButton
        size="small"
        onClick={() => step(1)}
        sx={{ color: '#fff', p: 0.5 }}
        aria-label="Next variant"
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
      {states.map((s) => (
        <Button
          key={s.key || 'normal'}
          size="small"
          onClick={() => setParam('state', s.key)}
          sx={{ ...pill, bgcolor: s.key === currentState ? '#444' : 'transparent' }}
        >
          {s.name}
        </Button>
      ))}
      {actions.map((a) => (
        <Button
          key={a.name}
          size="small"
          onClick={a.run}
          sx={{ ...pill, border: '1px solid #555' }}
        >
          {a.name}
        </Button>
      ))}
    </Box>
  );
};

export default PrototypeSwitcher;
