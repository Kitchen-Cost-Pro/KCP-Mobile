import { AuthLayout } from './AuthLayout';

export function BootScreen() {
  return (
    <AuthLayout compact>
      <div className="boot-panel" aria-live="polite">
        <div className="spinner" />
        <h1>Preparing your workspace</h1>
        <p>Restoring your secure KCP session.</p>
      </div>
    </AuthLayout>
  );
}
