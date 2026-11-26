'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useToast } from '@/components/Toast';
import { HALL, HALL_WALLS, TABLE_SIZE, clampPoint } from '@/src/hall-layout/hallLayoutShapes.js';
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
const NUDGE = 5;
const DRAG_THRESHOLD_PX = 4;
const TOOLTIP_WIDTH = 224;

const percent = (value: number, of: number) => `${(value / of) * 100}%`;

function box(x: number, y: number, width: number, height: number): CSSProperties {
  return {
    left: percent(x - width / 2, HALL.width),
    top: percent(y - height / 2, HALL.height),
    width: percent(width, HALL.width),
    height: percent(height, HALL.height),
  };
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
    const scale = HALL.width / canvas.getBoundingClientRect().width;
    setDrag({ ...start.item, ...clampPoint(start.item.x + dx * scale, start.item.y + dy * scale) });
  }

  function endDrag(cancelled = false) {
    const start = dragStart.current;
    dragStart.current = null;
    if (start?.moved) {
      justDragged.current = true;
      if (!cancelled && drag) void saveMove(drag);
    }
    setDrag(null);
  }

  /** Arrow keys move the focused item, for anyone not using a mouse or finger. */
  function nudge(event: KeyboardEvent, item: Item) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!moving || !step) return;
    event.preventDefault();
    void saveMove({ ...item, ...clampPoint(item.x + step[0] * NUDGE, item.y + step[1] * NUDGE) });
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

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4" data-testid="hall-layout">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Hall layout</h2>
        <div className="flex flex-wrap items-center gap-2">
          {layout?.hasLayout && (
            <>
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
          </ul>
          <p className="mb-3 text-xs text-slate-500">
            {moving
              ? 'Drag tables and areas; each move is saved. Tap an area to rename, resize, turn or remove it.'
              : 'Point at or tap a table to see who sits there. Press “Move items” to rearrange.'}
          </p>
          <div className="overflow-auto max-h-[85vh]">
            <div
              ref={canvasRef}
              className="relative mx-auto"
              style={{
                width: percent(zoom, 1),
                maxWidth: 720 * zoom,
                aspectRatio: `${HALL.width} / ${HALL.height}`,
                containerType: 'inline-size',
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setPinned(null); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setPinned(null); setHovered(null); } }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute border-4 border-double border-slate-800"
                style={{
                  left: percent(HALL_WALLS.left, HALL.width),
                  top: percent(HALL_WALLS.top, HALL.height),
                  width: percent(HALL_WALLS.right - HALL_WALLS.left, HALL.width),
                  height: percent(HALL_WALLS.bottom - HALL_WALLS.top, HALL.height),
                }}
              />

              {layout.areas.map((saved) => {
                const area = positionOf(saved);
                const item: Item = { kind: 'area', id: area.id, x: area.x, y: area.y };
                const labelBelow = area.shape === 'circle' && area.width < 90;
                const upright = area.height > area.width * 2.5;
                return (
                  <div
                    key={area.id}
                    className={`absolute ${moveCursor} ${moving ? 'hover:outline-2 hover:outline-dashed hover:outline-emerald-700' : ''}`}
                    style={box(area.x, area.y, area.width, area.height)}
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
                    <div className="absolute inset-0" style={{ transform: `rotate(${area.rotation}deg)` }}>
                      <div
                        className="absolute inset-0 border border-black/25"
                        style={{ background: area.color, clipPath: CLIP[area.shape], borderRadius: RADIUS[area.shape] }}
                      />
                      {area.label && !labelBelow && (
                        <span
                          className={`absolute inset-0 flex justify-center text-center font-semibold uppercase leading-tight ${
                            area.shape === 'arrow' ? 'items-end pb-[28%]' : 'items-center'
                          }`}
                          style={{
                            color: textOn(area.color),
                            fontSize: 'clamp(7px, 1.5cqw, 18px)',
                            writingMode: upright ? 'vertical-rl' : undefined,
                          }}
                        >
                          {area.shape === 'arrow' ? (
                            // An arrow's body is narrower than its name, so the name carries its own backing.
                            <span className="whitespace-nowrap rounded-sm px-0.5" style={{ background: area.color }}>
                              {area.label}
                            </span>
                          ) : (
                            area.label
                          )}
                        </span>
                      )}
                    </div>
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
                return (
                  <button
                    key={table.id}
                    type="button"
                    className={`absolute flex flex-col items-center justify-center rounded-full border-2 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                      SIDE_FILL[table.side] ?? SIDE_FILL.common
                    } ${moveCursor || 'cursor-pointer'} ${shownId === table.id ? 'ring-4 ring-slate-900/40' : ''}`}
                    style={box(table.x, table.y, TABLE_SIZE, TABLE_SIZE)}
                    aria-label={`Table ${table.number}${name ? `, ${name}` : ''}, ${sideLabel(table.side)}`}
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
                    <span className="font-bold leading-none" style={{ fontSize: 'clamp(10px, 3cqw, 36px)' }}>
                      {table.number}
                    </span>
                    {name && (
                      <span className="w-[92%] truncate text-center leading-tight" style={{ fontSize: 'clamp(7px, 1.5cqw, 18px)' }}>
                        {name}
                      </span>
                    )}
                  </button>
                );
              })}

              {shownTable && (
                <TableTooltip table={shownTable} details={detailsById.get(shownTable.id)} party={party} />
              )}
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
function TableTooltip({ table, details, party }: { table: MapTable; details?: SeatingTable; party: Party }) {
  const hidden = table.side !== 'common' && table.side !== party;
  const people = details?.seats
    .filter((seat) => seat.guestId || seat.inviteeId || seat.probableAttendeeId)
    .map((seat) => ({ id: seat.id, name: seatOccupantLabel(seat), declined: seat.occupantRsvpStatus === 'declined' }));
  const above = table.y > HALL.height * 0.55;

  return (
    <div
      role="tooltip"
      data-testid="hall-tooltip"
      className="pointer-events-none absolute z-10 rounded-lg border border-slate-300 bg-white p-3 text-left text-xs text-slate-800 shadow-lg"
      style={{
        width: TOOLTIP_WIDTH,
        left: `clamp(0px, calc(${percent(table.x, HALL.width)} - ${TOOLTIP_WIDTH / 2}px), calc(100% - ${TOOLTIP_WIDTH}px))`,
        ...(above
          ? { bottom: percent(HALL.height - table.y + TABLE_SIZE / 2 + 6, HALL.height) }
          : { top: percent(table.y + TABLE_SIZE / 2 + 6, HALL.height) }),
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
