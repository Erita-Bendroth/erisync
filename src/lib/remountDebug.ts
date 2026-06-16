/**
 * Lightweight remount/state diagnostic logger.
 *
 * Enable in browser DevTools:
 *   sessionStorage.setItem('schedule-debug-remounts', '1')
 * Optional isolation toggles:
 *   sessionStorage.setItem('schedule-debug-freeze-context-loading', '1')
 *   sessionStorage.setItem('schedule-debug-disable-schedule-user-context-effect', '1')
 *
 * All logs are no-ops unless the main flag is enabled, so production noise
 * stays minimal.
 */

const MAIN_FLAG = 'schedule-debug-remounts';

function flag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(name) === '1';
  } catch {
    return false;
  }
}

export function isRemountDebugEnabled(): boolean {
  return flag(MAIN_FLAG);
}

export function isFreezeContextLoadingEnabled(): boolean {
  return flag('schedule-debug-freeze-context-loading');
}

export function isDisableScheduleUserContextEffectEnabled(): boolean {
  return flag('schedule-debug-disable-schedule-user-context-effect');
}

let counter = 0;
export function newInstanceId(prefix: string): string {
  counter += 1;
  return `${prefix}#${counter}`;
}

function ts(): string {
  const d = new Date();
  return d.toISOString().substring(11, 23);
}

export function rlog(scope: string, event: string, data?: Record<string, unknown>) {
  if (!isRemountDebugEnabled()) return;
  const visibility =
    typeof document !== 'undefined' ? document.visibilityState : 'n/a';
  // eslint-disable-next-line no-console
  console.log(
    `[remount ${ts()}] [${scope}] ${event}`,
    { visibility, url: typeof window !== 'undefined' ? window.location.href : '', ...(data || {}) },
  );
}

let globalListenersInstalled = false;
export function installGlobalRemountListeners() {
  if (globalListenersInstalled) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!isRemountDebugEnabled()) return;
  globalListenersInstalled = true;

  document.addEventListener('visibilitychange', () => {
    rlog('global', 'visibilitychange', { state: document.visibilityState });
  });
  window.addEventListener('focus', () => rlog('global', 'window.focus'));
  window.addEventListener('blur', () => rlog('global', 'window.blur'));
  window.addEventListener('pageshow', (e) =>
    rlog('global', 'pageshow', { persisted: (e as PageTransitionEvent).persisted }),
  );
  window.addEventListener('pagehide', (e) =>
    rlog('global', 'pagehide', { persisted: (e as PageTransitionEvent).persisted }),
  );

  rlog('global', 'listeners installed');
}