import { useState } from 'react';
import { Building2, ChevronRight, FileText, LogOut, MapPin, RefreshCw, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import type { KcpLocation, WorkspaceOption } from '../../types/kcp';
import type { AccessSnapshot } from '../../types/kcp';
import { NotificationSettings } from './NotificationSettings';
import { QuickAccessSettings, type QuickAccessOption } from './QuickAccessSettings';
import type { QuickAccessRoute } from '../../core/navigation/quickAccess';
import type { RoleSet } from '../role-sets/roleSetModel';
import { clearReadSnapshots } from '../../core/offline/snapshotCache';

type Props = {
  displayName: string;
  email: string;
  workspaceId: string;
  deviceId: string;
  workspace: WorkspaceOption;
  location: KcpLocation | null;
  access: AccessSnapshot;
  roleSet: RoleSet;
  canSwitchWorkspace: boolean;
  busy: boolean;
  quickAccessOptions: QuickAccessOption[];
  quickAccess: QuickAccessRoute[];
  onToggleQuickAccess: (route: QuickAccessRoute) => void;
  onLocation: () => void;
  onSwitchWorkspace: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
};

export function ProfileScreen(props: Props) {
  const initials = props.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'K';
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const clearCache = async () => {
    setClearing(true);
    try { await clearReadSnapshots(); setCleared(true); props.onRefresh(); }
    finally { setClearing(false); }
  };
  return (
    <div className="screen profile-screen">
      <section className="profile-card">
        <div className="profile-avatar">{initials}</div>
        <div><p className="eyebrow">Signed in</p><h1>{props.displayName}</h1><p>{props.email}</p></div>
      </section>

      <QuickAccessSettings options={props.quickAccessOptions} selected={props.quickAccess} onToggle={props.onToggleQuickAccess} />

      <NotificationSettings workspaceId={props.workspaceId} deviceId={props.deviceId} onCurrentRevoked={props.onSignOut} />

      <section className="settings-group">
        <p className="settings-label">Workspace</p>
        <button className="settings-row" type="button" onClick={props.canSwitchWorkspace ? props.onSwitchWorkspace : undefined} aria-disabled={!props.canSwitchWorkspace}>
          <span className="settings-icon"><Building2 size={19} /></span>
          <span><strong>{props.workspace.siteName}</strong><small>{props.canSwitchWorkspace ? 'Switch workspace' : 'Current workspace'}</small></span>
          {props.canSwitchWorkspace && <ChevronRight size={18} />}
        </button>
        <button className="settings-row" type="button" onClick={props.onLocation}>
          <span className="settings-icon"><MapPin size={19} /></span>
          <span><strong>{props.location?.displayName || 'No location selected'}</strong><small>Current location</small></span>
          <ChevronRight size={18} />
        </button>
        <div className="settings-row static-row">
          <span className="settings-icon"><ShieldCheck size={19} /></span>
          <span><strong>{props.access.roleDefinition.label}</strong><small>{props.access.permissions.length} effective permissions</small></span>
        </div>
        <div className="settings-row static-row">
          <span className="settings-icon"><UserRound size={19} /></span>
          <span><strong>{props.roleSet.name}</strong><small>Role Set · {props.roleSet.financialVisibility.replace('_', ' ')} financial view</small></span>
        </div>
      </section>

      <section className="settings-group">
        <p className="settings-label">App</p>
        <button className="settings-row" type="button" onClick={props.onRefresh} disabled={props.busy}>
          <span className="settings-icon"><RefreshCw size={19} /></span>
          <span><strong>Refresh access</strong><small>Reload permissions, locations and theme</small></span>
          <ChevronRight size={18} />
        </button>
        <button className="settings-row" type="button" onClick={() => void clearCache()} disabled={clearing || props.busy}>
          <span className="settings-icon"><Trash2 size={19} /></span>
          <span><strong>Clear cached data</strong><small>{cleared ? 'Cleared · showing live data on next refresh' : 'Remove old offline snapshots (POs, tasks, low stock)'}</small></span>
          <ChevronRight size={18} />
        </button>
        <a className="settings-row" href="/terms.html" target="_blank" rel="noreferrer">
          <span className="settings-icon"><FileText size={19} /></span><span><strong>Terms of Service</strong><small>KCP legal terms</small></span><ChevronRight size={18} />
        </a>
        <a className="settings-row" href="/privacy.html" target="_blank" rel="noreferrer">
          <span className="settings-icon"><UserRound size={19} /></span><span><strong>Privacy Policy</strong><small>How KCP protects your information</small></span><ChevronRight size={18} />
        </a>
      </section>

      <button className="button button-danger button-large" type="button" onClick={props.onSignOut} disabled={props.busy}><LogOut size={19} /> Sign out</button>
      <p className="version-copy">KCP Lite · v0.20.0</p>
    </div>
  );
}
