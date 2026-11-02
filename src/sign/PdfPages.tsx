import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PageSize } from './api';
import type { PdfDocument } from './pdf';

const MAX_PAGE_WIDTH = 880;

type Props = {
  doc: PdfDocument;
  sizes: PageSize[];
  // Overlay content is laid out in percentages of the page, so it follows any width.
  overlay?: (page: number, size: PageSize, cssWidth: number) => ReactNode;
  limit?: number;
  onRendered?: () => void;
  onError?: () => void;
};

export function PdfPages({ doc, sizes, overlay, limit, onRendered, onError }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const shown = limit ? sizes.slice(0, limit) : sizes;
  return (
    <div ref={box} className="pages">
      {width > 0 && shown.map((size, i) => (
        <Page
          key={i}
          doc={doc}
          number={i + 1}
          size={size}
          width={Math.min(width, MAX_PAGE_WIDTH)}
          overlay={overlay}
          onRendered={onRendered}
          onError={onError}
        />
      ))}
    </div>
  );
}

type PageProps = Omit<Props, 'sizes' | 'limit'> & { number: number; size: PageSize; width: number };

function Page({ doc, number, size, width, overlay, onRendered, onError }: PageProps) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const callbacks = useRef({ onRendered, onError });
  callbacks.current = { onRendered, onError };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: '120% 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = box.current?.querySelector('.page-canvas');
    if (!host) return;
    if (!near) {
      // Long documents would otherwise exhaust a phone's canvas memory.
      host.replaceChildren();
      return;
    }
    let stale = false;
    let task: { cancel(): void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await doc.getPage(number);
      if (stale) return;
      const base = page.getViewport({ scale: 1 });
      const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale });
      // A fresh canvas each time, because pdf.js refuses two renders on one canvas.
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas unavailable');
      task = page.render({ canvasContext: context, viewport });
      await task.promise;
      if (stale) return;
      host.replaceChildren(canvas);
      callbacks.current.onRendered?.();
    })().catch((e: { name?: string }) => {
      if (e?.name !== 'RenderingCancelledException' && !stale) callbacks.current.onError?.();
    });
    return () => {
      stale = true;
      task?.cancel();
    };
  }, [doc, number, near, width]);

  return (
    <div
      ref={box}
      className="page"
      data-page={number}
      style={{ width, aspectRatio: `${size.width} / ${size.height}` }}
    >
      <div className="page-canvas" />
      {overlay?.(number, size, width)}
    </div>
  );
}
