import React, { useCallback, useEffect, useState } from 'react';

import { Box, Button, CircularProgress, Typography } from '@mui/material';

import { decomposeCharacter } from '../../../../services/decompositionService';

interface DecompositionComponent {
  char: string;
  meaning: string | null;
  pinyin: string | null;
}

const MAX_DEPTH = 4;

interface ComponentRowProps {
  component: DecompositionComponent;
  depth: number;
}

const ComponentRow: React.FC<ComponentRowProps> = ({ component, depth }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DecompositionComponent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const handleDecompose = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (children !== null) {
      setExpanded(true);
      return;
    }
    setLoading(true);
    setFetchError(false);
    try {
      const result = await decomposeCharacter(component.char);
      setChildren(result);
      setExpanded(true);
    } catch {
      setFetchError(true);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  }, [expanded, children, component.char]);

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: '10px 12px',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2.5,
          mb: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Typography
          sx={{
            fontSize: '2em',
            fontWeight: 500,
            color: 'text.primary',
            minWidth: 48,
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {component.char}
        </Typography>
        <Box sx={{ flex: 1 }}>
          {component.pinyin && (
            <Typography sx={{ fontSize: '0.95em', color: 'primary.dark', fontWeight: 500 }}>
              {component.pinyin}
            </Typography>
          )}
          {component.meaning && (
            <Typography sx={{ fontSize: '0.8em', color: 'text.secondary', mt: 0.25 }}>
              {component.meaning}
            </Typography>
          )}
        </Box>
        {depth < MAX_DEPTH && (
          <Button
            variant={expanded ? 'contained' : 'outlined'}
            size="small"
            onClick={handleDecompose}
            disabled={loading}
            aria-pressed={expanded && !fetchError}
            aria-label={
              loading
                ? `Loading decomposition for ${component.char}`
                : expanded && !fetchError
                  ? `Collapse decomposition for ${component.char}`
                  : `Decompose ${component.char}`
            }
            sx={
              expanded
                ? {
                    minWidth: 'auto',
                    px: 1.25,
                    py: 0.5,
                    fontSize: '0.75em',
                    whiteSpace: 'nowrap',
                    bgcolor: 'primary.dark',
                    color: '#fff',
                    '&:hover': { bgcolor: '#145233' },
                  }
                : {
                    minWidth: 'auto',
                    px: 1.25,
                    py: 0.5,
                    fontSize: '0.75em',
                    whiteSpace: 'nowrap',
                    color: 'text.secondary',
                    borderColor: 'divider',
                  }
            }
          >
            {loading ? <CircularProgress size={14} aria-hidden="true" /> : 'Decompose'}
          </Button>
        )}
      </Box>

      {expanded && !fetchError && children !== null && children.length > 0 && (
        <Box
          sx={{
            ml: 3,
            pl: 2,
            borderLeft: '2px solid',
            borderColor: '#bbdefb',
            mb: 1,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7em',
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 600,
              mb: 0.75,
            }}
          >
            Components of {component.char}
          </Typography>
          {children.map((child, i) => (
            <ComponentRow key={`${child.char}-${i}`} component={child} depth={depth + 1} />
          ))}
        </Box>
      )}

      {expanded && !fetchError && children !== null && children.length === 0 && (
        <Box
          sx={{
            ml: 3,
            pl: 2,
            borderLeft: '2px solid',
            borderColor: '#bbdefb',
            mb: 1,
          }}
        >
          <Typography sx={{ fontSize: '0.8em', color: 'text.disabled', py: 0.5 }}>
            No further decomposition
          </Typography>
        </Box>
      )}

      {expanded && fetchError && (
        <Box
          sx={{
            ml: 3,
            pl: 2,
            borderLeft: '2px solid',
            borderColor: 'error.light',
            mb: 1,
          }}
        >
          <Typography sx={{ fontSize: '0.8em', color: 'error.main', py: 0.5 }}>
            Could not load decomposition
          </Typography>
        </Box>
      )}
    </>
  );
};

interface DecompositionTreeProps {
  char: string;
}

const DecompositionTree: React.FC<DecompositionTreeProps> = ({ char }) => {
  const [components, setComponents] = useState<DecompositionComponent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDecomposition = useCallback(() => {
    setLoading(true);
    setError(null);
    setComponents(null);

    decomposeCharacter(char)
      .then((result) => {
        setComponents(result);
        setLoading(false);
      })
      .catch(() => {
        setError('Decomposition failed');
        setLoading(false);
      });
  }, [char]);

  useEffect(() => {
    loadDecomposition();
  }, [loadDecomposition]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={20} aria-label="Loading character decomposition" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 1 }}>
        <Typography sx={{ fontSize: '0.85em', color: 'error.main' }}>{error}</Typography>
        <Button
          variant="text"
          size="small"
          onClick={loadDecomposition}
          sx={{ mt: 0.5, fontSize: '0.8em', color: 'primary.main' }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (!components || components.length === 0) {
    return (
      <Typography sx={{ fontSize: '0.85em', color: 'text.disabled', textAlign: 'center', py: 1 }}>
        No decomposition available
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <Typography
        sx={{
          fontSize: '0.7em',
          color: 'text.disabled',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 600,
          mb: 0.75,
        }}
      >
        Components of {char}
      </Typography>
      {components.map((comp, i) => (
        <ComponentRow key={`${comp.char}-${i}`} component={comp} depth={0} />
      ))}
    </Box>
  );
};

export default DecompositionTree;
