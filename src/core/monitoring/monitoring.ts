const dsn = String(import.meta.env.VITE_SENTRY_DSN || '').trim();
type SentryModule = typeof import('@sentry/capacitor');
let sentry: Promise<SentryModule> | null = null;

function loadMonitoring() {
  if (!dsn) return null;
  sentry ||= Promise.all([import('@sentry/capacitor'), import('@sentry/react')]).then(([capacitor, react]) => {
    capacitor.init({
      dsn,
      release: 'kcp-lite@0.20.0',
      environment: import.meta.env.MODE,
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request) { delete event.request.cookies; delete event.request.data; }
        if (event.user) event.user = { id: event.user.id };
        return event;
      }
    }, react.init);
    return capacitor;
  });
  return sentry;
}

export function initializeMonitoring() { void loadMonitoring(); }
export function captureOperationalError(error: unknown, context: Record<string, unknown> = {}) {
  void loadMonitoring()?.then((client) => client.withScope((scope) => {
    scope.setContext('operation', context);
    client.captureException(error);
  }));
}
export function setMonitoringUser(uid: string) { void loadMonitoring()?.then((client) => client.setUser(uid ? { id: uid } : null)); }
