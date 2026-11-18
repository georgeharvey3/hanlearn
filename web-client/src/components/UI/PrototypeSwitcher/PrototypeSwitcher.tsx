// PROTOTYPE switcher: a floating bar that cycles the `?variant=` search param.
// The dev server only; the production build never mounts it.
import React, { useCallback, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

interface Props {
  variants: { key: string; name: string }[];
  /** A second param to cycle, such as the data case. */
  extra?: { param: string; values: string[] };
}

export const useParam = (param: string, fallback: string): string => {
  const { search } = useLocation();
  return new URLSearchParams(search).get(param) ?? fallback;
};

const PrototypeSwitcher: React.FC<Props> = ({ variants, extra }) => {
  const history = useHistory();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const current = params.get('variant') ?? variants[0].key;
  const index = Math.max(0, variants.findIndex((v) => v.key === current));

  const set = useCallback(
    (param: string, value: string) => {
      const next = new URLSearchParams(location.search);
      next.set(param, value);
      history.replace({ ...location, search: next.toString() });
    },
    [history, location],
  );
  const step = useCallback(
    (by: number) => set('variant', variants[(index + by + variants.length) % variants.length].key),
    [index, set, variants],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  if (!import.meta.env.DEV) return null;
  const v = variants[index];
  const btn: React.CSSProperties = {
    background: 'transparent',
    color: '#fff',
    border: 'none',
    fontSize: 18,
    padding: '6px 10px',
    cursor: 'pointer',
  };
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 88,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: '#111',
        color: '#fff',
        borderRadius: 999,
        padding: '4px 8px',
        boxShadow: '0 4px 16px rgba(0,0,0,.35)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      <button type="button" style={btn} onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        {v.key} ({v.name})
      </span>
      <button type="button" style={btn} onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
      {extra && (
        <select
          value={params.get(extra.param) ?? extra.values[0]}
          onChange={(e) => set(extra.param, e.target.value)}
          style={{ marginLeft: 6, background: '#333', color: '#fff', border: 'none', borderRadius: 6, padding: 4 }}
        >
          {extra.values.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default PrototypeSwitcher;
