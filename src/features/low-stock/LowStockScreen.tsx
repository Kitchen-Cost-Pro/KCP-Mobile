import { useCallback, useEffect, useMemo, useState } from 'react';
import { Barcode, Check, ChevronRight, CloudOff, LoaderCircle, MapPin, PackageCheck, PackageSearch, RefreshCw, Search, ShoppingCart } from 'lucide-react';
import { ApiError } from '../../core/api/client';
import { useConnectivity } from '../../hooks/useConnectivity';
import type { KcpLocation } from '../../types/kcp';
import type { StockLookupSeed } from '../scan/StockLookupScreen';
import { loadLowStock, type LowStockItem, type LowStockResponse } from './lowStockApi';
import { lowStockSnapshotStore } from './lowStockSnapshotStore';

export type LowStockPurchaseOrderIntent = {
  requestId: string;
  locationId: string;
  locationName: string;
  items: Array<{ stockItemId: string; name: string; suggestedOrderQuantity: number }>;
};

type Props = {
  workspaceId: string;
  userId: string;
  location: KcpLocation | null;
  canCreatePurchaseOrder: boolean;
  onLocation: () => void;
  onLookup: (item: StockLookupSeed) => void;
  onCreatePurchaseOrder: (intent: LowStockPurchaseOrderIntent) => void;
};

type Bucket = 'out_of_stock' | 'below_par';

export function LowStockScreen({ workspaceId, userId, location, canCreatePurchaseOrder, onLocation, onLookup, onCreatePurchaseOrder }: Props) {
  const connected = useConnectivity();
  const [response, setResponse] = useState<LowStockResponse | null>(null);
  const [bucket, setBucket] = useState<Bucket>('out_of_stock');
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(100);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshotAt, setSnapshotAt] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async (signal?: AbortSignal, manual = false) => {
    if (!location) { setResponse(null); setLoading(false); return; }
    if (manual) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      if (!connected) {
        const saved = await lowStockSnapshotStore.get(workspaceId, userId, location.id);
        if (signal?.aborted) return;
        setResponse(saved?.response || null);
        setSnapshotAt(saved?.savedAt || '');
        if (!saved) setError('No saved low-stock snapshot is available for this location yet.');
        return;
      }
      const next = await loadLowStock(workspaceId, location.id, signal);
      const savedAt = new Date().toISOString();
      setResponse(next);
      setSnapshotAt(savedAt);
      setSelected((current) => new Set([...current].filter((id) => next.items.some((item) => item.id === id))));
      await lowStockSnapshotStore.set({ workspaceId, userId, locationId: location.id, response: next, savedAt });
    } catch (cause) {
      if (signal?.aborted) return;
      const saved = await lowStockSnapshotStore.get(workspaceId, userId, location.id);
      if (saved) { setResponse(saved.response); setSnapshotAt(saved.savedAt); }
      setError(message(cause, saved ? 'Live low stock is unavailable. Showing the saved snapshot.' : 'Low stock could not be loaded.'));
    } finally {
      if (!signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [connected, location, userId, workspaceId]);

  useEffect(() => {
    setSelected(new Set());
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const items = useMemo(() => {
    const query = normalize(search);
    return (response?.items || []).filter((item) => item.status === bucket).filter((item) => !query || normalize([item.name, item.sku, item.category, ...item.barcodes].filter(Boolean).join(' ')).includes(query));
  }, [bucket, response, search]);
  const selectedItems = (response?.items || []).filter((item) => selected.has(item.id));
  const visibleItems = items.slice(0, visibleLimit);
  const orderAllowed = connected && canCreatePurchaseOrder && response?.canCreatePurchaseOrder === true;

  useEffect(() => { setVisibleLimit(100); }, [bucket, search, location?.id]);

  function toggle(id: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function selectVisible() {
    setSelected((current) => { const next = new Set(current); const allSelected = items.length > 0 && items.every((item) => next.has(item.id)); items.forEach((item) => allSelected ? next.delete(item.id) : next.add(item.id)); return next; });
  }
  function createOrder() {
    if (!location || !selectedItems.length || !orderAllowed) return;
    onCreatePurchaseOrder({
      requestId: `${Date.now()}-${selectedItems.map((item) => item.id).sort().join('-')}`,
      locationId: location.id,
      locationName: location.displayName,
      items: selectedItems.map((item) => ({ stockItemId: item.id, name: item.name, suggestedOrderQuantity: item.suggestedOrderQuantity }))
    });
  }

  return <div className="screen low-stock-screen">
    <header className="operation-hero low-stock-hero">
      <span className="operation-hero-icon"><PackageSearch size={27} /></span>
      <p className="eyebrow">Stock intelligence</p>
      <h1>Low-stock action</h1>
      <p>Review shortages, check the live stock record and prepare a supplier-independent order.</p>
      <button className="location-pill" type="button" onClick={onLocation}><MapPin size={15} /><span>{location?.displayName || 'Choose a location'}</span><ChevronRight size={15} /></button>
    </header>

    {!location && <button className="empty-action low-stock-location-action" type="button" onClick={onLocation}><MapPin size={24} /><strong>Choose a location</strong><span>Low stock is always calculated for one authorised location.</span></button>}
    {location && !connected && <div className="sync-state is-offline"><CloudOff size={17} /> Read-only offline snapshot{snapshotAt ? ` · saved ${formatDateTime(snapshotAt)}` : ''}</div>}
    {error && <div className="message message-error operation-message" role="alert">{error}</div>}

    {location && loading && !response
      ? <div className="operation-loading"><LoaderCircle className="spin" /> Loading low-stock intelligence…</div>
      : location && response && <>
        <section className="low-stock-summary">
          <div><span>Low-stock items</span><strong>{response.counts.total}</strong></div>
          <div className="is-danger"><span>Out of stock</span><strong>{response.counts.outOfStock}</strong></div>
          <div className="is-warning"><span>Below par</span><strong>{response.counts.belowPar}</strong></div>
          <button type="button" onClick={() => void reload(undefined, true)} disabled={!connected || refreshing} aria-label="Refresh low stock"><RefreshCw className={refreshing ? 'spin' : ''} size={18} /></button>
        </section>
        <label className="count-search low-stock-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Item, SKU, barcode or category" /></label>
        <div className="count-bucket-tabs low-stock-tabs">
          <button className={bucket === 'out_of_stock' ? 'is-active is-danger' : ''} type="button" onClick={() => setBucket('out_of_stock')}>Out of stock <strong>{response.counts.outOfStock}</strong></button>
          <button className={bucket === 'below_par' ? 'is-active' : ''} type="button" onClick={() => setBucket('below_par')}>Below par <strong>{response.counts.belowPar}</strong></button>
        </div>
        <div className="low-stock-list-tools"><span>{items.length} item{items.length === 1 ? '' : 's'}</span><button type="button" onClick={selectVisible} disabled={!items.length}>{items.length && items.every((item) => selected.has(item.id)) ? 'Clear visible' : 'Select visible'}</button></div>
        <section className="low-stock-list">
          {visibleItems.map((item) => <LowStockCard key={item.id} item={item} checked={selected.has(item.id)} onToggle={() => toggle(item.id)} onLookup={() => onLookup(toLookupSeed(item))} />)}
          {visibleItems.length < items.length && <button className="button button-secondary long-list-more" type="button" onClick={() => setVisibleLimit((value) => value + 100)}>Show 100 more <span>({items.length - visibleItems.length} remaining)</span></button>}
          {!items.length && <div className="transfer-empty"><PackageCheck size={23} /> No items match this bucket and search.</div>}
        </section>
      </>}

    {!!selectedItems.length && <div className="low-stock-order-bar"><div><strong>{selectedItems.length}</strong><span>selected</span></div><button className="button button-primary" type="button" disabled={!orderAllowed} onClick={createOrder}><ShoppingCart size={18} /> Start purchase order</button>{!canCreatePurchaseOrder && <small>Purchase-order permission required</small>}{!connected && <small>Reconnect to create the draft</small>}</div>}
  </div>;
}

function LowStockCard({ item, checked, onToggle, onLookup }: { item: LowStockItem; checked: boolean; onToggle: () => void; onLookup: () => void }) {
  return <article className={`low-stock-card ${item.status === 'out_of_stock' ? 'is-out' : ''} ${checked ? 'is-selected' : ''}`}>
    <header><button className="low-stock-check" type="button" onClick={onToggle} aria-label={`${checked ? 'Remove' : 'Select'} ${item.name}`} aria-pressed={checked}>{checked ? <Check size={17} /> : null}</button><div><strong>{item.name}</strong><small>{[item.sku, item.category].filter(Boolean).join(' · ') || 'Uncategorised'}</small></div><span>{item.status === 'out_of_stock' ? 'Out' : 'Low'}</span></header>
    <div className="low-stock-levels"><div><span>Current</span><strong>{quantity(item.currentQuantity)} {item.baseUom}</strong></div><div><span>Threshold</span><strong>{quantity(item.threshold)} {item.baseUom}</strong></div><div><span>Par level</span><strong>{quantity(item.parLevel)} {item.baseUom}</strong></div></div>
    <div className="low-stock-suggestion"><ShoppingCart size={17} /><span>Suggested order</span><strong>{quantity(item.suggestedOrderQuantity)} {item.purchaseUom}</strong><small>{quantity(item.shortageQuantity)} {item.baseUom} needed</small></div>
    <button className="low-stock-lookup" type="button" onClick={onLookup}><Barcode size={16} /> Open Stock Lookup <ChevronRight size={15} /></button>
  </article>;
}

function toLookupSeed(item: LowStockItem): StockLookupSeed {
  return { id: item.id, name: item.name, sku: item.sku, category: item.category, baseUom: item.baseUom, trackInventory: true, onHand: item.currentQuantity, uoms: item.uoms, barcodes: item.barcodes };
}
function normalize(value: unknown) { return String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function quantity(value: number) { return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 3 }).format(Number(value || 0)); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(date); }
function message(cause: unknown, fallback: string) { if (cause instanceof ApiError && cause.message) return cause.message; return cause instanceof Error && cause.message ? cause.message : fallback; }
