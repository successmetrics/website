/** Coarse synthesis steps — never show method names (GAN, copula, epochs). */
export const PROGRESS_STEPS = 8;

const SEARCH_PROGRESS =
  /^(trial\s+\d+\s+of\s+\d+|validating(\s+\d+\s+of\s+\d+)?|validating winner|searching(\s+\d+\s+trials)?|starting search|baseline evaluation)$/i;

export function jobStepLabel(status?: string, progress?: number, message?: string): string {
  const st = (status || '').toLowerCase();
  const msg = (message || '').trim();
  const lower = msg.toLowerCase();
  if (st === 'cancelled' || st === 'canceled' || lower === 'cancelled' || lower === 'canceled') {
    return 'cancelled';
  }
  if (st === 'done' || lower === 'complete') return 'complete';
  if (st === 'error' || lower === 'failed') return 'failed';
  if (st === 'queued' || lower === 'queued') return 'queued';
  if (SEARCH_PROGRESS.test(msg) || /^step\s+\d+$/i.test(msg)) return msg;
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  const step = Math.max(1, Math.min(PROGRESS_STEPS, Math.ceil(p * PROGRESS_STEPS) || 1));
  return `Step ${step}`;
}
