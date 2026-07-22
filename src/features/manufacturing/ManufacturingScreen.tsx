import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, ChevronRight, CloudOff, Factory, ListChecks, LoaderCircle, MapPin, PackageCheck, RefreshCw, RotateCcw, Search, ShieldCheck, TriangleAlert, Undo2, Wheat } from 'lucide-react';
import { OperationalLocationPicker, type OperationalLocationOption } from '../../components/OperationalLocationPicker';
import { ApiError } from '../../core/api/client';
import { createId } from '../../core/id/createId';
import { useConnectivity } from '../../hooks/useConnectivity';
import type { KcpLocation } from '../../types/kcp';
import {
  loadManufacturingBootstrap,
  loadManufacturingCatalog,
  postManufacturingRun,
  previewManufacturingRun,
  type ManufacturingBootstrap,
  type ManufacturingCatalogItem,
  type ManufacturingHistoryItem,
  type ManufacturingRunDraft,
  type ManufacturingRunEntry,
  type ManufacturingRunPreview,
  type ManufacturingRunResult
} from './manufacturingApi';
import { manufacturingRecoveryStore } from './manufacturingRecoveryStore';
import { isApprovalPending } from '../approvals/approvalSubmission';

type View = 'dashboard' | 'entry' | 'review' | 'complete';
type Props = { workspaceId: string; userId: string; location: KcpLocation | null; onLocation: () => void; initialSourceId?: string; onActionEvent?: (event: 'waiting' | 'complete' | 'reject', detail?: string) => Promise<void> };

export function ManufacturingScreen({ workspaceId, userId, location, onLocation, initialSourceId = '', onActionEvent }: Props) {
  const connected = useConnectivity();
  const [view, setView] = useState<View>('dashboard');
  const [bootstrap, setBootstrap] = useState<ManufacturingBootstrap | null>(null);
  const [catalog, setCatalog] = useState<ManufacturingCatalogItem[]>([]);
  const [draft, setDraft] = useState<ManufacturingRunDraft>(() => emptyDraft(location?.id || ''));
  const [preview, setPreview] = useState<ManufacturingRunPreview | null>(null);
  const [result, setResult] = useState<ManufacturingRunResult | null>(null);
  const [bucket, setBucket] = useState<'todo' | 'entered'>('todo');
  const [filter, setFilter] = useState('');
  const [locationPicker, setLocationPicker] = useState(false);
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const run = useCallback(async (action: () => Promise<void>, fallback: string) => {
    setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(message(cause, fallback)); } finally { setBusy(false); }
  }, []);

  const refresh = useCallback(async () => {
    if (!connected) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const next = await loadManufacturingBootstrap(workspaceId);
      setBootstrap(next);
      setDraft((current) => ({ ...current, locationId: current.locationId || preferredLocation(next, location?.id || '') }));
    } catch (cause) { setError(message(cause, 'Manufacturing could not be loaded.')); }
    finally { setLoading(false); }
  }, [connected, location?.id, workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    void manufacturingRecoveryStore.get(workspaceId, userId).then((recovery) => {
      if (!active) return;
      if (recovery) { setDraft(recovery.draft); if (recovery.catalog?.length) setCatalog(recovery.catalog); setNotice('Recovered your unfinished production run.'); }
      setRecoveryLoaded(true);
    });
    return () => { active = false; };
  }, [userId, workspaceId]);

  useEffect(() => {
    if (!recoveryLoaded || view === 'complete' || !Object.keys(draft.entries).length) return;
    void manufacturingRecoveryStore.set({ workspaceId, userId, draft, catalog, updatedAt: new Date().toISOString() }).catch(() => undefined);
  }, [catalog, draft, recoveryLoaded, userId, view, workspaceId]);

  const loadCatalog = useCallback(async (locationId: string) => {
    if (!connected || !locationId) return;
    setCatalogLoading(true); setError('');
    try { setCatalog(await loadManufacturingCatalog(workspaceId, locationId)); }
    catch (cause) { setError(message(cause, 'Manufactured items could not be loaded.')); }
    finally { setCatalogLoading(false); }
  }, [connected, workspaceId]);

  useEffect(() => { if (view === 'entry' && draft.locationId) void loadCatalog(draft.locationId); }, [draft.locationId, loadCatalog, view]);
  useEffect(() => { if (initialSourceId && view === 'dashboard' && recoveryLoaded) setView('entry'); }, [initialSourceId, recoveryLoaded, view]);
  useEffect(() => { const item = catalog.find((entry) => entry.id === initialSourceId); if (item) setFilter(item.name); }, [catalog, initialSourceId]);

  const selectedLocation = bootstrap?.locations.find((entry) => entry.id === draft.locationId) || null;
  const enteredCount = catalog.filter((item) => draft.entries[item.id]?.entered).length;
  const validEntries = useMemo(() => toPayload(draft), [draft]);
  const visible = useMemo(() => {
    const clean = filter.trim().toLocaleLowerCase();
    return catalog.filter((item) => Boolean(draft.entries[item.id]?.entered) === (bucket === 'entered'))
      .filter((item) => !clean || `${item.name} ${item.sku || ''} ${item.category}`.toLocaleLowerCase().includes(clean));
  }, [bucket, catalog, draft.entries, filter]);

  const updateEntry = (item: ManufacturingCatalogItem, field: 'batchCount' | 'actualQuantity' | 'note', value: string) => {
    setDraft((current) => {
      const existing = current.entries[item.id] || { batchCount: '', actualQuantity: '', note: '', entered: false };
      const next = { ...existing, [field]: value, entered: false };
      if (field === 'batchCount') {
        const oldExpected = Number(existing.batchCount) * item.batchYield;
        const newExpected = Number(value) * item.batchYield;
        if (!existing.actualQuantity || Number(existing.actualQuantity) === oldExpected) next.actualQuantity = newExpected > 0 ? String(round3(newExpected)) : '';
      }
      return { ...current, entries: { ...current.entries, [item.id]: next } };
    });
    setPreview(null); setConfirmed(false);
  };

  const markEntered = (item: ManufacturingCatalogItem) => {
    const entry = draft.entries[item.id];
    if (!item.hasBlueprint) { setError(`${item.name} needs a KCP blueprint before production can be recorded.`); return; }
    if (!(Number(entry?.batchCount) > 0) || !(Number(entry?.actualQuantity) > 0)) { setError(`Enter batches and actual output for ${item.name}.`); return; }
    setError('');
    setDraft((current) => ({ ...current, entries: { ...current.entries, [item.id]: { ...current.entries[item.id], entered: true } } }));
  };

  const returnToRecord = (itemId: string) => setDraft((current) => ({ ...current, entries: { ...current.entries, [itemId]: { ...current.entries[itemId], entered: false } } }));

  const startRun = () => { setView('entry'); setError(''); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const selectLocation = (next: OperationalLocationOption) => {
    if (Object.keys(draft.entries).length && next.id !== draft.locationId && !window.confirm('Changing location clears this production run because component availability is location-specific. Continue?')) return false;
    setDraft(emptyDraft(next.id)); setCatalog([]); setPreview(null); setBucket('todo'); setFilter(''); return true;
  };

  const requestPreview = () => void run(async () => {
    if (!connected) throw new Error('Reconnect before checking the production run.');
    if (!draft.locationId) throw new Error('Choose a production location.');
    if (!validEntries.length) throw new Error('Enter production for at least one manufactured item.');
    const next = await previewManufacturingRun(workspaceId, draft.locationId, validEntries);
    setPreview(next); setConfirmed(false); setView('review'); window.scrollTo({ top: 0, behavior: 'instant' });
  }, 'KCP could not preview this production run.');

  const submit = () => void run(async () => {
    if (!connected || !confirmed || !preview) throw new Error('Reconnect, review and confirm the current production run.');
    const committed = await postManufacturingRun(workspaceId, { idempotencyKey: draft.clientRunId, locationId: draft.locationId, entries: validEntries, previewToken: preview.previewToken, occurredAt: draft.occurredAt, confirm: true });
    await manufacturingRecoveryStore.clear(workspaceId, userId);
    if (isApprovalPending(committed)) { await onActionEvent?.('waiting', `Awaiting approval ${committed.requestId}`); setNotice(`Production exception submitted for approval (${committed.requestId}). Stock has not changed.`); setDraft(emptyDraft(draft.locationId)); setPreview(null); setConfirmed(false); setView('dashboard'); await refresh(); return; }
    setResult(committed); setView('complete'); window.scrollTo({ top: 0, behavior: 'instant' });
    await onActionEvent?.('complete', committed.runId);
  }, 'Production run could not be completed. It remains safely retryable.');

  const discard = async (nextView: View = 'dashboard') => {
    await manufacturingRecoveryStore.clear(workspaceId, userId);
    setDraft(emptyDraft(preferredLocation(bootstrap, location?.id || ''))); setCatalog([]); setPreview(null); setResult(null); setFilter(''); setBucket('todo'); setError(''); setNotice(''); setConfirmed(false); setView(nextView);
  };

  if ((loading && !bootstrap) || !recoveryLoaded) return <div className="screen operation-loading"><LoaderCircle className="spin" size={28} /><span>Loading production…</span></div>;
  if (view === 'complete' && result) return <RunComplete result={result} onDone={() => { void discard('dashboard').then(() => refresh()); }} />;
  if (view === 'review' && preview) return <RunReview preview={preview} connected={connected} busy={busy} confirmed={confirmed} error={error} onConfirmed={setConfirmed} onBack={() => setView('entry')} onRefresh={requestPreview} onSubmit={submit} />;

  if (view === 'entry') return <div className="screen manufacturing-run-screen">
    <header className="count-header"><button className="icon-button" type="button" onClick={() => setView('dashboard')} aria-label="Back to manufacturing"><ArrowLeft size={19} /></button><div><p className="eyebrow">Production run</p><h1>Record production</h1></div><span /></header>
    {!connected && <div className="sync-state is-offline"><CloudOff size={17} /> Continue entering saved values. Refresh, preview and posting require KCP.</div>}
    {error && <div className="message message-error operation-message" role="alert">{error}</div>}
    {notice && <div className="message message-success operation-message" role="status">{notice}</div>}
    <button className="manufacturing-run-location" type="button" onClick={() => setLocationPicker(true)}><span><MapPin size={19} /></span><span><small>Production location</small><strong>{selectedLocation?.name || 'Choose location'}</strong></span><ChevronRight size={18} /></button>
    <section className="manufacturing-progress"><div><strong>{enteredCount}</strong><span>of {catalog.length} entered</span></div><progress max={Math.max(catalog.length, 1)} value={enteredCount} /></section>
    <label className="input-shell manufacturing-list-filter"><Search size={18} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter the full manufactured list" aria-label="Filter manufactured items" /></label>
    <div className="count-tabs manufacturing-tabs"><button className={bucket === 'todo' ? 'is-active' : ''} type="button" onClick={() => setBucket('todo')}>To Record <span>{catalog.length - enteredCount}</span></button><button className={bucket === 'entered' ? 'is-active' : ''} type="button" onClick={() => setBucket('entered')}>Entered <span>{enteredCount}</span></button></div>
    {catalogLoading ? <div className="operation-loading compact"><LoaderCircle className="spin" size={22} /><span>Loading every manufactured item…</span></div> : <div className="manufacturing-run-list">{visible.map((item) => <ProductionItemCard key={item.id} item={item} entry={draft.entries[item.id]} entered={bucket === 'entered'} onChange={(field, value) => updateEntry(item, field, value)} onDone={() => markEntered(item)} onReturn={() => returnToRecord(item.id)} />)}{!visible.length && <div className="transfer-empty">{catalog.length ? `No ${bucket === 'todo' ? 'remaining' : 'entered'} items match this filter.` : 'No active manufactured items are configured in KCP.'}</div>}</div>}
    {validEntries.length > 0 && <button className="button button-primary button-large operation-submit" type="button" disabled={!connected || busy} onClick={requestPreview}><ListChecks size={18} /> Review {validEntries.length} product{validEntries.length === 1 ? '' : 's'}</button>}
    {Object.keys(draft.entries).length > 0 && <button className="discard-operation" type="button" onClick={() => void discard()}><RotateCcw size={14} /> Discard this production run</button>}
    <OperationalLocationPicker open={locationPicker} title="Choose production location" eyebrow="Production run" locations={bootstrap?.locations || []} selectedId={draft.locationId} onSelect={selectLocation} onClose={() => setLocationPicker(false)} />
  </div>;

  return <div className="screen manufacturing-screen">
    <header className="operation-hero manufacturing-operation-hero"><span className="operation-hero-icon"><Factory size={27} /></span><p className="eyebrow">Production list</p><h1>Manufacturing</h1><p>See every manufactured item, enter what the kitchen made and post one controlled production run.</p><button className="location-pill" type="button" onClick={onLocation}><MapPin size={15} /><span>{location?.displayName || 'Choose a location'}</span><ChevronRight size={15} /></button></header>
    {!connected && <div className="sync-state is-offline"><CloudOff size={17} /> Recent production may be out of date. Live actions require KCP.</div>}
    {error && <div className="message message-error operation-message" role="alert">{error}</div>}
    {notice && <div className="message message-success operation-message" role="status">{notice}</div>}
    <section className="manufacturing-principle"><ShieldCheck size={21} /><div><strong>The complete production list</strong><p>No discovery search. Every active manufactured item is loaded from KCP and blueprint problems stay visible.</p></div></section>
    <button className="button button-primary button-large manufacturing-new" type="button" disabled={!bootstrap?.canCreateBatch && !Object.keys(draft.entries).length} onClick={startRun}><Factory size={18} /> {Object.keys(draft.entries).length ? 'Continue saved run' : 'Record production'}</button>
    <RecentProduction items={bootstrap?.recentBatches || []} />
    <button className="discard-operation" type="button" disabled={loading || !connected} onClick={() => void refresh()}><RefreshCw className={loading ? 'spin' : ''} size={14} /> Refresh production</button>
  </div>;
}

function ProductionItemCard({ item, entry, entered, onChange, onDone, onReturn }: { item: ManufacturingCatalogItem; entry?: ManufacturingRunDraft['entries'][string]; entered: boolean; onChange: (field: 'batchCount' | 'actualQuantity' | 'note', value: string) => void; onDone: () => void; onReturn: () => void }) {
  const expected = Number(entry?.batchCount || 0) * item.batchYield;
  return <article className={`production-list-item ${!item.hasBlueprint ? 'is-disabled' : ''} ${entered ? 'is-entered' : ''}`}>
    <header><span className="production-item-icon">{entered ? <Check size={19} /> : <Factory size={19} />}</span><div><strong>{item.name}</strong><small>{[item.sku, item.category].filter(Boolean).join(' · ') || item.baseUom}</small></div>{!item.hasBlueprint && <b>Blueprint required</b>}</header>
    {item.hasBlueprint && <><div className="production-inline-fields"><label><span>Batches run</span><input aria-label={`${item.name} batches run`} type="number" min="0" step="any" inputMode="decimal" value={entry?.batchCount || ''} onChange={(event) => onChange('batchCount', event.target.value)} placeholder="0" /></label><label><span>Actual produced</span><div><input aria-label={`${item.name} actual produced`} type="number" min="0" step="any" inputMode="decimal" value={entry?.actualQuantity || ''} onChange={(event) => onChange('actualQuantity', event.target.value)} placeholder="0" /><small>{item.baseUom}</small></div></label></div><div className="production-yield-line"><span>Expected {expected > 0 ? `${formatQuantity(expected)} ${item.baseUom}` : '—'}</span><span className={Number(entry?.actualQuantity || 0) < expected ? 'is-shortage' : ''}>Variance {expected > 0 && entry?.actualQuantity ? signedQuantity(Number(entry.actualQuantity) - expected, item.baseUom) : '—'}</span></div><label className="production-item-note"><span>Optional note</span><input aria-label={`${item.name} note`} value={entry?.note || ''} maxLength={160} onChange={(event) => onChange('note', event.target.value)} placeholder="Batch or quality note" /></label>{entered ? <button className="production-return" type="button" onClick={onReturn}><Undo2 size={15} /> Return to record</button> : <button className="production-done" type="button" onClick={onDone}><Check size={16} /> Done & next</button>}</>}
  </article>;
}

function RunReview({ preview, connected, busy, confirmed, error, onConfirmed, onBack, onRefresh, onSubmit }: { preview: ManufacturingRunPreview; connected: boolean; busy: boolean; confirmed: boolean; error: string; onConfirmed: (value: boolean) => void; onBack: () => void; onRefresh: () => void; onSubmit: () => void }) {
  const shortages = preview.components.filter((component) => !component.available);
  return <div className="screen review-screen manufacturing-review"><header className="count-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to production entry"><ArrowLeft size={19} /></button><div><p className="eyebrow">Run preview</p><h1>Confirm production</h1></div><span /></header>{error && <div className="message message-error operation-message" role="alert">{error}</div>}
    <section className="operation-section"><div className="section-title"><div><p className="eyebrow">Finished output</p><h2>{preview.products.length} manufactured products</h2></div><PackageCheck size={20} /></div><div className="run-review-products">{preview.products.map((product) => <article key={product.item.id}><div><strong>{product.item.name}</strong><small>{formatQuantity(product.batchCount)} batches</small></div><span><strong>{formatQuantity(product.actualQuantity)} {product.item.baseUom}</strong><small>Expected {formatQuantity(product.expectedQuantity)} · Loss {formatQuantity(product.wastageQuantity)}</small></span></article>)}</div></section>
    <section className={`operation-section component-preview-section ${shortages.length ? 'shortage-section' : ''}`}><div className="section-title"><div><p className="eyebrow">Combined blueprint usage</p><h2>{shortages.length ? 'Component shortages' : 'Components available'}</h2></div><span className="count-badge">{preview.components.length}</span></div><div className="component-preview-list">{preview.components.map((component) => <article key={component.stockItemId} className={component.available ? 'is-available' : 'is-shortage'}><span className="component-status">{component.available ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}</span><div><strong>{component.name}</strong><small>Need {formatQuantity(component.requiredQuantity)} {component.unit} · On hand {formatQuantity(component.onHand)}</small></div><span className="component-remaining"><small>After</small><strong>{formatQuantity(component.remainingQuantity)} {component.unit}</strong></span></article>)}</div></section>
    <div className="server-authority-note"><ShieldCheck size={20} /><div><strong>KCP checks the whole run</strong><p>Shared ingredients are aggregated before retry-safe standard Manufacturing batches are posted.</p></div></div>
    {shortages.length > 0 && <button className="button button-secondary button-large operation-submit" type="button" disabled={!connected || busy} onClick={onRefresh}><RefreshCw size={18} /> Refresh component check</button>}
    <label className="commit-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} /><span><strong>{shortages.length ? 'I confirm this shortage exception' : 'I confirm this production run'}</strong><small>{shortages.length ? 'This locked run will require authorised approval before stock can change.' : `${preview.products.length} finished products will update live KCP stock.`}</small></span></label>
    <button className="button button-primary button-large operation-submit" type="button" disabled={!confirmed || !connected || busy} onClick={onSubmit}>{busy ? <LoaderCircle className="spin" size={18} /> : <PackageCheck size={18} />} {shortages.length ? 'Submit for approval' : 'Post production run'}</button>
  </div>;
}

function RunComplete({ result, onDone }: { result: ManufacturingRunResult; onDone: () => void }) {
  return <div className="screen complete-screen"><section className="complete-card manufacturing-complete-card"><span className="complete-icon"><CheckCircle2 size={35} /></span><p className="eyebrow">{result.duplicate ? 'Already posted safely' : 'Production posted'}</p><h1>Run complete</h1><p>{result.productCount} manufactured product{result.productCount === 1 ? '' : 's'} updated at {result.location.name}.</p><div className="transaction-reference"><span>Production run ID</span><strong>{result.runId}</strong></div><div className="run-receipt-list">{result.batches.map((batch) => <div key={batch.batchId}><span>{batch.itemName}</span><strong>{batch.transactionReference || batch.batchId}</strong></div>)}</div><button className="button button-primary button-large" type="button" onClick={onDone}>Back to manufacturing</button></section></div>;
}

function RecentProduction({ items }: { items: ManufacturingHistoryItem[] }) { return <section className="operation-section recent-production"><div className="section-title"><div><p className="eyebrow">Audit trail</p><h2>Recent production</h2></div><Wheat size={19} /></div><div className="recent-production-list">{items.length ? items.map((item) => <article key={item.id}><span className="recent-production-icon"><Factory size={18} /></span><div><strong>{item.itemName}</strong><small>{item.locationName} · {formatDate(item.postedAt)}</small><small>{item.transactionReference || item.id}</small></div><span className={item.wastageQuantity > 0 ? 'has-loss' : ''}><strong>{formatQuantity(item.actualQuantity)} {item.unit}</strong><small>{item.wastageQuantity > 0 ? `${formatQuantity(item.wastageQuantity)} loss` : 'On yield'}</small></span></article>) : <div className="transfer-empty">No production batches have been posted yet.</div>}</div></section>; }

function emptyDraft(locationId: string): ManufacturingRunDraft { return { clientRunId: createId('mfg-run'), locationId, entries: {}, occurredAt: new Date().toISOString() }; }
function toPayload(draft: ManufacturingRunDraft): ManufacturingRunEntry[] { return Object.entries(draft.entries).filter(([, entry]) => Number(entry.batchCount) > 0 && Number(entry.actualQuantity) > 0).map(([manufacturedItemId, entry]) => ({ manufacturedItemId, batchCount: Number(entry.batchCount), actualQuantity: Number(entry.actualQuantity), note: entry.note.trim() })); }
function preferredLocation(bootstrap: ManufacturingBootstrap | null, locationId: string) { return bootstrap?.locations.find((entry) => entry.id === locationId)?.id || bootstrap?.locations.find((entry) => entry.isDefault)?.id || bootstrap?.locations[0]?.id || ''; }
function round3(value: number) { return Math.round((value + Number.EPSILON) * 1000) / 1000; }
function formatQuantity(value: number) { return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 3 }).format(Number(value || 0)); }
function signedQuantity(value: number, unit: string) { const number = Number(value || 0); return `${number > 0 ? '+' : ''}${formatQuantity(number)} ${unit}`; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(date); }
function message(cause: unknown, fallback: string) { if (cause instanceof ApiError && cause.message) return cause.message; return cause instanceof Error && cause.message ? cause.message : fallback; }
