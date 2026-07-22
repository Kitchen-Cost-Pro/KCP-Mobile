import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, MapPin, Search, X } from 'lucide-react';

export type OperationalLocationOption = {
  id: string;
  name: string;
  kind?: string;
  isDefault?: boolean;
};

type Props = {
  open: boolean;
  title: string;
  eyebrow?: string;
  locations: OperationalLocationOption[];
  selectedId?: string;
  excludedIds?: string[];
  onSelect: (location: OperationalLocationOption) => boolean | void;
  onClose: () => void;
};

export function OperationalLocationPicker({
  open,
  title,
  eyebrow = 'Transfer route',
  locations,
  selectedId = '',
  excludedIds = [],
  onSelect,
  onClose
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);
  const available = useMemo(() => locations.filter((location) => !excluded.has(location.id)), [excluded, locations]);
  const filtered = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase();
    if (!clean) return available;
    return available.filter((location) => `${location.name} ${location.kind || ''}`.toLocaleLowerCase().includes(clean));
  }, [available, query]);
  const searchable = locations.length > 6;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      if (searchable) searchRef.current?.focus();
      else (dialogRef.current?.querySelector<HTMLElement>('.operational-location-option') || dialogRef.current?.querySelector<HTMLElement>('button'))?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose, open, searchable]);

  if (!open) return null;

  const select = (location: OperationalLocationOption) => {
    if (onSelect(location) !== false) onClose();
  };

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="bottom-sheet operational-location-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close location selection"><X size={20} /></button>
        </header>
        {searchable && <label className="input-shell operational-location-search"><Search size={18} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search locations" aria-label="Search locations" /></label>}
        <div className="operational-location-list">
          {filtered.map((location) => {
            const active = selectedId === location.id;
            return (
              <button className={`operational-location-option ${active ? 'is-active' : ''}`} type="button" key={location.id} onClick={() => select(location)} aria-pressed={active} aria-label={`Select ${location.name}`}>
                <span className="operational-location-icon"><MapPin size={20} /></span>
                <span><strong>{location.name}</strong><small>{location.kind || 'KCP location'}{location.isDefault ? ' · Default' : ''}</small></span>
                {active && <Check size={20} />}
              </button>
            );
          })}
          {!filtered.length && <div className="empty-inline">No permitted locations match that search.</div>}
        </div>
      </section>
    </div>
  );
}
