/**
 * How the hall is drawn on screen: turned by quarter turns for the person looking,
 * with every name kept upright and sized to fit. Pure, and nothing here is saved:
 * positions are always stored the hall's own way up.
 */
import { HALL } from './hallLayoutShapes.js';

const sideways = (turn) => turn === 90 || turn === 270;

/** The drawing's size after turning it clockwise by 0, 90, 180 or 270 degrees. */
export function viewSize(turn) {
  return sideways(turn) ? { width: HALL.height, height: HALL.width } : { width: HALL.width, height: HALL.height };
}

/** Where a point of the hall appears on the turned drawing. */
export function toViewPoint(x, y, turn) {
  if (turn === 90) return { x: HALL.height - y, y: x };
  if (turn === 180) return { x: HALL.width - x, y: HALL.height - y };
  if (turn === 270) return { x: y, y: HALL.width - x };
  return { x, y };
}

/** A movement made on the turned drawing, as a movement in the hall. */
export function toHallDelta(dx, dy, turn) {
  // `0 - n` rather than `-n`, so a still axis is 0 and not -0.
  if (turn === 90) return { x: dy, y: 0 - dx };
  if (turn === 180) return { x: 0 - dx, y: 0 - dy };
  if (turn === 270) return { x: 0 - dy, y: dx };
  return { x: dx, y: dy };
}

/**
 * An area on the turned drawing. `angle` turns its shape. The frame is the box it
 * is placed and clicked by: its sides swap when the shape ends up nearer sideways.
 */
export function areaFrame(area, turn) {
  const angle = (area.rotation + turn) % 360;
  const leaning = angle % 180;
  const swap = leaning > 45 && leaning < 135;
  return {
    angle,
    width: swap ? area.height : area.width,
    height: swap ? area.width : area.height,
    shapeWidth: area.width,
    shapeHeight: area.height,
  };
}

const LINE_HEIGHT = 1.15;
const MAX_LINES = 3;

/** Every way of breaking the words into `count` lines, keeping their order. */
function breaks(words, count) {
  if (count === 1) return [[words.join(' ')]];
  const out = [];
  for (let first = 1; first <= words.length - count + 1; first += 1) {
    for (const rest of breaks(words.slice(first), count - 1)) out.push([words.slice(0, first).join(' '), ...rest]);
  }
  return out;
}

/**
 * The biggest upright text (up to `maxSize`) that fits inside a box which has
 * itself been turned by `angle` degrees, breaking it over up to three lines.
 * Sizes are in drawing units. `charWidth` is a letter's width as a share of the
 * font size; `round` leaves room for a circle's curved edge.
 *
 * @returns {{ size: number, lines: string[] }}
 */
export function fitLabel(text, boxWidth, boxHeight, angle, { charWidth = 0.68, maxSize = 18, round = false } = {}) {
  const words = String(text).trim().split(/\s+/);
  const width = boxWidth * (round ? 0.8 : 0.9);
  const height = boxHeight * (round ? 0.7 : 0.9);
  const cos = Math.abs(Math.cos((angle * Math.PI) / 180));
  const sin = Math.abs(Math.sin((angle * Math.PI) / 180));
  let best = { size: 0, lines: [words.join(' ')] };

  for (let count = 1; count <= Math.min(MAX_LINES, words.length); count += 1) {
    for (const lines of breaks(words, count)) {
      // The text block's width and height for a font size of 1.
      const w = Math.max(...lines.map((line) => line.length)) * charWidth;
      const h = lines.length * LINE_HEIGHT;
      const size = Math.min(maxSize, width / (w * cos + h * sin), height / (w * sin + h * cos));
      // Ties go to fewer lines.
      if (size > best.size + 0.01) best = { size, lines };
    }
  }
  return best;
}
