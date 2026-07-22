import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  Inbox,
  LoaderCircle,
  MapPin,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  ScanBarcode,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Truck,
  TriangleAlert
} from 'lucide-react';
import { OperationalLocationPicker, type OperationalLocationOption } from '../../components/OperationalLocationPicker';
import { ApiError } from '../../core/api/client';
import { createId } from '../../core/id/createId';
import { useConnectivity } from '../../hooks/useConnectivity';
import type { KcpLocation } from '../../types/kcp';
import { scanBarcodeWithDevice } from '../wastage/nativeBarcodeScanner';
import {
  acceptIncomingTransfer,
  createInternalTransfer,
  loadTransferBootstrap,
  loadTransferBuckets,
  rejectIncomingTransfer,
  searchTransferItems,
  type TransferBootstrap,
  type TransferBuckets,
  type TransferDraftLine,
  type TransferItem,
  type TransferResult,
  type TransferSummary
} from './transferApi';
import { transferRecoveryStore, type TransferRecovery } from './transferRecoveryStore';
import { isApprovalPending } from '../approvals/approvalSubmission';
import { readSnapshotStore } from '../../core/offline/readSnapshotStore';

type View = 'dashboard' | 'create' | 'review' | 'complete' | 'incoming';

type Draft = {
  clientActionId: string;
  fromLocationId: string;
  toLocationId: string;
  lines: TransferDraftLine[];
  note: string;
  occurredAt: string;
};

type Props = {
  workspaceId: string;
  userId: string;
  location: KcpLocation | null;
  onLocation: () => void;
  initialTransferId?: string;
  onActionEvent?: (event: 'waiting' | 'complete' | 'reject', detail?: string) => Promise<void>;
};

const EMPTY_BUCKETS: TransferBuckets = {
  ok: true,
  awaitingMyAcceptance: [],
  recentlySent: [],
  recentlyReceived: [],
  needsAttention: [],
  counts: { awaitingMyAcceptance: 0, recentlySent: 0, recentlyReceived: 0 }
};

export function TransfersScreen({ workspaceId, userId, location, onLocation, initialTransferId='', onActionEvent }: Props) {
  const connected = useConnectivity();
  const [view, setView] = useState<View>('dashboard');
  const [bootstrap, setBootstrap] = useState<TransferBootstrap | null>(null);
  const [buckets, setBuckets] = useState<TransferBuckets>(EMPTY_BUCKETS);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(location?.id || ''));
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [searchResults, setSearchResults] = useState<TransferItem[]>([]);
  const [selectedIncoming, setSelectedIncoming] = useState<TransferSummary | null>(null);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [locationPicker, setLocationPicker] = useState<'source' | 'destination' | null>(null);
  const openedTarget=useRef('');

  const run = useCallback(async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    try { await action(); } catch (cause) { setError(message(cause, fallback)); } finally { setBusy(false); }
  }, []);

  const refresh = useCallback(async () => {
    if (!connected) {const saved=await readSnapshotStore.get<{bootstrap:TransferBootstrap;buckets:TransferBuckets}>('transfers',workspaceId,userId);if(saved){setBootstrap(saved.bootstrap);setBuckets(saved.buckets);setNotice('Offline · showing the last authorised transfer snapshot.');}else setError('No offline transfer snapshot is available.');setLoading(false);return;}
    setLoading(true);
    setError('');
    try {
      const [nextBootstrap, nextBuckets] = await Promise.all([
        loadTransferBootstrap(workspaceId),
        loadTransferBuckets(workspaceId)
      ]);
      setBootstrap(nextBootstrap);
      setBuckets(nextBuckets);
      await readSnapshotStore.set('transfers',workspaceId,userId,'all',{bootstrap:nextBootstrap,buckets:nextBuckets});
      setDraft((current) => ({
        ...current,
        fromLocationId: current.fromLocationId || preferredSource(nextBootstrap, location?.id || ''),
        toLocationId: current.toLocationId === (current.fromLocationId || preferredSource(nextBootstrap, location?.id || '')) ? '' : current.toLocationId
      }));
    } catch (cause) {
      setError(message(cause, 'Transfers could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [connected, location?.id, userId, workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(()=>{if(!initialTransferId||openedTarget.current===initialTransferId||!buckets)return;openedTarget.current=initialTransferId;const match=[...buckets.awaitingMyAcceptance,...buckets.recentlySent,...buckets.recentlyReceived,...buckets.needsAttention].find((item)=>item.id===initialTransferId);if(!match){setError(connected?'The linked transfer is unavailable or no longer authorised.':'This transfer is not in the offline snapshot.');return;}if(match.direction==='incoming'||buckets.awaitingMyAcceptance.some((item)=>item.id===match.id)){setSelectedIncoming(match);setReceived(Object.fromEntries(match.items.map((item)=>[item.stockItemId,String(item.quantity)])));setView('incoming');}else setNotice(`${match.transactionReference||match.id} is visible in the transfer history.`);},[buckets,connected,initialTransferId]);

  useEffect(() => {
    let active = true;
    void transferRecoveryStore.get(workspaceId, userId).then((recovery) => {
      if (!active) return;
      if (recovery) {
        setDraft(fromRecovery(recovery));
        setNotice('Recovered your unfinished internal transfer.');
      }
      setRecoveryLoaded(true);
    });
    return () => { active = false; };
  }, [userId, workspaceId]);

  useEffect(() => {
    if (!recoveryLoaded || !draft.lines.length || view === 'complete') return;
    void transferRecoveryStore.set({
      workspaceId,
      userId,
      ...draft,
      updatedAt: new Date().toISOString()
    }).catch(() => undefined);
  }, [draft, recoveryLoaded, userId, view, workspaceId]);

  const source = bootstrap?.locations.find((entry) => entry.id === draft.fromLocationId) || null;
  const destination = bootstrap?.locations.find((entry) => entry.id === draft.toLocationId) || null;
  const validLines = useMemo(() => draft.lines.filter((line) => Number(line.quantity) > 0), [draft.lines]);

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!connected) throw new Error('Reconnect before searching KCP stock.');
      if (!draft.fromLocationId) throw new Error('Choose the source location first.');
      if (query.trim().length < 2) throw new Error('Enter at least two characters to search.');
      const items = await searchTransferItems(workspaceId, query.trim(), draft.fromLocationId);
      setSearchResults(items.filter((item) => !draft.lines.some((line) => line.item.id === item.id)));
      if (!items.length) setNotice('No active stocked items match that search.');
    }, 'Could not search KCP stock.');
  };

  const resolveBarcode = async (value: string) => {
    if (!connected) throw new Error('Reconnect before looking up a barcode.');
    if (!draft.fromLocationId) throw new Error('Choose the source location first.');
    const clean = value.trim();
    if (!clean) throw new Error('Enter or scan a barcode first.');
    const items = await searchTransferItems(workspaceId, clean, draft.fromLocationId);
    const matches = items.filter((entry) => entry.barcodes.some((code) => code === clean));
    if (!matches.length) throw new Error('No active KCP stock item matches that barcode.');
    if (matches.length > 1) throw new Error('This barcode belongs to more than one stock item. Correct it in KCP before transferring stock.');
    const item = matches[0];
    addItem(item, item.uoms.find((uom) => uom.barcode === clean)?.name);
    setBarcode(clean);
  };

  const scan = () => void run(async () => resolveBarcode(await scanBarcodeWithDevice()), 'The barcode could not be scanned.');
  const manualBarcode = (event: React.FormEvent) => { event.preventDefault(); void run(() => resolveBarcode(barcode), 'The barcode could not be resolved.'); };

  const addItem = (item: TransferItem, selectedUomName = item.baseUom) => {
    setDraft((current) => current.lines.some((line) => line.item.id === item.id) ? current : {
      ...current,
      lines: [...current.lines, { item, quantity: '', selectedUomName }]
    });
    setSearchResults([]);
    setQuery('');
    setNotice(`${item.name} added to the transfer.`);
  };

  const updateLine = (itemId: string, patch: Partial<TransferDraftLine>) => {
    setDraft((current) => ({ ...current, lines: current.lines.map((line) => line.item.id === itemId ? { ...line, ...patch } : line) }));
  };

  const changeSource = (fromLocationId: string) => {
    if (fromLocationId === draft.fromLocationId) return true;
    if (draft.lines.length && !window.confirm('Changing the source clears the current item list because stock availability is location-specific. Continue?')) return false;
    setDraft((current) => ({ ...current, fromLocationId, toLocationId: current.toLocationId === fromLocationId ? '' : current.toLocationId, lines: [] }));
    setSearchResults([]);
    return true;
  };

  const selectRouteLocation = (selected: OperationalLocationOption) => {
    if (locationPicker === 'source') return changeSource(selected.id);
    if (selected.id === draft.fromLocationId) return false;
    setDraft((current) => ({ ...current, toLocationId: selected.id }));
    return true;
  };

  const openReview = () => {
    setError('');
    if (!source || !destination) { setError('Choose different source and destination locations.'); return; }
    if (!draft.lines.length) { setError('Add at least one stock item.'); return; }
    if (validLines.length !== draft.lines.length) { setError('Every item needs a quantity greater than zero.'); return; }
    setConfirmed(false);
    setView('review');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const submit = () => void run(async () => {
    if (!connected) throw new Error('Reconnect before posting this transfer.');
    if (!confirmed || !source || !destination) throw new Error('Review and confirm the transfer first.');
    const committed = await createInternalTransfer(workspaceId, {
      idempotencyKey: draft.clientActionId,
      fromLocationId: source.id,
      toLocationId: destination.id,
      note: draft.note.trim(),
      occurredAt: draft.occurredAt,
      lines: draft.lines.map((line) => ({
        stockItemId: line.item.id,
        quantity: Number(line.quantity),
        uom: line.selectedUomName === line.item.baseUom ? 'base' : line.selectedUomName
      }))
    });
    await transferRecoveryStore.clear(workspaceId, userId);
    if (isApprovalPending(committed)) {
      await onActionEvent?.('waiting', `Awaiting approval ${committed.requestId}`);
      setNotice(`Transfer submitted for approval (${committed.requestId}). Stock has not moved.`);
      setDraft(emptyDraft(location?.id || ''));
      setConfirmed(false);
      setView('dashboard');
      await refresh();
      return;
    }
    setResult(committed);
    await onActionEvent?.('complete', committed.transactionReference || committed.transferId);
    setView('complete');
  }, 'Transfer could not be posted. Your draft remains safely saved.');

  const openIncoming = (transfer: TransferSummary) => {
    setSelectedIncoming(transfer);
    setReceived(Object.fromEntries(transfer.items.map((item) => [item.stockItemId, String(item.quantity)])));
    setRejectReason('');
    setConfirmed(false);
    setError('');
    setView('incoming');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const accept = () => void run(async () => {
    if (!connected || !selectedIncoming) throw new Error('Reconnect before accepting this transfer.');
    if (!confirmed) throw new Error('Confirm the received quantities first.');
    const lines = selectedIncoming.items.map((item) => {
      const receivedQty = Number(received[item.stockItemId]);
      if (!Number.isFinite(receivedQty) || receivedQty < 0 || receivedQty > item.quantity) throw new Error(`${item.name} must be between 0 and ${formatQuantity(item.quantity)}.`);
      return { stockItemId: item.stockItemId, receivedQty };
    });
    await acceptIncomingTransfer(workspaceId, selectedIncoming.id, lines);
    await onActionEvent?.('complete', selectedIncoming.transactionReference || selectedIncoming.id);
    setNotice('Incoming transfer accepted and stock updated by KCP.');
    setView('dashboard');
    await refresh();
  }, 'Incoming transfer could not be accepted.');

  const reject = () => void run(async () => {
    if (!connected || !selectedIncoming) throw new Error('Reconnect before rejecting this transfer.');
    if (!confirmed) throw new Error('Confirm this rejection first.');
    if (!rejectReason.trim()) throw new Error('Enter a reason before rejecting the transfer.');
    await rejectIncomingTransfer(workspaceId, selectedIncoming.id, rejectReason.trim());
    await onActionEvent?.('reject', rejectReason.trim());
    setNotice('Incoming transfer rejected. KCP has recorded the reversal.');
    setView('dashboard');
    await refresh();
  }, 'Incoming transfer could not be rejected.');

  const discard = async () => {
    await transferRecoveryStore.clear(workspaceId, userId);
    setDraft(emptyDraft(preferredSource(bootstrap, location?.id || '')));
    setQuery('');
    setBarcode('');
    setSearchResults([]);
    setNotice('');
    setError('');
    setView('dashboard');
  };

  const startNew = () => {
    setError('');
    setView('create');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (loading && !bootstrap) return <div className="screen operation-loading"><LoaderCircle className="spin" size={28} /><span>Loading transfers…</span></div>;

  if (view === 'complete' && result) {
    return <TransferComplete result={result} onDone={() => { setDraft(emptyDraft(preferredSource(bootstrap, location?.id || ''))); setResult(null); setView('dashboard'); void refresh(); }} />;
  }

  if (view === 'review' && source && destination) {
    return <TransferReview draft={draft} sourceName={source.name} destinationName={destination.name} connected={connected} busy={busy} confirmed={confirmed} error={error} onConfirmed={setConfirmed} onBack={() => setView('create')} onSubmit={submit} />;
  }

  if (view === 'incoming' && selectedIncoming) {
    return <IncomingTransfer transfer={selectedIncoming} received={received} rejectReason={rejectReason} connected={connected} busy={busy} confirmed={confirmed} error={error} onReceived={(id, value) => setReceived((current) => ({ ...current, [id]: value }))} onReason={setRejectReason} onConfirmed={setConfirmed} onBack={() => setView('dashboard')} onAccept={accept} onReject={reject} />;
  }

  if (view === 'create' && bootstrap) {
    return (
      <div className="screen transfer-create-screen">
        <header className="count-header"><button className="icon-button" type="button" onClick={() => setView('dashboard')} aria-label="Back to transfers"><ArrowLeft size={19} /></button><div><p className="eyebrow">Internal transfer</p><h1>Build transfer</h1></div><span /></header>
        {!connected && <div className="sync-state is-offline"><CloudOff size={17} /> Draft changes stay on this device. Search and submission require KCP.</div>}
        {error && <div className="message message-error operation-message" role="alert">{error}</div>}
        {notice && <div className="message message-success operation-message" role="status">{notice}</div>}

        <section className="operation-section transfer-route-card">
          <div className="section-title"><div><p className="eyebrow">Step 1</p><h2>Transfer route</h2></div></div>
          <div className="transfer-route-field"><span className="transfer-route-label">From</span><button className={`transfer-route-selector ${source ? 'has-selection' : ''}`} type="button" onClick={() => setLocationPicker('source')} aria-label="Select source location"><span className="transfer-route-icon"><MapPin size={19} /></span><span><strong>{source?.name || 'Choose source'}</strong><small>{source ? `${source.kind || 'KCP location'}${source.isDefault ? ' · Default' : ''}` : 'Where stock will leave from'}</small></span><ChevronRight size={18} /></button></div>
          <span className="transfer-route-arrow"><ArrowDown size={17} /></span>
          <div className="transfer-route-field"><span className="transfer-route-label">To</span><button className={`transfer-route-selector ${destination ? 'has-selection' : ''}`} type="button" disabled={!source} onClick={() => setLocationPicker('destination')} aria-label="Select destination location"><span className="transfer-route-icon destination"><MapPin size={19} /></span><span><strong>{destination?.name || 'Choose destination'}</strong><small>{destination ? destination.kind || 'KCP location' : source ? 'Where stock will arrive' : 'Choose a source first'}</small></span><ChevronRight size={18} /></button></div>
        </section>

        <section className="operation-section">
          <div className="section-title"><div><p className="eyebrow">Step 2</p><h2>Add stock items</h2></div><span className="count-badge">{draft.lines.length}</span></div>
          <button className="scan-action transfer-scan" type="button" disabled={busy || !connected || !draft.fromLocationId} onClick={scan}><span><ScanBarcode size={27} /></span><div><strong>Scan item</strong><small>Add by KCP barcode</small></div>{busy ? <LoaderCircle className="spin" size={20} /> : <ChevronRight size={20} />}</button>
          <form className="manual-barcode-form" onSubmit={manualBarcode}><label className="input-shell"><ScanBarcode size={18} /><input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Enter barcode manually" autoCapitalize="off" /><button className="input-inline-button" type="submit" disabled={busy || !connected}>Add</button></label></form>
          <form className="item-search-panel" onSubmit={search}><p>Or search by item name, SKU, category or barcode.</p><label className="input-shell"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source stock" /><button className="input-inline-button" type="submit" disabled={busy || !connected}>Search</button></label>{searchResults.length > 0 && <div className="item-search-results">{searchResults.map((item) => <button type="button" key={item.id} onClick={() => addItem(item)}><PackagePlus size={18} /><span><strong>{item.name}</strong><small>{formatQuantity(item.onHand)} {item.baseUom} on hand · {[item.sku, item.category].filter(Boolean).join(' · ')}</small></span><ChevronRight size={17} /></button>)}</div>}</form>
          <div className="transfer-lines">{draft.lines.map((line) => <TransferLineCard key={line.item.id} line={line} onChange={(patch) => updateLine(line.item.id, patch)} onRemove={() => setDraft((current) => ({ ...current, lines: current.lines.filter((entry) => entry.item.id !== line.item.id) }))} />)}</div>
        </section>

        {draft.lines.length > 0 && <section className="operation-section"><div className="section-title"><div><p className="eyebrow">Step 3</p><h2>Transfer note</h2></div></div><label className="operation-field"><span>Optional note</span><textarea value={draft.note} maxLength={240} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Add delivery or audit context" /></label></section>}
        {draft.lines.length > 0 && <button className="button button-primary button-large operation-submit" type="button" onClick={openReview}>Review transfer <ChevronRight size={18} /></button>}
        {draft.lines.length > 0 && <button className="discard-operation" type="button" onClick={() => { void discard(); }}><RotateCcw size={14} /> Discard this saved transfer</button>}
        <OperationalLocationPicker
          open={locationPicker !== null}
          title={locationPicker === 'source' ? 'Choose source' : 'Choose destination'}
          locations={bootstrap.locations}
          selectedId={locationPicker === 'source' ? draft.fromLocationId : draft.toLocationId}
          excludedIds={locationPicker === 'destination' ? [draft.fromLocationId] : []}
          onSelect={selectRouteLocation}
          onClose={() => setLocationPicker(null)}
        />
      </div>
    );
  }

  return (
    <div className="screen transfers-screen">
      <header className="operation-hero transfer-hero"><span className="operation-hero-icon"><Truck size={27} /></span><p className="eyebrow">Stock transfers</p><h1>Transfers</h1><p>Move stock between your locations and safely process incoming deliveries.</p><button className="location-pill" type="button" onClick={onLocation}><MapPin size={15} /><span>{location?.displayName || 'Choose a location'}</span><ChevronRight size={15} /></button></header>
      {!connected && <div className="sync-state is-offline"><CloudOff size={17} /> Transfer lists may be out of date. Live actions require KCP.</div>}
      {error && <div className="message message-error operation-message" role="alert">{error}</div>}
      {notice && <div className="message message-success operation-message" role="status">{notice}</div>}
      <section className="transfer-summary-grid"><div><strong>{buckets.counts.awaitingMyAcceptance}</strong><span>Awaiting</span></div><div><strong>{buckets.counts.recentlySent}</strong><span>Sent</span></div><div><strong>{buckets.counts.recentlyReceived}</strong><span>Received</span></div></section>
      <button className="button button-primary button-large transfer-new" type="button" disabled={!bootstrap?.canCreateInternal} onClick={startNew}><Send size={18} /> New internal transfer</button>
      {!bootstrap?.canCreateInternal && <p className="transfer-help">You need access to at least two active locations to create an internal transfer.</p>}
      <TransferList title="Awaiting acceptance" eyebrow="Needs action" icon={<Inbox size={18} />} items={buckets.awaitingMyAcceptance} empty="No incoming transfers are waiting." onOpen={openIncoming} actionable />
      <TransferList title="Recently sent" eyebrow="Outbound" icon={<Send size={18} />} items={buckets.recentlySent} empty="No recent transfers sent." />
      <TransferList title="Recently received" eyebrow="Inbound" icon={<CheckCircle2 size={18} />} items={buckets.recentlyReceived} empty="No recent transfers received." />
      <button className="discard-operation" type="button" disabled={loading || !connected} onClick={() => void refresh()}><RefreshCw className={loading ? 'spin' : ''} size={14} /> Refresh transfers</button>
    </div>
  );
}

function TransferLineCard({ line, onChange, onRemove }: { line: TransferDraftLine; onChange: (patch: Partial<TransferDraftLine>) => void; onRemove: () => void }) {
  const uom = line.item.uoms.find((entry) => entry.name === line.selectedUomName) || line.item.uoms[0];
  const base = Number(line.quantity) > 0 ? Number(line.quantity) * (uom?.quantityInBase || 1) : 0;
  return <article className="transfer-line-card"><div className="transfer-line-title"><div><strong>{line.item.name}</strong><small>{formatQuantity(line.item.onHand)} {line.item.baseUom} available</small></div><button type="button" onClick={onRemove} aria-label={`Remove ${line.item.name}`}><Trash2 size={17} /></button></div><div className="transfer-line-inputs"><label><span>Quantity</span><input aria-label={`${line.item.name} quantity`} type="number" min="0" step="any" inputMode="decimal" value={line.quantity} onChange={(event) => onChange({ quantity: event.target.value })} placeholder="0" /></label><label><span>Unit</span><select aria-label={`${line.item.name} unit`} value={line.selectedUomName} onChange={(event) => onChange({ selectedUomName: event.target.value })}>{line.item.uoms.map((entry) => <option key={entry.id} value={entry.name}>{entry.name}</option>)}</select></label></div><p>{base > 0 ? `Provisional: ${formatQuantity(base)} ${line.item.baseUom}` : 'Enter a quantity'} · KCP verifies on submission</p></article>;
}

function TransferList({ title, eyebrow, icon, items, empty, onOpen, actionable = false }: { title: string; eyebrow: string; icon: React.ReactNode; items: TransferSummary[]; empty: string; onOpen?: (item: TransferSummary) => void; actionable?: boolean }) {
  return <section className="operation-section transfer-list-section"><div className="section-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{icon}</div><div className="transfer-list">{items.length ? items.map((item) => <button key={item.id} type="button" disabled={!onOpen} onClick={() => onOpen?.(item)}><span className="transfer-list-icon">{icon}</span><span><strong>{item.fromLocationName || item.fromSiteName || 'Source'} → {item.toLocationName || item.toSiteName || 'Destination'}</strong><small>{item.transactionReference || item.id} · {item.lineCount} item{item.lineCount === 1 ? '' : 's'}</small><small>{formatDate(item.requestedAt)} · {formatStatus(item.status)}</small></span>{actionable && <ChevronRight size={18} />}</button>) : <div className="transfer-empty">{empty}</div>}</div></section>;
}

function TransferReview({ draft, sourceName, destinationName, connected, busy, confirmed, error, onConfirmed, onBack, onSubmit }: { draft: Draft; sourceName: string; destinationName: string; connected: boolean; busy: boolean; confirmed: boolean; error: string; onConfirmed: (value: boolean) => void; onBack: () => void; onSubmit: () => void }) {
  return <div className="screen review-screen transfer-review"><header className="count-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to transfer entry"><ArrowLeft size={19} /></button><div><p className="eyebrow">Final review</p><h1>Confirm transfer</h1></div><span /></header>{error && <div className="message message-error operation-message" role="alert">{error}</div>}<section className="wastage-review-card"><div className="review-item transfer-review-item"><Truck size={22} /><span><strong>{sourceName} → {destinationName}</strong><small>{draft.lines.length} stock item{draft.lines.length === 1 ? '' : 's'}</small></span></div><div className="transfer-review-lines">{draft.lines.map((line) => <div key={line.item.id}><span><strong>{line.item.name}</strong><small>{line.quantity} {line.selectedUomName}</small></span><b>{formatQuantity(Number(line.quantity) * (line.item.uoms.find((entry) => entry.name === line.selectedUomName)?.quantityInBase || 1))} {line.item.baseUom}</b></div>)}</div>{draft.note && <p className="transfer-review-note">{draft.note}</p>}</section><div className="server-authority-note"><ShieldCheck size={20} /><div><strong>KCP remains authoritative</strong><p>The server rechecks permissions, locations, stock items and stored UOM ratios, then posts one idempotent transfer.</p></div></div>{!connected && <div className="warning-panel"><CloudOff size={18} /><span>Reconnect before posting this stock movement.</span></div>}<label className="commit-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} /><span><strong>I confirm this internal transfer</strong><small>Live stock will move from {sourceName} to {destinationName}.</small></span></label><button className="button button-primary button-large operation-submit" type="button" disabled={!confirmed || !connected || busy} onClick={onSubmit}>{busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />} Post transfer in KCP</button><p className="irreversible-note"><TriangleAlert size={15} /> Use the transaction reference for later audit or correction.</p></div>;
}

function IncomingTransfer({ transfer, received, rejectReason, connected, busy, confirmed, error, onReceived, onReason, onConfirmed, onBack, onAccept, onReject }: { transfer: TransferSummary; received: Record<string, string>; rejectReason: string; connected: boolean; busy: boolean; confirmed: boolean; error: string; onReceived: (id: string, value: string) => void; onReason: (value: string) => void; onConfirmed: (value: boolean) => void; onBack: () => void; onAccept: () => void; onReject: () => void }) {
  return <div className="screen incoming-transfer-screen"><header className="count-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to transfers"><ArrowLeft size={19} /></button><div><p className="eyebrow">Incoming transfer</p><h1>{transfer.transactionReference || transfer.id}</h1></div><span /></header>{!connected && <div className="sync-state is-offline"><CloudOff size={17} /> Reconnect before accepting or rejecting this delivery.</div>}{error && <div className="message message-error operation-message" role="alert">{error}</div>}<section className="incoming-route"><span><small>From</small><strong>{transfer.fromLocationName || transfer.fromSiteName}</strong></span><ChevronRight size={18} /><span><small>To</small><strong>{transfer.toLocationName || transfer.toSiteName}</strong></span></section><section className="operation-section"><div className="section-title"><div><p className="eyebrow">Delivery check</p><h2>Quantities received</h2></div><span className="count-badge">{transfer.items.length}</span></div><div className="incoming-lines">{transfer.items.map((item) => <article key={item.stockItemId}><div><strong>{item.name}</strong><small>Shipped {formatQuantity(item.quantity)} {item.unit}</small></div><label><span>Received</span><input aria-label={`${item.name} received quantity`} type="number" min="0" max={item.quantity} step="any" inputMode="decimal" value={received[item.stockItemId] ?? ''} onChange={(event) => onReceived(item.stockItemId, event.target.value)} /></label></article>)}</div></section>{transfer.note && <div className="incoming-note"><strong>Sender note</strong><p>{transfer.note}</p></div>}<label className="operation-field"><span>Reason required only when rejecting</span><textarea value={rejectReason} maxLength={240} onChange={(event) => onReason(event.target.value)} placeholder="Explain why this delivery is being rejected" /></label><label className="commit-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} /><span><strong>I checked this delivery</strong><small>Accepting posts the entered quantities; rejecting records the reason and reversal.</small></span></label><div className="incoming-actions"><button className="button button-danger button-large" type="button" disabled={!confirmed || !rejectReason.trim() || !connected || busy} onClick={onReject}>Reject transfer</button><button className="button button-primary button-large" type="button" disabled={!confirmed || !connected || busy} onClick={onAccept}>{busy ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />} Accept quantities</button></div></div>;
}

function TransferComplete({ result, onDone }: { result: TransferResult; onDone: () => void }) {
  return <div className="screen complete-screen"><section className="complete-card transfer-complete-card"><span className="complete-icon"><CheckCircle2 size={35} /></span><p className="eyebrow">{result.duplicate ? 'Already posted safely' : 'Posted successfully'}</p><h1>Transfer complete</h1><p>{result.lineCount} stock item{result.lineCount === 1 ? '' : 's'} moved through KCP.</p><div className="transaction-reference"><span>Transaction reference</span><strong>{result.transactionReference || result.transferId}</strong></div><button className="button button-primary button-large" type="button" onClick={onDone}>Back to transfers</button></section></div>;
}

function emptyDraft(fromLocationId: string): Draft {
  return { clientActionId: createId('transfer'), fromLocationId, toLocationId: '', lines: [], note: '', occurredAt: new Date().toISOString() };
}

function fromRecovery(recovery: TransferRecovery): Draft {
  return { clientActionId: recovery.clientActionId, fromLocationId: recovery.fromLocationId, toLocationId: recovery.toLocationId, lines: recovery.lines, note: recovery.note, occurredAt: recovery.occurredAt };
}

function preferredSource(bootstrap: TransferBootstrap | null, locationId: string) {
  return bootstrap?.locations.find((entry) => entry.id === locationId)?.id || bootstrap?.locations.find((entry) => entry.isDefault)?.id || bootstrap?.locations[0]?.id || '';
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(date);
}

function formatStatus(value: string) {
  return String(value || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function message(cause: unknown, fallback: string) {
  if (cause instanceof ApiError && cause.message) return cause.message;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
