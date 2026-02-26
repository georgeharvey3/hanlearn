import React from 'react';
import Box from '@mui/material/Box';

interface MountainLayerProps {
  pathData: string;
  color: string;
  opacity?: number;
  speed: number;
  scrollProgress: number;
  bottom?: string;
  blur?: number;
  zIndex: number;
}

const MountainLayer: React.FC<MountainLayerProps> = ({
  pathData,
  color,
  opacity = 1,
  speed,
  scrollProgress,
  bottom = '0',
  blur,
  zIndex,
}) => {
  const isTouchDevice = 'ontouchstart' in window;
  const effectiveSpeed = isTouchDevice ? speed * 0.3 : speed;
  const offset = scrollProgress * effectiveSpeed * -100;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom,
        left: 0,
        width: '100%',
        zIndex,
        transform: `translate3d(0, ${offset}px, 0)`,
        willChange: 'transform',
        filter: blur ? `blur(${blur}px)` : undefined,
      }}
    >
      <svg
        viewBox="0 0 1440 560"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <path d={pathData} fill={color} opacity={opacity} />
      </svg>
    </Box>
  );
};

export default MountainLayer;
