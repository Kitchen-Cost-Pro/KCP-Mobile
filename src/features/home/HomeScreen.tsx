import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, BarChart3, Boxes, CheckCircle2, ClipboardCheck, Factory, LoaderCircle, PackageCheck, RefreshCw, ScanBarcode, ShoppingCart, Trash2, Truck } from 'lucide-react';
import type { AccessSnapshot, AppRoute, KcpLocation, MobileFeatureFlags } from '../../types/kcp';
import { hasPermission, hasSectionAccess } from '../../core/permissions/permissions';
import { OperationsDashboard } from './OperationsDashboard';
import type { RoleSet } from '../role-sets/roleSetModel';
import { BUILT_IN_ROLE_SETS } from '../role-sets/roleSetModel';
import { loadActions } from '../flow/actionApi';
import type { KcpAction } from '../flow/actionModel';
import { TodayActionCard } from '../today/TodayActionCard';
import { bucketTodayActions } from '../today/todayModel';
import { taskSnapshotStore } from '../tasks/taskSnapshotStore';

type Props = {
  name: string; userId?: string; workspaceName: string; workspaceLogo?: string; workspaceId?: string; connected?: boolean;
  location: KcpLocation | null; access: AccessSnapshot; featureFlags: MobileFeatureFlags; roleSet?: RoleSet;
  onNavigate: (route: AppRoute) => void; onLocation: () => void; onOpenAction?: (action: KcpAction, details?: boolean) => void;
};

export function HomeScreen({ name, userId = '', workspaceName, workspaceLogo = '', workspaceId = '', connected = true, location, access, featureFlags, roleSet, onNavigate, onLocation, onOpenAction }: Props) {
  const effectiveRoleSet = roleSet || BUILT_IN_ROLE_SETS.find((item) => item.id === 'owner-area-manager')!;
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  const [actions, setActions] = useState<KcpAction[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!workspaceId || !location || !featureFlags.tasks || !hasSectionAccess(access, 'tasks')) { setActions([]); return; }
    if (!connected) { setActions(taskSnapshotStore.get(workspaceId, userId, location.id)?.actions || []); return; }
    setLoading(true); setError('');
    try { setActions((await loadActions(workspaceId, location.id, signal)).actions); }
    catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Today could not load your KCP Flow Actions.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [access, connected, featureFlags.tasks, location, userId, workspaceId]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  const today = useMemo(() => bucketTodayActions(actions, effectiveRoleSet), [actions, effectiveRoleSet]);
  const quickTools = useMemo(() => operationalTools(access, featureFlags, effectiveRoleSet.id), [access, effectiveRoleSet.id, featureFlags]);
  const open = (action: KcpAction, details = false) => onOpenAction ? onOpenAction(action, details) : onNavigate('tasks');

  return <div className="screen home-screen today-screen">
    <section className="today-greeting"><WorkspaceLogo name={workspaceName} src={workspaceLogo} /><div><p>Good {greeting()}</p><h1>{firstName}</h1><span>{effectiveRoleSet.name} · {location?.displayName || workspaceName}</span></div><button className="icon-button" type="button" onClick={() => void refresh()} disabled={loading || !connected} aria-label="Refresh Today"><RefreshCw className={loading ? 'spin' : ''} size={18} /></button></section>
    {!connected && <div className="dashboard-stale">Offline · showing only previously loaded work</div>}{error && <div className="message message-error operation-message">{error}</div>}

    {loading && !actions.length ? <div className="today-loading"><LoaderCircle className="spin" /> Building your Today view…</div> : <>
      {today.resume && <TodaySection eyebrow="Resume" title="Continue where you left off"><TodayActionCard action={today.resume} roleSet={effectiveRoleSet} featured onPrimary={open} onSecondary={(item) => open(item, true)} /></TodaySection>}
      <TodaySection eyebrow="Now" title="Needs your attention" count={today.now.length} empty="Nothing urgent or overdue.">{today.now.map((action) => <TodayActionCard key={action.id} action={action} roleSet={effectiveRoleSet} onPrimary={open} onSecondary={(item) => open(item, true)} />)}</TodaySection>
      <TodaySection eyebrow="Next" title="Later this shift" count={today.next.length} empty="No more Actions due this shift.">{today.next.slice(0, 4).map((action) => <TodayActionCard key={action.id} action={action} roleSet={effectiveRoleSet} onPrimary={open} onSecondary={(item) => open(item, true)} />)}</TodaySection>
    </>}

    <TodaySection eyebrow={effectiveRoleSet.name} title="Quick Tools"><div className="today-tools">{quickTools.slice(0, 4).map(({ id, title, icon: Icon }) => <button type="button" key={id} onClick={() => onNavigate(id)}><span><Icon size={19} /></span><strong>{title}</strong></button>)}{!quickTools.length && <div className="today-empty"><Boxes size={20} /> No extra tools assigned.</div>}</div></TodaySection>

    {workspaceId && effectiveRoleSet.id !== 'team-member' && <TodaySection eyebrow="At a glance" title="Operational summary" action={<button type="button" onClick={() => onNavigate('insights')}>Open Insights</button>}><OperationsDashboard workspaceId={workspaceId} connected={connected} location={location} access={access} featureFlags={featureFlags} financialVisibility={effectiveRoleSet.financialVisibility} onNavigate={onNavigate} onLocation={onLocation} compact /></TodaySection>}

    <TodaySection eyebrow="Waiting" title="Submitted or blocked" count={today.waiting.length} empty="Nothing is waiting on someone else.">{today.waiting.slice(0, 3).map((action) => <TodayActionCard key={action.id} action={action} roleSet={effectiveRoleSet} onPrimary={open} onSecondary={(item) => open(item, true)} />)}</TodaySection>
    <TodaySection eyebrow="Recent activity" title="Completed Actions" count={today.completed.length} empty="No recently completed Actions."><div className="today-completed">{today.completed.map((action) => <button type="button" key={action.id} onClick={() => open(action, true)}><CheckCircle2 size={17} /><span><strong>{action.title}</strong><small>{action.location?.name || action.assignment.label}</small></span></button>)}</div></TodaySection>
  </div>;
}

function TodaySection({ eyebrow, title, count, action, empty, children }: { eyebrow: string; title: string; count?: number; action?: React.ReactNode; empty?: string; children?: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="today-section"><header><div><p className="eyebrow">{eyebrow}</p><h2>{title}{count != null && <span>{count}</span>}</h2></div>{action}</header>{hasChildren ? children : empty ? <div className="today-empty"><CheckCircle2 size={19} />{empty}</div> : null}</section>;
}

function operationalTools(access: AccessSnapshot, flags: MobileFeatureFlags, roleSetId: string) {
  const items = [
    flags.stockCount && hasSectionAccess(access, 'stock-takes') && { id: 'stock-takes' as AppRoute, title: 'Stock Take', icon: ClipboardCheck },
    flags.transfers && hasSectionAccess(access, 'transfers') && { id: 'transfers' as AppRoute, title: 'Transfers', icon: Truck },
    flags.receiving && hasSectionAccess(access, 'receiving') && { id: 'receiving' as AppRoute, title: 'Receive', icon: PackageCheck },
    flags.manufacturing && hasSectionAccess(access, 'manufacturing') && { id: 'manufacturing' as AppRoute, title: 'Manufacture', icon: Factory },
    flags.purchaseOrders && hasSectionAccess(access, 'purchase-orders') && { id: 'purchase-orders' as AppRoute, title: 'Purchase Orders', icon: ShoppingCart },
    flags.approvals && hasSectionAccess(access, 'approvals') && { id: 'approvals' as AppRoute, title: 'Approvals', icon: BadgeCheck },
    flags.wastage && hasSectionAccess(access, 'wastage') && { id: 'wastage' as AppRoute, title: 'Wastage', icon: Trash2 },
    flags.scan && hasSectionAccess(access, 'stock-lookup') && { id: 'scan' as AppRoute, title: 'Scan', icon: ScanBarcode },
    hasPermission(access, 'nav-dashboard') && { id: 'insights' as AppRoute, title: 'Insights', icon: BarChart3 }
  ].filter(Boolean) as Array<{ id: AppRoute; title: string; icon: typeof Boxes }>;
  return roleSetId === 'team-member' ? [] : items;
}

function WorkspaceLogo({ name, src }: { name: string; src: string }) {
  const [failed, setFailed] = useState(false); useEffect(() => setFailed(false), [src]);
  const fallback = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'KCP';
  return <div className={`hero-workspace-logo${src && !failed ? ' has-image' : ''}`} aria-label={`${name} workspace logo`}>{src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : <span aria-hidden="true">{fallback}</span>}</div>;
}
function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'; }
