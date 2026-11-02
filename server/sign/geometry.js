// Maps what a person saw (pdf.js, fractions of the DISPLAYED page, origin top-left)
// to what pdf-lib draws (PDF user space, origin bottom-left, unaware of /Rotate
// and /CropBox). Ported from pdf.js rather than re-derived, so the browser and the
// sealed file cannot disagree:
//   computeView()       = Page#view     (src/core/document.js)
//   normalizeRotate()   = Page#rotate   (src/core/document.js)
//   viewportTransform() = PageViewport  (src/display/display_utils.js), scale 1
// /UserUnit cancels out of fractions, so it only matters for absolute font sizes.
import { PDFArray, PDFName, PDFNumber } from 'pdf-lib';

export const LETTER_SIZE_MEDIABOX = Object.freeze([0, 0, 612, 792]);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** pdf.js lookupNormalRect + _getBoundingBox: 4 numbers, x0<x1, y0<y1, else null. */
export function normalizeBox(box) {
  if (!Array.isArray(box) || box.length !== 4 || !box.every(isNum)) return null;
  const r = [
    Math.min(box[0], box[2]),
    Math.min(box[1], box[3]),
    Math.max(box[0], box[2]),
    Math.max(box[1], box[3]),
  ];
  return r[2] - r[0] > 0 && r[3] - r[1] > 0 ? r : null;
}

/**
 * pdf.js Page#view. The fallback rules are what make this differ from a plain
 * intersection: a missing/invalid MediaBox is Letter, and an EMPTY intersection
 * falls back to the MediaBox rather than failing.
 *
 * Returns the view plus a `fallback` tag so preflight can reject the cases
 * where other renderers disagree with pdf.js.
 */
export function computeViewDetailed(rawMediaBox, rawCropBox) {
  const media = normalizeBox(rawMediaBox);
  const mediaBox = media ?? [...LETTER_SIZE_MEDIABOX];
  const crop = normalizeBox(rawCropBox);
  const fallback = [];
  if (!media) fallback.push('invalid-mediabox');
  if (rawCropBox != null && !crop) fallback.push('invalid-cropbox');
  if (!crop) return { view: mediaBox, fallback };

  const same = crop.every((v, i) => v === mediaBox[i]);
  if (same) return { view: mediaBox, fallback };

  const x0 = Math.max(crop[0], mediaBox[0]);
  const y0 = Math.max(crop[1], mediaBox[1]);
  const x1 = Math.min(crop[2], mediaBox[2]);
  const y1 = Math.min(crop[3], mediaBox[3]);
  if (x1 - x0 > 0 && y1 - y0 > 0) return { view: [x0, y0, x1, y1], fallback };

  fallback.push('empty-crop-media-intersection');
  return { view: mediaBox, fallback };
}

export const computeView = (media, crop) => computeViewDetailed(media, crop).view;

/** pdf.js Page#rotate: non-multiples of 90 become 0, then wrap into [0, 360). */
export function normalizeRotate(raw) {
  const r = raw || 0;
  if (typeof r !== 'number' || r % 90 !== 0) return 0;
  return ((r % 360) + 360) % 360;
}

/**
 * PageViewport at scale 1, dontFlip false. Maps PDF user space to displayed
 * units (origin top-left, y down). Returns the same [a,b,c,d,e,f], width and
 * height pdf.js computes, ignoring userUnit because fractions cancel it.
 */
export function viewportTransform(view, rotate) {
  const [x0, y0, x1, y1] = view;
  const centerX = (x0 + x1) / 2;
  const centerY = (y0 + y1) / 2;
  let a, b, c, d;
  switch (rotate) {
    case 0: [a, b, c, d] = [1, 0, 0, -1]; break;
    case 90: [a, b, c, d] = [0, 1, 1, 0]; break;
    case 180: [a, b, c, d] = [-1, 0, 0, 1]; break;
    case 270: [a, b, c, d] = [0, -1, -1, 0]; break;
    default: throw new Error(`rotate must be 0/90/180/270, got ${rotate}`);
  }
  let offX, offY, width, height;
  if (a === 0) {
    offX = Math.abs(centerY - y0);
    offY = Math.abs(centerX - x0);
    width = y1 - y0;
    height = x1 - x0;
  } else {
    offX = Math.abs(centerX - x0);
    offY = Math.abs(centerY - y0);
    width = x1 - x0;
    height = y1 - y0;
  }
  return {
    transform: [a, b, c, d, offX - a * centerX - c * centerY, offY - b * centerX - d * centerY],
    width,
    height,
  };
}

export function invertTransform([a, b, c, d, e, f]) {
  const det = a * d - b * c;
  return [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ];
}

export const applyTransform = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f];

/** Build a geometry from raw values. Pure: no pdf-lib objects needed. */
export function pageGeometry({ mediaBox, cropBox, rotate = 0, userUnit = 1 }) {
  const { view, fallback } = computeViewDetailed(mediaBox, cropBox);
  const rot = normalizeRotate(rotate);
  const vp = viewportTransform(view, rot);
  return {
    view,
    rotate: rot,
    userUnit,
    width: vp.width, // displayed width in user units
    height: vp.height, // displayed height in user units
    transform: vp.transform,
    inverse: invertTransform(vp.transform),
    fallback,
  };
}

function readNumber(context, obj) {
  const v = context.lookup(obj);
  return v instanceof PDFNumber ? v.asNumber() : undefined;
}

function readBox(leaf, name) {
  const context = leaf.context;
  const raw = context.lookup(leaf.getInheritableAttribute(PDFName.of(name)));
  if (!(raw instanceof PDFArray)) return undefined;
  const out = [];
  for (let i = 0; i < raw.size(); i++) out.push(readNumber(context, raw.get(i)));
  return out;
}

/**
 * Read raw geometry off a pdf-lib page. Deliberately avoids page.getCropBox()
 * and page.getRotation(): those do not intersect, do not normalise reversed
 * boxes, and throw on a missing or mistyped entry that pdf.js tolerates.
 */
export function readPageGeometry(page) {
  const leaf = page.node;
  const context = leaf.context;
  const rawRotate = readNumber(context, leaf.getInheritableAttribute(PDFName.of('Rotate')));
  const uu = readNumber(context, leaf.get(PDFName.of('UserUnit')));
  return pageGeometry({
    mediaBox: readBox(leaf, 'MediaBox'),
    cropBox: readBox(leaf, 'CropBox'),
    rotate: rawRotate,
    userUnit: isNum(uu) && uu > 0 ? uu : 1,
  });
}

/** Displayed fractions (u across, v down, origin top-left) to PDF user space. */
export function displayedToUser(geom, u, v) {
  return applyTransform(geom.inverse, u * geom.width, v * geom.height);
}

/** Reject anything that is not a sane box on the page. */
export function assertRect(rect, epsilon = 1e-6) {
  if (rect == null) throw new RangeError('rect is required');
  const { x, y, w, h } = rect;
  if (![x, y, w, h].every(isNum)) throw new RangeError(`rect has non-finite values: ${JSON.stringify(rect)}`);
  if (w <= 0 || h <= 0) throw new RangeError(`rect has no area: ${JSON.stringify(rect)}`);
  if (x < -epsilon || y < -epsilon || x + w > 1 + epsilon || y + h > 1 + epsilon) {
    throw new RangeError(`rect is outside the page: ${JSON.stringify(rect)}`);
  }
}

/**
 * Normalised displayed rect to pdf-lib draw parameters.
 *
 * pdf-lib rotates about its (x, y) anchor, so the anchor must be the corner
 * that ends up BOTTOM-LEFT ON SCREEN, which is a different PDF corner for each
 * rotation. `rotate` is the counter-clockwise angle pdf-lib needs: the page is
 * shown rotated clockwise by R, so content is counter-rotated by +R.
 *
 * Works unchanged for drawRectangle, drawImage and (with a baseline offset, see
 * pointInRect) drawText.
 */
export function mapRect(geom, rect) {
  assertRect(rect);
  const { x, y, w, h } = rect;
  const [ax, ay] = displayedToUser(geom, x, y + h); // displayed bottom-left
  const [rx, ry] = displayedToUser(geom, x + w, y + h); // displayed bottom-right
  const [tx, ty] = displayedToUser(geom, x, y); // displayed top-left
  return {
    x: ax,
    y: ay,
    width: Math.hypot(rx - ax, ry - ay),
    height: Math.hypot(tx - ax, ty - ay),
    rotate: geom.rotate,
  };
}

/**
 * Point inside a displayed rect, in user units measured right and DOWN from the
 * rect's top-left corner on screen. Lets text code think in screen terms.
 */
export function pointInRect(geom, rect, rightUser, downUser) {
  return displayedToUser(
    geom,
    rect.x + rightUser / geom.width,
    rect.y + downUser / geom.height,
  );
}

