/** Privacy metrics — ported from demo/index.html computePrivacyMetrics. */

export type PrivacyMetrics = {
  reidCount: number | null;
  reidPct: string | null;
  plausibleCount: number | null;
  plausiblePct: string | null;
  nndr: string | null;
  status: 'PASS' | 'WARN' | 'FAIL' | string;
  reason?: string;
};

export type ColTypes = Record<string, 'num' | 'cat'>;

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function inferTypes(records: Record<string, unknown>[]): ColTypes {
  if (!records.length) return {};
  const cols = Object.keys(records[0] || {});
  const types: ColTypes = {};
  for (const c of cols) {
    const vals = records.map((r) => r[c]).filter((v) => v != null && v !== '');
    if (!vals.length) {
      types[c] = 'cat';
      continue;
    }
    const nums = vals.filter(
      (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))),
    );
    types[c] = nums.length / vals.length > 0.85 ? 'num' : 'cat';
  }
  return types;
}

function isIdentifierColumn(name: string, records: Record<string, unknown>[]): boolean {
  const lower = name.toLowerCase().replace(/-/g, '_');
  if (lower === 'id' || lower.endsWith('_id') || /(^|_)(id|uuid|guid)$/.test(lower)) return true;
  const n = records.length;
  if (n <= 50) return false;
  const vals = new Set(records.map((r) => r[name]).filter((v) => v != null && v !== ''));
  return vals.size / n > 0.95;
}

const MIN_UNIQUE = 20;

function privacyFeatureColumns(records: Record<string, unknown>[], types: ColTypes): string[] {
  if (!records.length) return [];
  const n = records.length;
  const minUniq = Math.min(MIN_UNIQUE, Math.max(3, Math.floor(n * 0.15)));
  return Object.keys(records[0] || {}).filter((c) => {
    if (isIdentifierColumn(c, records)) return false;
    const raw = records.map((r) => r[c]).filter((v) => v != null && v !== '');
    if (!raw.length) return false;
    const nums = raw.filter(
      (v) => typeof v === 'number' || (typeof v === 'string' && String(v).trim() !== '' && !Number.isNaN(Number(v))),
    );
    const isNum = types[c] === 'num' || nums.length / raw.length > 0.9;
    if (!isNum) return false;
    const nUniq = new Set(nums.map((v) => String(Number(v)))).size;
    return nUniq >= minUniq;
  });
}

/**
 * Composite privacy score 0–100 (higher = more private).
 *
 * Mirrors the backend `compute_privacy_score` in privacy_metrics.py.
 * Used as a fallback when the report doesn't include a backend-computed score.
 *
 * Components
 * ----------
 * Reid component  : reid_pct / 100, clamped [0, 1]
 * NNDR component  : nndr ≥ 1 → 0; [0.5, 1) → linear 0–1; < 0.5 → 1; unknown → 0.5
 * Score = round(100 × (1 – 0.5×reid – 0.5×nndr))
 * Grade : A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F < 40
 */
export function computePrivacyScore(
  reidPct: number | string | null | undefined,
  nndr: number | string | null | undefined,
): { score: number; grade: string } {
  const reid = Math.max(0, Math.min(1, (parseFloat(String(reidPct ?? 0)) || 0) / 100));

  const n = parseFloat(String(nndr ?? ''));
  let nndrComp: number;
  if (isNaN(n)) {
    nndrComp = 0.5;
  } else if (n >= 1.0) {
    nndrComp = 0.0;
  } else if (n >= 0.5) {
    nndrComp = (1.0 - n) / 0.5;
  } else {
    nndrComp = 1.0;
  }

  const penalty = 0.5 * reid + 0.5 * nndrComp;
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - penalty))));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { score, grade };
}

export function privacyStatusFromReid(reidPct: number | string | null | undefined): 'PASS' | 'WARN' | 'FAIL' {
  const reid = parseFloat(String(reidPct ?? 0)) || 0;
  if (reid > 20) return 'FAIL';
  if (reid >= 5) return 'WARN';
  return 'PASS';
}

export function computeCombinedStatus(
  fidelityStatus: string | null | undefined,
  reidPct: number | string | null | undefined,
): 'PASS' | 'WARN' | 'FAIL' {
  const priv = privacyStatusFromReid(reidPct);
  const rank: Record<string, number> = { PASS: 0, WARN: 1, FAIL: 2 };
  const worst = Math.max(rank[fidelityStatus || ''] ?? 2, rank[priv] ?? 2);
  return worst === 0 ? 'PASS' : worst === 1 ? 'WARN' : 'FAIL';
}

export function computePrivacyMetrics(
  realIn: Record<string, unknown>[],
  synthIn: Record<string, unknown>[],
  types: ColTypes,
): PrivacyMetrics {
  let real = realIn;
  let synth = synthIn;
  if (real?.length && synth?.length) {
    const realKeys = new Set(Object.keys(real[0] || {}));
    const shared = Object.keys(synth[0] || {}).filter((c) => realKeys.has(c));
    if (shared.length) {
      real = real.map((r) => {
        const o: Record<string, unknown> = {};
        shared.forEach((c) => {
          o[c] = r[c];
        });
        return o;
      });
      synth = synth.map((r) => {
        const o: Record<string, unknown> = {};
        shared.forEach((c) => {
          o[c] = r[c];
        });
        return o;
      });
    }
  }

  const numCols = privacyFeatureColumns(real, types);
  if (!numCols.length || !real.length || !synth.length) {
    return {
      reidCount: null,
      reidPct: null,
      plausibleCount: null,
      plausiblePct: null,
      nndr: null,
      status: 'PASS',
      reason: 'no_numeric_qi',
    };
  }

  const MAX_REAL = 200;
  if (real.length > MAX_REAL) {
    const step = Math.floor(real.length / MAX_REAL);
    real = real.filter((_, i) => i % step === 0).slice(0, MAX_REAL);
  }

  const ranges: Record<string, number> = {};
  numCols.forEach((c) => {
    const vals = real
      .map((r) => r[c])
      .filter((v) => v != null && !Number.isNaN(Number(v)))
      .map(Number);
    if (!vals.length) {
      ranges[c] = 1;
      return;
    }
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    ranges[c] = mx - mn || 1;
  });

  function dist(a: Record<string, unknown>, b: Record<string, unknown>): number {
    let d = 0;
    let cnt = 0;
    numCols.forEach((c) => {
      const av = a[c];
      const bv = b[c];
      if (av != null && bv != null && !Number.isNaN(Number(av)) && !Number.isNaN(Number(bv))) {
        d += Math.abs(Number(av) - Number(bv)) / ranges[c]!;
        cnt++;
      }
    });
    return cnt ? d / cnt : Infinity;
  }

  const realToReal: number[] = [];
  real.forEach((rr, i) => {
    let minD = Infinity;
    real.forEach((rr2, j) => {
      if (i !== j) {
        const d = dist(rr, rr2);
        if (d < minD) minD = d;
      }
    });
    realToReal.push(minD);
  });
  const medRR = median(realToReal);
  const EPS = medRR != null ? Math.max(0.005, Math.min(0.05, 0.5 * medRR)) : 0.02;
  const DELTA = medRR != null ? Math.max(EPS * 3, 2.0 * medRR) : 0.15;

  let reidCount = 0;
  let plausibleCount = 0;
  const synthToReal: number[] = [];
  synth.forEach((sr) => {
    let minD = Infinity;
    real.forEach((rr) => {
      const d = dist(sr, rr);
      if (d < minD) minD = d;
    });
    synthToReal.push(minD);
    if (minD < EPS) reidCount++;
    else if (minD <= DELTA) plausibleCount++;
  });

  const medSR = median(synthToReal);
  const nndr = medSR != null && medRR != null && medRR > 0 ? medSR / medRR : null;
  const n = synth.length;
  return {
    reidCount,
    reidPct: ((reidCount / n) * 100).toFixed(1),
    plausibleCount,
    plausiblePct: ((plausibleCount / n) * 100).toFixed(1),
    nndr: nndr != null ? nndr.toFixed(2) : null,
    status: privacyStatusFromReid((reidCount / n) * 100),
  };
}
