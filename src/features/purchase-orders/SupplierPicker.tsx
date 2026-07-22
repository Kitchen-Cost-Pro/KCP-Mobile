import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Search, X } from 'lucide-react';
import type { PurchaseOrderSupplier } from './purchaseOrderApi';

export function SupplierPicker(props: { open: boolean; suppliers: PurchaseOrderSupplier[]; selectedId: string; onSelect: (supplier: PurchaseOrderSupplier) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (props.open) setQuery(''); }, [props.open]);
  useEffect(() => { if (!props.open) return; const escape = (event: KeyboardEvent) => event.key === 'Escape' && props.onClose(); document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, [props]);
  const filtered = useMemo(() => props.suppliers.filter((supplier) => `${supplier.name} ${supplier.email}`.toLowerCase().includes(query.trim().toLowerCase())), [props.suppliers, query]);
  if (!props.open) return null;
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}><section className="bottom-sheet operational-location-sheet" role="dialog" aria-modal="true" aria-label="Choose supplier"><div className="sheet-handle" /><header className="sheet-header"><div><p className="eyebrow">Purchase order</p><h2>Choose supplier</h2></div><button className="icon-button" type="button" onClick={props.onClose} aria-label="Close supplier selection"><X size={20} /></button></header><label className="input-shell operational-location-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search suppliers" aria-label="Search suppliers" /></label><div className="operational-location-list">{filtered.map((supplier) => <button className={`operational-location-option ${props.selectedId === supplier.id ? 'is-active' : ''}`} type="button" key={supplier.id} onClick={() => { props.onSelect(supplier); props.onClose(); }}><span className="operational-location-icon"><Building2 size={20} /></span><span><strong>{supplier.name}</strong><small>{supplier.email || supplier.category || 'KCP supplier'}</small></span>{props.selectedId === supplier.id && <Check size={20} />}</button>)}{!filtered.length && <div className="empty-inline">No active suppliers match that search.</div>}</div></section></div>;
}
