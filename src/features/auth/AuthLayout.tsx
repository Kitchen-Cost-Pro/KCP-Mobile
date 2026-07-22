import type { ReactNode } from 'react';

export function AuthLayout({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <main className="auth-shell">
      <div className="auth-glow" />
      <section className={`auth-card ${compact ? 'auth-card-compact' : ''}`}>
        <div className="brand-lockup" aria-label="Kitchen Cost Pro">
          <div className="brand-mark">KCP</div>
          <div>
            <strong>Kitchen Cost <span>Pro</span></strong>
            <small>Lite Mobile</small>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
