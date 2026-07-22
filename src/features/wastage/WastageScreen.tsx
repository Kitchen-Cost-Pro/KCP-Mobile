import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  LoaderCircle,
  MapPin,
  PackageSearch,
  RotateCcw,
  ScanBarcode,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert
} from 'lucide-react';
import { ApiError } from '../../core/api/client';
import { createId } from '../../core/id/createId';
import { useConnectivity } from '../../hooks/useConnectivity';
import type { KcpLocation } from '../../types/kcp';
import { scanBarcodeWithDevice } from './nativeBarcodeScanner';
import {
  lookupBarcode,
  postWastage,
  searchWastageItems,
  type BarcodeLookupResult,
  type WastageItem,
  type WastageLocation,
  type WastageResult,
  type WastageSearchItem,
  type WastageUom
} from './wastageApi';
import { wastageRecoveryStore, type WastageRecovery } from './wastageRecoveryStore';
import { isApprovalPending } from '../approvals/approvalSubmission';

type View = 'entry' | 'review' | 'complete';

type Draft = {
  clientActionId: string;
  location: WastageLocation | null;
  item: WastageItem | null;
  barcode: string;
  availableUoms: WastageUom[];
  selectedUomName: string;
  quantity: string;
  reason: string;
  customReason: string;
  note: string;
  occurredAt: string;
};

type Props = {
  workspaceId: string;
  userId: string;
  location: KcpLocation | null;
  canSearchItems: boolean;
  onLocation: () => void;
  onActionEvent?: (event: 'waiting' | 'complete' | 'reject', detail?: string) => Promise<void>;
};

const REASONS = ['Spoilage', 'Damaged', 'Expired', 'Preparation loss', 'Quality control', 'Other'];

export function WastageScreen({ workspaceId, userId, location, canSearchItems, onLocation, onActionEvent }: Props) {
  const connected = useConnectivity();
  const [view, setView] = useState<View>('entry');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(location));
  const [manualBarcode, setManualBarcode] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<WastageSearchItem[]>([]);
  const [result, setResult] = useState<WastageResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void wastageRecoveryStore.get(workspaceId, userId).then((recovery) => {
      if (!active) return;
      if (recovery) {
        setDraft(fromRecovery(recovery));
        setManualBarcode(recovery.barcode);
        setNotice('Recovered your unfinished wastage entry.');
      }
      setRecoveryLoaded(true);
    });
    return () => { active = false; };
  }, [userId, workspaceId]);

  useEffect(() => {
    if (!recoveryLoaded || draft.item || !location) return;
    setDraft((current) => ({ ...current, location: toWastageLocation(location) }));
  }, [draft.item, location, recoveryLoaded]);

  useEffect(() => {
    if (!recoveryLoaded || !draft.item || !draft.location || view === 'complete') return;
    void wastageRecoveryStore.set({
      workspaceId,
      userId,
      clientActionId: draft.clientActionId,
      location: draft.location,
      item: draft.item,
      barcode: draft.barcode,
      availableUoms: draft.availableUoms,
      selectedUomName: draft.selectedUomName,
      quantity: draft.quantity,
      reason: draft.reason,
      customReason: draft.customReason,
      note: draft.note,
      occurredAt: draft.occurredAt,
      updatedAt: new Date().toISOString()
    }).catch(() => undefined);
  }, [draft, recoveryLoaded, userId, view, workspaceId]);

  const activeUom = useMemo(
    () => draft.availableUoms.find((uom) => uom.name === draft.selectedUomName) || null,
    [draft.availableUoms, draft.selectedUomName]
  );
  const quantity = Number(draft.quantity);
  const provisionalBase = Number.isFinite(quantity) && quantity > 0 && activeUom
    ? quantity * activeUom.quantityInBase
    : 0;
  const finalReason = draft.reason === 'Other' ? draft.customReason.trim() : draft.reason;

  const applyBarcodeResult = useCallback((lookup: BarcodeLookupResult) => {
    if (!lookup.matched || !lookup.item || !lookup.barcodeMatch) {
      if (lookup.reason === 'ambiguous') {
        const candidates = (lookup.candidates || []).map((candidate) => candidate.name).join(', ');
        throw new Error(`This barcode belongs to more than one item${candidates ? `: ${candidates}` : ''}. Correct it in KCP before recording wastage.`);
      }
      throw new Error('No active KCP stock item matches that barcode. Nothing was created.');
    }
    if (!lookup.item.trackInventory) throw new Error('This item is not inventory-tracked and cannot be used for wastage.');
    const base: WastageUom = {
      id: `${lookup.item.id}:base`,
      name: lookup.item.baseUom,
      quantityInBase: 1,
      isBase: true
    };
    const matched: WastageUom = {
      id: lookup.barcodeMatch.uomId || `${lookup.item.id}:base`,
      name: lookup.barcodeMatch.uomName,
      quantityInBase: lookup.barcodeMatch.quantityInBase,
      isBase: lookup.barcodeMatch.type === 'BASE_UOM',
      barcode: lookup.barcode
    };
    const available = matched.isBase ? [base] : [matched, base];
    setDraft((current) => ({
      ...current,
      location: lookup.location || current.location,
      item: lookup.item || null,
      barcode: lookup.barcode,
      availableUoms: available,
      selectedUomName: matched.name,
      quantity: ''
    }));
    setManualBarcode(lookup.barcode);
    setSearchResults([]);
    setItemSearch('');
    setNotice(`${lookup.item.name} matched as ${matched.name}.`);
  }, []);

  const resolveBarcode = useCallback(async (barcode: string) => {
    if (!connected) throw new Error('Reconnect before looking up a barcode.');
    if (!draft.location?.id) throw new Error('Choose a location before scanning stock.');
    const clean = barcode.trim();
    if (!clean) throw new Error('Enter or scan a barcode first.');
    const lookup = await lookupBarcode(workspaceId, clean, draft.location.id);
    applyBarcodeResult(lookup);
  }, [applyBarcodeResult, connected, draft.location?.id, workspaceId]);

  const run = useCallback(async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      setError(message(cause, fallback));
    } finally {
      setBusy(false);
    }
  }, []);

  const scan = () => void run(async () => {
    const barcode = await scanBarcodeWithDevice();
    await resolveBarcode(barcode);
  }, 'The barcode could not be scanned.');

  const submitManualBarcode = (event: React.FormEvent) => {
    event.preventDefault();
    void run(() => resolveBarcode(manualBarcode), 'The barcode could not be resolved.');
  };

  const searchItems = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!connected) throw new Error('Reconnect before searching KCP items.');
      if (!draft.location?.id) throw new Error('Choose a location before searching stock.');
      if (itemSearch.trim().length < 2) throw new Error('Enter at least two characters to search.');
      const items = await searchWastageItems(workspaceId, itemSearch.trim(), draft.location.id);
      setSearchResults(items);
      if (!items.length) setNotice('No active stocked items match that search.');
    }, 'Could not search KCP stock items.');
  };

  const chooseItem = (item: WastageSearchItem) => {
    setDraft((current) => ({
      ...current,
      item,
      barcode: '',
      availableUoms: item.uoms,
      selectedUomName: item.baseUom,
      quantity: ''
    }));
    setSearchResults([]);
    setNotice(`${item.name} selected.`);
    setError('');
  };

  const removeItem = () => {
    setDraft((current) => ({
      ...current,
      item: null,
      barcode: '',
      availableUoms: [],
      selectedUomName: '',
      quantity: ''
    }));
    setManualBarcode('');
    setNotice('');
    setError('');
  };

  const openReview = () => {
    setError('');
    if (!draft.location) { setError('Choose a location before recording wastage.'); return; }
    if (!draft.item) { setError('Scan or search for a stock item first.'); return; }
    if (!activeUom) { setError('Choose a valid unit of measure.'); return; }
    if (!Number.isFinite(quantity) || quantity <= 0) { setError('Enter a quantity greater than zero.'); return; }
    if (!finalReason) { setError('Choose or enter a wastage reason.'); return; }
    setConfirmed(false);
    setView('review');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const submit = () => void run(async () => {
    if (!connected) throw new Error('Reconnect before submitting wastage.');
    if (!confirmed) throw new Error('Confirm the reviewed wastage entry before submitting.');
    if (!draft.location || !draft.item || !activeUom) throw new Error('This wastage entry is incomplete.');
    const committed = await postWastage(workspaceId, {
      idempotencyKey: draft.clientActionId,
      stockItemId: draft.item.id,
      locationId: draft.location.id,
      quantity,
      uom: activeUom.isBase ? 'base' : activeUom.name,
      wasteReason: finalReason,
      note: draft.note.trim(),
      occurredAt: draft.occurredAt
    });
    await wastageRecoveryStore.clear(workspaceId, userId);
    if (isApprovalPending(committed)) {
      await onActionEvent?.('waiting', `Awaiting approval ${committed.requestId}`);
      setNotice(`Wastage submitted for approval (${committed.requestId}). Stock has not changed.`);
      setDraft(emptyDraft(location));
      setConfirmed(false);
      setView('entry');
      return;
    }
    setResult(committed);
    await onActionEvent?.('complete', committed.transactionId);
    setView('complete');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, 'Wastage could not be recorded. Your entry remains safely saved.');

  const reset = async () => {
    await wastageRecoveryStore.clear(workspaceId, userId);
    setDraft(emptyDraft(location));
    setManualBarcode('');
    setItemSearch('');
    setSearchResults([]);
    setResult(null);
    setConfirmed(false);
    setError('');
    setNotice('');
    setView('entry');
  };

  if (!recoveryLoaded) {
    return <div className="screen operation-loading"><LoaderCircle className="spin" size={28} /><span>Checking saved wastage…</span></div>;
  }

  if (view === 'complete' && result) return <WastageComplete result={result} onReset={() => { void reset(); }} />;

  if (view === 'review' && draft.item && draft.location && activeUom) {
    return (
      <WastageReview
        draft={draft}
        uom={activeUom}
        provisionalBase={provisionalBase}
        finalReason={finalReason}
        connected={connected}
        busy={busy}
        confirmed={confirmed}
        error={error}
        onConfirmed={setConfirmed}
        onBack={() => { setConfirmed(false); setView('entry'); }}
        onSubmit={submit}
      />
    );
  }

  return (
    <div className="screen wastage-screen">
      <header className="operation-hero wastage-hero">
        <span className="operation-hero-icon"><Trash2 size={27} /></span>
        <p className="eyebrow">Live operations</p>
        <h1>Record wastage</h1>
        <p>Scan an item, capture the loss, and let KCP calculate the authoritative stock impact.</p>
        <button className="location-pill" type="button" onClick={onLocation} disabled={Boolean(draft.item)} title={draft.item ? 'Change the item before changing location' : undefined}>
          <MapPin size={15} /> <span>{draft.location?.name || 'Choose a location'}</span><ChevronRight size={15} />
        </button>
      </header>

      {!connected && <div className="sync-state is-offline"><CloudOff size={17} /> Offline entry is saved on this device. Lookup and submission require KCP.</div>}
      {error && <div className="message message-error operation-message" role="alert">{error}</div>}
      {notice && <div className="message message-success operation-message" role="status">{notice}</div>}

      <section className="operation-section">
        <div className="section-title"><div><p className="eyebrow">Step 1</p><h2>Choose the item</h2></div>{draft.item && <button className="text-button" type="button" onClick={removeItem}>Change</button>}</div>
        {draft.item ? (
          <SelectedItemCard item={draft.item} barcode={draft.barcode} />
        ) : (
          <>
            <button className="scan-action" type="button" disabled={busy || !connected || !draft.location} onClick={scan}>
              <span><ScanBarcode size={27} /></span>
              <div><strong>Scan barcode</strong><small>Use the KCP Lite camera scanner</small></div>
              {busy ? <LoaderCircle className="spin" size={20} /> : <ChevronRight size={20} />}
            </button>
            <form className="manual-barcode-form" onSubmit={submitManualBarcode}>
              <label className="input-shell"><ScanBarcode size={18} /><input value={manualBarcode} onChange={(event) => setManualBarcode(event.target.value)} placeholder="Enter barcode manually" inputMode="numeric" autoCapitalize="off" /><button className="input-inline-button" type="submit" disabled={busy || !connected}>Look up</button></label>
            </form>
            {canSearchItems && (
              <form className="item-search-panel" onSubmit={searchItems}>
                <p>Barcode unavailable? Search by item name, SKU or category.</p>
                <label className="input-shell"><Search size={18} /><input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search KCP stock" /><button className="input-inline-button" type="submit" disabled={busy || !connected}>Search</button></label>
                {searchResults.length > 0 && <div className="item-search-results">{searchResults.map((item) => <button type="button" key={item.id} onClick={() => chooseItem(item)}><PackageSearch size={18} /><span><strong>{item.name}</strong><small>{[item.sku, item.category, item.baseUom].filter(Boolean).join(' · ')}</small></span><ChevronRight size={17} /></button>)}</div>}
              </form>
            )}
          </>
        )}
      </section>

      {draft.item && (
        <section className="operation-section">
          <div className="section-title"><div><p className="eyebrow">Step 2</p><h2>Quantity lost</h2></div></div>
          <div className="wastage-quantity-card">
            <label><span>Quantity</span><input type="number" min="0" step="any" inputMode="decimal" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} placeholder="0" aria-label="Wastage quantity" /></label>
            <label><span>Unit</span><select value={draft.selectedUomName} onChange={(event) => setDraft((current) => ({ ...current, selectedUomName: event.target.value }))}>{draft.availableUoms.map((uom) => <option key={uom.id} value={uom.name}>{uom.name}</option>)}</select></label>
            <div className="provisional-impact"><span>Provisional conversion</span><strong>{provisionalBase > 0 ? `${formatQuantity(provisionalBase)} ${draft.item.baseUom}` : '—'}</strong><small>KCP verifies the stored UOM ratio on submission.</small></div>
          </div>
        </section>
      )}

      {draft.item && (
        <section className="operation-section">
          <div className="section-title"><div><p className="eyebrow">Step 3</p><h2>Reason and note</h2></div></div>
          <div className="reason-grid">{REASONS.map((reason) => <button className={draft.reason === reason ? 'is-selected' : ''} type="button" key={reason} onClick={() => setDraft((current) => ({ ...current, reason }))}>{reason}</button>)}</div>
          {draft.reason === 'Other' && <label className="operation-field"><span>Wastage reason</span><input value={draft.customReason} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, customReason: event.target.value }))} placeholder="Enter the reason" /></label>}
          <label className="operation-field"><span>Optional note</span><textarea value={draft.note} maxLength={240} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Add context for the audit trail" /></label>
        </section>
      )}

      {draft.item && <button className="button button-primary button-large operation-submit" type="button" onClick={openReview}>Review wastage <ChevronRight size={18} /></button>}
      {draft.item && <button className="discard-operation" type="button" onClick={() => { void reset(); }}><RotateCcw size={14} /> Discard this saved entry</button>}
    </div>
  );
}

function SelectedItemCard({ item, barcode }: { item: WastageItem; barcode: string }) {
  return (
    <article className="selected-operation-item">
      <span><CheckCircle2 size={22} /></span>
      <div><strong>{item.name}</strong><p>{[item.sku, item.category, item.baseUom].filter(Boolean).join(' · ')}</p>{barcode && <small>Barcode {barcode}</small>}</div>
    </article>
  );
}

function WastageReview({ draft, uom, provisionalBase, finalReason, connected, busy, confirmed, error, onConfirmed, onBack, onSubmit }: {
  draft: Draft;
  uom: WastageUom;
  provisionalBase: number;
  finalReason: string;
  connected: boolean;
  busy: boolean;
  confirmed: boolean;
  error: string;
  onConfirmed: (value: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="screen review-screen wastage-review">
      <header className="count-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to wastage entry"><ArrowLeft size={19} /></button><div><p className="eyebrow">Final review</p><h1>Confirm wastage</h1></div><span /></header>
      {error && <div className="message message-error operation-message" role="alert">{error}</div>}
      <section className="wastage-review-card">
        <div className="review-item"><Trash2 size={22} /><span><strong>{draft.item?.name}</strong><small>{draft.location?.name}</small></span></div>
        <dl>
          <div><dt>Entered</dt><dd>{formatQuantity(Number(draft.quantity))} {uom.name}</dd></div>
          <div><dt>Provisional base</dt><dd>{formatQuantity(provisionalBase)} {draft.item?.baseUom}</dd></div>
          <div><dt>Reason</dt><dd>{finalReason}</dd></div>
          {draft.note && <div><dt>Note</dt><dd>{draft.note}</dd></div>}
        </dl>
      </section>
      <div className="server-authority-note"><ShieldCheck size={20} /><div><strong>KCP remains authoritative</strong><p>The server will revalidate the location, item, UOM ratio and cost before making one idempotent stock adjustment.</p></div></div>
      {!connected && <div className="warning-panel"><CloudOff size={18} /><span>Reconnect before recording this stock movement.</span></div>}
      <label className="commit-confirmation wastage-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} /><span><strong>I confirm this wastage entry</strong><small>The quantity and reason above will update live KCP stock.</small></span></label>
      <button className="button button-danger button-large operation-submit" type="button" disabled={!confirmed || !connected || busy} onClick={onSubmit}>{busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />} Record wastage in KCP</button>
      <p className="irreversible-note"><TriangleAlert size={15} /> This changes live stock. Use the transaction reference for any later audit or correction.</p>
    </div>
  );
}

function WastageComplete({ result, onReset }: { result: WastageResult; onReset: () => void }) {
  return (
    <div className="screen complete-screen">
      <section className="complete-card wastage-complete-card">
        <span className="complete-icon"><CheckCircle2 size={35} /></span>
        <p className="eyebrow">{result.duplicate ? 'Already recorded safely' : 'Recorded successfully'}</p>
        <h1>Wastage complete</h1>
        <p>{formatQuantity(result.originalQuantity)} {result.originalUom} of {result.stockItemName} was recorded.</p>
        <div className="transaction-reference"><span>Transaction reference</span><strong>{result.transactionId}</strong></div>
        <div className="complete-stats"><div><strong>{formatQuantity(result.baseQuantity)} {result.baseUom}</strong><span>stock impact</span></div><div><strong>{formatMoney(result.wastageValue, result.currency)}</strong><span>wastage value</span></div></div>
        <button className="button button-primary button-large" type="button" onClick={onReset}>Record another item</button>
      </section>
    </div>
  );
}

function emptyDraft(location: KcpLocation | null): Draft {
  return {
    clientActionId: createId('waste'),
    location: location ? toWastageLocation(location) : null,
    item: null,
    barcode: '',
    availableUoms: [],
    selectedUomName: '',
    quantity: '',
    reason: '',
    customReason: '',
    note: '',
    occurredAt: new Date().toISOString()
  };
}

function fromRecovery(recovery: WastageRecovery): Draft {
  return {
    clientActionId: recovery.clientActionId,
    location: recovery.location,
    item: recovery.item,
    barcode: recovery.barcode,
    availableUoms: recovery.availableUoms,
    selectedUomName: recovery.selectedUomName,
    quantity: recovery.quantity,
    reason: recovery.reason,
    customReason: recovery.customReason,
    note: recovery.note,
    occurredAt: recovery.occurredAt
  };
}

function toWastageLocation(location: KcpLocation): WastageLocation {
  return { id: location.id, name: location.displayName || location.name, kind: location.kind };
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatMoney(value: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function message(cause: unknown, fallback: string) {
  if (cause instanceof ApiError && cause.message) return cause.message;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
