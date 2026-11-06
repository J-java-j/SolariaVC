import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Mark } from './api';
import { Notice, Sheet } from './ui';

const INK = '#1b2a52';
const MIN_WIDTH = 1.5;
const MAX_WIDTH = 3.6;

// Crops to the ink so the mark fills its field however it was written.
function trimmed(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, width, height);
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return null;
  const pad = 6;
  const crop = document.createElement('canvas');
  crop.width = right - left + 1 + pad * 2;
  crop.height = bottom - top + 1 + pad * 2;
  crop.getContext('2d')!.drawImage(canvas, left - pad, top - pad, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return crop.toDataURL('image/png');
}

async function typedMark(text: string) {
  await document.fonts.load('96px Sacramento', text);
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 420;
  const context = canvas.getContext('2d')!;
  context.font = '150px Sacramento, cursive';
  const size = Math.min(150, 150 * (1280 / context.measureText(text).width));
  context.font = `${size}px Sacramento, cursive`;
  context.fillStyle = INK;
  context.textBaseline = 'middle';
  context.fillText(text, 40, 210);
  return trimmed(canvas);
}

type Nib = { x: number; y: number; time: number; width: number; midX: number; midY: number };

function DrawPad({ onChange }: { onChange: (canvas: HTMLCanvasElement | null) => void }) {
  const box = useRef<HTMLCanvasElement>(null);
  const ratio = useRef(1);
  const last = useRef<Nib | null>(null);
  const [inked, setInked] = useState(false);

  const reset = () => {
    const canvas = box.current!;
    ratio.current = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = canvas.clientWidth * ratio.current;
    canvas.height = canvas.clientHeight * ratio.current;
    const context = canvas.getContext('2d')!;
    context.lineCap = 'round';
    context.strokeStyle = INK;
    setInked(false);
    onChange(null);
  };
  useEffect(reset, []);

  // Measured on every event, so rotating a phone mid-signature can't shift the ink.
  const point = (e: { clientX: number; clientY: number; timeStamp: number }) => {
    const canvas = box.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale, time: e.timeStamp };
  };

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = point(e);
    last.current = { ...at, width: MAX_WIDTH * 0.7, midX: at.x, midY: at.y };
  };

  // Faster strokes run thinner, the way a real nib does.
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const context = e.currentTarget.getContext('2d')!;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const event of events.length ? events : [e.nativeEvent]) {
      const next = point(event);
      const from: Nib = last.current;
      const distance = Math.hypot(next.x - from.x, next.y - from.y) / ratio.current;
      if (distance < 0.5) continue;
      const speed = distance / Math.max(next.time - from.time, 1);
      const target = Math.max(MIN_WIDTH, MAX_WIDTH - speed * 1.1);
      const width: number = from.width + (target - from.width) * 0.3;
      const middle = { x: (from.x + next.x) / 2, y: (from.y + next.y) / 2 };
      context.lineWidth = width * ratio.current;
      context.beginPath();
      context.moveTo(from.midX, from.midY);
      context.quadraticCurveTo(from.x, from.y, middle.x, middle.y);
      context.stroke();
      last.current = { ...next, width, midX: middle.x, midY: middle.y };
    }
    if (!inked) setInked(true);
  };

  const end = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const context = e.currentTarget.getContext('2d')!;
    const { x, y, width, midX, midY } = last.current;
    context.lineWidth = width * ratio.current;
    context.beginPath();
    context.moveTo(midX, midY);
    context.lineTo(x + 0.01, y);
    context.stroke();
    last.current = null;
    setInked(true);
    onChange(e.currentTarget);
  };

  return (
    <div className="pad">
      <canvas
        ref={box}
        className="pad-canvas"
        aria-label="Draw your signature here"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <span className="pad-line" aria-hidden="true" />
      {inked && <button type="button" className="quiet pad-clear" onClick={reset}>Clear</button>}
    </div>
  );
}

type Props = {
  kind: 'signature' | 'initials';
  name: string;
  intent: string;
  onAdopt: (mark: Mark) => void;
  onCancel: () => void;
};

export function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).map((word) => word[0].toUpperCase()).join('').slice(0, 4);
}

export function SignaturePad({ kind, name, intent, onAdopt, onCancel }: Props) {
  const signature = kind === 'signature';
  // Typed by default: one click adopts it, with no drawing on a trackpad.
  const [method, setMethod] = useState<Mark['method']>('type');
  const [text, setText] = useState(signature ? name : initialsOf(name));
  const [drawn, setDrawn] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState('');

  const ready = signature ? Boolean(text.trim()) && (method === 'type' || Boolean(drawn)) : method === 'type' ? Boolean(text.trim()) : Boolean(drawn);

  const adopt = async () => {
    const dataUrl = method === 'draw' ? trimmed(drawn!) : await typedMark(text.trim());
    if (!dataUrl) {
      setError(method === 'draw' ? 'Draw your signature first.' : 'Type your name first.');
      return;
    }
    onAdopt({ dataUrl, method, name: signature ? text.trim() : name });
  };

  const label = signature ? 'Your full name' : 'Your initials';
  return (
    <Sheet title={signature ? 'Adopt your signature' : 'Adopt your initials'} onClose={onCancel}>
      {(signature || method === 'type') && (
        <label className="field">
          {label}
          <input value={text} autoComplete={signature ? 'name' : 'off'} maxLength={signature ? 120 : 8} onChange={(e) => setText(e.target.value)} />
        </label>
      )}
      <div className="tabs" role="group" aria-label="How to sign">
        <button type="button" aria-pressed={method === 'type'} onClick={() => setMethod('type')}>Type</button>
        <button type="button" aria-pressed={method === 'draw'} onClick={() => setMethod('draw')}>Draw</button>
      </div>
      {method === 'draw'
        ? <DrawPad onChange={setDrawn} />
        : <div className="pad pad-typed"><span>{text || name}</span><span className="pad-line" aria-hidden="true" /></div>}
      {error && <Notice>{error}</Notice>}
      <p className="legal">{intent}</p>
      <div className="actions">
        <button type="button" className="primary" disabled={!ready} onClick={adopt}>Adopt and sign</button>
        <button type="button" className="quiet" onClick={onCancel}>Cancel</button>
      </div>
    </Sheet>
  );
}
