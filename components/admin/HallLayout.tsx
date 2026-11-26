'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useToast } from '@/components/Toast';
import { GRID, HALL, HALL_WALLS, TABLE_SIZE, snapPoint } from '@/src/hall-layout/hallLayoutShapes.js';
import { areaFrame, fitLabel, toHallDelta, toViewPoint, viewSize } from '@/src/hall-layout/hallLayoutView.js';
import { seatOccupantLabel } from '@/src/table-arrangement/seatLabel.js';
import { sideLabel } from '@/src/table-arrangement/tableSides.js';
import {
  AreaEditorDialog,
  LayoutSettingsDialog,
  NEW_AREA,
  areaTitle,
  type AreaDraft,
  type HallArea,
} from './HallLayoutDialogs';
import type { Party, SeatingTable, TableSide } from './TableArrangement';

type MapTable = { id: string; number: number; name: string | null; side: TableSide; x: number; y: number };
type Layout = { available: boolean; hasLayout: boolean; tables: MapTable[]; areas: HallArea[] };
type Item = { kind: 'table' | 'area'; id: string; x: number; y: number };

const SIDE_FILL: Record<TableSide, string> = {
  bride: 'bg-rose-700 text-white border-rose-900',
  groom: 'bg-sky-700 text-white border-sky-900',
  common: 'bg-amber-300 text-slate-900 border-amber-600',
};

const CLIP: Partial<Record<HallArea['shape'], string>> = {
  heptagon: 'polygon(50% 0%, 90% 20%, 100% 60%, 75% 100%, 25% 100%, 0% 60%, 10% 20%)',
  arrow: 'polygon(50% 0%, 100% 40%, 74% 40%, 74% 100%, 26% 100%, 26% 40%, 0% 40%)',
};
const RADIUS: Partial<Record<HallArea['shape'], string>> = { circle: '50%', rounded: '12%' };

const ZOOMS = [1, 1.5, 2];
type View = { width: number; height: number };
// At 100% the whole hall fits on screen: no wider than the card (720px upright, more on its side)
// and no taller than 80% of the window (never narrower than 280px, so a very short window stays readable).
const fitWidth = (view: View) =>
  `min(100%, ${Math.round(720 * Math.max(1, view.width / HALL.width))}px, max(280px, calc(80vh * ${view.width} / ${view.height})))`;
// The large view covers the window, so the hall takes all the height left under the buttons and legend.
const largeWidth = (view: View) => `min(100%, max(280px, calc((100dvh - 8rem) * ${view.width} / ${view.height})))`;
// Which way up this device shows the hall. A viewing choice only: the saved layout never turns.
const TURN_KEY = 'hall-layout-turn';
const TURNS = [0, 90, 180, 270];

function savedTurn(): number {
  try {
    const turn = Number(window.localStorage.getItem(TURN_KEY));
    return TURNS.includes(turn) ? turn : 0;
  } catch {
    return 0;
  }
}
const DRAG_THRESHOLD_PX = 4;
const TOOLTIP_WIDTH = 224;

const percent = (value: number, of: number) => `${(value / of) * 100}%`;

/** Places a box by its centre on the drawing as currently turned. */
function box(view: View, x: number, y: number, width: number, height: number): CSSProperties {
  return {
    left: percent(x - width / 2, view.width),
    top: percent(y - height / 2, view.height),
    width: percent(width, view.width),
    height: percent(height, view.height),
  };
}

/** Upright text, sized in drawing units so it grows and shrinks with the map. */
function FittedText({ view, fit, className = '', color }: {
  view: View;
  fit: { size: number; lines: string[] };
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={`block whitespace-nowrap text-center ${className}`}
      style={{ fontSize: `${(fit.size / view.width) * 100}cqw`, lineHeight: 1.15, color }}
    >
      {fit.lines.map((line, index) => (
        <span key={index} className="block">{line}</span>
      ))}
    </span>
  );
}

/** Black or white, whichever reads better on the area's colour. */
function textOn(color: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#0f172a' : '#ffffff';
}

/**
 * The shared hall map on the Table Arrangement screen. `tables` is what this
 * admin may already see (own side and Common, with seats); guest names come only
 * from there. The map's own data covers the whole room but carries no names.
 */
export default function HallLayout({
  party,
  tables,
  csrfToken,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  onTablesChanged,
  onDeleteTable,
}: {
  party: Party;
  tables: SeatingTable[];
  csrfToken: string;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onTablesChanged: () => Promise<void>;
  onDeleteTable: (table: SeatingTable) => Promise<void>;
}) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [large, setLarge] = useState(false);
  // Read once: the map is not drawn until its data arrives, so this cannot differ from the server's page.
  const [turn, setTurn] = useState(() => (typeof window === 'undefined' ? 0 : savedTurn()));
  const [spaceHeld, setSpaceHeld] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerOverMap = useRef(false);
  const panFrom = useRef<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [areaDraft, setAreaDraft] = useState<AreaDraft | null>(null);
  const [drag, setDrag] = useState<Item | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ item: Item; clientX: number; clientY: number; moved: boolean } | null>(null);
  // A drag ends with a click event too; this stops it opening anything.
  const justDragged = useRef(false);
  const showToast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/table-arrangement/layout');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error('load failed');
      setLayout(data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  // Reload when a table is added, removed, renamed or changes side, and when the
  // window is looked at again (the other admin may have moved something).
  const tableSignature = tables.map((t) => `${t.id}:${t.table_number}:${t.table_name}:${t.side}`).join('|');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the state is set after the fetch resolves
    void load();
  }, [load, tableSignature]);

  useEffect(() => {
    const refresh = () => {
      if (!dragStart.current) void Promise.all([load(), onTablesChanged()]);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load, onTablesChanged]);

  // In the large view the page behind stays still, and Escape closes the view once
  // nothing on top of it (a table's pop-up or a dialog) is open.
  const somethingOnTop = Boolean(pinned || areaDraft || settingsOpen);
  useEffect(() => {
    if (!large) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [large]);
  useEffect(() => {
    if (!large) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (somethingOnTop) setPinned(null);
      else setLarge(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [large, somethingOnTop]);

  // Holding Space turns the pointer into a hand that drags the view around, as in Photoshop.
  // Only while the pointer is on the map (or in the large view), so Space keeps its usual job elsewhere.
  const dialogOpen = Boolean(areaDraft || settingsOpen);
  useEffect(() => {
    const wanted = (event: globalThis.KeyboardEvent) => {
      if (event.code !== 'Space' || dialogOpen) return false;
      // A key pressed with nothing focused can be aimed at the window itself, which is not an element.
      const target = event.target instanceof Element ? event.target : document.body;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return false;
      return pointerOverMap.current || (large && !target.closest('button'));
    };
    const down = (event: globalThis.KeyboardEvent) => {
      if (!wanted(event)) return;
      event.preventDefault();
      setSpaceHeld(true);
    };
    const release = () => {
      panFrom.current = null;
      setSpaceHeld(false);
    };
    const up = (event: globalThis.KeyboardEvent) => {
      if (event.code !== 'Space') return;
      // A focused button would otherwise be pressed as Space comes up.
      if (wanted(event)) event.preventDefault();
      release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    };
  }, [large, dialogOpen]);

  /** Drags the view: the map's own scroll first, then the page for any up-and-down that is left. */
  function pan(event: PointerEvent<HTMLElement>) {
    const from = panFrom.current;
    const scroller = scrollRef.current;
    if (!from || !scroller) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    panFrom.current = { x: event.clientX, y: event.clientY };
    const before = scroller.scrollTop;
    scroller.scrollLeft -= dx;
    scroller.scrollTop -= dy;
    const left = dy - (before - scroller.scrollTop);
    if (!large && Math.abs(left) >= 1) window.scrollBy({ top: -left, behavior: 'instant' });
  }

  function rotate() {
    const next = (turn + 90) % 360;
    setTurn(next);
    setPinned(null);
    try {
      window.localStorage.setItem(TURN_KEY, String(next));
    } catch {
      // Private browsing: the choice just lasts until the page is reloaded.
    }
  }

  async function align() {
    if (!window.confirm('Line everything on the map up to the grid? Each table and area moves only a little.')) return;
    if (await send('', 'POST', { action: 'align' })) {
      showToast({ kind: 'ok', text: 'Everything is lined up on the grid.' });
      await load();
    }
  }

  /** One change to the map, then a fresh read. Returns the reply, or null when it failed. */
  async function send(path: string, method: string, body?: object) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/table-arrangement/layout' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (res.ok && data.success) return data;
      showToast({ kind: 'error', text: data.message || 'Could not save the hall layout.' });
      return null;
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveMove(item: Item) {
    const { x, y } = item;
    const place = <T extends { id: string }>(list: T[]) => list.map((e) => (e.id === item.id ? { ...e, x, y } : e));
    setLayout((current) =>
      current && (item.kind === 'table'
        ? { ...current, tables: place(current.tables) }
        : { ...current, areas: place(current.areas) })
    );
    const saved = await send(`/${item.kind === 'table' ? 'tables' : 'areas'}/${item.id}`, 'PUT', { x, y });
    if (!saved) await load();
  }

  async function generate(tableCount: number) {
    const data = await send('', 'POST', { action: 'generate', tableCount });
    if (data) {
      const added = data.created.length;
      showToast({
        kind: 'ok',
        text: added ? `Layout ready. ${added} new ${added === 1 ? 'table' : 'tables'} added.` : 'Layout ready.',
      });
      onCloseSettings();
    }
    await onTablesChanged();
    await load();
  }

  async function reset() {
    if (!window.confirm('Reset the map to the hotel plan? Moved positions and the areas you added or changed will be lost. Tables and seated guests stay as they are.')) return;
    if (await send('', 'POST', { action: 'reset' })) {
      showToast({ kind: 'ok', text: 'Map reset to the hotel plan.' });
      await load();
    }
  }

  async function saveArea(draft: AreaDraft) {
    const { id, shape, ...values } = draft;
    const saved = id ? await send(`/areas/${id}`, 'PUT', values) : await send('/areas', 'POST', { shape, ...values });
    if (!saved) return;
    setAreaDraft(null);
    if (!id) {
      setMoving(true);
      onCloseSettings();
      showToast({ kind: 'ok', text: 'Area added near the middle. Drag it into place.' });
    }
    await load();
  }

  async function removeArea(areaId: string) {
    const area = layout?.areas.find((entry) => entry.id === areaId);
    if (!area || !window.confirm(`Remove "${areaTitle(area)}" from the map?`)) return;
    if (await send(`/areas/${areaId}`, 'DELETE')) {
      setAreaDraft(null);
      await load();
    }
  }

  function startDrag(event: PointerEvent<HTMLElement>, item: Item) {
    justDragged.current = false;
    if (!moving || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { item, clientX: event.clientX, clientY: event.clientY, moved: false };
  }

  function continueDrag(event: PointerEvent<HTMLElement>) {
    const start = dragStart.current;
    const canvas = canvasRef.current;
    if (!start || !canvas) return;
    const dx = event.clientX - start.clientX;
    const dy = event.clientY - start.clientY;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    start.moved = true;
    const scale = viewSize(turn).width / canvas.getBoundingClientRect().width;
    // The drag is measured on the turned picture; the position is saved the hall's own way up.
    const moved = toHallDelta(dx * scale, dy * scale, turn);
    // It jumps from grid point to grid point while being dragged, so you see where it will land.
    setDrag({ ...start.item, ...snapPoint(start.item.x + moved.x, start.item.y + moved.y) });
  }

  function endDrag(cancelled = false) {
    const start = dragStart.current;
    dragStart.current = null;
    if (start?.moved) {
      justDragged.current = true;
      // A drag that ends where it began changes nothing.
      if (!cancelled && drag && (drag.x !== start.item.x || drag.y !== start.item.y)) void saveMove(drag);
    }
    setDrag(null);
  }

  /** Arrow keys move the focused item, for anyone not using a mouse or finger. */
  function nudge(event: KeyboardEvent, item: Item) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!moving || !step) return;
    event.preventDefault();
    const moved = toHallDelta(step[0] * GRID, step[1] * GRID, turn);
    void saveMove({ ...item, ...snapPoint(item.x + moved.x, item.y + moved.y) });
  }

  const dragProps = (item: Item) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => startDrag(e, item),
    onPointerMove: continueDrag,
    onPointerUp: () => endDrag(),
    onPointerCancel: () => endDrag(true),
    onKeyDown: (e: KeyboardEvent) => nudge(e, item),
  });

  const positionOf = <T extends { id: string; x: number; y: number }>(item: T): T =>
    drag?.id === item.id ? { ...item, x: drag.x, y: drag.y } : item;

  const detailsById = new Map(tables.map((table) => [table.id, table]));
  // While moving, only a tap opens a table: a pop-up left over from a drag would be in the way.
  const shownId = drag ? null : (pinned ?? (moving ? null : hovered));
  const shownTable = layout?.tables.find((table) => table.id === shownId);
  const moveCursor = moving ? 'cursor-move touch-none select-none' : '';
  const view = viewSize(turn);
  const wallA = toViewPoint(HALL_WALLS.left, HALL_WALLS.top, turn);
  const wallB = toViewPoint(HALL_WALLS.right, HALL_WALLS.bottom, turn);

  return (
    // The same section either way, so nothing about the map resets when the large view opens.
    <section
      className={
        large
          ? 'fixed inset-0 z-40 flex flex-col bg-white p-3 sm:p-4'
          : 'mb-6 rounded-xl border border-slate-200 bg-white p-4'
      }
      {...(large ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Hall layout, large view' } : {})}
      data-testid="hall-layout"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Hall layout</h2>
        <div className="flex flex-wrap items-center gap-2">
          {layout?.hasLayout && (
            <>
              <button
                type="button"
                onClick={() => { setLarge((open) => !open); setZoom(1); setPinned(null); }}
                className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {large ? 'Close large view' : '⛶ Large view'}
              </button>
              <button
                type="button"
                aria-pressed={moving}
                onClick={() => { setMoving((on) => !on); setPinned(null); }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  moving ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {moving ? 'Done moving' : 'Move items'}
              </button>
              <button
                type="button"
                onClick={rotate}
                title="Turns your view of the hall by a quarter turn"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ⟳ Rotate
              </button>
              <button
                type="button"
                onClick={() => setZoom((current) => ZOOMS[(ZOOMS.indexOf(current) + 1) % ZOOMS.length])}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Zoom {zoom * 100}%
              </button>
            </>
          )}
          {layout?.available && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Layout settings
            </button>
          )}
        </div>
      </div>

      {failed && (
        <p className="text-sm text-red-700">
          Could not load the hall layout.{' '}
          <button type="button" onClick={() => void load()} className="font-semibold underline">Try again</button>
        </p>
      )}
      {!layout && !failed && <p className="text-sm text-slate-500">Loading the hall layout…</p>}
      {layout && !layout.available && (
        <p className="text-sm text-amber-800">
          The hall layout is not switched on yet: the database needs its update (npm run migrate). Everything else on
          this page works as usual.
        </p>
      )}
      {layout?.available && !layout.hasLayout && (
        <div className="text-sm text-slate-600">
          <p className="mb-3">Enter the number of tables first. The map is then drawn from the hotel plan.</p>
          <button type="button" onClick={onOpenSettings} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">
            Enter number of tables
          </button>
        </div>
      )}

      {layout?.hasLayout && (
        <>
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {(['bride', 'groom', 'common'] as TableSide[]).map((side) => (
              <li key={side} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-3 w-3 rounded-full border ${SIDE_FILL[side]}`} />
                {sideLabel(side)}
              </li>
            ))}
            <li>8/10 under a table = seats filled out of all seats (green when full)</li>
          </ul>
          {/* The large view drops the hint to give the map the height, except while moving. */}
          <p className={`mb-3 text-xs text-slate-500 ${large && !moving ? 'hidden' : ''}`}>
            {moving
              ? 'Drag tables and areas; they snap into line and each move is saved. Tap an area to rename, resize, turn or remove it.'
              : 'Point at or tap a table to see who sits there. Press “Move items” to rearrange.'}
            {' '}Hold Space and drag to move around the map.
          </p>
          <div
            className={`relative ${large ? 'flex min-h-0 flex-1 flex-col' : ''}`}
            onPointerEnter={() => { pointerOverMap.current = true; }}
            onPointerLeave={() => { pointerOverMap.current = false; }}
          >
          {spaceHeld && (
            // Lies over the map, so a drag pans instead of moving or opening anything.
            <div
              data-testid="hall-pan"
              className="absolute inset-0 z-20 cursor-grab touch-none select-none active:cursor-grabbing"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                panFrom.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerMove={pan}
              onPointerUp={() => { panFrom.current = null; }}
              onPointerCancel={() => { panFrom.current = null; }}
            />
          )}
          <div ref={scrollRef} className={`overflow-auto ${large ? 'min-h-0 flex-1' : 'max-h-[85vh]'}`}>
            <div
              ref={canvasRef}
              className="relative mx-auto"
              style={{
                width: `calc(${large ? largeWidth(view) : fitWidth(view)} * ${zoom})`,
                aspectRatio: `${view.width} / ${view.height}`,
                containerType: 'inline-size',
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setPinned(null); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setPinned(null); setHovered(null); } }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute border-4 border-double border-slate-800"
                style={{
                  left: percent(Math.min(wallA.x, wallB.x), view.width),
                  top: percent(Math.min(wallA.y, wallB.y), view.height),
                  width: percent(Math.abs(wallB.x - wallA.x), view.width),
                  height: percent(Math.abs(wallB.y - wallA.y), view.height),
                }}
              />

              {layout.areas.map((saved) => {
                const area = positionOf(saved);
                const item: Item = { kind: 'area', id: area.id, x: area.x, y: area.y };
                const labelBelow = area.shape === 'circle' && area.width < 90;
                const at = toViewPoint(area.x, area.y, turn);
                const frame = areaFrame(area, turn);
                return (
                  <div
                    key={area.id}
                    className={`absolute ${moveCursor} ${moving ? 'hover:outline-2 hover:outline-dashed hover:outline-emerald-700' : ''}`}
                    style={box(view, at.x, at.y, frame.width, frame.height)}
                    {...(moving
                      ? {
                          ...dragProps(item),
                          role: 'button',
                          tabIndex: 0,
                          'aria-label': `Area ${areaTitle(area)}`,
                          onClick: () => { if (!justDragged.current) setAreaDraft(area); },
                          onKeyDown: (e: KeyboardEvent) => {
                            if (e.key === 'Enter') setAreaDraft(area);
                            else nudge(e, item);
                          },
                        }
                      : {})}
                    data-area={area.label || area.shape}
                  >
                    {/* Only the shape turns. Its name is drawn on top, always upright. */}
                    <div
                      className="absolute left-1/2 top-1/2 border border-black/25"
                      style={{
                        width: percent(frame.shapeWidth, frame.width),
                        height: percent(frame.shapeHeight, frame.height),
                        transform: `translate(-50%, -50%) rotate(${frame.angle}deg)`,
                        background: area.color,
                        clipPath: CLIP[area.shape],
                        borderRadius: RADIUS[area.shape],
                      }}
                    />
                    {area.label && !labelBelow && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        {area.shape === 'arrow' ? (
                          // An arrow is narrow, so its name fits across the whole arrow on its own backing.
                          <span className="rounded-sm" style={{ background: area.color }}>
                            <FittedText
                              view={view}
                              className="px-0.5 font-semibold uppercase"
                              color={textOn(area.color)}
                              fit={fitLabel(area.label.toUpperCase(), frame.width * 0.95, frame.height * 0.5, 0)}
                            />
                          </span>
                        ) : (
                          <FittedText
                            view={view}
                            className="font-semibold uppercase"
                            color={textOn(area.color)}
                            fit={fitLabel(area.label.toUpperCase(), area.width, area.height, frame.angle, {
                              round: area.shape === 'circle',
                            })}
                          />
                        )}
                      </span>
                    )}
                    {area.label && labelBelow && (
                      <span
                        className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap font-semibold text-slate-700"
                        style={{ fontSize: 'clamp(7px, 1.4cqw, 16px)' }}
                      >
                        {area.label}
                      </span>
                    )}
                  </div>
                );
              })}

              {layout.tables.map((saved) => {
                const table = positionOf(saved);
                const item: Item = { kind: 'table', id: table.id, x: table.x, y: table.y };
                const name = table.name?.trim() ?? '';
                const at = toViewPoint(table.x, table.y, turn);
                // Counted like the table cards (placeholders take a seat). Only for tables this admin
                // can see: the other side's tables show colour, number and name.
                const seating = table.side === party || table.side === 'common' ? detailsById.get(table.id) : undefined;
                const filled = seating?.seats.filter((seat) => seat.guestId || seat.inviteeId || seat.probableAttendeeId).length ?? 0;
                return (
                  <button
                    key={table.id}
                    type="button"
                    className={`absolute flex flex-col items-center justify-center rounded-full border-2 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                      SIDE_FILL[table.side] ?? SIDE_FILL.common
                    } ${moveCursor || 'cursor-pointer'} ${shownId === table.id ? 'ring-4 ring-slate-900/40' : ''}`}
                    style={box(view, at.x, at.y, TABLE_SIZE, TABLE_SIZE)}
                    aria-label={`Table ${table.number}${name ? `, ${name}` : ''}, ${sideLabel(table.side)}${
                      seating ? `, ${filled} of ${seating.capacity} seats filled` : ''
                    }`}
                    data-table={table.number}
                    {...dragProps(item)}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(table.id); }}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(table.id)}
                    onBlur={() => setHovered(null)}
                    onClick={() => {
                      if (!justDragged.current) setPinned((current) => (current === table.id ? null : table.id));
                    }}
                  >
                    <FittedText view={view} className="font-bold" fit={{ size: name ? 30 : 36, lines: [String(table.number)] }} />
                    {name && <FittedText view={view} fit={fitLabel(name, 90, 42, 0, { charWidth: 0.56, maxSize: 16 })} />}
                    {seating && (
                      // Sits across the bottom edge, small enough for the gap to the table below. Green when full.
                      <span
                        data-testid="seat-count"
                        className={`absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border font-bold ${
                          filled >= seating.capacity
                            ? 'border-emerald-800 bg-emerald-700 text-white'
                            : 'border-slate-500 bg-white text-slate-900'
                        }`}
                        style={{ fontSize: `${(18 / view.width) * 100}cqw`, lineHeight: 1.2, padding: '0 0.35em' }}
                      >
                        {filled}/{seating.capacity}
                      </span>
                    )}
                  </button>
                );
              })}

              {shownTable && (
                <TableTooltip
                  table={shownTable}
                  at={toViewPoint(shownTable.x, shownTable.y, turn)}
                  view={view}
                  details={detailsById.get(shownTable.id)}
                  party={party}
                />
              )}
            </div>
          </div>
          </div>
        </>
      )}

      {settingsOpen && layout?.available && (
        <LayoutSettingsDialog
          hasLayout={layout.hasLayout}
          existingNumbers={layout.tables.map((table) => table.number)}
          areas={layout.areas}
          removableTables={tables.filter((table) =>
            table.seats.every((seat) => !seat.guestId && !seat.inviteeId && !seat.probableAttendeeId)
          )}
          busy={busy || !csrfToken}
          onGenerate={(count) => void generate(count)}
          onAddArea={() => setAreaDraft(NEW_AREA)}
          onEditArea={setAreaDraft}
          onRemoveArea={(id) => void removeArea(id)}
          onRemoveTable={(table) => void onDeleteTable(table)}
          onReset={() => void reset()}
          onAlign={() => void align()}
          // The area editor sits on top: Escape closes it first.
          onClose={() => { if (!areaDraft) onCloseSettings(); }}
        />
      )}
      {areaDraft && (
        <AreaEditorDialog
          key={areaDraft.id ?? 'new'}
          draft={areaDraft}
          busy={busy || !csrfToken}
          onSave={(draft) => void saveArea(draft)}
          onRemove={(id) => void removeArea(id)}
          onClose={() => setAreaDraft(null)}
        />
      )}
    </section>
  );
}

/** Who sits at a table. The other side's tables show no names (owner's decision). */
function TableTooltip({ table, at, view, details, party }: {
  table: MapTable;
  /** Where the table is drawn, with the hall as currently turned. */
  at: { x: number; y: number };
  view: View;
  details?: SeatingTable;
  party: Party;
}) {
  const hidden = table.side !== 'common' && table.side !== party;
  const people = details?.seats
    .filter((seat) => seat.guestId || seat.inviteeId || seat.probableAttendeeId)
    .map((seat) => ({ id: seat.id, name: seatOccupantLabel(seat), declined: seat.occupantRsvpStatus === 'declined' }));
  const above = at.y > view.height * 0.55;

  return (
    <div
      role="tooltip"
      data-testid="hall-tooltip"
      className="pointer-events-none absolute z-10 rounded-lg border border-slate-300 bg-white p-3 text-left text-xs text-slate-800 shadow-lg"
      style={{
        width: TOOLTIP_WIDTH,
        left: `clamp(0px, calc(${percent(at.x, view.width)} - ${TOOLTIP_WIDTH / 2}px), calc(100% - ${TOOLTIP_WIDTH}px))`,
        ...(above
          ? { bottom: percent(view.height - at.y + TABLE_SIZE / 2 + 6, view.height) }
          : { top: percent(at.y + TABLE_SIZE / 2 + 6, view.height) }),
      }}
    >
      <p className="text-sm font-bold">
        Table {table.number}
        {table.name && table.name !== `Table ${table.number}` ? ` — ${table.name}` : ''}
      </p>
      <p className="mb-1 text-slate-500">
        {sideLabel(table.side)}
        {!hidden && details ? ` · ${people?.length ?? 0}/${details.capacity} seats filled` : ''}
      </p>
      {hidden ? (
        <p className="text-slate-500">Only the {sideLabel(table.side).toLowerCase()}&apos;s admin sees who sits here.</p>
      ) : !people ? (
        <p className="text-slate-500">Loading names…</p>
      ) : people.length === 0 ? (
        <p className="text-slate-500">No one seated yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {people.map((person) => (
            <li key={person.id}>
              {person.name}
              {person.declined && <span className="font-semibold text-red-700"> (declined)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
