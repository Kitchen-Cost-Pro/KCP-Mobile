import { useMemo, useState } from 'react';
import { ArrowRight, Building2, LogOut, Search } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import { AuthLayout } from '../auth/AuthLayout';

export function WorkspaceSelectScreen() {
  const auth = useAuth();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return auth.workspaces.filter((workspace) => !needle || `${workspace.siteName} ${workspace.role}`.toLowerCase().includes(needle));
  }, [auth.workspaces, query]);

  return (
    <AuthLayout>
      <header className="auth-heading">
        <p className="eyebrow">Your KCP workspaces</p>
        <h1>Where are you working?</h1>
        <p>Select a workspace to load your locations and permissions.</p>
      </header>
      {auth.error && <div className="message message-error" role="alert">{auth.error}</div>}
      {auth.workspaces.length > 3 && (
        <label className="input-shell workspace-search">
          <Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspaces" />
        </label>
      )}
      <div className="workspace-list">
        {filtered.map((workspace) => (
          <button className="workspace-card" type="button" key={workspace.id} onClick={() => auth.selectWorkspace(workspace)} disabled={auth.busy}>
            <span className="workspace-icon"><Building2 size={21} /></span>
            <span><strong>{workspace.siteName}</strong><small>{workspace.role.replace(/[-_]/g, ' ')}</small></span>
            <ArrowRight size={19} />
          </button>
        ))}
        {!filtered.length && <div className="empty-inline">No workspaces match your search.</div>}
      </div>
      <button className="button button-secondary" type="button" onClick={auth.signOut} disabled={auth.busy}><LogOut size={18} /> Sign out</button>
    </AuthLayout>
  );
}
