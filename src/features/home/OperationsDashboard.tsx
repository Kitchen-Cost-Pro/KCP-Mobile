import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, Boxes, ChevronDown, CircleDollarSign, ClipboardCheck, Clock3, Filter, LoaderCircle, PackageSearch, RefreshCw, Trash2, Truck } from 'lucide-react';
import { hasPermission, hasSectionAccess } from '../../core/permissions/permissions';
import type { AccessSnapshot, AppRoute, KcpLocation, MobileFeatureFlags } from '../../types/kcp';
import { loadMobileDashboard, type DashboardAttention, type DashboardMetric, type MobileDashboard } from './dashboardApi';
import type { FinancialVisibility } from '../role-sets/roleSetModel';

type Props = {
  workspaceId: string;
  connected: boolean;
  location: KcpLocation | null;
  access: AccessSnapshot;
  featureFlags: MobileFeatureFlags;
  onNavigate: (route: AppRoute) => void;
  onLocation?: () => void;
  financialVisibility?: FinancialVisibility;
  compact?: boolean;
};

export function OperationsDashboard({ workspaceId, connected, location, access, featureFlags, onNavigate, onLocation, financialVisibility = 'full', compact = false }: Props) {
  const [dashboard, setDashboard] = useState<MobileDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async (signal?: AbortSignal, manual = false) => {
    if (!connected) { setLoading(false); return; }
    if (manual) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setDashboard(await loadMobileDashboard(workspaceId, location?.id || '', signal));
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Today’s KCP dashboard could not be loaded.');
    } finally {
      if (!signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [connected, location?.id, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const metrics = useMemo(() => dashboard ? metricEntries(dashboard).filter((entry) => entry.metric.available && metricVisible(entry.key, financialVisibility)).slice(0, compact ? 4 : undefined) : [], [compact, dashboard, financialVisibility]);

  if (loading && !dashboard) return <section className="live-dashboard dashboard-loading"><LoaderCircle className="spin" size={20} /> Loading today’s KCP activity…</section>;
  if (!dashboard) return <section className="live-dashboard dashboard-unavailable"><AlertTriangle size={20} /><div><strong>{connected ? 'Live dashboard unavailable' : 'Connect for today’s dashboard'}</strong><p>{error || 'Metrics and activity require a connection to KCP.'}</p>{connected && <button type="button" onClick={() => void reload(undefined, true)}><RefreshCw size={15} /> Retry</button>}</div></section>;

  return (
    <section className={`live-dashboard${compact ? ' is-compact' : ''}`} aria-label={compact ? 'Compact operational summary' : 'Today’s operations dashboard'}>
      {!compact && <div className="dashboard-filters" aria-label="Dashboard filters">
        <div className="dashboard-filter"><span>Location</span><button type="button" onClick={onLocation} disabled={!onLocation}><strong>{location?.displayName || 'All locations'}</strong><ChevronDown size={18} /></button></div>
        <div className="dashboard-filter"><span>Date range</span><button type="button" aria-label="Date range: Today" aria-disabled="true"><strong>Today</strong><ChevronDown size={18} /></button></div>
      </div>}
      {!compact && <header className="live-dashboard-header">
        <div><Filter size={17} /><small>{dashboard.scope.locationName} · {dashboard.period.tradingDayLabel}</small></div>
        <button type="button" onClick={() => void reload(undefined, true)} disabled={!connected || refreshing} aria-label="Refresh live dashboard"><RefreshCw className={refreshing ? 'spin' : ''} size={18} /></button>
      </header>}

      {!connected && <div className="dashboard-stale">Offline · showing the last loaded snapshot</div>}
      {error && <div className="dashboard-stale is-error">{error}</div>}

      {metrics.length
        ? <div className="dashboard-metrics">{metrics.map(({ key, metric, icon: Icon }) => <article className={`metric-${key}`} key={key}><header><small>{metric.label}</small><span><Icon size={18} /></span></header><strong>{formatMetric(metric, key)}</strong><p>{key === 'grossSales' || key === 'netSales' || key === 'theoreticalFoodCost' || key === 'wastageValue' ? 'No comparison' : 'Live total'}</p></article>)}</div>
        : <div className="dashboard-empty"><BarChart3 size={20} /> No dashboard metrics are available for this scope.</div>}

      {!compact && !!dashboard.attention.length && <div className="dashboard-block"><div className="dashboard-block-title"><span>Needs attention</span><b>{dashboard.attention.length}</b></div><div className="attention-list">{dashboard.attention.map((item) => <AttentionCard key={item.id} item={item} route={attentionRoute(item, access, featureFlags)} onNavigate={onNavigate} />)}</div></div>}

      {!compact && <div className="dashboard-block"><div className="dashboard-block-title"><span>Recent activity</span><Clock3 size={16} /></div><div className="activity-list">{dashboard.recentActivity.length ? dashboard.recentActivity.map((item) => <article key={`${item.eventType}:${item.id}`}><span>{activityIcon(item.eventType)}</span><div><strong>{item.title}</strong><small>{item.locationName}</small></div><time dateTime={item.occurredAt}>{item.displayTime || relativeDate(item.occurredAt)}</time></article>) : <div className="dashboard-empty"><Clock3 size={19} /> No recent activity in this scope.</div>}</div></div>}
    </section>
  );
}

function AttentionCard({ item, route, onNavigate }: { item: DashboardAttention; route: AppRoute | null; onNavigate: (route: AppRoute) => void }) {
  const content = <><span className={`attention-icon severity-${item.severity}`}>{attentionIcon(item.type)}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div>{item.count != null && <b>{item.count}</b>}{route && <ArrowRight size={16} />}</>;
  return route
    ? <button type="button" onClick={() => onNavigate(route)}>{content}</button>
    : <article>{content}</article>;
}

function metricEntries(value: MobileDashboard): Array<{ key: string; metric: DashboardMetric; icon: typeof BarChart3 }> {
  return [
    { key: 'grossSales', metric: value.metrics.grossSales, icon: CircleDollarSign },
    { key: 'netSales', metric: value.metrics.netSales, icon: BarChart3 },
    { key: 'theoreticalFoodCost', metric: value.metrics.theoreticalFoodCost, icon: Boxes },
    { key: 'foodCostPercent', metric: value.metrics.foodCostPercent, icon: BarChart3 },
    { key: 'wastageValue', metric: value.metrics.wastageValue, icon: Trash2 },
    { key: 'lowStockCount', metric: value.metrics.lowStockCount, icon: PackageSearch },
    { key: 'pendingTransfers', metric: value.metrics.pendingTransfers, icon: Truck },
    { key: 'activeCountDrafts', metric: value.metrics.activeCountDrafts, icon: ClipboardCheck }
  ];
}
// Money/financial metrics (sales, food cost, wastage value) are shown only to full
// financial visibility. Operational counts (low stock, transfers, count drafts) are
// always visible, so a stock controller still sees their work without any values.
function metricVisible(key: string, visibility: FinancialVisibility) {
  const moneyMetrics = ['grossSales', 'netSales', 'theoreticalFoodCost', 'foodCostPercent', 'wastageValue'];
  return moneyMetrics.includes(key) ? visibility === 'full' : true;
}

function attentionRoute(item: DashboardAttention, access: AccessSnapshot, flags: MobileFeatureFlags): AppRoute | null {
  if (item.type === 'LOW_STOCK' && hasPermission(access, 'nav-dashboard') && hasPermission(access, 'nav-ingredients')) return 'low-stock';
  if (item.type === 'TRANSFER_AWAITING_ACCEPTANCE' && flags.transfers && hasSectionAccess(access, 'transfers')) return 'transfers';
  if (item.type === 'COUNT_DRAFT' && flags.stockCount && hasSectionAccess(access, 'stock-takes')) return 'stock-takes';
  return null;
}

function formatMetric(metric: DashboardMetric, key: string) {
  if (metric.value == null) return '—';
  if (key === 'foodCostPercent') return `${number(metric.value, 1)}%`;
  if (metric.currency === 'ZAR') return `R ${number(metric.value, 2)}`;
  return number(metric.value, 0);
}
function number(value: number, digits: number) { return new Intl.NumberFormat('en-ZA', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value); }
function attentionIcon(type: string) { if (type === 'LOW_STOCK') return <PackageSearch size={18} />; if (type === 'TRANSFER_AWAITING_ACCEPTANCE') return <Truck size={18} />; if (type === 'COUNT_DRAFT') return <ClipboardCheck size={18} />; return <AlertTriangle size={18} />; }
function activityIcon(type: string) { if (type.includes('TRANSFER')) return <Truck size={16} />; if (type === 'STOCK_COUNT') return <ClipboardCheck size={16} />; if (type === 'WASTAGE') return <Trash2 size={16} />; return <Boxes size={16} />; }
function relativeDate(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(parsed); }
