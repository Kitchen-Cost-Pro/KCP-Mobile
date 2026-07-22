import { useCallback, useEffect, useState } from 'react';
import { Barcode, CheckCircle2, ChevronRight, CloudOff, LoaderCircle, MapPin, PackageSearch, ScanBarcode, Search, ShieldCheck } from 'lucide-react';
import { ApiError } from '../../core/api/client';
import { useConnectivity } from '../../hooks/useConnectivity';
import type { KcpLocation } from '../../types/kcp';
import { scanBarcodeWithDevice } from '../wastage/nativeBarcodeScanner';
import { lookupBarcode, searchWastageItems, type BarcodeLookupResult, type WastageSearchItem } from '../wastage/wastageApi';

type Props = {
  workspaceId: string;
  location: KcpLocation | null;
  onLocation: () => void;
  initialItem?: StockLookupSeed | null;
};

export type StockLookupSeed = WastageSearchItem & { barcodes?: string[] };

export function StockLookupScreen({ workspaceId, location, onLocation, initialItem = null }: Props) {
  const connected = useConnectivity();
  const [barcode, setBarcode] = useState('');
  const [search, setSearch] = useState('');
  const [lookup, setLookup] = useState<BarcodeLookupResult | null>(null);
  const [results, setResults] = useState<WastageSearchItem[]>([]);
  const [selected, setSelected] = useState<WastageSearchItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!initialItem) return;
    setSelected(initialItem);
    setLookup(null);
    setResults([]);
    setSearch('');
    setBarcode('');
    setError('');
    setNotice(`${initialItem.name} opened from low-stock intelligence.`);
  }, [initialItem]);

  const run = useCallback(async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); } catch (cause) { setError(message(cause, fallback)); } finally { setBusy(false); }
  }, []);

  const resolve = useCallback(async (value: string) => {
    if (!connected) throw new Error('Reconnect before looking up stock.');
    if (!location) throw new Error('Choose a location before scanning stock.');
    const clean = value.trim();
    if (!clean) throw new Error('Enter or scan a barcode first.');
    const response = await lookupBarcode(workspaceId, clean, location.id);
    setBarcode(response.barcode);
    setLookup(response);
    setSelected(null);
    setResults([]);
    if (!response.matched) {
      if (response.reason === 'ambiguous') {
        const names = (response.candidates || []).map((candidate) => candidate.name).join(', ');
        throw new Error(`This barcode is ambiguous${names ? `: ${names}` : ''}. Correct it in KCP before using it.`);
      }
      throw new Error('No active KCP stock item matches that barcode. Nothing was created.');
    }
    const details = await searchWastageItems(workspaceId, response.barcode, location.id);
    setSelected(details.find((item) => item.id === response.item?.id) || null);
    setNotice(`${response.item?.name || 'Stock item'} matched successfully.`);
  }, [connected, location, workspaceId]);

  const scan = () => void run(async () => resolve(await scanBarcodeWithDevice()), 'The barcode could not be scanned.');
  const submitBarcode = (event: React.FormEvent) => { event.preventDefault(); void run(() => resolve(barcode), 'The barcode could not be resolved.'); };
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!connected) throw new Error('Reconnect before searching KCP stock.');
      if (!location) throw new Error('Choose a location before searching stock.');
      if (search.trim().length < 2) throw new Error('Enter at least two characters to search.');
      const items = await searchWastageItems(workspaceId, search.trim(), location.id);
      setResults(items);
      setLookup(null);
      setSelected(null);
      if (!items.length) setNotice('No active stocked items match that search.');
    }, 'Could not search KCP stock items.');
  };

  const foundItem = lookup?.matched ? lookup.item : selected;
  const stockDetail = selected?.id === foundItem?.id ? selected : null;

  return (
    <div className="screen lookup-screen">
      <header className="operation-hero lookup-hero">
        <span className="operation-hero-icon"><ScanBarcode size={28} /></span>
        <p className="eyebrow">Stock tools</p>
        <h1>Stock lookup</h1>
        <p>Resolve a barcode exactly or find an inventory item by name, SKU or category.</p>
        <button className="location-pill" type="button" onClick={onLocation}><MapPin size={15} /><span>{location?.displayName || 'Choose a location'}</span><ChevronRight size={15} /></button>
      </header>

      {!connected && <div className="sync-state is-offline"><CloudOff size={17} /> Reconnect to search the live KCP catalogue.</div>}
      {error && <div className="message message-error operation-message" role="alert">{error}</div>}
      {notice && <div className="message message-success operation-message" role="status">{notice}</div>}

      <section className="lookup-actions">
        <button className="scan-action" type="button" disabled={busy || !connected || !location} onClick={scan}>
          <span><ScanBarcode size={27} /></span><div><strong>Scan barcode</strong><small>Open the native camera scanner</small></div>{busy ? <LoaderCircle className="spin" size={20} /> : <ChevronRight size={20} />}
        </button>
        <form className="manual-barcode-form" onSubmit={submitBarcode}><label className="input-shell"><Barcode size={18} /><input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Enter barcode manually" inputMode="numeric" autoCapitalize="off" /><button className="input-inline-button" type="submit" disabled={busy || !connected}>Look up</button></label></form>
        <div className="lookup-divider"><span>or search the catalogue</span></div>
        <form className="item-search-panel lookup-search" onSubmit={submitSearch}>
          <label className="input-shell"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Item name, SKU or category" /><button className="input-inline-button" type="submit" disabled={busy || !connected}>Search</button></label>
          {results.length > 0 && <div className="item-search-results">{results.map((item) => <button type="button" key={item.id} onClick={() => { setSelected(item); setResults([]); setNotice(`${item.name} selected.`); }}><PackageSearch size={18} /><span><strong>{item.name}</strong><small>{[item.sku, item.category, item.baseUom].filter(Boolean).join(' · ')}</small></span><ChevronRight size={17} /></button>)}</div>}
        </form>
      </section>

      {foundItem && (
        <section className="lookup-result-card">
          <span className="lookup-result-icon"><CheckCircle2 size={27} /></span>
          <p className="eyebrow">Exact KCP result</p>
          <h2>{foundItem.name}</h2>
          <div className="lookup-facts">
            <div><span>SKU</span><strong>{foundItem.sku || 'Not set'}</strong></div>
            <div><span>Category</span><strong>{foundItem.category || 'Uncategorised'}</strong></div>
            <div><span>Base unit</span><strong>{foundItem.baseUom}</strong></div>
            <div><span>Inventory</span><strong>{foundItem.trackInventory ? 'Tracked' : 'Not tracked'}</strong></div>
            {stockDetail && <div className="wide"><span>On hand at {location?.displayName || 'location'}</span><strong>{formatQuantity(stockDetail.onHand)} {foundItem.baseUom}</strong></div>}
            {lookup?.barcodeMatch && <div className="wide"><span>Barcode matched</span><strong>{lookup.barcodeMatch.uomName}{lookup.barcodeMatch.quantityInBase !== 1 ? ` × ${formatQuantity(lookup.barcodeMatch.quantityInBase)} ${foundItem.baseUom}` : ''}</strong></div>}
          </div>
          {stockDetail && stockDetail.uoms.length > 1 && <div className="lookup-uoms"><span>Available units</span><p>{stockDetail.uoms.map((uom) => `${uom.name}${uom.isBase ? '' : ` × ${formatQuantity(uom.quantityInBase)}`}`).join(' · ')}</p></div>}
          <p className="foundation-note"><ShieldCheck size={16} /> Lookup is read-only. Unknown barcodes never create catalogue records.</p>
        </section>
      )}
    </div>
  );
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function message(cause: unknown, fallback: string) {
  if (cause instanceof ApiError && cause.message) return cause.message;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
