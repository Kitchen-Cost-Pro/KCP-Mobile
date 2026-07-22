import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, CalendarDays, Camera, Check, CheckCircle2, ChevronRight, ClipboardList, CloudOff,
  FileText, LoaderCircle, PackageCheck, Plus, ReceiptText, RefreshCw, ScanBarcode, Search,
  ShieldCheck, TriangleAlert, Undo2, X
} from 'lucide-react';
import { ApiError } from '../../core/api/client';
import { createId } from '../../core/id/createId';
import { useConnectivity } from '../../hooks/useConnectivity';
import { scanBarcodeWithDevice } from '../wastage/nativeBarcodeScanner';
import {
  commitReceiving, loadReceivingBootstrap, loadReceivingOrder, lookupReceivingBarcode,
  previewReceiving, type ReceivingBootstrap, type ReceivingDraft, type ReceivingEntry,
  type ReceivingEvidence, type ReceivingOrder, type ReceivingOrderLine, type ReceivingOrderSummary,
  type ReceivingPreview, type ReceivingResult
} from './receivingApi';
import { receivingRecoveryStore } from './receivingRecoveryStore';
import { canSeeOperationalValues, type FinancialVisibility } from '../role-sets/roleSetModel';

type View = 'dashboard' | 'entry' | 'review' | 'complete';
type Props = { workspaceId: string; userId: string; initialOrderId?: string; financialVisibility?: FinancialVisibility; onActionEvent?: (event: 'waiting' | 'complete' | 'reject', detail?: string) => Promise<void> };

const MAX_GRV_PHOTOS = 6;

export function ReceivingScreen({ workspaceId, userId, initialOrderId = '', financialVisibility = 'full', onActionEvent }: Props) {
  const connected = useConnectivity();
  const showMoney = canSeeOperationalValues(financialVisibility);
  const [view, setView] = useState<View>('dashboard');
  const [bootstrap, setBootstrap] = useState<ReceivingBootstrap | null>(null);
  const [order, setOrder] = useState<ReceivingOrder | null>(null);
  const [draft, setDraft] = useState<ReceivingDraft>(() => emptyDraft());
  const [preview, setPreview] = useState<ReceivingPreview | null>(null);
  const [result, setResult] = useState<ReceivingResult | null>(null);
  const [orderBucket, setOrderBucket] = useState<'awaiting' | 'partial'>('awaiting');
  const [lineBucket, setLineBucket] = useState<'todo' | 'entered'>('todo');
  const [filter, setFilter] = useState('');
  const [barcode, setBarcode] = useState('');
  const [highlightedLine, setHighlightedLine] = useState('');
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const openedOrder = useRef('');

  const refresh = useCallback(async () => {
    if (!connected) { setLoading(false); return; }
    setLoading(true); setError('');
    try { setBootstrap(await loadReceivingBootstrap(workspaceId)); }
    catch (cause) { setError(message(cause, 'Goods receiving could not be loaded.')); }
    finally { setLoading(false); }
  }, [connected, workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!connected || view !== 'dashboard') return;
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refreshWhenVisible); document.removeEventListener('visibilitychange', refreshWhenVisible); };
  }, [connected, refresh, view]);
  useEffect(() => {
    let active = true;
    void receivingRecoveryStore.get(workspaceId, userId).then((recovery) => {
      if (!active) return;
      if (recovery) {
        setDraft({ ...recovery.draft, evidence: normalizeEvidence(recovery.draft.evidence) }); setOrder(recovery.order);
        setNotice('Your unfinished goods receipt is ready to continue.');
      }
      setRecoveryLoaded(true);
    });
    return () => { active = false; };
  }, [userId, workspaceId]);

  useEffect(() => {
    if (!recoveryLoaded || view === 'complete' || !order || !draft.purchaseOrderId) return;
    void receivingRecoveryStore.set({ workspaceId, userId, draft, order, updatedAt: new Date().toISOString() }).catch(() => undefined);
  }, [draft, order, recoveryLoaded, userId, view, workspaceId]);

  const selectedEntries = useMemo(() => toEntries(draft), [draft]);
  const enteredCount = Object.values(draft.entries).filter((entry) => entry.entered && Number(entry.receivedQuantity) > 0).length;

  async function chooseOrder(summary: ReceivingOrderSummary) {
    if (!connected) { setError('Connect to KCP before opening a purchase order.'); return; }
    setBusy(true); setError('');
    try {
      const loaded = await loadReceivingOrder(workspaceId, summary.id);
      await receivingRecoveryStore.clear(workspaceId, userId);
      setOrder(loaded); setDraft(emptyDraft(loaded.id)); setLineBucket('todo'); setFilter(''); setView('entry');
    } catch (cause) { setError(message(cause, 'Purchase order could not be loaded.')); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!initialOrderId || !bootstrap || openedOrder.current === initialOrderId) return;
    const match = bootstrap.orders.find((item) => item.id === initialOrderId);
    if (!match) { setError('The linked purchase order is unavailable or no longer authorised.'); return; }
    openedOrder.current = initialOrderId; void chooseOrder(match);
  }, [bootstrap, initialOrderId]);

  function updateEntry(line: ReceivingOrderLine, field: 'receivedQuantity' | 'note', value: string) {
    setDraft((current) => {
      const prior = current.entries[line.id] || { receivedQuantity: '', note: '', entered: false };
      const next = { ...prior, [field]: value };
      if (field === 'receivedQuantity' && !(Number(value) > 0)) next.entered = false;
      return { ...current, entries: { ...current.entries, [line.id]: next } };
    });
  }

  function completeLine(line: ReceivingOrderLine) {
    const value = draft.entries[line.id]?.receivedQuantity || '';
    if (!(Number(value) > 0)) { setError(`Enter a received quantity for ${line.name}.`); return; }
    setError('');
    setDraft((current) => ({ ...current, entries: { ...current.entries, [line.id]: { ...(current.entries[line.id] || { receivedQuantity: value, note: '' }), entered: true } } }));
  }

  function returnLine(line: ReceivingOrderLine) {
    setDraft((current) => ({ ...current, entries: { ...current.entries, [line.id]: { ...(current.entries[line.id] || { receivedQuantity: '', note: '' }), entered: false } } }));
  }

  function receiveAll() {
    if (!order || !window.confirm('Enter every outstanding purchase-order quantity as received? You can still edit values before review.')) return;
    const entries = Object.fromEntries(order.lines.map((line) => [line.id, {
      receivedQuantity: String(line.outstandingQuantity), note: draft.entries[line.id]?.note || '', entered: true
    }]));
    setDraft((current) => ({ ...current, entries })); setLineBucket('entered');
  }

  async function resolveBarcode(value: string) {
    if (!order) return;
    if (!connected) { setError('Barcode verification needs a connection to KCP.'); return; }
    if (!value.trim()) { setError('Scan or enter a barcode first.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const match = await lookupReceivingBarcode(workspaceId, order.id, value);
      if (!match.matched || !match.line) {
        setError(match.reason === 'ambiguous' ? 'That barcode matches more than one line on this order.' : 'That item is not on this purchase order.');
        return;
      }
      setLineBucket(draft.entries[match.line.id]?.entered ? 'entered' : 'todo');
      setFilter(match.line.name); setHighlightedLine(match.line.id); setNotice(`${match.line.name} found on ${order.poNumber}.`);
      window.setTimeout(() => {
        const target = document.getElementById(`receiving-line-${match.line!.id}`);
        if (typeof target?.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    } catch (cause) { setError(message(cause, 'Barcode could not be checked.')); }
    finally { setBusy(false); }
  }

  async function scan() {
    try { const value = await scanBarcodeWithDevice(); setBarcode(value); await resolveBarcode(value); }
    catch (cause) { setError(message(cause, 'Barcode scan was cancelled.')); }
  }

  async function review() {
    if (!order) return;
    if (!draft.invoiceNumber.trim()) { setError('Enter the supplier invoice number.'); return; }
    if (!selectedEntries.length) { setError('Enter a received quantity for at least one item.'); return; }
    if (!draft.evidence.length) { setError('Take or attach at least one delivery photo before reviewing this GRV.'); return; }
    if (!connected) { setError('Connect to KCP to validate this goods receipt.'); return; }
    setBusy(true); setError('');
    try {
      const next = await previewReceiving(workspaceId, payload(draft));
      setPreview(next); setConfirmed(false); setView('review'); window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (cause) { setError(message(cause, 'Goods receipt validation failed.')); }
    finally { setBusy(false); }
  }

  async function addPhoto(file?: File) {
    if (!file) return;
    if (draft.evidence.length >= MAX_GRV_PHOTOS) { setError(`You can attach up to ${MAX_GRV_PHOTOS} delivery photos.`); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('Use a JPEG, PNG or WebP delivery photo.'); return; }
    if (file.size > 1_000_000) { setError('Each delivery photo must be 1 MB or smaller.'); return; }
    try {
      const photo: ReceivingEvidence = { clientId: createId('grv-photo'), fileName: file.name.slice(0, 120) || 'delivery-photo.jpg', mimeType: file.type, dataUrl: await readPhoto(file) };
      setDraft((current) => ({ ...current, evidence: [...current.evidence, photo] }));
      setError(''); setNotice('Delivery photo attached as GRV evidence.');
    } catch { setError('The delivery photo could not be read. Try taking it again.'); }
  }

  function removePhoto(clientId: string) {
    setDraft((current) => ({ ...current, evidence: current.evidence.filter((photo) => photo.clientId !== clientId) }));
  }

  async function commit() {
    if (!preview || !confirmed) return;
    setBusy(true); setError('');
    try {
      const posted = await commitReceiving(workspaceId, {
        ...payload(draft), idempotencyKey: draft.clientReceiptId, previewToken: preview.previewToken, confirm: true
      });
      setResult(posted); setView('complete'); await receivingRecoveryStore.clear(workspaceId, userId);
      await onActionEvent?.('complete', posted.transactionReference || posted.receiptId);
    } catch (cause) { setError(message(cause, 'Goods receipt could not be posted. Refresh the preview and try again.')); }
    finally { setBusy(false); }
  }

  function finish() {
    setOrder(null); setDraft(emptyDraft()); setPreview(null); setResult(null); setConfirmed(false); setNotice(''); setView('dashboard');
    void refresh(); window.scrollTo({ top: 0, behavior: 'instant' });
  }

  if (view === 'complete' && result) return <ReceivingComplete result={result} showMoney={showMoney} onDone={finish} />;
  if (view === 'review' && preview) return <ReceivingReview preview={preview} connected={connected} busy={busy} confirmed={confirmed} error={error} showMoney={showMoney} photoCount={draft.evidence.length} onConfirmed={setConfirmed} onBack={() => setView('entry')} onRefresh={review} onSubmit={commit} />;
  if (view === 'entry' && order) return <ReceivingEntryView
    order={order} draft={draft} lineBucket={lineBucket} filter={filter} barcode={barcode} highlightedLine={highlightedLine}
    enteredCount={enteredCount} connected={connected} busy={busy} error={error} notice={notice}
    onBack={() => setView('dashboard')} onDraft={setDraft} onBucket={setLineBucket} onFilter={setFilter} onBarcode={setBarcode}
    onResolveBarcode={resolveBarcode} onScan={scan} onUpdate={updateEntry} onCompleteLine={completeLine} onReturnLine={returnLine}
    onReceiveAll={receiveAll} onPhoto={addPhoto} onRemovePhoto={removePhoto} onReview={review}
  />;

  const orders = (bootstrap?.orders || []).filter((entry) => entry.statusBucket === orderBucket);
  return <div className="screen receiving-screen">
    <section className="operation-hero receiving-operation-hero"><span className="operation-hero-icon"><PackageCheck size={25} /></span><p className="eyebrow">PO to GRV</p><h1>Process a purchase order.</h1><p>Select an active PO, record what arrived, compare every line and post the matched delivery to GRV.</p><div className="receiving-principle"><ShieldCheck size={19} /><div><strong>Live KCP records</strong><p>Active POs and GRVs are reconciled from the same authoritative records used by the main app.</p></div></div></section>
    {error && <div className="message message-error operation-message" role="alert">{error}</div>}
    {notice && <div className="message message-success operation-message">{notice}</div>}
    {!connected && <div className="offline-operation"><CloudOff size={19} /><div><strong>Offline recovery only</strong><p>You can continue a saved receipt, but KCP validation and posting need a connection.</p></div></div>}
    {order && draft.purchaseOrderId && <button className="resume-card receiving-resume" type="button" onClick={() => setView('entry')}><span><ClipboardList size={20} /></span><div><strong>Continue {order.poNumber}</strong><small>{enteredCount} item{enteredCount === 1 ? '' : 's'} entered · {order.supplierName}</small></div><ChevronRight size={19} /></button>}
    <section className="operation-section"><div className="section-title"><div><p className="eyebrow">Step 1 · Active POs</p><h2>Select a purchase order</h2>{bootstrap?.syncedAt && <small className="sync-stamp">Synced {formatTime(bootstrap.syncedAt)}</small>}</div><button className="icon-button" type="button" onClick={refresh} disabled={!connected || loading} aria-label="Refresh purchase orders"><RefreshCw className={loading ? 'spin' : ''} size={18} /></button></div>
      <div className="segmented-tabs receiving-tabs"><button className={orderBucket === 'awaiting' ? 'is-active' : ''} type="button" onClick={() => setOrderBucket('awaiting')}>Awaiting <span>{bootstrap?.orders.filter((entry) => entry.statusBucket === 'awaiting').length || 0}</span></button><button className={orderBucket === 'partial' ? 'is-active' : ''} type="button" onClick={() => setOrderBucket('partial')}>Partial <span>{bootstrap?.orders.filter((entry) => entry.statusBucket === 'partial').length || 0}</span></button></div>
      {loading ? <div className="operation-loading compact"><LoaderCircle className="spin" size={28} /><p>Loading purchase orders…</p></div> : <div className="receiving-order-list">{orders.length ? orders.map((entry) => <button type="button" key={entry.id} onClick={() => void chooseOrder(entry)} disabled={busy}><span className="receiving-order-icon"><ReceiptText size={20} /></span><span><strong>{entry.poNumber}</strong><small>{entry.supplierName}</small><small>{entry.location.name} · {entry.outstandingLineCount} outstanding</small></span><span><b>{entry.statusBucket === 'partial' ? 'Partial' : 'Awaiting'}</b><small>{formatDate(entry.expectedAt || entry.orderedAt)}</small><ChevronRight size={17} /></span></button>) : <div className="transfer-empty">No {orderBucket} purchase orders are available for your locations.</div>}</div>}
    </section>
    <RecentReceipts bootstrap={bootstrap} />
  </div>;
}

type EntryViewProps = {
  order: ReceivingOrder; draft: ReceivingDraft; lineBucket: 'todo' | 'entered'; filter: string; barcode: string;
  highlightedLine: string; enteredCount: number; connected: boolean; busy: boolean; error: string; notice: string;
  onBack: () => void; onDraft: React.Dispatch<React.SetStateAction<ReceivingDraft>>; onBucket: (value: 'todo' | 'entered') => void;
  onFilter: (value: string) => void; onBarcode: (value: string) => void; onResolveBarcode: (value: string) => void; onScan: () => void;
  onUpdate: (line: ReceivingOrderLine, field: 'receivedQuantity' | 'note', value: string) => void;
  onCompleteLine: (line: ReceivingOrderLine) => void; onReturnLine: (line: ReceivingOrderLine) => void; onReceiveAll: () => void; onPhoto: (file?: File) => void; onRemovePhoto: (clientId: string) => void; onReview: () => void;
};

function ReceivingEntryView(props: EntryViewProps) {
  const visible = props.order.lines.filter((line) => {
    const entered = Boolean(props.draft.entries[line.id]?.entered && Number(props.draft.entries[line.id]?.receivedQuantity) > 0);
    const matchesBucket = props.lineBucket === 'entered' ? entered : !entered;
    const haystack = `${line.name} ${line.sku || ''} ${line.category}`.toLowerCase();
    return matchesBucket && haystack.includes(props.filter.trim().toLowerCase());
  });
  return <div className="screen receiving-entry-screen"><header className="count-header"><button className="icon-button" type="button" onClick={props.onBack} aria-label="Back to purchase orders"><ArrowLeft size={19} /></button><div><p className="eyebrow">Goods receipt</p><h1>{props.order.poNumber}</h1></div><span /></header>
    {props.error && <div className="message message-error operation-message" role="alert">{props.error}</div>}{props.notice && <div className="message message-success operation-message">{props.notice}</div>}
    <section className="receiving-locked-card"><div><span>Supplier</span><strong>{props.order.supplierName}</strong></div><div><span>Receiving location</span><strong>{props.order.location.name}</strong></div><small><ShieldCheck size={14} /> Locked to the KCP purchase order</small></section>
    <section className="operation-section receiving-document-fields"><div className="section-title"><div><p className="eyebrow">Delivery document</p><h2>Receipt details</h2></div><FileText size={19} /></div><div className="form-grid">
      <label><span>Supplier invoice *</span><input value={props.draft.invoiceNumber} maxLength={120} autoComplete="off" onChange={(event) => props.onDraft((current) => ({ ...current, invoiceNumber: event.target.value }))} placeholder="Invoice number" /></label>
      <label><span>Delivery note</span><input value={props.draft.deliveryNote} maxLength={120} onChange={(event) => props.onDraft((current) => ({ ...current, deliveryNote: event.target.value }))} placeholder="Optional reference" /></label>
      <label><span>Received date</span><input type="date" value={props.draft.receivedAt} max={today()} onChange={(event) => props.onDraft((current) => ({ ...current, receivedAt: event.target.value }))} /></label>
      <label><span>Receipt note</span><input value={props.draft.note} maxLength={500} onChange={(event) => props.onDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" /></label>
    </div></section>
    <section className="operation-section receiving-scan-section"><div className="section-title"><div><p className="eyebrow">Find on this PO</p><h2>Scan a delivered item</h2></div><ScanBarcode size={20} /></div><button className="scan-action receiving-scan" type="button" onClick={props.onScan} disabled={!props.connected || props.busy}><ScanBarcode size={22} /><span><strong>Open barcode scanner</strong><small>Only items on {props.order.poNumber} can match</small></span><ChevronRight size={18} /></button><div className="manual-barcode"><input value={props.barcode} onChange={(event) => props.onBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') props.onResolveBarcode(props.barcode); }} placeholder="Enter barcode manually" /><button type="button" onClick={() => props.onResolveBarcode(props.barcode)} disabled={!props.connected || props.busy}>Check</button></div></section>
    <section className="operation-section receiving-lines-section"><div className="section-title"><div><p className="eyebrow">Step 2 · GRV lines</p><h2>{props.enteredCount} of {props.order.lines.length} checked</h2></div><button className="text-button" type="button" onClick={props.onReceiveAll}>Everything matches</button></div><div className="receiving-progress"><div><strong>{props.enteredCount}</strong><span>checked</span></div><progress max={Math.max(props.order.lines.length, 1)} value={props.enteredCount} /></div>{props.enteredCount < props.order.lines.length && <button className="button button-secondary receiving-confirm-all" type="button" onClick={props.onReceiveAll}><Check size={17} /> Everything arrived as ordered</button>}<div className="search-field receiving-list-filter"><Search size={17} /><input value={props.filter} onChange={(event) => props.onFilter(event.target.value)} placeholder="Filter this purchase order" /></div><div className="segmented-tabs receiving-line-tabs"><button className={props.lineBucket === 'todo' ? 'is-active' : ''} type="button" onClick={() => props.onBucket('todo')}>To check <span>{props.order.lines.length - props.enteredCount}</span></button><button className={props.lineBucket === 'entered' ? 'is-active' : ''} type="button" onClick={() => props.onBucket('entered')}>Checked <span>{props.enteredCount}</span></button></div><div className="receiving-line-list">{visible.length ? visible.map((line) => {
        const entry = props.draft.entries[line.id] || { receivedQuantity: '', note: '', entered: false };
        const match = lineMatch(line.outstandingQuantity, Number(entry.receivedQuantity));
        return <article id={`receiving-line-${line.id}`} key={line.id} className={`${entry.entered ? 'is-entered' : ''} ${props.highlightedLine === line.id ? 'is-highlighted' : ''}`}><header><span className="receiving-line-icon"><PackageCheck size={18} /></span><div><strong>{line.name}</strong><small>{line.sku || line.category || 'KCP stock item'}</small></div><b>{formatQuantity(line.outstandingQuantity)} {line.receivingUom} expected</b></header><div className="receiving-line-stats"><span>Ordered <strong>{formatQuantity(line.orderedQuantity)}</strong></span><span>Already received <strong>{formatQuantity(line.previouslyReceivedQuantity)}</strong></span><span>Pack size <strong>{formatQuantity(line.packSize)}</strong></span></div><div className="receiving-line-fields"><label><span>Received now</span><div><input aria-label={`${line.name} received now`} type="number" inputMode="decimal" min="0" step="any" value={entry.receivedQuantity} onChange={(event) => props.onUpdate(line, 'receivedQuantity', event.target.value)} /><small>{line.receivingUom}</small></div></label><label><span>Line note</span><input aria-label={`${line.name} line note`} value={entry.note} maxLength={160} onChange={(event) => props.onUpdate(line, 'note', event.target.value)} placeholder={match.status === 'match' ? 'Optional' : 'Explain discrepancy'} /></label></div>{Number(entry.receivedQuantity) > 0 && <div className={`receiving-match is-${match.status}`}><strong>{match.label}</strong><span>{match.detail}</span></div>}{entry.entered ? <button className="receiving-return" type="button" onClick={() => props.onReturnLine(line)}><Undo2 size={15} /> Edit line</button> : <button className="receiving-done" type="button" onClick={() => props.onCompleteLine(line)}><Check size={15} /> Check line</button>}</article>;
      }) : <div className="transfer-empty">No items match this view.</div>}</div></section>
    <section className="operation-section receiving-evidence"><div className="section-title"><div><p className="eyebrow">Step 3 · Evidence</p><h2>Delivery photos</h2></div><Camera size={20} /></div>
      {props.draft.evidence.length > 0 && <div className="receiving-photo-grid">{props.draft.evidence.map((photo) => <figure key={photo.clientId} className="receiving-photo-thumb"><img src={photo.dataUrl} alt={photo.fileName} /><button type="button" aria-label={`Remove ${photo.fileName}`} onClick={() => props.onRemovePhoto(photo.clientId)}><X size={14} /></button></figure>)}</div>}
      <label className={`receiving-photo ${props.draft.evidence.length ? 'has-photo' : ''}`}>{props.draft.evidence.length ? <Plus size={20} /> : <Camera size={20} />}<span><strong>{props.draft.evidence.length ? 'Photo attached' : 'Take delivery photo *'}</strong><small>{props.draft.evidence.length ? `${props.draft.evidence.length} of ${MAX_GRV_PHOTOS} attached · add another` : 'Invoice, delivery note or delivered goods'}</small></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!props.connected || props.draft.evidence.length >= MAX_GRV_PHOTOS} onChange={(event) => { props.onPhoto(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
      <p>Photos are stored with the GRV as receiving evidence for later review and AI receipt scanning.</p></section>
    <button className="button button-primary button-large operation-submit" type="button" onClick={props.onReview} disabled={!props.connected || props.busy || !props.enteredCount || !props.draft.evidence.length}>{props.busy ? <LoaderCircle className="spin" size={18} /> : <ClipboardList size={18} />} Compare and review GRV</button>
  </div>;
}

function ReceivingReview(props: { preview: ReceivingPreview; connected: boolean; busy: boolean; confirmed: boolean; error: string; showMoney: boolean; photoCount: number; onConfirmed: (value: boolean) => void; onBack: () => void; onRefresh: () => void; onSubmit: () => void }) {
  return <div className="screen review-screen receiving-review"><header className="count-header"><button className="icon-button" type="button" onClick={props.onBack} aria-label="Back to receiving entry"><ArrowLeft size={19} /></button><div><p className="eyebrow">Server preview</p><h1>Confirm delivery</h1></div><span /></header>{props.error && <div className="message message-error operation-message" role="alert">{props.error}</div>}
    <section className="operation-section receiving-review-summary"><div className="section-title"><div><p className="eyebrow">{props.preview.order.poNumber}</p><h2>{props.preview.order.supplierName}</h2></div><ReceiptText size={20} /></div><div className="receiving-review-meta"><span>Invoice <strong>{props.preview.invoiceNumber}</strong></span><span>Location <strong>{props.preview.order.location.name}</strong></span><span>Received <strong>{formatDate(props.preview.receivedAt)}</strong></span><span>Evidence <strong>{props.photoCount} photo{props.photoCount === 1 ? '' : 's'}</strong></span></div><div className="receiving-review-lines">{props.preview.entries.map((entry) => <article key={entry.id} className={`is-${entry.matchStatus}`}><div><strong>{entry.name}</strong><small>Expected {formatQuantity(entry.outstandingQuantity)} · received {formatQuantity(entry.receivedQuantity)} {entry.receivingUom}</small></div><span className={`review-match is-${entry.matchStatus}`}>{matchLabel(entry.matchStatus)}</span></article>)}</div><div className="receiving-totals"><span>Matching lines <strong>{props.preview.entries.filter((entry) => entry.matchStatus === 'match').length} / {props.preview.entries.length}</strong></span><span>PO after posting <strong>{humanStatus(props.preview.completionStatus)}</strong></span>{props.showMoney && <span>Total <strong>{formatMoney(props.preview.totalInc)}</strong></span>}</div></section>
    {props.preview.blockingErrors.map((entry) => <div className="message message-error operation-message" key={entry}><TriangleAlert size={17} /> {entry}</div>)}{props.preview.warnings.map((entry) => <div className="message message-warning operation-message" key={entry}><TriangleAlert size={17} /> {entry}</div>)}
    <div className="server-authority-note"><ShieldCheck size={20} /><div><strong>KCP validates again when posting</strong><p>The PO state, outstanding quantities, supplier invoice and your location access are checked atomically.</p></div></div>
    <button className="button button-secondary button-large operation-submit" type="button" disabled={!props.connected || props.busy} onClick={props.onRefresh}><RefreshCw size={18} /> Refresh preview</button>
    <label className="commit-confirmation"><input type="checkbox" checked={props.confirmed} disabled={props.preview.blockingErrors.length > 0} onChange={(event) => props.onConfirmed(event.target.checked)} /><span><strong>I confirm this delivery</strong><small>{props.preview.entries.length} lines will update live KCP stock.</small></span></label>
    <button className="button button-primary button-large operation-submit" type="button" disabled={!props.confirmed || props.preview.blockingErrors.length > 0 || !props.connected || props.busy} onClick={props.onSubmit}>{props.busy ? <LoaderCircle className="spin" size={18} /> : <PackageCheck size={18} />} Post goods receipt</button>
  </div>;
}

function ReceivingComplete({ result, showMoney, onDone }: { result: ReceivingResult; showMoney: boolean; onDone: () => void }) {
  return <div className="screen complete-screen"><section className="complete-card receiving-complete-card"><span className="complete-icon"><CheckCircle2 size={35} /></span><p className="eyebrow">{result.duplicate ? 'Already posted safely' : 'Goods receipt posted'}</p><h1>Delivery received</h1><p>{result.lineCount} purchase-order line{result.lineCount === 1 ? '' : 's'} updated at {result.locationName}.</p><div className="transaction-reference"><span>GRV reference</span><strong>{result.transactionReference || result.receiptId}</strong></div><div className="receiving-complete-meta"><span>PO <strong>{result.poNumber}</strong></span><span>Invoice <strong>{result.invoiceNumber}</strong></span><span>Status <strong>{humanStatus(result.status)}</strong></span>{showMoney && <span>Total <strong>{formatMoney(result.totalInc)}</strong></span>}</div><button className="button button-primary button-large" type="button" onClick={onDone}>Back to goods receiving</button></section></div>;
}

function RecentReceipts({ bootstrap }: { bootstrap: ReceivingBootstrap | null }) {
  const items = bootstrap?.recentReceipts || [];
  return <section className="operation-section recent-receiving"><div className="section-title"><div><p className="eyebrow">Synced GRVs</p><h2>Recent goods receipts</h2></div><CalendarDays size={19} /></div><div className="recent-receiving-list">{items.length ? items.map((item) => <article key={item.id}><span><ReceiptText size={18} /></span><div><strong>{item.transactionReference || item.poNumber}</strong><small>{item.supplierName} · {item.locationName}</small><small>{item.invoiceNumber} · {formatDate(item.receivedAt)}{item.evidenceCount ? ' · photo evidence' : ''}</small></div><b>{item.lineCount} lines</b></article>) : <div className="transfer-empty">No goods receipts have been posted yet.</div>}</div></section>;
}

function emptyDraft(purchaseOrderId = ''): ReceivingDraft {
  return { clientReceiptId: createId('grv'), purchaseOrderId, invoiceNumber: '', deliveryNote: '', receivedAt: today(), note: '', evidence: [], entries: {} };
}
// Recovered drafts (and drafts saved before multi-photo) may store evidence as a
// single object, null, or be missing it entirely. Coerce to an array so the rest
// of the screen can treat it uniformly.
function normalizeEvidence(value: unknown): ReceivingEvidence[] {
  if (Array.isArray(value)) return value as ReceivingEvidence[];
  return value && typeof value === 'object' ? [value as ReceivingEvidence] : [];
}
function today() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function toEntries(draft: ReceivingDraft): ReceivingEntry[] { return Object.entries(draft.entries).filter(([, entry]) => entry.entered && Number(entry.receivedQuantity) > 0).map(([lineId, entry]) => ({ lineId, receivedQuantity: Number(entry.receivedQuantity), note: entry.note.trim() })); }
function payload(draft: ReceivingDraft) { const photos = normalizeEvidence(draft.evidence); return { purchaseOrderId: draft.purchaseOrderId, invoiceNumber: draft.invoiceNumber.trim(), deliveryNote: draft.deliveryNote.trim(), receivedAt: draft.receivedAt, note: draft.note.trim(), evidence: photos[0] || null, evidencePhotos: photos, entries: toEntries(draft) }; }
function formatQuantity(value: number) { return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 3 }).format(Number(value || 0)); }
function formatMoney(value: number) { return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(value || 0)); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(date); }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'now' : new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' }).format(date); }
function matchLabel(status: 'match' | 'short' | 'over') { return status === 'match' ? 'Matches' : status === 'short' ? 'Short' : 'Over'; }
function lineMatch(expected: number, received: number) { const variance = received - expected; const status = Math.abs(variance) < .0005 ? 'match' as const : variance < 0 ? 'short' as const : 'over' as const; return { status, label: matchLabel(status), detail: status === 'match' ? 'Received quantity matches the PO.' : `${formatQuantity(Math.abs(variance))} ${status === 'short' ? 'short' : 'over'} the PO quantity.` }; }
function readPhoto(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function humanStatus(value: string) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function message(cause: unknown, fallback: string) { if (cause instanceof ApiError && cause.message) return cause.message; return cause instanceof Error && cause.message ? cause.message : fallback; }
