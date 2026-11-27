import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton } from '@mui/material';
import BackspaceRoundedIcon from '@mui/icons-material/BackspaceRounded';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { candidatesFor, loadTemplates } from '../../services/handwritingService';
import { Point, Stroke } from '../../utils/handwriting';
import { CANVAS_HEIGHT, STRIP_HEIGHT } from './padSize';

/** The width of the line that the learner draws, in pixels. */
const INK_WIDTH = 6;

interface Props {
  /** A tap on a candidate: the field appends it. */
  onCandidate: (char: string) => void;
  /** Backspace on an empty pad: the field takes away its last character. */
  onDeleteChar: () => void;
  /** The keyboard button: close the pad and give the field the keyboard. */
  onKeyboard: () => void;
  /**
   * True on a wide screen: the pad sits below the field, and the keyboard
   * still types. False on a phone: the pad takes the place of the system
   * keyboard, at the foot of the screen.
   */
  docked: boolean;
}

type LoadStatus = 'loading' | 'ready' | 'failed';

/**
 * The handwriting pad of Add Words (#476): the learner draws one character,
 * and the pad offers up to 8 candidates after each stroke. A tap on a
 * candidate puts it into the search field and clears the pad. The pad never
 * puts in a candidate by itself.
 *
 * Pointer Events give touch, pen and mouse the same code. The pad keeps the
 * focus where it is, so the field keeps its caret.
 */
const HandwritingPad: React.FC<Props> = ({ onCandidate, onDeleteChar, onKeyboard, docked }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [candidates, setCandidates] = useState<string[]>([]);
  // The stroke under the pointer, outside React state, so a move redraws
  // without a render.
  const drawing = useRef<{ id: number; stroke: Stroke } | null>(null);
  // Each request takes a number, so an answer for older strokes is dropped.
  const seq = useRef(0);

  const load = useCallback(() => {
    loadTemplates().then(
      () => setStatus('ready'),
      (err) => {
        console.error('Failed to load the handwriting templates:', err);
        setStatus('failed');
      },
    );
  }, []);

  // The first load starts in the 'loading' status.
  useEffect(load, [load]);

  const retry = () => {
    setStatus('loading');
    load();
  };

  const redraw = useCallback((done: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * ratio;
    const height = canvas.clientHeight * ratio;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    context.strokeStyle = colors.text;
    context.lineWidth = INK_WIDTH;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const all = drawing.current ? [...done, drawing.current.stroke] : done;
    for (const stroke of all) {
      context.beginPath();
      stroke.forEach(([x, y], i) => (i === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
      if (stroke.length === 1) context.lineTo(stroke[0][0] + 0.1, stroke[0][1]);
      context.stroke();
    }
  }, []);

  useEffect(() => redraw(strokes), [strokes, redraw]);

  // A rotation or a new window size changes the box: draw the ink again at
  // the new size.
  useEffect(() => {
    const onResize = () => redraw(strokes);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [strokes, redraw]);

  const ask = useCallback((next: Stroke[]) => {
    const mine = ++seq.current;
    if (next.length === 0) {
      setCandidates([]);
      return;
    }
    candidatesFor(next).then(
      (found) => mine === seq.current && setCandidates(found),
      (err) => console.error('Failed to match the strokes:', err),
    );
  }, []);

  const setAndAsk = (next: Stroke[]) => {
    setStrokes(next);
    ask(next);
  };

  const pointOf = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // No focus change and no scroll: the field keeps its caret.
    event.preventDefault();
    if (drawing.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawing.current = { id: event.pointerId, stroke: [pointOf(event)] };
    redraw(strokes);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current?.id !== event.pointerId) return;
    drawing.current.stroke.push(pointOf(event));
    redraw(strokes);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current?.id !== event.pointerId) return;
    const stroke = drawing.current.stroke;
    drawing.current = null;
    setAndAsk([...strokes, stroke]);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current?.id !== event.pointerId) return;
    drawing.current = null;
    redraw(strokes);
  };

  const pick = (char: string) => {
    onCandidate(char);
    setAndAsk([]);
  };

  const backspace = () => {
    if (strokes.length > 0) setAndAsk(strokes.slice(0, -1));
    else onDeleteChar();
  };

  const toolSx = { width: 48, height: 48, borderRadius: 1, color: colors.textSecondary };

  return (
    <Box
      role="group"
      aria-label={copy.wordBank.pad.name}
      // A tap on the pad never takes the focus from the field.
      onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
      sx={{
        bgcolor: colors.card,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: 1,
        overflow: 'hidden',
        ...(docked
          ? {}
          : {
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              // Over the tab bar (1100), as a keyboard is.
              zIndex: 1200,
              borderRadius: 0,
              borderLeft: 0,
              borderRight: 0,
              borderBottom: 0,
              pb: 'env(safe-area-inset-bottom)',
            }),
      }}
    >
      <Box
        role="list"
        aria-label={copy.wordBank.pad.candidates}
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: STRIP_HEIGHT,
          px: 0.5,
          gap: 0.25,
          borderBottom: `1px solid ${colors.divider}`,
          overflowX: 'auto',
        }}
      >
        {status === 'loading' && (
          <CircularProgress
            size={20}
            thickness={5}
            aria-label={copy.wordBank.pad.loading}
            sx={{ color: colors.primaryDark, mx: 1.5 }}
          />
        )}
        {status === 'failed' && (
          <>
            <Box
              component="span"
              sx={{ px: 1.5, fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary }}
            >
              {copy.wordBank.pad.failed}
            </Box>
            <Button onClick={retry} sx={{ textTransform: 'none', fontFamily: fonts.body }}>
              {copy.wordBank.retry}
            </Button>
          </>
        )}
        {status === 'ready' &&
          candidates.map((char) => (
            <Box role="listitem" key={char} sx={{ flex: 'none' }}>
              <Button
                lang="zh"
                onClick={() => pick(char)}
                sx={{
                  minWidth: 44,
                  height: 44,
                  px: 0.5,
                  fontSize: 26,
                  lineHeight: 1,
                  color: colors.text,
                  borderRadius: 1,
                }}
              >
                {char}
              </Button>
            </Box>
          ))}
      </Box>
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: CANVAS_HEIGHT }}>
          {/* The guides of the box: a cross through the middle. */}
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              borderLeft: `1px dashed ${colors.gridLine}`,
            }}
          />
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              borderTop: `1px dashed ${colors.gridLine}`,
            }}
          />
          <canvas
            ref={canvasRef}
            data-testid="handwriting-canvas"
            aria-hidden="true"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              touchAction: 'none',
              cursor: 'crosshair',
            }}
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            alignItems: 'center',
            width: 56,
            borderLeft: `1px solid ${colors.divider}`,
          }}
        >
          <IconButton onClick={backspace} aria-label={copy.wordBank.pad.backspace} sx={toolSx}>
            <BackspaceRoundedIcon />
          </IconButton>
          <Button
            onClick={() => setAndAsk([])}
            disabled={strokes.length === 0}
            aria-label={copy.wordBank.pad.clear}
            sx={{
              ...toolSx,
              minWidth: 0,
              fontFamily: fonts.body,
              fontSize: 14,
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            {copy.wordBank.pad.clearShort}
          </Button>
          <IconButton onClick={onKeyboard} aria-label={copy.wordBank.pad.keyboard} sx={toolSx}>
            <KeyboardRoundedIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default HandwritingPad;
