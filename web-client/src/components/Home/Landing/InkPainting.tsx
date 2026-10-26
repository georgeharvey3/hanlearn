// The finale's painting, uncovered by ink that bleeds out from the red sun.
//
// The ink is a WebGL shader, not an SVG filter. A turbulence and displacement
// filter gave the right edge, but iOS Safari runs SVG filters on the CPU at
// full screen resolution, every scroll frame: the reveal stuttered, and a
// filter region sized to the disc went past Safari's limit and drew nothing at
// all. A mask built on the CPU was either too slow at screen resolution or
// showed steps when scaled up. The shader does the same work per pixel on the
// GPU: noise pushes the pixel about, and its distance from the sun against the
// radius decides whether the ink has reached it.
import React, { useEffect, useRef, useState } from 'react';

import mountains from '../../../assets/images/homepage/mountains.jpg';

// The painting's own pixel size, used as the coordinate space of the view.
export const IW = 3000;
export const IH = 2000;
// Where the red sun sits, which the ink bleeds out from.
const SUN = { x: 0.78 * IW, y: 0.16 * IH };
// The radius that covers the far corner from the sun, plus room for the
// ragged edge.
export const FULL_RADIUS = Math.hypot(SUN.x, IH - SUN.y) + 500;

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// The noise follows the old feTurbulence (baseFrequency 0.006, three octaves)
// and feDisplacementMap (scale 420, so a pixel moves up to 210).
const FRAGMENT = `
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_canvas;
uniform vec2 u_offset;
uniform float u_scale;
uniform float u_radius;
uniform vec2 u_sun;
uniform vec2 u_size;

vec2 grad(vec2 i, float seed) {
  float a = fract(sin(dot(i, vec2(127.1, 311.7)) + seed) * 43758.5453) * 6.2831853;
  return vec2(cos(a), sin(a));
}

float noise(vec2 p, float seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad(i, seed), f);
  float b = dot(grad(i + vec2(1.0, 0.0), seed), f - vec2(1.0, 0.0));
  float c = dot(grad(i + vec2(0.0, 1.0), seed), f - vec2(0.0, 1.0));
  float d = dot(grad(i + vec2(1.0, 1.0), seed), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, float seed) {
  float freq = 0.006;
  return noise(p * freq, seed)
    + 0.5 * noise(p * freq * 2.0, seed)
    + 0.25 * noise(p * freq * 4.0, seed);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y);
  vec2 p = (frag - u_offset) / u_scale;
  vec2 moved = p + 210.0 * vec2(fbm(p, 0.0), fbm(p, 17.0));
  // One screen pixel of soft edge, so the outline is smooth and not blurred.
  float ink = clamp((u_radius - distance(moved, u_sun)) * u_scale + 0.5, 0.0, 1.0);
  vec4 colour = texture2D(u_image, p / u_size);
  gl_FragColor = vec4(colour.rgb * ink, ink);
}
`;

interface Gl {
  gl: WebGLRenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const setUp = (canvas: HTMLCanvasElement, image: HTMLImageElement): Gl | null => {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  // One triangle that covers the whole canvas.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  const uniforms = Object.fromEntries(
    ['u_canvas', 'u_offset', 'u_scale', 'u_radius', 'u_sun', 'u_size'].map((name) => [
      name,
      gl.getUniformLocation(program, name),
    ]),
  );
  gl.uniform2f(uniforms.u_sun, SUN.x, SUN.y);
  gl.uniform2f(uniforms.u_size, IW, IH);
  return { gl, uniforms };
};

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  /** The ink's radius, in painting pixels. */
  radius: number;
  /** The part of the painting to show; it covers the canvas, like SVG's slice. */
  view: View;
}

const InkPainting: React.FC<Props> = ({ radius, view }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<Gl | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Without WebGL, the painting shows whole, with no ink.
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = mountains;
    return () => {
      img.onload = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      setSize({
        w: Math.round(entry.contentRect.width * dpr),
        h: Math.round(entry.contentRect.height * dpr),
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !size.w || !size.h || fallback) return;
    if (!glRef.current) {
      glRef.current = setUp(canvas, image);
      if (!glRef.current) {
        setFallback(true);
        return;
      }
    }
    const { gl, uniforms } = glRef.current;
    if (canvas.width !== size.w) canvas.width = size.w;
    if (canvas.height !== size.h) canvas.height = size.h;
    gl.viewport(0, 0, size.w, size.h);

    const s = Math.max(size.w / view.w, size.h / view.h);
    gl.uniform2f(uniforms.u_canvas, size.w, size.h);
    gl.uniform2f(
      uniforms.u_offset,
      (size.w - view.w * s) / 2 - view.x * s,
      (size.h - view.h * s) / 2 - view.y * s,
    );
    gl.uniform1f(uniforms.u_scale, s);
    gl.uniform1f(uniforms.u_radius, radius);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [image, size, fallback, radius, view.x, view.y, view.w, view.h]);

  if (fallback) {
    return (
      <img
        src={mountains}
        alt=""
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
      aria-hidden
    />
  );
};

export default InkPainting;
