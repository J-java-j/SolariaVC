import { useId, useMemo } from 'react';

const TEETH = 64;
const OUTER = 98;
const INNER = 90;

// Foil seals are pressed into radial pleats, and each pleat catches the light by its
// angle. Colouring every tooth on its own gives that shimmer without an image.
function pleats() {
  const step = (Math.PI * 2) / TEETH;
  const point = (radius: number, angle: number) => `${(100 + radius * Math.cos(angle)).toFixed(2)} ${(100 + radius * Math.sin(angle)).toFixed(2)}`;
  return Array.from({ length: TEETH }, (_, i) => {
    const angle = i * step;
    const sheen = Math.cos(2 * (angle + 0.7)) * 12 + Math.cos(5 * angle) * 4;
    const lightness = 62 + sheen + (i % 2 ? 5 : -5);
    return {
      d: `M100 100L${point(INNER, angle)}L${point(OUTER, angle + step / 2)}L${point(INNER, angle + step)}Z`,
      fill: `hsl(42 82% ${lightness.toFixed(1)}%)`,
    };
  });
}

type Props = { reference: string; size?: number; strike?: boolean };

export function Seal({ reference, size = 220, strike = false }: Props) {
  const id = useId();
  const faces = useMemo(pleats, []);
  const top = `${id}-top`;
  const bottom = `${id}-bottom`;
  return (
    <span className={strike ? 'seal seal-strike' : 'seal'} style={{ width: size, height: size }} role="img" aria-label={`Sealed by Solaria Capital, reference ${reference}`}>
      <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
        <defs>
          <radialGradient id={`${id}-face`} cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#ffe6a1" />
            <stop offset="55%" stopColor="#f4c253" />
            <stop offset="100%" stopColor="#cf9627" />
          </radialGradient>
          <path id={top} d="M100 100m-66 0a66 66 0 1 1 132 0" />
          <path id={bottom} d="M100 100m-73 0a73 73 0 0 0 146 0" />
        </defs>
        {faces.map((face) => <path key={face.d} d={face.d} fill={face.fill} />)}
        <circle cx="100" cy="100" r="85" fill={`url(#${id}-face)`} />
        <circle cx="100" cy="100" r="82" fill="none" stroke="#fff3cf" strokeWidth="1" opacity="0.8" />
        <circle cx="100" cy="100" r="81" fill="none" stroke="#8d6210" strokeWidth="0.8" opacity="0.7" />
        <circle cx="100" cy="100" r="54" fill="none" stroke="#fff3cf" strokeWidth="1" opacity="0.8" />
        <circle cx="100" cy="100" r="53" fill="none" stroke="#8d6210" strokeWidth="0.8" opacity="0.7" />
        <g className="seal-text">
          <text><textPath href={`#${top}`} startOffset="50%" textAnchor="middle">Solaria Capital</textPath></text>
          <text className="seal-reference"><textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">{reference}</textPath></text>
        </g>
        <g transform="translate(58 58) scale(1.31)">
          <g fill="#fff3cf" stroke="#fff3cf" opacity="0.85" transform="translate(0.6 0.7)"><SealMark /></g>
          <g fill="#7f570c" stroke="#7f570c"><SealMark /></g>
        </g>
      </svg>
    </span>
  );
}

function SealMark() {
  return (
    <>
      <path d="M19.5 15.9A21 21 0 1 1 20.07 48.55" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M53.28 37.43A21 21 0 0 1 29.35 52.68" fill="none" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="28.1" cy="31.9" r="15.5" stroke="none" />
    </>
  );
}
