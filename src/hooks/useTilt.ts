import { useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from './useReducedMotion';

type TiltState = { rx: number; ry: number; mx: number; my: number; active: boolean };

/**
 * Pointer-tracking 3D tilt. Returns a ref to attach + a CSS transform
 * string + boolean active state. Maxes out at ±maxDeg to avoid the
 * cheesy gyroscope feel — the skill caps subtle parallax / 3D effects.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(
  maxDeg = 6
): {
  ref: RefObject<T>;
  transform: string;
  glare: { x: number; y: number; opacity: number };
  bind: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
  };
} {
  const ref = useRef<T>(null) as unknown as RefObject<T>;
  const reduced = useReducedMotion();
  const [s, setS] = useState<TiltState>({ rx: 0, ry: 0, mx: 0.5, my: 0.5, active: false });

  const onMouseMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const ry = (px - 0.5) * 2 * maxDeg;
    const rx = (0.5 - py) * 2 * maxDeg;
    setS({ rx, ry, mx: px, my: py, active: true });
  };

  const onMouseLeave = () => {
    setS((p) => ({ ...p, rx: 0, ry: 0, active: false }));
  };

  const transform = reduced
    ? 'none'
    : `perspective(1100px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg)`;

  const glare = {
    x: s.mx * 100,
    y: s.my * 100,
    opacity: s.active ? 0.18 : 0,
  };

  return { ref, transform, glare, bind: { onMouseMove, onMouseLeave } };
}
