import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  CloudOff,
  FileClock,
  LoaderCircle,
  MapPin,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Save,
  ScanBarcode,
  Search,
  ShieldCheck,
  TriangleAlert
} from 'lucide-react';
import { ApiError } from '../../core/api/client';
import { useConnectivity } from '../../hooks/useConnectivity';
import { scanBarcodeWithDevice } from '../wastage/nativeBarcodeScanner';
import { normalizeKcpBarcode } from '../../core/barcodes/normalizeBarcode';
import { canSeeOperationalValues, type FinancialVisibility } from '../role-sets/roleSetModel';
import type {
  KcpLocation,
  StockCountDraft,
  StockCountHistoryItem,
  StockCountItem,
  StockCountLine,
  StockCountLocation,
  StockCountReconciliation,
  StockCountTemplate
} from '../../types/kcp';
import { countRecoveryStore, type StockCountRecovery } from './countRecoveryStore';
import {
  commitStockCount,
  createStockCount,
  getStockCount,
  listStockCountDrafts,
  listStockCountHistory,
  listStockCountTemplates,
  loadStockCountPackage,
  reconcileStockCount,
  saveStockCount,
  type StockCountCommitResult
} from './stockTakeApi';
import { isApprovalPending } from '../approvals/approvalSubmission';

type View = 'overview' | 'count' | 'review' | 'complete';
type CountBucket = 'pending' | 'counted';

type ActiveCount = {
  draft: StockCountDraft;
  template: Pick<StockCountTemplate, 'id' | 'name' | 'version' | 'scope'>;
  location: StockCountLocation;
  items: StockCountItem[];
  dirty: boolean;
  editVersion: number;
};

type Props = {
  workspaceId: string;
  userId: string;
  location: KcpLocation | null;
  onLocation: () => void;
  initialSourceId?: string;
  financialVisibility?: FinancialVisibility;
  onActionEvent?: (event: 'waiting' | 'complete' | 'reject', detail?: string) => Promise<void>;
};

const PAGE_SIZE = 50;

export function StockTakeScreen({ workspaceId, userId, location, onLocation, initialSourceId = '', financialVisibility = 'full', onActionEvent }: Props) {
  const connected = useConnectivity();
  const showMoney = canSeeOperationalValues(financialVisibility);
  const [barcode, setBarcode] = useState('');
  const [view, setView] = useState<View>('overview');
  const [templates, setTemplates] = useState<StockCountTemplate[]>([]);
  const [drafts, setDrafts] = useState<StockCountDraft[]>([]);
  const [history, setHistory] = useState<StockCountHistoryItem[]>([]);
  const [recovery, setRecovery] = useState<StockCountRecovery | null>(null);
  const [active, setActiveState] = useState<ActiveCount | null>(null);
  const activeRef = useRef<ActiveCount | null>(null);
  const savePromiseRef = useRef<Promise<ActiveCount | null> | null>(null);
  const [reconciliation, setReconciliation] = useState<StockCountReconciliation | null>(null);
  const [commitResult, setCommitResult] = useState<StockCountCommitResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [countBucket, setCountBucket] = useState<CountBucket>('pending');
  const [editingItemId, setEditingItemId] = useState('');
  const openedSource = useRef('');

  const assignActive = useCallback((next: ActiveCount | null) => {
    activeRef.current = next;
    setActiveState(next);
  }, []);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextTemplates, nextDrafts, nextHistory, nextRecovery] = await Promise.all([
        listStockCountTemplates(workspaceId),
        listStockCountDrafts(workspaceId),
        listStockCountHistory(workspaceId),
        countRecoveryStore.get(workspaceId, userId)
      ]);
      setTemplates(nextTemplates);
      setDrafts(nextDrafts);
      setHistory(nextHistory);
      setRecovery(nextRecovery?.draft.status === 'committed' ? null : nextRecovery);
    } catch (cause) {
      setError(message(cause, 'Could not load stock takes.'));
    } finally {
      setLoading(false);
    }
  }, [userId, workspaceId]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (!active || active.draft.status === 'committed') return;
    void countRecoveryStore.set({
      workspaceId,
      userId,
      draft: active.draft,
      template: active.template,
      location: active.location,
      items: active.items,
      dirty: active.dirty,
      updatedAt: new Date().toISOString()
    }).catch(() => undefined);
  }, [active, userId, workspaceId]);

  const startSave = useCallback((snapshot: ActiveCount) => {
    setSaving(true);
    const promise = saveStockCount(workspaceId, snapshot.draft.id, {
      templateId: snapshot.draft.templateId,
      templateVersion: snapshot.draft.templateVersion,
      locationId: snapshot.draft.locationId,
      lines: snapshot.draft.lines,
      expectedRevision: snapshot.draft.revision
    }).then((saved) => {
      const current = activeRef.current;
      if (!current || current.draft.id !== snapshot.draft.id) return current;
      const next: ActiveCount = {
        ...current,
        draft: {
          ...current.draft,
          revision: saved.revision,
          status: saved.status,
          savedAt: saved.savedAt
        },
        dirty: current.editVersion !== snapshot.editVersion
      };
      assignActive(next);
      setNotice(next.dirty ? 'Saving latest changes…' : 'Draft saved');
      return next;
    }).catch((cause) => {
      setError(message(cause, 'Could not save this count. Your changes remain securely on this device.'));
      throw cause;
    }).finally(() => {
      savePromiseRef.current = null;
      setSaving(false);
    });
    savePromiseRef.current = promise;
    return promise;
  }, [assignActive, workspaceId]);

  const flushDraft = useCallback(async () => {
    if (!connected) throw new Error('Reconnect before saving or reviewing this count.');
    while (activeRef.current?.dirty) {
      if (savePromiseRef.current) await savePromiseRef.current;
      else await startSave(activeRef.current);
    }
    return activeRef.current;
  }, [connected, startSave]);

  useEffect(() => {
    if (view !== 'count' || !active?.dirty || !connected || saving) return;
    const timeout = window.setTimeout(() => { void flushDraft().catch(() => undefined); }, 1200);
    return () => window.clearTimeout(timeout);
  }, [active?.dirty, active?.editVersion, connected, flushDraft, saving, view]);

  useEffect(() => {
    if (notice !== 'Draft saved') return;
    const timeout = window.setTimeout(() => setNotice(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const templatesAtLocation = useMemo(() => {
    if (!location) return [];
    return templates.filter((template) => template.linkedLocations.some((linked) => linked.id === location.id));
  }, [location, templates]);

  const startCount = useCallback(async (template: StockCountTemplate) => {
    if (!connected) { setError('Connect to KCP before starting a new stock take.'); return; }
    if (!location || !template.linkedLocations.some((linked) => linked.id === location.id)) {
      setError('Choose one of this template’s authorised locations first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const countPackage = await loadStockCountPackage(workspaceId, template.id, location.id);
      if (!countPackage.location) throw new Error('KCP did not return a count location.');
      const lines = countPackage.items.map(emptyLine);
      const created = await createStockCount(workspaceId, {
        templateId: template.id,
        templateVersion: countPackage.template.version,
        locationId: countPackage.location.id,
        lines
      });
      const next: ActiveCount = {
        draft: {
          id: created.sessionId,
          templateId: template.id,
          templateVersion: countPackage.template.version,
          locationId: countPackage.location.id,
          lines,
          revision: created.revision,
          status: created.status,
          savedAt: created.savedAt
        },
        template: countPackage.template,
        location: countPackage.location,
        items: countPackage.items,
        dirty: false,
        editVersion: 0
      };
      assignActive(next);
      setSearch('');
      setVisibleLimit(PAGE_SIZE);
      setCountBucket('pending');
      setEditingItemId('');
      setNotice('Draft started');
      setView('count');
    } catch (cause) {
      setError(message(cause, 'Could not start this stock take.'));
    } finally {
      setBusy(false);
    }
  }, [assignActive, connected, location, workspaceId]);

  const resumeCount = useCallback(async (draft: StockCountDraft) => {
    if (!connected) {
      const local = await countRecoveryStore.get(workspaceId, userId);
      if (local?.draft.id === draft.id) {
        assignActive({
          draft: local.draft,
          template: local.template,
          location: local.location,
          items: local.items,
          dirty: local.dirty,
          editVersion: 0
        });
        setView('count');
        return;
      }
      setError('Reconnect to download this stock take.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const serverDraft = await getStockCount(workspaceId, draft.id);
      const countPackage = await loadStockCountPackage(workspaceId, serverDraft.templateId, serverDraft.locationId);
      if (!countPackage.location) throw new Error('The draft location is no longer available.');
      const local = await countRecoveryStore.get(workspaceId, userId);
      const useLocal = Boolean(
        local?.draft.id === serverDraft.id &&
        local.dirty &&
        local.draft.revision >= serverDraft.revision
      );
      const sourceLines = useLocal && local ? local.draft.lines : serverDraft.lines;
      const next: ActiveCount = {
        draft: {
          ...serverDraft,
          lines: mergeLines(countPackage.items, sourceLines),
          revision: serverDraft.revision
        },
        template: countPackage.template,
        location: countPackage.location,
        items: countPackage.items,
        dirty: useLocal,
        editVersion: 0
      };
      assignActive(next);
      setSearch('');
      setVisibleLimit(PAGE_SIZE);
      setCountBucket('pending');
      setEditingItemId('');
      setNotice(useLocal ? 'Recovered unsaved device changes' : 'Draft resumed');
      setView('count');
    } catch (cause) {
      setError(message(cause, 'Could not resume this stock take.'));
    } finally {
      setBusy(false);
    }
  }, [assignActive, connected, userId, workspaceId]);

  useEffect(() => {
    if (!initialSourceId || loading || openedSource.current === initialSourceId) return;
    const draft = drafts.find((item) => item.id === initialSourceId);
    const template = templatesAtLocation.find((item) => item.id === initialSourceId);
    if (!draft && !template) return;
    openedSource.current = initialSourceId;
    if (draft) void resumeCount(draft); else if (template) void startCount(template);
  }, [drafts, initialSourceId, loading, resumeCount, startCount, templatesAtLocation]);

  const updateLine = useCallback((stockItemId: string, updater: (line: StockCountLine) => StockCountLine) => {
    const current = activeRef.current;
    if (!current) return;
    const next: ActiveCount = {
      ...current,
      draft: {
        ...current.draft,
        status: 'server_draft',
        lines: current.draft.lines.map((line) => line.stockItemId === stockItemId ? updater(line) : line)
      },
      dirty: true,
      editVersion: current.editVersion + 1
    };
    assignActive(next);
    setReconciliation(null);
    setConfirmed(false);
    setNotice(connected ? 'Unsaved changes' : 'Saved securely on this device');
  }, [assignActive, connected]);

  const reviewCount = useCallback(async () => {
    if (!connected) { setError('Reconnect before reviewing and submitting this count.'); return; }
    setBusy(true);
    setError('');
    try {
      const saved = await flushDraft();
      if (!saved) throw new Error('No active count was found.');
      const result = await reconcileStockCount(workspaceId, saved.draft.id);
      setReconciliation(result);
      setConfirmed(false);
      setView('review');
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (cause) {
      setError(message(cause, 'Could not prepare this count for review.'));
    } finally {
      setBusy(false);
    }
  }, [connected, flushDraft, workspaceId]);

  const submitCount = useCallback(async () => {
    const current = activeRef.current;
    if (!current || !reconciliation || !confirmed) return;
    if (!connected) { setError('Reconnect before submitting this count.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await commitStockCount(
        workspaceId,
        current.draft.id,
        reconciliation.reconciliationVersion
      );
      if (isApprovalPending(result)) {
        await onActionEvent?.('waiting', `Awaiting approval ${result.requestId}`);
        await countRecoveryStore.clear(workspaceId, userId);
        setRecovery(null);
        assignActive(null);
        setNotice(`Stock-take variance submitted for approval (${result.requestId}). Stock has not changed.`);
        setConfirmed(false);
        setReconciliation(null);
        setView('overview');
        await loadOverview();
        return;
      }
      // A retry after a lost response is idempotent. The Worker intentionally returns a
      // compact duplicate response, so retain the already-reviewed totals for the receipt.
      const completeResult: StockCountCommitResult = {
        ...result,
        committedAt: result.committedAt || new Date().toISOString(),
        countedItemCount: result.countedItemCount ?? reconciliation.countedItemCount,
        netVarianceValue: result.netVarianceValue ?? reconciliation.netVarianceValue,
        currency: result.currency || reconciliation.currency
      };
      const committed: ActiveCount = {
        ...current,
        dirty: false,
        draft: {
          ...current.draft,
          status: 'committed',
          committedAt: completeResult.committedAt,
          serverTransactionId: completeResult.transactionId
        }
      };
      assignActive(committed);
      setCommitResult(completeResult);
      await countRecoveryStore.clear(workspaceId, userId);
      setRecovery(null);
      setView('complete');
      await onActionEvent?.('complete', completeResult.transactionId);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (cause) {
      setError(message(cause, 'Could not submit this stock take. It remains saved as a draft.'));
    } finally {
      setBusy(false);
    }
  }, [assignActive, confirmed, connected, loadOverview, onActionEvent, reconciliation, userId, workspaceId]);

  const backToOverview = useCallback(async () => {
    if (connected && activeRef.current?.dirty) await flushDraft().catch(() => undefined);
    assignActive(null);
    setReconciliation(null);
    setCommitResult(null);
    setView('overview');
    await loadOverview();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [assignActive, connected, flushDraft, loadOverview]);

  const counted = active?.draft.lines.filter((line) => line.counted).length || 0;
  const pending = Math.max(0, (active?.items.length || 0) - counted);
  const filteredItems = useMemo(() => {
    if (!active) return [];
    const query = search.trim().toLowerCase();
    if (!query) return active.items;
    return active.items.filter((item) => [item.name, item.sku, item.category, ...item.barcodes]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [active, search]);
  const bucketItems = useMemo(() => {
    if (!active) return [];
    const countedById = new Map(active.draft.lines.map((line) => [line.stockItemId, line.counted]));
    return filteredItems.filter((item) => {
      const isCounted = countedById.get(item.id) === true;
      if (countBucket === 'counted') return isCounted;
      return !isCounted || editingItemId === item.id;
    });
  }, [active, countBucket, editingItemId, filteredItems]);

  // Scan-to-count: match a scanned/typed barcode against the loaded count items
  // locally (so it works offline), then surface that item's card ready for entry.
  // A barcode registered against a custom UOM points the counter at that unit.
  const resolveCountBarcode = useCallback((raw: string) => {
    const current = activeRef.current;
    if (!current) return;
    const code = normalizeKcpBarcode(raw);
    if (!code) { setError('Scan or enter a barcode first.'); return; }
    let matchedUom = '';
    const match = current.items.find((candidate) => {
      if (candidate.barcodes.some((value) => normalizeKcpBarcode(value) === code)) return true;
      const uom = candidate.uoms.find((entry) => entry.barcode && normalizeKcpBarcode(entry.barcode) === code);
      if (uom) { matchedUom = uom.name; return true; }
      return false;
    });
    if (!match) { setError('That barcode is not on this stock take.'); return; }
    setError('');
    setBarcode('');
    setSearch(match.name);
    setVisibleLimit(PAGE_SIZE);
    setCountBucket('pending');
    setEditingItemId(match.id);
    setNotice(`${match.name} ready · enter ${matchedUom || match.baseUom}`);
    window.setTimeout(() => {
      const card = document.getElementById(`count-card-${match.id}`);
      if (typeof card?.scrollIntoView === 'function') card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
    }, 60);
  }, []);

  const scanToCount = useCallback(async () => {
    try { const value = await scanBarcodeWithDevice(); setBarcode(value); resolveCountBarcode(value); }
    catch (cause) { setError(message(cause, 'Barcode scan was cancelled.')); }
  }, [resolveCountBarcode]);

  if (view === 'count' && active) {
    return (
      <CountEntryView
        active={active}
        items={bucketItems.slice(0, visibleLimit)}
        totalFiltered={bucketItems.length}
        counted={counted}
        pending={pending}
        bucket={countBucket}
        connected={connected}
        busy={busy}
        saving={saving}
        error={error}
        notice={notice}
        search={search}
        barcode={barcode}
        onScan={() => { void scanToCount(); }}
        onBarcode={setBarcode}
        onResolveBarcode={resolveCountBarcode}
        onSearch={(value) => { setSearch(value); setVisibleLimit(PAGE_SIZE); }}
        onBucket={(value) => { setCountBucket(value); setEditingItemId(''); setVisibleLimit(PAGE_SIZE); }}
        onBack={() => { void backToOverview(); }}
        onSave={() => { setError(''); void flushDraft().catch(() => undefined); }}
        onReview={() => { void reviewCount(); }}
        onUpdateLine={updateLine}
        onEditing={setEditingItemId}
        onFinishEditing={(stockItemId) => setEditingItemId((current) => current === stockItemId ? '' : current)}
        onMore={() => setVisibleLimit((value) => value + PAGE_SIZE)}
      />
    );
  }

  if (view === 'review' && active && reconciliation) {
    return (
      <ReviewView
        active={active}
        reconciliation={reconciliation}
        confirmed={confirmed}
        connected={connected}
        busy={busy}
        error={error}
        showMoney={showMoney}
        onConfirmed={setConfirmed}
        onBack={() => { setError(''); setView('count'); }}
        onSubmit={() => { void submitCount(); }}
      />
    );
  }

  if (view === 'complete' && active && commitResult) {
    return <CompleteView active={active} result={commitResult} showMoney={showMoney} onDone={() => { void backToOverview(); }} />;
  }

  return (
    <div className="screen module-screen stock-take-overview">
      <header className="module-hero">
        <span className="module-icon"><ClipboardCheck size={27} /></span>
        <p className="eyebrow">Live mobile stock control</p>
        <h1>Stock Takes</h1>
        <p>Count, save, review and post directly to the authoritative KCP stock ledger.</p>
        <button className="location-pill" type="button" onClick={onLocation}>
          <MapPin size={15} /> {location?.displayName || 'Choose a location'} <ArrowRight size={15} />
        </button>
      </header>

      {error && <div className="message message-error stock-message" role="alert">{error}</div>}
      {!connected && <div className="sync-state is-offline"><CloudOff size={17} /> Connect to start or resume a server draft.</div>}

      {recovery && !drafts.some((draft) => draft.id === recovery.draft.id) && (
        <section className="recovery-card">
          <div className="recovery-icon"><ShieldCheck size={20} /></div>
          <div><strong>Recovered device draft</strong><p>{recovery.template.name} · {recovery.location.name}</p></div>
          <button className="button button-quiet button-small" type="button" onClick={() => { void resumeCount(recovery.draft); }}>Resume</button>
        </section>
      )}

      <section className="section-block">
        <div className="section-title">
          <div><p className="eyebrow">Current location</p><h2>Start a new count</h2></div>
          {loading && <LoaderCircle className="spin" size={19} />}
        </div>
        {!location ? (
          <button className="empty-action" type="button" onClick={onLocation}><MapPin size={22} /><strong>Choose a location first</strong><span>Templates are filtered by your authorised location.</span></button>
        ) : templatesAtLocation.length ? (
          <div className="template-list">
            {templatesAtLocation.map((template) => (
              <article className="template-card" key={template.id}>
                <span className="template-icon"><ClipboardCheck size={21} /></span>
                <div><strong>{template.name}</strong><p>{template.scope === 'items' ? 'Selected stock items' : 'Category count'} · {location.displayName}</p></div>
                <button className="button button-primary button-small" type="button" disabled={busy || !connected} onClick={() => { void startCount(template); }}>Start</button>
              </article>
            ))}
          </div>
        ) : !loading ? (
          <div className="placeholder-panel"><div className="placeholder-icon"><PackageSearch size={22} /></div><div><strong>No templates for this location</strong><p>Choose another authorised location or assign a stock-take template in KCP.</p></div></div>
        ) : null}
      </section>

      <section className="section-block">
        <div className="section-title"><div><p className="eyebrow">Saved securely</p><h2>Active drafts</h2></div><span className="count-badge">{drafts.length}</span></div>
        <div className="draft-list">
          {drafts.map((draft) => {
            const template = templates.find((entry) => entry.id === draft.templateId);
            const draftLocation = template?.linkedLocations.find((entry) => entry.id === draft.locationId);
            const localDirty = recovery?.draft.id === draft.id && recovery.dirty;
            return (
              <button className="draft-card" type="button" key={draft.id} disabled={busy} onClick={() => { void resumeCount(draft); }}>
                <span className="draft-icon"><FileClock size={20} /></span>
                <span><strong>{template?.name || 'Stock count draft'}</strong><small>{draftLocation?.name || draft.locationId} · {countedLines(draft.lines)} counted{localDirty ? ' · device changes pending' : ''}</small></span>
                <ArrowRight size={18} />
              </button>
            );
          })}
          {!drafts.length && !loading && <div className="empty-inline bordered">No active stock-take drafts.</div>}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title"><div><p className="eyebrow">Posted to KCP</p><h2>Recent counts</h2></div><button className="icon-button small-icon" type="button" onClick={() => { void loadOverview(); }} aria-label="Refresh stock takes"><RefreshCw size={17} /></button></div>
        <div className="history-list">
          {history.map((entry) => (
            <article className="history-card" key={entry.id}>
              <span className="history-check"><Check size={16} /></span>
              <div><strong>{entry.transactionReference || entry.templateName || 'Stock take'}</strong><p>{entry.locationName || entry.locationId} · {formatDate(entry.timestamp)}</p></div>
              <small>{entry.lineCount ?? entry.items?.length ?? 0} items</small>
            </article>
          ))}
          {!history.length && !loading && <div className="empty-inline bordered">No posted stock takes yet.</div>}
        </div>
      </section>
    </div>
  );
}

type CountEntryProps = {
  active: ActiveCount;
  items: StockCountItem[];
  totalFiltered: number;
  counted: number;
  pending: number;
  bucket: CountBucket;
  connected: boolean;
  busy: boolean;
  saving: boolean;
  error: string;
  notice: string;
  search: string;
  barcode: string;
  onScan: () => void;
  onBarcode: (value: string) => void;
  onResolveBarcode: (value: string) => void;
  onSearch: (value: string) => void;
  onBucket: (value: CountBucket) => void;
  onBack: () => void;
  onSave: () => void;
  onReview: () => void;
  onUpdateLine: (stockItemId: string, updater: (line: StockCountLine) => StockCountLine) => void;
  onEditing: (stockItemId: string) => void;
  onFinishEditing: (stockItemId: string) => void;
  onMore: () => void;
};

function CountEntryView(props: CountEntryProps) {
  const lines = useMemo(() => new Map(props.active.draft.lines.map((line) => [line.stockItemId, line])), [props.active.draft.lines]);
  const percent = props.active.items.length ? Math.round((props.counted / props.active.items.length) * 100) : 0;
  const listRef = useRef<HTMLDivElement | null>(null);
  const doneAndNext = (stockItemId: string) => {
    props.onFinishEditing(stockItemId);
    window.setTimeout(() => listRef.current?.querySelector<HTMLInputElement>('.count-item-card input')?.focus(), 0);
  };
  return (
    <div className="screen count-entry-screen">
      <header className="count-header">
        <button className="icon-button" type="button" onClick={props.onBack} aria-label="Back to stock takes"><ArrowLeft size={19} /></button>
        <div><p className="eyebrow">{props.active.location.name}</p><h1>{props.active.template.name}</h1></div>
        <button className="icon-button" type="button" disabled={!props.connected || !props.active.dirty || props.saving} onClick={props.onSave} aria-label="Save draft">{props.saving ? <LoaderCircle className="spin" size={19} /> : <Save size={19} />}</button>
      </header>

      <div className="count-progress-card">
        <div><strong>{props.counted} of {props.active.items.length}</strong><span>{percent}% counted</span></div>
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
        <p className={`save-copy ${!props.connected ? 'is-offline' : ''}`}>
          {!props.connected ? <><CloudOff size={14} /> Device recovery active</> : props.saving ? <><Cloud size={14} /> Saving…</> : <><Check size={14} /> {props.notice || 'Server draft current'}</>}
        </p>
      </div>

      {props.error && <div className="message message-error stock-message" role="alert">{props.error}</div>}

      <div className="count-scan-row">
        <button className="count-scan" type="button" onClick={props.onScan} disabled={props.busy}><ScanBarcode size={20} /><span><strong>Scan an item</strong><small>Jump to its card and enter the quantity</small></span></button>
        <div className="manual-barcode count-manual-barcode"><input aria-label="Barcode" value={props.barcode} onChange={(event) => props.onBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') props.onResolveBarcode(props.barcode); }} placeholder="Enter barcode" /><button type="button" onClick={() => props.onResolveBarcode(props.barcode)}>Find</button></div>
      </div>

      <label className="count-search">
        <Search size={18} />
        <input type="search" placeholder={`Search ${props.bucket === 'pending' ? 'items to count' : 'counted items'}`} value={props.search} onChange={(event) => props.onSearch(event.target.value)} />
      </label>

      <div className="count-bucket-tabs" role="tablist" aria-label="Stock count buckets">
        <button type="button" role="tab" aria-label={`To Count ${props.pending}`} aria-selected={props.bucket === 'pending'} className={props.bucket === 'pending' ? 'is-active' : ''} onClick={() => props.onBucket('pending')}><span>To Count</span><strong>{props.pending}</strong></button>
        <button type="button" role="tab" aria-label={`Counted ${props.counted}`} aria-selected={props.bucket === 'counted'} className={props.bucket === 'counted' ? 'is-active' : ''} onClick={() => props.onBucket('counted')}><span>Counted</span><strong>{props.counted}</strong></button>
      </div>

      <div className="count-item-list" ref={listRef}>
        {props.items.map((item, index) => {
          const line = lines.get(item.id) || emptyLine(item);
          return <CountItemCard
            key={item.id}
            item={item}
            line={line}
            position={index + 1}
            bucket={props.bucket}
            onChange={(updater) => props.onUpdateLine(item.id, updater)}
            onEditing={() => props.onEditing(item.id)}
            onFinishEditing={() => props.onFinishEditing(item.id)}
            onDoneAndNext={() => doneAndNext(item.id)}
          />;
        })}
        {!props.items.length && props.bucket === 'pending' && !props.search && props.pending === 0 && (
          <div className="count-bucket-complete"><CheckCircle2 size={27} /><strong>Everything is counted</strong><p>Review the completed count before posting it to KCP.</p><button className="button button-primary" type="button" disabled={!props.connected || !props.counted || props.busy} onClick={props.onReview}>Review stock take</button></div>
        )}
        {!props.items.length && (props.bucket === 'counted' || props.search || props.pending > 0) && <div className="empty-inline bordered">No {props.bucket === 'pending' ? 'items to count' : 'counted items'} match this search.</div>}
      </div>

      {props.items.length < props.totalFiltered && <button className="button button-secondary load-more" type="button" onClick={props.onMore}>Show more items</button>}

      <div className="count-footer">
        <div><strong>{props.counted}</strong><span>counted</span></div>
        <button className="button button-primary" type="button" disabled={!props.connected || !props.counted || props.busy} onClick={props.onReview}>
          {props.busy ? <LoaderCircle className="spin" size={18} /> : <ClipboardCheck size={18} />} Review count
        </button>
      </div>
    </div>
  );
}

function CountItemCard({ item, line, position, bucket, onChange, onEditing, onFinishEditing, onDoneAndNext }: {
  item: StockCountItem;
  line: StockCountLine;
  position: number;
  bucket: CountBucket;
  onChange: (updater: (line: StockCountLine) => StockCountLine) => void;
  onEditing: () => void;
  onFinishEditing: () => void;
  onDoneAndNext: () => void;
}) {
  const provisional = line.baseQuantity + line.uoms.reduce((sum, entry) => {
    const uom = item.uoms.find((candidate) => candidate.name === entry.name);
    return sum + entry.quantity * Number(uom?.quantityInBase || 0);
  }, 0);
  return (
    <article
      id={`count-card-${item.id}`}
      className={`count-item-card ${line.counted ? 'is-counted' : ''}`}
      onFocusCapture={onEditing}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) onFinishEditing();
      }}
    >
      <header>
        <span className="item-position">{line.counted ? <Check size={15} /> : position}</span>
        <div><strong>{item.name}</strong><p>{item.category || 'Uncategorised'}{item.sku ? ` · ${item.sku}` : ''}</p></div>
        {line.counted && <span className="counted-badge">Counted</span>}
      </header>
      <div className="quantity-grid">
        <QuantityField
          label={item.baseUom}
          value={line.counted ? line.baseQuantity : null}
          onValue={(value) => {
            onEditing();
            onChange((current) => ({ ...current, baseQuantity: value ?? 0, counted: value !== null || current.uoms.some((entry) => entry.quantity !== 0) }));
          }}
        />
        {item.uoms.map((uom) => {
          const entry = line.uoms.find((candidate) => candidate.name === uom.name);
          return <QuantityField
            key={uom.id}
            label={uom.name}
            hint={`× ${formatQuantity(uom.quantityInBase)} ${item.baseUom}`}
            value={entry ? entry.quantity : null}
            onValue={(value) => {
              onEditing();
              onChange((current) => {
                const remaining = current.uoms.filter((candidate) => candidate.name !== uom.name);
                if (value !== null) remaining.push({ name: uom.name, quantity: value });
                return {
                  ...current,
                  uoms: remaining,
                  counted: value !== null || current.counted || current.baseQuantity !== 0
                };
              });
            }}
          />;
        })}
      </div>
      <div className="item-total">
        <span>Provisional total</span><strong>{line.counted ? `${formatQuantity(provisional)} ${item.baseUom}` : 'Not counted'}</strong>
      </div>
      {line.counted && (
        <div className="counted-card-actions">
          <button className="clear-count-button" type="button" onClick={() => onChange(() => emptyLine(item))}><RotateCcw size={13} /> Mark as uncounted</button>
          {bucket === 'pending' && <button className="done-count-button" type="button" onClick={onDoneAndNext}><Check size={14} /> Done &amp; next</button>}
        </div>
      )}
      <details className="item-note">
        <summary>Add a note</summary>
        <input type="text" value={line.note || ''} maxLength={180} placeholder="Optional counting note" onChange={(event) => onChange((current) => ({ ...current, note: event.target.value }))} />
      </details>
    </article>
  );
}

function QuantityField({ label, hint, value, onValue }: { label: string; hint?: string; value: number | null; onValue: (value: number | null) => void }) {
  return (
    <label className="quantity-field">
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
      <input
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        placeholder="—"
        value={value === null ? '' : String(value)}
        onChange={(event) => {
          if (event.target.value === '') { onValue(null); return; }
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next >= 0) onValue(next);
        }}
        aria-label={`${label} quantity`}
      />
    </label>
  );
}

function ReviewView({ active, reconciliation, confirmed, connected, busy, error, showMoney, onConfirmed, onBack, onSubmit }: {
  active: ActiveCount;
  reconciliation: StockCountReconciliation;
  confirmed: boolean;
  connected: boolean;
  busy: boolean;
  error: string;
  showMoney: boolean;
  onConfirmed: (value: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const blocked = reconciliation.blockingErrors.length > 0;
  return (
    <div className="screen review-screen">
      <header className="count-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back to count"><ArrowLeft size={19} /></button>
        <div><p className="eyebrow">Final review</p><h1>{active.template.name}</h1></div><span />
      </header>
      {error && <div className="message message-error stock-message" role="alert">{error}</div>}
      <section className="review-summary">
        <div><span>Counted</span><strong>{reconciliation.countedItemCount}</strong></div>
        <div><span>Uncounted</span><strong>{reconciliation.uncountedItemCount}</strong></div>
        {showMoney && <div className={reconciliation.netVarianceValue < 0 ? 'negative' : reconciliation.netVarianceValue > 0 ? 'positive' : ''}><span>Net variance</span><strong>{formatMoney(reconciliation.netVarianceValue, reconciliation.currency)}</strong></div>}
      </section>

      {blocked && <div className="blocking-panel"><TriangleAlert size={20} /><div><strong>Submission blocked</strong>{reconciliation.blockingErrors.map((entry) => <p key={entry}>{entry}</p>)}</div></div>}
      {reconciliation.warnings.length > 0 && <div className="warning-panel"><TriangleAlert size={18} /><span>{reconciliation.warnings.join(' ')}</span></div>}

      <section className="section-block">
        <div className="section-title"><div><p className="eyebrow">Server-authoritative</p><h2>Variance by item</h2></div></div>
        <div className="variance-list">
          {reconciliation.lines.map((line) => (
            <article className="variance-card" key={line.stockItemId}>
              <div><strong>{line.name}</strong><p>{formatQuantity(line.countedBaseQuantity)} counted · {formatQuantity(line.expectedQuantity)} expected</p></div>
              {showMoney ? <span className={line.varianceValue < 0 ? 'negative' : line.varianceValue > 0 ? 'positive' : ''}>{formatMoney(line.varianceValue, reconciliation.currency)}</span> : <span className={line.varianceQuantity < 0 ? 'negative' : line.varianceQuantity > 0 ? 'positive' : ''}>{formatQuantity(line.varianceQuantity)}</span>}
            </article>
          ))}
        </div>
      </section>

      <label className="commit-confirmation">
        <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} />
        <span><strong>I confirm this stock take</strong><small>{reconciliation.uncountedItemCount ? `${reconciliation.uncountedItemCount} uncounted items will not be posted. ` : ''}Submission updates the live KCP stock ledger and cannot be casually undone.</small></span>
      </label>
      <button className="button button-primary button-large" type="button" disabled={!confirmed || blocked || !connected || busy} onClick={onSubmit}>
        {busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />} Submit to KCP
      </button>
    </div>
  );
}

function CompleteView({ active, result, showMoney, onDone }: { active: ActiveCount; result: StockCountCommitResult; showMoney: boolean; onDone: () => void }) {
  return (
    <div className="screen complete-screen">
      <section className="complete-card">
        <span className="complete-icon"><CheckCircle2 size={35} /></span>
        <p className="eyebrow">Posted successfully</p>
        <h1>Stock take complete</h1>
        <p>{active.template.name} at {active.location.name} is now reflected in KCP.</p>
        <div className="transaction-reference"><span>Transaction reference</span><strong>{result.transactionId}</strong></div>
        <div className="complete-stats"><div><strong>{result.countedItemCount}</strong><span>items</span></div>{showMoney && <div><strong>{formatMoney(result.netVarianceValue, result.currency)}</strong><span>net variance</span></div>}</div>
        <button className="button button-primary button-large" type="button" onClick={onDone}>Return to stock takes</button>
      </section>
    </div>
  );
}

function emptyLine(item: StockCountItem): StockCountLine {
  return { stockItemId: item.id, baseQuantity: 0, uoms: [], note: '', counted: false };
}

function mergeLines(items: StockCountItem[], lines: StockCountLine[] = []) {
  const byId = new Map(lines.map((line) => [line.stockItemId, line]));
  return items.map((item) => {
    const line = byId.get(item.id);
    return line ? {
      ...emptyLine(item),
      ...line,
      baseQuantity: Number(line.baseQuantity || 0),
      uoms: Array.isArray(line.uoms) ? line.uoms : [],
      counted: line.counted === true
    } : emptyLine(item);
  });
}

function countedLines(lines: StockCountLine[] = []) {
  return lines.filter((line) => line.counted).length;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatMoney(value: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(date);
}

function message(cause: unknown, fallback: string) {
  if (cause instanceof ApiError && cause.message) return cause.message;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
