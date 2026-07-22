import { Clock3, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import { AuthLayout } from '../auth/AuthLayout';

export function PendingScreen() {
  const auth = useAuth();
  return (
    <AuthLayout compact>
      <div className="auth-icon"><Clock3 size={24} /></div>
      <header className="auth-heading">
        <p className="eyebrow">Workspace access</p>
        <h1>Almost there</h1>
        <p>{auth.notice || 'Your account is waiting for a workspace assignment.'}</p>
      </header>
      {auth.error && <div className="message message-error">{auth.error}</div>}
      <button className="button button-primary" type="button" onClick={auth.refreshAccount} disabled={auth.busy}><RefreshCw size={18} /> Check again</button>
      <button className="button button-secondary" type="button" onClick={auth.signOut} disabled={auth.busy}><LogOut size={18} /> Sign out</button>
    </AuthLayout>
  );
}
