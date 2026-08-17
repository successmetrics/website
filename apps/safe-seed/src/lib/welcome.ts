const NOTICE_PREFIX = 'ss_demo_notice_v1';
const TOUR_PREFIX = 'ss_tour_done';
export const PENDING_WELCOME = 'ss_pending_welcome';

function noticeKey(userId?: string | null) {
  return userId ? `${NOTICE_PREFIX}:${userId}` : NOTICE_PREFIX;
}

function tourKey(userId?: string | null) {
  return userId ? `${TOUR_PREFIX}:${userId}` : TOUR_PREFIX;
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function ssGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function ssRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function shouldShowDemoNotice(userId?: string | null): boolean {
  if (ssGet(PENDING_WELCOME) === '1') return true;
  return lsGet(noticeKey(userId)) !== '1';
}

export function markDemoNoticeSeen(userId?: string | null) {
  ssRemove(PENDING_WELCOME);
  lsSet(noticeKey(userId), '1');
}

export function isTourDone(userId?: string | null): boolean {
  return lsGet(tourKey(userId)) === '1';
}

export function markTourDone(userId?: string | null) {
  lsSet(tourKey(userId), '1');
}
