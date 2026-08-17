/** Schema editor helpers — PII auto-detect, transitive expansion, NaN rates. */

export type SchemaLink = {
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
};

export type PiiEntry = {
  table: string;
  col: string;
  type: string;
  group?: string;
  transitive?: boolean;
};

export type NanEntry = {
  table: string;
  col: string;
  policy: 'synth' | 'preserve' | 'fill_mean' | 'fill_value';
  fill_value?: string;
};

export type SchemaConfig = {
  locked_tables: string[];
  pii_columns: PiiEntry[];
  nan_columns: NanEntry[];
  links?: SchemaLink[];
  parent_table?: string | null;
  positions?: Record<string, { x: number; y: number }>;
};

export const PII_TYPES = [
  'uuid',
  'name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'id',
  'ssn',
  'date',
  'address',
  'company',
  'username',
  'ip',
] as const;

const PII_HINTS: Array<{ kw: string; type: string }> = [
  { kw: 'email', type: 'email' },
  { kw: 'e_mail', type: 'email' },
  { kw: 'phone', type: 'phone' },
  { kw: 'mobile', type: 'phone' },
  { kw: 'ssn', type: 'ssn' },
  { kw: 'social', type: 'ssn' },
  { kw: 'first_name', type: 'first_name' },
  { kw: 'lastname', type: 'last_name' },
  { kw: 'last_name', type: 'last_name' },
  { kw: 'fullname', type: 'name' },
  { kw: 'address', type: 'address' },
  { kw: 'street', type: 'address' },
  { kw: 'username', type: 'username' },
  { kw: 'user_name', type: 'username' },
  { kw: 'company', type: 'company' },
  { kw: 'dob', type: 'date' },
  { kw: 'birth', type: 'date' },
  { kw: 'ip', type: 'ip' },
  { kw: 'ip_address', type: 'ip' },
];

function normName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[m]![n]!;
}

function bestHint(norm: string): { type: string; dist: number; kwLen: number } | null {
  let best: { type: string; dist: number; kwLen: number } | null = null;
  for (const h of PII_HINTS) {
    if (norm === h.kw) return { type: h.type, dist: 0, kwLen: h.kw.length };
    const d = lev(norm, h.kw);
    const thr = h.kw.length <= 4 ? 0 : 1;
    if (d <= thr && (!best || d < best.dist || (d === best.dist && h.kw.length > best.kwLen))) {
      best = { type: h.type, dist: d, kwLen: h.kw.length };
    }
  }
  return best;
}

export function autoDetectParentPii(
  parent: string | null | undefined,
  tables: Record<string, { columns: string[] }>,
): PiiEntry[] {
  if (!parent || !tables[parent]) return [];
  const cols = tables[parent].columns || [];
  const tokenSkip = new Set(['first', 'last', 'name', 'id', 'mail', 'tel', 'sin', 'ip']);
  const found: PiiEntry[] = [];
  for (const col of cols) {
    const n = normName(col);
    let match = bestHint(n);
    if (!match) {
      const tokens = n.split('_').filter((t) => t.length >= 2 && !tokenSkip.has(t));
      let best: { type: string; dist: number; kwLen: number } | null = null;
      for (const tok of tokens) {
        const m = bestHint(tok);
        if (m && m.dist === 0 && (!best || m.kwLen > best.kwLen)) best = m;
      }
      match = best;
    }
    if (match) found.push({ table: parent, col, type: match.type });
  }
  return found;
}

export function expandPiiTransitive(pii: PiiEntry[], links: SchemaLink[]): PiiEntry[] {
  const adj = new Map<string, Array<{ table: string; col: string }>>();
  for (const l of links) {
    const a = `${l.fromTable}\0${l.fromCol}`;
    const b = `${l.toTable}\0${l.toCol}`;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ table: l.toTable, col: l.toCol });
    adj.get(b)!.push({ table: l.fromTable, col: l.fromCol });
  }
  const expanded: PiiEntry[] = [];
  const visited = new Set<string>();
  let groupId = 0;
  for (const seed of pii) {
    const seedKey = `${seed.table}\0${seed.col}`;
    if (visited.has(seedKey)) continue;
    const g = `g${groupId++}`;
    const queue: Array<{ table: string; col: string; transitive: boolean }> = [
      { table: seed.table, col: seed.col, transitive: false },
    ];
    while (queue.length) {
      const { table, col, transitive } = queue.shift()!;
      const k = `${table}\0${col}`;
      if (visited.has(k)) continue;
      visited.add(k);
      expanded.push({ table, col, type: seed.type, group: g, transitive });
      for (const n of adj.get(k) || []) {
        if (!visited.has(`${n.table}\0${n.col}`)) {
          queue.push({ table: n.table, col: n.col, transitive: true });
        }
      }
    }
  }
  return expanded;
}

export function nanRates(
  table: string,
  records: Record<string, unknown>[] | undefined,
  columns: string[],
): Record<string, number> {
  const rates: Record<string, number> = {};
  if (!records?.length) return rates;
  for (const col of columns) {
    const nNull = records.filter((r) => r[col] == null || r[col] === '').length;
    rates[col] = nNull / records.length;
  }
  return rates;
}

export function emptySchemaConfig(): SchemaConfig {
  return { locked_tables: [], pii_columns: [], nan_columns: [] };
}

/** Flatten nan_columns into synth nan_policy dict (column → policy). */
export function nanPolicyFromConfig(nan: NanEntry[]): Record<string, string | { fill: string }> {
  const out: Record<string, string | { fill: string }> = {};
  for (const n of nan) {
    if (!n.policy || n.policy === 'synth') continue;
    if (n.policy === 'fill_value') out[n.col] = { fill: n.fill_value ?? '' };
    else out[n.col] = n.policy;
  }
  return out;
}
