import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Box, ButtonBase, CircularProgress, Fade, Paper, Typography } from '@mui/material';

import { decomposeCharacter } from '../../../../services/decompositionService';
import { searchWord } from '../../../../services/dictionaryService';

interface DecompositionComponent {
  char: string;
  meaning: string | null;
  pinyin: string | null;
}

interface BreadcrumbEntry {
  char: string;
}

interface CharInfo {
  pinyin: string | null;
  meaning: string | null;
}

interface DecompositionTreeProps {
  char: string;
}

const SVG_SIZE = 280;
const CENTER = SVG_SIZE / 2;
const ROOT_RADIUS = 36;
const ORBIT_RADIUS = 95;
const NODE_RADIUS = 28;

function getNodePosition(index: number, total: number): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: CENTER + ORBIT_RADIUS * Math.cos(angle),
    y: CENTER + ORBIT_RADIUS * Math.sin(angle),
  };
}

const DecompositionTree: React.FC<DecompositionTreeProps> = ({ char }) => {
  const [rootChar, setRootChar] = useState(char);
  const [rootInfo, setRootInfo] = useState<CharInfo>({ pinyin: null, meaning: null });
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);
  const [components, setComponents] = useState<DecompositionComponent[] | null>(null);
  const [explored, setExplored] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decompCache = useRef<Map<string, DecompositionComponent[]>>(new Map());
  const infoCache = useRef<Map<string, CharInfo>>(new Map());
  const latestRequest = useRef<string>('');

  const lookupCharInfo = useCallback(async (target: string) => {
    const cached = infoCache.current.get(target);
    if (cached) {
      setRootInfo(cached);
      return;
    }
    try {
      const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp';
      const results = await searchWord(target, charSet);
      const info: CharInfo =
        results.length > 0
          ? {
              pinyin: Array.from(new Set(results.map((r) => r.pinyin))).join(' / '),
              meaning: Array.from(new Set(results.map((r) => r.meaning))).join(' / '),
            }
          : { pinyin: null, meaning: null };
      infoCache.current.set(target, info);
      setRootInfo(info);
    } catch {
      setRootInfo({ pinyin: null, meaning: null });
    }
  }, []);

  const decompose = useCallback(async (target: string) => {
    latestRequest.current = target;
    setLoading(true);
    setError(null);
    setComponents(null);

    const cached = decompCache.current.get(target);
    if (cached) {
      setComponents(cached);
      setLoading(false);
      return;
    }

    try {
      const result = await decomposeCharacter(target);
      if (latestRequest.current !== target) return;
      decompCache.current.set(target, result);
      setComponents(result);
    } catch (err) {
      if (latestRequest.current !== target) return;
      setComponents([]);
      setError(err instanceof Error ? err.message : 'Decomposition failed');
    } finally {
      if (latestRequest.current === target) {
        setLoading(false);
      }
    }
  }, []);

  // Reset when the parent character changes
  useEffect(() => {
    setRootChar(char);
    setRootInfo({ pinyin: null, meaning: null });
    setBreadcrumbs([]);
    setExplored(new Set());
    decompCache.current.clear();
    infoCache.current.clear();
    decompose(char);
    lookupCharInfo(char);
  }, [char, decompose, lookupCharInfo]);

  const handleNodeClick = useCallback(
    (comp: DecompositionComponent) => {
      setExplored((prev) => new Set(prev).add(comp.char));
      setBreadcrumbs((prev) => [...prev, { char: rootChar }]);
      setRootChar(comp.char);
      setRootInfo({
        pinyin: comp.pinyin,
        meaning: comp.meaning,
      });
      decompose(comp.char);
      lookupCharInfo(comp.char);
    },
    [rootChar, decompose, lookupCharInfo],
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const target = breadcrumbs[index];
      setBreadcrumbs((prev) => prev.slice(0, index));
      setRootChar(target.char);
      decompose(target.char);
      lookupCharInfo(target.char);
    },
    [breadcrumbs, decompose, lookupCharInfo],
  );

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        p: 2,
        textAlign: 'center',
      }}
    >
      {/* Breadcrumb trail */}
      {breadcrumbs.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            mb: 1.5,
            px: 1.5,
            py: 0.5,
            bgcolor: 'grey.50',
            borderRadius: 4,
            mx: 'auto',
            width: 'fit-content',
          }}
        >
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={i}>
              <ButtonBase
                onClick={() => handleBreadcrumbClick(i)}
                aria-label={`Navigate back to ${bc.char}`}
                sx={{
                  fontSize: '1.2em',
                  color: 'primary.main',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {bc.char}
              </ButtonBase>
              <Typography sx={{ color: 'text.disabled', fontSize: '0.8em', userSelect: 'none' }}>
                ›
              </Typography>
            </React.Fragment>
          ))}
          <Typography sx={{ fontSize: '1.2em', fontWeight: 600, px: 0.75 }}>{rootChar}</Typography>
        </Box>
      )}

      {/* Root character info — only shown when drilled into a component */}
      {breadcrumbs.length > 0 && (
        <Box sx={{ mb: 0.5 }}>
          <Typography
            sx={{ fontSize: '2.2em', fontWeight: 500, lineHeight: 1.2, color: 'text.primary' }}
          >
            {rootChar}
          </Typography>
          {rootInfo.pinyin && (
            <Typography sx={{ fontSize: '1em', color: 'primary.dark', fontWeight: 500, mt: 0.25 }}>
              {rootInfo.pinyin}
            </Typography>
          )}
          {rootInfo.meaning && (
            <Typography
              sx={{
                fontSize: '0.8em',
                color: 'text.secondary',
                mt: 0.25,
                maxWidth: 240,
                mx: 'auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {rootInfo.meaning}
            </Typography>
          )}
        </Box>
      )}

      {/* Loading state */}
      {loading && (
        <Box sx={{ py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {/* Radial tree */}
      {!loading && components !== null && components.length > 0 && (
        <Fade in>
          <Box sx={{ mt: 1 }}>
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              width="100%"
              style={{ maxWidth: SVG_SIZE, display: 'block', margin: '0 auto' }}
              role="img"
              aria-label={`Decomposition of ${rootChar}`}
            >
              {/* Connection lines */}
              {components.map((_, i) => {
                const { x, y } = getNodePosition(i, components.length);
                return (
                  <line
                    key={`line-${i}`}
                    x1={CENTER}
                    y1={CENTER}
                    x2={x}
                    y2={y}
                    stroke="#bbdefb"
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* Root node */}
              <g>
                <circle cx={CENTER} cy={CENTER} r={ROOT_RADIUS} fill="#1976d2" />
                <text
                  x={CENTER}
                  y={CENTER}
                  fill="white"
                  fontSize="26"
                  fontWeight="500"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {rootChar}
                </text>
              </g>

              {/* Component nodes */}
              {components.map((comp, i) => {
                const { x, y } = getNodePosition(i, components.length);
                const isExplored = explored.has(comp.char);
                return (
                  <g
                    key={`node-${i}`}
                    onClick={() => handleNodeClick(comp)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    aria-label={`Decompose ${comp.char}`}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={NODE_RADIUS}
                      fill={isExplored ? '#e3f2fd' : 'white'}
                      stroke={isExplored ? '#1565c0' : '#1976d2'}
                      strokeWidth={isExplored ? 2.5 : 1.5}
                    />
                    <text
                      x={x}
                      y={comp.meaning ? y - 4 : y}
                      fill="#1976d2"
                      fontSize="20"
                      fontWeight="500"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {comp.char}
                    </text>
                    {comp.meaning && (
                      <text x={x} y={y + 12} fill="#888" fontSize="8" textAnchor="middle">
                        {comp.meaning.length > 10 ? comp.meaning.slice(0, 9) + '…' : comp.meaning}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </Box>
        </Fade>
      )}

      {/* Empty state */}
      {!loading && components !== null && components.length === 0 && (
        <Typography
          sx={{
            fontSize: '0.85em',
            color: error ? 'error.main' : 'text.disabled',
            mt: 2,
          }}
        >
          {error ?? 'No decomposition available'}
        </Typography>
      )}
    </Paper>
  );
};

export default DecompositionTree;
