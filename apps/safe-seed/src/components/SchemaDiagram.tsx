import { useMemo, useRef, useState, type MouseEvent, type PointerEvent as PE } from 'react';
import {
  expandPiiTransitive,
  nanRates,
  PII_TYPES,
  type NanEntry,
  type SchemaConfig,
  type SchemaLink,
} from '../lib/schemaConfig';

export type SchemaTable = {
  columns: string[];
  n_rows: number;
  records?: Record<string, unknown>[];
};

type Props = {
  tables: Record<string, SchemaTable>;
  links?: SchemaLink[];
  parentTable?: string | null;
  config: SchemaConfig;
  onChange: (next: SchemaConfig) => void;
  readOnly?: boolean;
  height?: number;
};

const NW = 168;
const CH = 19;
const HH = 40;
const GAP = 28;

function nodeH(cols: string[]) {
  return HH + Math.max(1, cols.length) * CH + 8;
}

function autoLayout(tables: Record<string, SchemaTable>) {
  const tNames = Object.keys(tables);
  const gcols = Math.max(1, Math.ceil(Math.sqrt(tNames.length)));
  const colBottoms = Array(gcols).fill(20) as number[];
  const positions: Record<string, { x: number; y: number }> = {};
  tNames.forEach((name, i) => {
    const c = i % gcols;
    const nh = nodeH(tables[name]?.columns || []);
    positions[name] = { x: 16 + c * (NW + GAP), y: colBottoms[c]! };
    colBottoms[c] = Math.max(colBottoms[c]!, positions[name]!.y + nh + 28);
  });
  return positions;
}

function svgCoords(svg: SVGSVGElement | null, clientX: number, clientY: number) {
  if (!svg) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    const r = svg.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

type Pop =
  | { kind: 'pii'; table: string; col: string; x: number; y: number }
  | { kind: 'nan'; table: string; col: string; rate: number; x: number; y: number }
  | { kind: 'lock'; table: string; x: number; y: number };

type Drag =
  | { kind: 'table'; name: string; dx: number; dy: number; moved: boolean; last?: { x: number; y: number } }
  | {
      kind: 'link';
      fromTable: string;
      fromCol: string;
      x: number;
      y: number;
      moved: boolean;
    };

export function SchemaDiagram({
  tables,
  links: linksProp,
  parentTable,
  config,
  onChange,
  readOnly,
  height,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [piiType, setPiiType] = useState('uuid');
  const [nanPolicy, setNanPolicy] = useState<NanEntry['policy']>('preserve');
  const [nanFill, setNanFill] = useState('');
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draftLink, setDraftLink] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  const links = config.links?.length ? config.links : linksProp || [];
  const locked = new Set(config.locked_tables || []);
  const piiExpanded = useMemo(
    () => expandPiiTransitive(config.pii_columns || [], links),
    [config.pii_columns, links],
  );

  const basePositions = useMemo(
    () => ({ ...autoLayout(tables), ...(config.positions || {}) }),
    [tables, config.positions],
  );
  const positions = { ...basePositions, ...livePositions };

  const layout = useMemo(() => {
    const tNames = Object.keys(tables);
    if (!tNames.length) return null;
    const fkSet = new Set<string>();
    links.forEach((l) => {
      fkSet.add(`${l.fromTable}:${l.fromCol}`);
      fkSet.add(`${l.toTable}:${l.toCol}`);
    });
    function dotPos(table: string, col: string, side: 'left' | 'right') {
      const pos = positions[table];
      const cols = tables[table]?.columns || [];
      if (!pos) return null;
      const ci = cols.indexOf(col);
      if (ci < 0) return null;
      return {
        x: pos.x + (side === 'left' ? 8 : NW - 8),
        y: pos.y + HH + ci * CH + CH / 2,
        table,
        col,
        side,
      };
    }
    const ports: Array<{ x: number; y: number; table: string; col: string; side: 'left' | 'right' }> =
      [];
    tNames.forEach((name) => {
      (tables[name]?.columns || []).forEach((col) => {
        const L = dotPos(name, col, 'left');
        const R = dotPos(name, col, 'right');
        if (L) ports.push(L);
        if (R) ports.push(R);
      });
    });
    const edges = links
      .map((link, i) => {
        const from = dotPos(link.fromTable, link.fromCol, 'right');
        const to = dotPos(link.toTable, link.toCol, 'left');
        if (!from || !to) return null;
        const mx = (from.x + to.x) / 2;
        const d = `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`;
        return { d, label: `${link.fromCol} → ${link.toCol}`, i, midX: mx, midY: (from.y + to.y) / 2 };
      })
      .filter(Boolean) as Array<{
      d: string;
      label: string;
      i: number;
      midX: number;
      midY: number;
    }>;
    const maxX =
      Math.max(320, ...tNames.map((n) => (positions[n]?.x || 0) + NW), ...ports.map((p) => p.x)) + 40;
    const maxY =
      Math.max(
        200,
        ...tNames.map((n) => (positions[n]?.y || 0) + nodeH(tables[n]?.columns || [])),
        ...ports.map((p) => p.y),
      ) + 40;
    return { tNames, fkSet, edges, ports, maxX, maxY };
  }, [tables, links, positions]);

  function resolvedLinks(): SchemaLink[] {
    return (config.links?.length ? config.links : linksProp) || [];
  }

  function hitPort(x: number, y: number, exclude?: { table: string; col: string }) {
    const r2 = 12 * 12;
    let best: { table: string; col: string } | null = null;
    let bestD = r2;
    for (const p of layout?.ports || []) {
      if (exclude && p.table === exclude.table && p.col === exclude.col) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = { table: p.table, col: p.col };
      }
    }
    return best;
  }

  function localPos(e: MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 10, y: 10 };
    let x = e.clientX - rect.left + 10;
    let y = e.clientY - rect.top + 10;
    x = Math.min(x, Math.max(8, rect.width - 220));
    y = Math.min(y, Math.max(8, rect.height - 180));
    return { x, y };
  }

  function openPii(table: string, col: string, e: MouseEvent) {
    if (readOnly || dragRef.current?.moved) return;
    e.stopPropagation();
    const existing = piiExpanded.find((p) => p.table === table && p.col === col);
    setPiiType(existing?.type || 'uuid');
    const { x, y } = localPos(e);
    setPop({ kind: 'pii', table, col, x, y });
  }

  function openNan(table: string, col: string, rate: number, e: MouseEvent) {
    if (readOnly || dragRef.current?.moved) return;
    e.stopPropagation();
    const existing = (config.nan_columns || []).find((n) => n.table === table && n.col === col);
    setNanPolicy(existing?.policy || 'preserve');
    setNanFill(existing?.fill_value || '');
    const { x, y } = localPos(e);
    setPop({ kind: 'nan', table, col, rate, x, y });
  }

  function openLock(table: string, e: MouseEvent) {
    if (readOnly || dragRef.current?.moved) return;
    e.stopPropagation();
    const { x, y } = localPos(e);
    setPop({ kind: 'lock', table, x, y });
  }

  function applyPii() {
    if (!pop || pop.kind !== 'pii') return;
    const next = [...(config.pii_columns || []).filter((p) => !(p.table === pop.table && p.col === pop.col))];
    next.push({ table: pop.table, col: pop.col, type: piiType });
    onChange({ ...config, pii_columns: next });
    setPop(null);
  }

  function removePii() {
    if (!pop || pop.kind !== 'pii') return;
    onChange({
      ...config,
      pii_columns: (config.pii_columns || []).filter(
        (p) => !(p.table === pop.table && p.col === pop.col),
      ),
    });
    setPop(null);
  }

  function applyNan() {
    if (!pop || pop.kind !== 'nan') return;
    const next = [...(config.nan_columns || []).filter((n) => !(n.table === pop.table && n.col === pop.col))];
    if (nanPolicy !== 'synth') {
      const entry: NanEntry = { table: pop.table, col: pop.col, policy: nanPolicy };
      if (nanPolicy === 'fill_value') entry.fill_value = nanFill;
      next.push(entry);
    }
    onChange({ ...config, nan_columns: next });
    setPop(null);
  }

  function removeNan() {
    if (!pop || pop.kind !== 'nan') return;
    onChange({
      ...config,
      nan_columns: (config.nan_columns || []).filter(
        (n) => !(n.table === pop.table && n.col === pop.col),
      ),
    });
    setPop(null);
  }

  function toggleLock() {
    if (!pop || pop.kind !== 'lock') return;
    const cur = new Set(config.locked_tables || []);
    if (cur.has(pop.table)) cur.delete(pop.table);
    else cur.add(pop.table);
    let parent = config.parent_table ?? parentTable;
    if (parent && cur.has(parent)) {
      parent = Object.keys(tables).find((t) => !cur.has(t)) || parent;
    }
    onChange({
      ...config,
      locked_tables: [...cur],
      parent_table: parent,
    });
    setPop(null);
  }

  function startTableDrag(name: string, e: PE<SVGElement>) {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    setPop(null);
    const pt = svgCoords(svgRef.current, e.clientX, e.clientY);
    const pos = positions[name] || { x: 16, y: 20 };
    dragRef.current = { kind: 'table', name, dx: pt.x - pos.x, dy: pt.y - pos.y, moved: false };
    setDragging(true);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }

  function startLinkDrag(table: string, col: string, e: PE<SVGElement>) {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    setPop(null);
    const pt = svgCoords(svgRef.current, e.clientX, e.clientY);
    dragRef.current = { kind: 'link', fromTable: table, fromCol: col, x: pt.x, y: pt.y, moved: false };
    setDraftLink({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    setDragging(true);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onCanvasPointerMove(e: PE<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const pt = svgCoords(svgRef.current, e.clientX, e.clientY);
    if (drag.kind === 'table') {
      const x = Math.max(8, pt.x - drag.dx);
      const y = Math.max(8, pt.y - drag.dy);
      if (Math.abs(x - (positions[drag.name]?.x || 0)) > 2 || Math.abs(y - (positions[drag.name]?.y || 0)) > 2) {
        drag.moved = true;
      }
      drag.last = { x, y };
      setLivePositions((prev) => ({ ...prev, [drag.name]: { x, y } }));
    } else {
      drag.moved = true;
      drag.x = pt.x;
      drag.y = pt.y;
      const from = layout?.ports.find(
        (p) => p.table === drag.fromTable && p.col === drag.fromCol && p.side === 'right',
      ) || layout?.ports.find((p) => p.table === drag.fromTable && p.col === drag.fromCol);
      setDraftLink({
        x1: from?.x ?? pt.x,
        y1: from?.y ?? pt.y,
        x2: pt.x,
        y2: pt.y,
      });
    }
  }

  function onCanvasPointerUp(e: PE<SVGSVGElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    setDraftLink(null);
    if (!drag) return;
    if (drag.kind === 'table') {
      if (!drag.moved) return;
      const pos = drag.last || livePositions[drag.name];
      if (!pos) return;
      onChange({
        ...config,
        links: resolvedLinks(),
        positions: { ...(config.positions || {}), [drag.name]: pos },
      });
      return;
    }
    const pt = svgCoords(svgRef.current, e.clientX, e.clientY);
    if (!drag.moved) return;
    const hit = hitPort(pt.x, pt.y, { table: drag.fromTable, col: drag.fromCol });
    if (!hit || hit.table === drag.fromTable) return;
    const next = resolvedLinks().filter(
      (l) =>
        !(
          (l.fromTable === drag.fromTable &&
            l.fromCol === drag.fromCol &&
            l.toTable === hit.table &&
            l.toCol === hit.col) ||
          (l.fromTable === hit.table &&
            l.fromCol === hit.col &&
            l.toTable === drag.fromTable &&
            l.toCol === drag.fromCol)
        ),
    );
    next.push({
      fromTable: drag.fromTable,
      fromCol: drag.fromCol,
      toTable: hit.table,
      toCol: hit.col,
    });
    onChange({ ...config, links: next });
  }

  function removeLink(i: number, e: MouseEvent) {
    if (readOnly) return;
    e.stopPropagation();
    const next = resolvedLinks().filter((_, idx) => idx !== i);
    onChange({ ...config, links: next });
  }

  if (!layout) return <p className="muted">No tables to diagram.</p>;
  const { tNames, fkSet, edges, maxX, maxY } = layout;
  const svgH = height ?? Math.max(280, maxY);
  const activeParent = config.parent_table ?? parentTable;

  return (
    <div
      className={`schema-diagram${dragging ? ' dragging' : ''}`}
      ref={wrapRef}
      style={{ position: 'relative' }}
      onClick={() => setPop(null)}
    >
      <div className="schema-legend muted">
        <span>drag a table to move</span>
        <span>drag a column dot to link matching keys</span>
        <span>click a link to remove</span>
        <span>🔒 lock table (copy as-is)</span>
        <span>👁 mask PII</span>
        <span style={{ color: '#f87171' }}>⚠ NaN policy</span>
        <span style={{ color: '#a78bfa' }}>purple = PII</span>
      </div>
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${maxX} ${maxY}`}
        preserveAspectRatio="xMinYMin meet"
        style={{ width: '100%', height: svgH, display: 'block', touchAction: 'none' }}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
      >
        <g>
          {edges.map((e) => (
            <g key={e.i} className="schema-edge" onClick={(ev) => removeLink(e.i, ev as unknown as MouseEvent)}>
              <path d={e.d} fill="none" stroke="transparent" strokeWidth="10" />
              <path d={e.d} fill="none" stroke="#4c6ef5" strokeWidth="1.5" opacity="0.7" />
              <text
                x={e.midX}
                y={e.midY - 4}
                textAnchor="middle"
                fontSize="9"
                fill="#9ecbff"
                fontFamily="ui-monospace, monospace"
                style={{ pointerEvents: 'none' }}
              >
                {e.label.length > 22 ? `${e.label.slice(0, 20)}…` : e.label}
              </text>
            </g>
          ))}
          {draftLink && (
            <path
              d={`M ${draftLink.x1} ${draftLink.y1} L ${draftLink.x2} ${draftLink.y2}`}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          )}
        </g>
        <g>
          {tNames.map((name) => {
            const tbl = tables[name]!;
            const pos = positions[name]!;
            const nh = nodeH(tbl.columns);
            const isLocked = locked.has(name);
            const isParent = activeParent === name;
            const rates = nanRates(name, tbl.records, tbl.columns);
            return (
              <g key={name} transform={`translate(${pos.x},${pos.y})`}>
                <rect
                  width={NW}
                  height={nh}
                  rx={8}
                  fill="#1e222b"
                  stroke={isLocked ? '#c9a227' : isParent ? '#4c6ef5' : '#2a2f3a'}
                  strokeWidth={isLocked || isParent ? 2 : 1.5}
                />
                <rect
                  className="schema-table-head"
                  width={NW - 28}
                  height={HH}
                  rx={8}
                  fill={isLocked ? '#2a2418' : isParent ? '#1c2438' : '#252a35'}
                  style={{ cursor: readOnly ? 'default' : 'grab' }}
                  onPointerDown={(e) => startTableDrag(name, e)}
                />
                <rect
                  width={28}
                  x={NW - 28}
                  height={HH}
                  fill={isLocked ? '#2a2418' : isParent ? '#1c2438' : '#252a35'}
                />
                <rect
                  width={NW}
                  height={8}
                  y={HH - 8}
                  fill={isLocked ? '#2a2418' : isParent ? '#1c2438' : '#252a35'}
                  pointerEvents="none"
                />
                <text
                  x={NW / 2 - 8}
                  y={16}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill={isLocked ? '#e6c35c' : '#e6e9ef'}
                  style={{ pointerEvents: 'none' }}
                >
                  {name.length > 16 ? `${name.slice(0, 14)}…` : name}
                </text>
                <text
                  x={NW - 14}
                  y={17}
                  textAnchor="middle"
                  fontSize="11"
                  fill={isLocked ? '#e6c35c' : 'rgba(138,147,163,0.45)'}
                  style={{ cursor: readOnly ? 'default' : 'pointer' }}
                  onClick={(e) => openLock(name, e as unknown as MouseEvent)}
                >
                  {isLocked ? '🔒' : '🔓'}
                </text>
                <text
                  x={NW / 2}
                  y={HH - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isLocked ? '#c9a227' : '#8a93a3'}
                  style={{ pointerEvents: 'none' }}
                >
                  {isLocked
                    ? '🔒 locked · copy as-is'
                    : `${tbl.n_rows.toLocaleString()} rows · ${tbl.columns.length} cols${isParent ? ' · parent' : ''}`}
                </text>
                {tbl.columns.map((col, ci) => {
                  const cy = HH + ci * CH + CH / 2;
                  const rowY = HH + ci * CH;
                  const isFk = fkSet.has(`${name}:${col}`);
                  const pii = piiExpanded.find((p) => p.table === name && p.col === col);
                  const nanEntry = (config.nan_columns || []).find(
                    (n) => n.table === name && n.col === col,
                  );
                  const nanRate = rates[col] || 0;
                  const hasNan = nanRate > 0.001;
                  const textColor = hasNan
                    ? nanEntry
                      ? '#fca5a5'
                      : '#f87171'
                    : pii?.transitive
                      ? '#7c5cbf'
                      : pii
                        ? '#a78bfa'
                        : isFk
                          ? '#9ecbff'
                          : '#8a93a3';
                  return (
                    <g key={col}>
                      {hasNan && (
                        <rect
                          x={13}
                          y={rowY}
                          width={NW - 26}
                          height={CH}
                          fill={nanEntry ? 'rgba(220,38,38,0.13)' : 'rgba(220,38,38,0.07)'}
                          rx={2}
                        />
                      )}
                      {!hasNan && pii && (
                        <rect
                          x={13}
                          y={rowY}
                          width={NW - 26}
                          height={CH}
                          fill={
                            pii.transitive ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.12)'
                          }
                          rx={2}
                        />
                      )}
                      <circle
                        className="schema-port"
                        cx={8}
                        cy={cy}
                        r={5.5}
                        fill={isFk ? '#4c6ef5' : '#2a2f3a'}
                        stroke={isFk ? '#6b8ef7' : '#8b93a8'}
                        strokeWidth={1.2}
                        style={{ cursor: readOnly ? 'default' : 'crosshair' }}
                        onPointerDown={(e) => startLinkDrag(name, col, e)}
                      />
                      <circle
                        className="schema-port"
                        cx={NW - 8}
                        cy={cy}
                        r={5.5}
                        fill={isFk ? '#4c6ef5' : '#2a2f3a'}
                        stroke={isFk ? '#6b8ef7' : '#8b93a8'}
                        strokeWidth={1.2}
                        style={{ cursor: readOnly ? 'default' : 'crosshair' }}
                        onPointerDown={(e) => startLinkDrag(name, col, e)}
                      />
                      <text
                        x={18}
                        y={rowY + CH * 0.7}
                        fontSize="10"
                        fill={textColor}
                        fontFamily="ui-monospace, monospace"
                        style={{ pointerEvents: 'none' }}
                      >
                        {col.length > 11 ? `${col.slice(0, 9)}…` : col}
                      </text>
                      {(hasNan || nanEntry) && (
                        <text
                          x={NW - 32}
                          y={rowY + CH * 0.72}
                          fontSize="8"
                          fill={nanEntry ? '#f87171' : 'rgba(248,113,113,0.5)'}
                          textAnchor="middle"
                          style={{ pointerEvents: 'none' }}
                        >
                          ⚠
                        </text>
                      )}
                      <text
                        x={NW - 20}
                        y={rowY + CH * 0.72}
                        fontSize="9"
                        fill={
                          pii?.transitive ? '#5b3fa0' : pii ? '#7c3aed' : 'rgba(138,147,163,0.35)'
                        }
                        textAnchor="middle"
                        style={{ cursor: readOnly ? 'default' : 'pointer' }}
                        onClick={(e) => openPii(name, col, e as unknown as MouseEvent)}
                      >
                        {pii?.transitive ? '🔗' : '👁'}
                      </text>
                      <rect
                        x={13}
                        y={rowY}
                        width={NW - 38}
                        height={CH}
                        fill="transparent"
                        style={{ cursor: readOnly ? 'default' : 'pointer' }}
                        onClick={(e) => {
                          const ev = e as unknown as MouseEvent;
                          if (hasNan) openNan(name, col, nanRate, ev);
                          else openPii(name, col, ev);
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>

      {pop?.kind === 'pii' && (
        <div
          className="schema-pop pii-pop"
          style={{ left: pop.x, top: pop.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="muted" style={{ fontSize: 10 }}>
            {pop.table}
            {piiExpanded.find((p) => p.table === pop.table && p.col === pop.col)?.transitive
              ? ' · via FK link'
              : ''}
          </div>
          <div className="schema-pop-col" style={{ color: '#c4b5fd' }}>
            {pop.col}
          </div>
          <select value={piiType} onChange={(e) => setPiiType(e.target.value)}>
            {PII_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" type="button" onClick={applyPii}>
              Mask PII
            </button>
            {(config.pii_columns || []).some((p) => p.table === pop.table && p.col === pop.col) && (
              <button className="btn sec sm" type="button" onClick={removePii}>
                Remove
              </button>
            )}
            <button className="btn sec sm" type="button" onClick={() => setPop(null)}>
              ✕
            </button>
          </div>
        </div>
      )}

      {pop?.kind === 'nan' && (
        <div
          className="schema-pop nan-pop"
          style={{ left: pop.x, top: pop.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="muted" style={{ fontSize: 10 }}>
            {pop.table}
          </div>
          <div className="schema-pop-col" style={{ color: '#f5c542' }}>
            {pop.col}
          </div>
          <div style={{ fontSize: 10, color: '#d4a017', marginBottom: 8 }}>
            {(pop.rate * 100).toFixed(1)}% NaN in source
          </div>
          <select
            value={nanPolicy}
            onChange={(e) => setNanPolicy(e.target.value as NanEntry['policy'])}
          >
            <option value="synth">Auto-synthesize (default)</option>
            <option value="preserve">Preserve as NaN</option>
            <option value="fill_mean">Fill with mean/mode</option>
            <option value="fill_value">Fill with value…</option>
          </select>
          {nanPolicy === 'fill_value' && (
            <input
              value={nanFill}
              onChange={(e) => setNanFill(e.target.value)}
              placeholder="fill value"
              style={{ marginTop: 6 }}
            />
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" type="button" onClick={applyNan}>
              Apply
            </button>
            {(config.nan_columns || []).some((n) => n.table === pop.table && n.col === pop.col) && (
              <button className="btn sec sm" type="button" onClick={removeNan}>
                Remove
              </button>
            )}
            <button className="btn sec sm" type="button" onClick={() => setPop(null)}>
              ✕
            </button>
          </div>
        </div>
      )}

      {pop?.kind === 'lock' && (
        <div
          className="schema-pop lock-pop"
          style={{ left: pop.x, top: pop.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="muted" style={{ fontSize: 10 }}>
            Table
          </div>
          <div className="schema-pop-col">{pop.table}</div>
          <p className="muted" style={{ fontSize: 11, margin: '6px 0 10px' }}>
            Locked tables are copied as-is (not synthesized), matching the POC.
          </p>
          <div className="row">
            <button className="btn sm" type="button" onClick={toggleLock}>
              {locked.has(pop.table) ? '🔓 Unlock table' : '🔒 Lock table'}
            </button>
            <button className="btn sec sm" type="button" onClick={() => setPop(null)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
