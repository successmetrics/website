import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

export type PresetInfo = {
  test_id: string;
  kind: 'flat' | 'relational';
  name: string;
  label: string;
  description: string;
  domain: string;
  group: string;
  tables: string[];
  n_tables: number;
  parent_table?: string | null;
};

export function PresetPicker({
  value,
  onChange,
  disabled,
  emptyLabel,
}: {
  value: string;
  onChange: (id: string, preset?: PresetInfo) => void;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<{ presets: PresetInfo[] }>('/v1/sources/presets')
      .then((r) => setPresets(r.presets || []))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load presets'));
  }, []);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, PresetInfo[]>();
    for (const p of presets) {
      const g = p.group || (p.kind === 'relational' ? 'Relational' : 'Single table');
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(p);
    }
    return order.map((g) => ({ group: g, items: map.get(g)! }));
  }, [presets]);

  const selected = presets.find((p) => p.test_id === value);

  return (
    <div>
      <label>Built-in preset</label>
      <select
        value={value}
        disabled={disabled || !presets.length}
        onChange={(e) => {
          const id = e.target.value;
          onChange(id, presets.find((p) => p.test_id === id));
        }}
      >
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {!presets.length && !emptyLabel && <option value={value || ''}>Loading presets…</option>}
        {groups.map(({ group, items }) => (
          <optgroup key={group} label={group}>
            {items.map((p) => (
              <option key={p.test_id} value={p.test_id}>
                {p.label}
                {p.kind === 'relational' ? ` (${p.n_tables} tables)` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}
      {selected && (
        <p className="muted" style={{ margin: '8px 0 0' }}>
          {selected.kind === 'relational' ? 'Relational' : 'Single table'}
          {' · '}
          {selected.domain}
          {selected.tables?.length ? ` · ${selected.tables.join(', ')}` : ''}
          {selected.description ? ` — ${selected.description}` : ''}
        </p>
      )}
    </div>
  );
}
