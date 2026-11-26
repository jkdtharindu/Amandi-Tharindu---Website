'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  AREA_SHAPES,
  AREA_SHAPE_LABELS,
  AREA_SIZE_LIMITS,
  MAX_AREA_LABEL,
  MAX_LAYOUT_TABLES,
} from '@/src/hall-layout/hallLayoutShapes.js';
import { sideLabel, tableLabel } from '@/src/table-arrangement/tableSides.js';
import type { SeatingTable } from './TableArrangement';

export type AreaShape = 'rect' | 'rounded' | 'circle' | 'heptagon' | 'arrow';

export type HallArea = {
  id: string;
  shape: AreaShape;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
};

/** An area being edited (`id` set) or added (`id` null). */
export type AreaDraft = Omit<HallArea, 'id' | 'x' | 'y'> & { id: string | null };

export const NEW_AREA: AreaDraft = {
  id: null,
  shape: 'rect',
  label: '',
  width: 120,
  height: 80,
  rotation: 0,
  color: '#94a3b8',
};

const shapeName = (shape: AreaShape) => (AREA_SHAPE_LABELS as Record<AreaShape, string>)[shape];

export const areaTitle = (area: { label: string; shape: AreaShape }) => area.label || shapeName(area.shape);

const FIELD = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white';
const LABEL = 'block text-xs font-semibold text-slate-500 mb-1';
const PRIMARY = 'px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50';
const SECONDARY = 'px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50';
const DANGER = 'px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50';

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-slate-500">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AreaEditorDialog({
  draft,
  busy,
  onSave,
  onRemove,
  onClose,
}: {
  draft: AreaDraft;
  busy: boolean;
  onSave: (area: AreaDraft) => void;
  onRemove: (areaId: string) => void;
  onClose: () => void;
}) {
  const [shape, setShape] = useState<AreaShape>(draft.shape);
  const [label, setLabel] = useState(draft.label);
  const [width, setWidth] = useState(String(draft.width));
  const [height, setHeight] = useState(String(draft.height));
  const [rotation, setRotation] = useState(String(draft.rotation));
  const [color, setColor] = useState(draft.color);

  const numberField = (id: string, text: string, value: string, set: (v: string) => void, min: number, max: number) => (
    <div>
      <label htmlFor={id} className={LABEL}>
        {text}
      </label>
      <input id={id} type="number" required min={min} max={max} step={1} value={value}
        onChange={(e) => set(e.target.value)} className={FIELD} />
    </div>
  );

  return (
    <Dialog title={draft.id ? `Edit ${areaTitle(draft)}` : 'Add an area'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: draft.id, shape, label: label.trim(), color,
            width: Number(width), height: Number(height), rotation: Number(rotation),
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          {!draft.id && (
            <div className="col-span-2">
              <label htmlFor="areaShape" className={LABEL}>Shape</label>
              <select id="areaShape" value={shape} onChange={(e) => setShape(e.target.value as AreaShape)} className={FIELD}>
                {(AREA_SHAPES as AreaShape[]).map((option) => (
                  <option key={option} value={option}>{shapeName(option)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label htmlFor="areaLabel" className={LABEL}>Name on the map (can be blank)</label>
            <input id="areaLabel" maxLength={MAX_AREA_LABEL} value={label}
              onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Cake table" className={FIELD} />
          </div>
          {numberField('areaWidth', 'Width', width, setWidth, AREA_SIZE_LIMITS.min, AREA_SIZE_LIMITS.maxWidth)}
          {numberField('areaHeight', 'Height', height, setHeight, AREA_SIZE_LIMITS.min, AREA_SIZE_LIMITS.maxHeight)}
          {numberField('areaRotation', 'Turn (degrees, 0–359)', rotation, setRotation, 0, 359)}
          <div>
            <label htmlFor="areaColor" className={LABEL}>Colour</label>
            <input id="areaColor" type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300" />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          For comparison, a guest table is 104 wide and the whole drawing is 920 wide.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className={PRIMARY}>{draft.id ? 'Save' : 'Add to map'}</button>
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          {draft.id && (
            <button type="button" disabled={busy} onClick={() => onRemove(draft.id!)} className={`${DANGER} ml-auto`}>
              Remove from map
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

export function LayoutSettingsDialog({
  hasLayout,
  existingNumbers,
  areas,
  removableTables,
  busy,
  onGenerate,
  onAddArea,
  onEditArea,
  onRemoveArea,
  onRemoveTable,
  onReset,
  onAlign,
  onClose,
}: {
  hasLayout: boolean;
  /** The numbers of every table that exists, both sides and Common. */
  existingNumbers: number[];
  areas: HallArea[];
  /** Empty tables the signed-in admin is allowed to delete. */
  removableTables: SeatingTable[];
  busy: boolean;
  onGenerate: (tableCount: number) => void;
  onAddArea: () => void;
  onEditArea: (area: HallArea) => void;
  onRemoveArea: (areaId: string) => void;
  onRemoveTable: (table: SeatingTable) => void;
  onReset: () => void;
  onAlign: () => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(() => String(Math.min(MAX_LAYOUT_TABLES, Math.max(0, ...existingNumbers) || 26)));
  const [tableId, setTableId] = useState('');

  const wanted = Number(count);
  const validCount = Number.isInteger(wanted) && wanted >= 1 && wanted <= MAX_LAYOUT_TABLES;
  const toAdd = validCount ? wanted - new Set(existingNumbers.filter((n) => n >= 1 && n <= wanted)).size : 0;
  const chosen = removableTables.find((table) => table.id === tableId);

  return (
    <Dialog title="Layout settings" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (validCount) onGenerate(wanted);
        }}
      >
        <label htmlFor="layoutTableCount" className="block text-sm font-semibold mb-1">Number of tables</label>
        <div className="flex gap-2">
          <input id="layoutTableCount" type="number" min={1} max={MAX_LAYOUT_TABLES} required value={count}
            onChange={(e) => setCount(e.target.value)} className="w-24 px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          <button type="submit" disabled={busy || !validCount} className={PRIMARY}>
            {hasLayout ? 'Update layout' : 'Create layout'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500" data-testid="layout-count-note">
          {validCount && toAdd > 0
            ? `This adds ${toAdd} new empty Common ${toAdd === 1 ? 'table' : 'tables'} (10 seats each). `
            : 'No new tables are needed for this number. '}
          Existing tables and seated guests are never changed or deleted. A new table can be moved to your side from
          its card below the map.
        </p>
      </form>

      {hasLayout && (
        <>
          <section className="mt-5 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Other areas ({areas.length})</h3>
              <button type="button" disabled={busy} onClick={onAddArea} className={SECONDARY}>Add an area</button>
            </div>
            <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto">
              {areas.map((area) => (
                <li key={area.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ background: area.color }} />
                  <span className="min-w-0 flex-1 truncate">{areaTitle(area)}</span>
                  <button type="button" disabled={busy} onClick={() => onEditArea(area)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50">
                    Edit
                  </button>
                  <button type="button" disabled={busy} onClick={() => onRemoveArea(area.id)} className={DANGER}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5 border-t border-slate-200 pt-4">
            <label htmlFor="layoutRemoveTable" className="block text-sm font-semibold mb-1">Remove a table</label>
            <div className="flex gap-2">
              <select id="layoutRemoveTable" value={chosen ? tableId : ''} onChange={(e) => setTableId(e.target.value)} className={FIELD}>
                <option value="">Choose an empty table…</option>
                {removableTables.map((table) => (
                  <option key={table.id} value={table.id}>
                    Table {table.table_number} — {tableLabel(table)} ({sideLabel(table.side)})
                  </option>
                ))}
              </select>
              <button type="button" disabled={busy || !chosen} onClick={() => chosen && onRemoveTable(chosen)} className={DANGER}>
                Remove
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Only empty tables on your side or Common are listed. To add one table, use &ldquo;Add a table&rdquo;.
            </p>
          </section>

          <section className="mt-5 border-t border-slate-200 pt-4">
            <button type="button" disabled={busy} onClick={onAlign} className={SECONDARY}>
              Align everything to the grid
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Nudges every table and area to its closest grid point, so rows and columns line up.
            </p>
          </section>

          <section className="mt-5 border-t border-slate-200 pt-4">
            <button type="button" disabled={busy} onClick={onReset} className={DANGER}>
              Reset map to the hotel plan
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Puts every table and area back where the hotel plan has it. Tables and seated guests are not touched.
            </p>
          </section>
        </>
      )}
    </Dialog>
  );
}
