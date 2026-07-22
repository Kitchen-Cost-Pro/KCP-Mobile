import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, ClipboardCheck, ClipboardList, Factory, Home, MapPin, MoreHorizontal, PackageCheck, PackageSearch, RefreshCw, ScanBarcode, ShoppingCart, Trash2, Truck, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../core/auth/AuthProvider';
import { hasPermission, hasSectionAccess } from '../core/permissions/permissions';
import { useConnectivity } from '../hooks/useConnectivity';
import { useNativeLifecycle } from '../hooks/useNativeLifecycle';
import type { AppRoute, KcpLocation } from '../types/kcp';
import { LocationPicker } from '../components/LocationPicker';
import { HomeScreen } from '../features/home/HomeScreen';
import { InsightsScreen } from '../features/home/InsightsScreen';
import { StockTakeScreen } from '../features/stock-takes/StockTakeScreen';
import { ManufacturingScreen } from '../features/manufacturing/ManufacturingScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { StockLookupScreen } from '../features/scan/StockLookupScreen';
import { WastageScreen } from '../features/wastage/WastageScreen';
import { TransfersScreen } from '../features/transfers/TransfersScreen';
import { ReceivingScreen } from '../features/receiving/ReceivingScreen';
import { PurchaseOrdersScreen } from '../features/purchase-orders/PurchaseOrdersScreen';
import { LowStockScreen, type LowStockPurchaseOrderIntent } from '../features/low-stock/LowStockScreen';
import type { StockLookupSeed } from '../features/scan/StockLookupScreen';
import { KcpFlowScreen } from '../features/tasks/TasksScreen';
import { ApprovalsScreen } from '../features/approvals/ApprovalsScreen';
import { initializeNotifications } from '../core/notifications/notificationService';
import { deferDeepLink, parseDeepLink, takePendingDeepLink, type DeepLinkIntent } from '../core/navigation/deepLinks';
import { setMonitoringUser } from '../core/monitoring/monitoring';
import { parseQuickAccess, reconcileQuickAccess, toggleQuickAccess, type QuickAccessRoute } from '../core/navigation/quickAccess';
import { filterRoleSetLocations } from '../features/role-sets/roleSetModel';
import { recordActionLifecycle, type ActionLifecycleEvent } from '../features/flow/actionApi';
import type { KcpAction } from '../features/flow/actionModel';
import { routeForAction } from '../features/today/actionRouting';
import { actionLifecycleQueue } from '../features/flow/actionLifecycleQueue';

function locationStorageKey(workspaceId: string) {
  return `kcp-mobile:location:${workspaceId}`;
}

function quickAccessStorageKey(workspaceId: string, userId: string) {
  return `kcp-mobile:quick-access:${workspaceId}:${userId}`;
}

type ShortcutOption = {
  id: QuickAccessRoute;
  label: string;
  navLabel: string;
  icon: LucideIcon;
  visible: boolean;
};

export function AppShell() {
  const auth = useAuth();
  const connected = useConnectivity();
  const [route, setRoute] = useState<AppRoute>('home');
  const [lookupSeed, setLookupSeed] = useState<StockLookupSeed | null>(null);
  const [purchaseOrderPreload, setPurchaseOrderPreload] = useState<LowStockPurchaseOrderIntent | null>(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [recordTarget, setRecordTarget] = useState<DeepLinkIntent | null>(null);
  const [activeFlowAction, setActiveFlowAction] = useState<KcpAction | null>(null);
  const [pushAlert, setPushAlert] = useState<{title:string;body:string;deepLink:string}|null>(null);
  const access = auth.workspaceBootstrap!.access;
  const featureFlags = auth.workspaceBootstrap!.featureFlags;
  const roleSet = auth.workspaceBootstrap!.roleSet;
  const locations = useMemo(() => filterRoleSetLocations(access.accessibleLocations, roleSet), [access.accessibleLocations, roleSet]);
  const [selectedLocation, setSelectedLocation] = useState<KcpLocation | null>(null);
  const [quickRoutes, setQuickRoutes] = useState<QuickAccessRoute[]>([]);

  const availableShortcuts = useMemo(() => ([
    { id: 'tasks', label: 'KCP Flow', navLabel: 'Flow', icon: ClipboardList, visible: featureFlags.tasks && hasSectionAccess(access, 'tasks') },
    { id: 'approvals', label: 'Approvals', navLabel: 'Approvals', icon: BadgeCheck, visible: featureFlags.approvals && hasSectionAccess(access, 'approvals') },
    { id: 'stock-takes', label: 'Stock Take', navLabel: 'Stock Take', icon: ClipboardCheck, visible: featureFlags.stockCount && hasSectionAccess(access, 'stock-takes') },
    { id: 'wastage', label: 'Record Wastage', navLabel: 'Waste', icon: Trash2, visible: featureFlags.wastage && hasSectionAccess(access, 'wastage') },
    { id: 'transfers', label: 'Transfers', navLabel: 'Transfers', icon: Truck, visible: featureFlags.transfers && hasSectionAccess(access, 'transfers') },
    { id: 'manufacturing', label: 'Manufacturing', navLabel: 'Make', icon: Factory, visible: featureFlags.manufacturing && hasSectionAccess(access, 'manufacturing') },
    { id: 'receiving', label: 'Goods Receiving', navLabel: 'Receive', icon: PackageCheck, visible: featureFlags.receiving && hasSectionAccess(access, 'receiving') },
    { id: 'purchase-orders', label: 'Purchase Orders', navLabel: 'Orders', icon: ShoppingCart, visible: featureFlags.purchaseOrders && hasSectionAccess(access, 'purchase-orders') },
    { id: 'scan', label: 'Stock Lookup', navLabel: 'Lookup', icon: ScanBarcode, visible: featureFlags.scan && hasSectionAccess(access, 'stock-lookup') },
    { id: 'low-stock', label: 'Low Stock', navLabel: 'Low Stock', icon: PackageSearch, visible: hasPermission(access, 'nav-dashboard') && hasPermission(access, 'nav-ingredients') }
  ] as ShortcutOption[]).filter((option) => option.visible), [access, featureFlags.approvals, featureFlags.manufacturing, featureFlags.purchaseOrders, featureFlags.receiving, featureFlags.scan, featureFlags.stockCount, featureFlags.tasks, featureFlags.transfers, featureFlags.wastage]);

  const quickAccessKey = quickAccessStorageKey(auth.workspace?.id || '', auth.user?.uid || '');
  useEffect(() => {
    let saved: string[] = [];
    try { const stored = window.localStorage.getItem(quickAccessKey); saved = stored ? parseQuickAccess(stored) : roleSet.defaultShortcuts; } catch { saved = roleSet.defaultShortcuts; }
    const next = reconcileQuickAccess(saved, availableShortcuts.map((option) => option.id));
    setQuickRoutes((current) => current.length === next.length && current.every((route, index) => route === next[index]) ? current : next);
    try { window.localStorage.setItem(quickAccessKey, JSON.stringify(next)); } catch { /* optional */ }
  }, [availableShortcuts, quickAccessKey, roleSet.defaultShortcuts]);

  const toggleShortcut = useCallback((shortcut: QuickAccessRoute) => {
    if (!availableShortcuts.some((option) => option.id === shortcut)) return;
    setQuickRoutes((current) => {
      const next = toggleQuickAccess(current, shortcut);
      try { window.localStorage.setItem(quickAccessKey, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  }, [availableShortcuts, quickAccessKey]);

  const openIntent = useCallback((intent: DeepLinkIntent) => {
    if (intent.workspaceId !== auth.workspace?.id) {
      const target = auth.workspaces.find((workspace) => workspace.id === intent.workspaceId);
      if (target) { deferDeepLink(intent); void auth.selectWorkspace(target); }
      return;
    }
    setRecordTarget(intent); setRoute(intent.route); window.scrollTo({ top: 0, behavior: 'instant' });
  }, [auth.selectWorkspace, auth.workspace?.id, auth.workspaces]);
  useEffect(() => {
    setMonitoringUser(auth.user?.uid || '');
    void initializeNotifications({ workspaceId: auth.workspace?.id || '', deviceId: auth.session?.deviceId || '', onIntent: openIntent });
    const listener=(event:Event)=>openIntent((event as CustomEvent<DeepLinkIntent>).detail);window.addEventListener('kcp:deep-link',listener);
    const initial=takePendingDeepLink()||parseDeepLink(window.location.href);if(initial)openIntent(initial);
    return()=>window.removeEventListener('kcp:deep-link',listener);
  },[auth.session?.deviceId,auth.user?.uid,auth.workspace?.id,openIntent]);
  useEffect(()=>{const listener=(event:Event)=>setPushAlert((event as CustomEvent<{title:string;body:string;deepLink:string}>).detail);window.addEventListener('kcp:push-received',listener);return()=>window.removeEventListener('kcp:push-received',listener);},[]);

  useEffect(() => {
    const workspaceId = auth.workspace?.id || '';
    let savedId = '';
    try { savedId = window.localStorage.getItem(locationStorageKey(workspaceId)) || ''; } catch { /* optional */ }
    const saved = locations.find((location) => location.id === savedId);
    const next = saved || locations.find((location) => location.isDefault) || (locations.length === 1 ? locations[0] : null);
    setSelectedLocation(next || null);
    if (!next && locations.length > 1) setLocationPickerOpen(true);
  }, [auth.workspace?.id, locations]);

  useEffect(() => {
    if (route === 'stock-takes' && (!featureFlags.stockCount || !hasSectionAccess(access, 'stock-takes'))) setRoute('home');
    if (route === 'wastage' && (!featureFlags.wastage || !hasSectionAccess(access, 'wastage'))) setRoute('home');
    if (route === 'scan' && (!featureFlags.scan || !hasSectionAccess(access, 'stock-lookup'))) setRoute('home');
    if (route === 'transfers' && (!featureFlags.transfers || !hasSectionAccess(access, 'transfers'))) setRoute('home');
    if (route === 'manufacturing' && (!featureFlags.manufacturing || !hasSectionAccess(access, 'manufacturing'))) setRoute('home');
    if (route === 'receiving' && (!featureFlags.receiving || !hasSectionAccess(access, 'receiving'))) setRoute('home');
    if (route === 'purchase-orders' && (!featureFlags.purchaseOrders || !hasSectionAccess(access, 'purchase-orders'))) setRoute('home');
    if (route === 'tasks' && (!featureFlags.tasks || !hasSectionAccess(access, 'tasks'))) setRoute('home');
    if (route === 'approvals' && (!featureFlags.approvals || !hasSectionAccess(access, 'approvals'))) setRoute('home');
    if (route === 'low-stock' && (!hasPermission(access, 'nav-dashboard') || !hasPermission(access, 'nav-ingredients'))) setRoute('home');
    if (route === 'insights' && !hasPermission(access, 'nav-dashboard')) setRoute('home');
  }, [access, featureFlags.approvals, featureFlags.manufacturing, featureFlags.purchaseOrders, featureFlags.receiving, featureFlags.scan, featureFlags.stockCount, featureFlags.tasks, featureFlags.transfers, featureFlags.wastage, route]);

  const chooseLocation = useCallback((location: KcpLocation) => {
    setSelectedLocation(location);
    setLocationPickerOpen(false);
    try { window.localStorage.setItem(locationStorageKey(auth.workspace?.id || ''), location.id); } catch { /* optional */ }
  }, [auth.workspace?.id]);
  useEffect(() => {
    if (recordTarget?.route !== 'low-stock') return;
    const location = locations.find((item) => item.id === recordTarget.recordId);
    if (location) chooseLocation(location);
  }, [chooseLocation, locations, recordTarget]);

  const navigate = useCallback((next: AppRoute) => {
    if (next !== 'scan') setLookupSeed(null);
    setRecordTarget(null);
    setActiveFlowAction(null);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const openTodayAction = useCallback((action: KcpAction, details = false) => {
    const targetRoute = details ? 'tasks' : routeForAction(action);
    const recordId = details || targetRoute === 'tasks' ? action.id : action.sourceRecord.id;
    const targetLocation = action.location ? locations.find((item) => item.id === action.location!.id || item.locationId === action.location!.id) : null;
    if (targetLocation) chooseLocation(targetLocation);
    setActiveFlowAction(action);
    setRecordTarget({ workspaceId: auth.workspace!.id, route: targetRoute as DeepLinkIntent['route'], recordId });
    setRoute(targetRoute);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (!details && !['waiting', 'completed', 'cancelled'].includes(action.status)) void recordActionLifecycle(auth.workspace!.id, action.id, 'start').catch(() => undefined);
  }, [auth.workspace, chooseLocation, locations]);
  const resolveFlowAction = useCallback(async (event: ActionLifecycleEvent, detail = '') => {
    if (!activeFlowAction) return;
    try { await recordActionLifecycle(auth.workspace!.id, activeFlowAction.id, event, detail); }
    catch { actionLifecycleQueue.add(auth.workspace!.id, auth.user!.uid, { actionId: activeFlowAction.id, event, detail }); }
    if (event !== 'start') setActiveFlowAction(null);
  }, [activeFlowAction, auth.user, auth.workspace]);
  useEffect(() => {
    if (!connected || !auth.workspace || !auth.user) return;
    let cancelled = false;
    void (async () => { for (const item of actionLifecycleQueue.list(auth.workspace!.id, auth.user!.uid)) { if (cancelled) return; try { await recordActionLifecycle(auth.workspace!.id, item.actionId, item.event, item.detail); actionLifecycleQueue.remove(auth.workspace!.id, auth.user!.uid, item.id); } catch { return; } } })();
    return () => { cancelled = true; };
  }, [auth.user, auth.workspace, connected, route]);
  const openLowStockLookup = useCallback((item: StockLookupSeed) => { setLookupSeed(item); setRoute('scan'); window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  const createLowStockOrder = useCallback((intent: LowStockPurchaseOrderIntent) => { setPurchaseOrderPreload(intent); setRoute('purchase-orders'); window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  const processPurchaseOrder = useCallback((orderId: string) => {
    setRecordTarget({ workspaceId: auth.workspace!.id, route: 'receiving', recordId: orderId });
    setRoute('receiving');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [auth.workspace]);
  const refresh = useCallback(() => { auth.refreshWorkspace(); }, [auth.refreshWorkspace]);
  useNativeLifecycle(route, navigate, refresh);

  const tabs = useMemo(() => {
    const chosen = quickRoutes.flatMap((shortcut) => {
      const option = availableShortcuts.find((item) => item.id === shortcut);
      return option ? [{ id: option.id as AppRoute, label: option.navLabel, icon: option.icon }] : [];
    });
    return [
      { id: 'home' as AppRoute, label: 'Today', icon: Home },
      ...chosen,
      { id: 'more' as AppRoute, label: 'More', icon: MoreHorizontal }
    ];
  }, [availableShortcuts, quickRoutes]);

  const content = route === 'insights'
    ? <InsightsScreen workspaceId={auth.workspace!.id} connected={connected} location={selectedLocation} access={access} featureFlags={featureFlags} financialVisibility={roleSet.financialVisibility} onNavigate={navigate} onLocation={() => setLocationPickerOpen(true)} />
    : route === 'stock-takes'
    ? <StockTakeScreen workspaceId={auth.workspace!.id} userId={auth.user!.uid} location={selectedLocation} onLocation={() => setLocationPickerOpen(true)} initialSourceId={activeFlowAction?.sourceRecord.id || ''} onActionEvent={resolveFlowAction} />
    : route === 'tasks'
      ? <KcpFlowScreen workspaceId={auth.workspace!.id} userId={auth.user!.uid} connected={connected} location={selectedLocation} roleSet={roleSet} onLocation={() => setLocationPickerOpen(true)} initialActionId={recordTarget?.route==='tasks'?recordTarget.recordId:''} />
    : route === 'approvals'
      ? <ApprovalsScreen workspaceId={auth.workspace!.id} userId={auth.user!.uid} connected={connected} location={selectedLocation} onLocation={() => setLocationPickerOpen(true)} initialApprovalId={recordTarget?.route==='approvals'?recordTarget.recordId:''} onActionEvent={resolveFlowAction} />
    : route === 'wastage'
      ? <WastageScreen
          workspaceId={auth.workspace!.id}
          userId={auth.user!.uid}
          location={selectedLocation}
          canSearchItems={hasSectionAccess(access, 'stock-lookup')}
          onLocation={() => setLocationPickerOpen(true)}
          onActionEvent={resolveFlowAction}
        />
    : route === 'low-stock'
      ? <LowStockScreen workspaceId={auth.workspace!.id} userId={auth.user!.uid} location={selectedLocation} canCreatePurchaseOrder={featureFlags.purchaseOrders && hasSectionAccess(access, 'purchase-orders')} onLocation={() => setLocationPickerOpen(true)} onLookup={openLowStockLookup} onCreatePurchaseOrder={createLowStockOrder} />
    : route === 'scan'
      ? <StockLookupScreen workspaceId={auth.workspace!.id} location={selectedLocation} initialItem={lookupSeed} onLocation={() => setLocationPickerOpen(true)} />
    : route === 'transfers'
      ? <TransfersScreen workspaceId={auth.workspace!.id} userId={auth.user!.uid} location={selectedLocation} onLocation={() => setLocationPickerOpen(true)} initialTransferId={recordTarget?.route==='transfers'?recordTarget.recordId:''} onActionEvent={resolveFlowAction} />
    : route === 'manufacturing'
      ? <ManufacturingScreen workspaceId={auth.workspace!.id} userId={auth.user!.uid} location={selectedLocation} onLocation={() => setLocationPickerOpen(true)} initialSourceId={activeFlowAction?.sourceRecord.id || ''} onActionEvent={resolveFlowAction} />
    : route === 'receiving'
      ? <ReceivingScreen workspaceId={auth.workspace!.id} userId={auth.user!.uid} initialOrderId={recordTarget?.route==='receiving'?recordTarget.recordId:''} onActionEvent={resolveFlowAction} />
    : route === 'purchase-orders'
      ? <PurchaseOrdersScreen workspaceId={auth.workspace!.id} userId={auth.user!.uid} workspaceName={auth.workspace!.siteName} preload={purchaseOrderPreload} onPreloadConsumed={() => setPurchaseOrderPreload(null)} initialOrderId={recordTarget?.route==='purchase-orders'?recordTarget.recordId:''} onReceive={processPurchaseOrder} onActionEvent={resolveFlowAction} />
      : route === 'more'
        ? <ProfileScreen
            displayName={auth.user?.displayName || 'Workspace User'}
            email={auth.user?.email || ''}
            workspaceId={auth.workspace!.id}
            deviceId={auth.session?.deviceId || ''}
            workspace={auth.workspace!}
            location={selectedLocation}
            access={access}
            roleSet={roleSet}
            canSwitchWorkspace={auth.workspaces.length > 1}
            busy={auth.busy}
            quickAccessOptions={availableShortcuts.map(({ id, label }) => ({ route: id, label }))}
            quickAccess={quickRoutes}
            onToggleQuickAccess={toggleShortcut}
            onLocation={() => setLocationPickerOpen(true)}
            onSwitchWorkspace={auth.showWorkspacePicker}
            onRefresh={auth.refreshWorkspace}
            onSignOut={auth.signOut}
          />
        : <HomeScreen
            name={auth.user?.displayName || ''}
            userId={auth.user?.uid || ''}
            workspaceId={auth.workspace?.id || ''}
            connected={connected}
            workspaceName={auth.workspace?.siteName || 'KCP Workspace'}
            workspaceLogo={auth.workspaceBootstrap?.theme.logoDataUrl || ''}
            location={selectedLocation}
            access={access}
            featureFlags={featureFlags}
            roleSet={roleSet}
            onNavigate={navigate}
            onLocation={() => setLocationPickerOpen(true)}
            onOpenAction={openTodayAction}
          />;

  return (
    <div className="mobile-shell">
      <div className="workspace-background" />
      {!connected && <div className="offline-banner" role="status"><WifiOff size={16} /> You’re offline. Operational submissions remain unavailable.</div>}
      {pushAlert && <button className="foreground-notification" type="button" onClick={()=>{const intent=parseDeepLink(pushAlert.deepLink);setPushAlert(null);if(intent)openIntent(intent);}}><strong>{pushAlert.title}</strong><span>{pushAlert.body}</span></button>}
      <header className="app-header">
        <div className="mini-brand"><span>KCP</span><small>Lite</small></div>
        <button className="header-location" type="button" onClick={() => setLocationPickerOpen(true)}>
          <MapPin size={15} /><span>{selectedLocation?.displayName || 'Location'}</span>
        </button>
        <button className="icon-button" type="button" onClick={auth.refreshWorkspace} disabled={auth.busy} aria-label="Refresh workspace">
          <RefreshCw size={19} className={auth.busy ? 'spin' : ''} />
        </button>
      </header>

      {auth.error && <button className="app-message message-error" role="alert" type="button" onClick={auth.clearMessage}>{auth.error}</button>}
      <main className="app-content">{content}</main>

      <nav className="bottom-nav" aria-label="Primary navigation" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button className={route === id ? 'is-active' : ''} type="button" key={id} onClick={() => navigate(id)} aria-current={route === id ? 'page' : undefined}>
            <Icon size={21} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <LocationPicker
        open={locationPickerOpen}
        locations={locations}
        selected={selectedLocation}
        onSelect={chooseLocation}
        onClose={() => setLocationPickerOpen(false)}
      />
    </div>
  );
}
