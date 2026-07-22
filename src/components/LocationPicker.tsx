import { Check, MapPin, X } from 'lucide-react';
import type { KcpLocation } from '../types/kcp';

type Props = {
  open: boolean;
  locations: KcpLocation[];
  selected: KcpLocation | null;
  onSelect: (location: KcpLocation) => void;
  onClose: () => void;
};

export function LocationPicker({ open, locations, selected, onSelect, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="location-title">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div><p className="eyebrow">Current workspace</p><h2 id="location-title">Choose location</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close location picker"><X size={20} /></button>
        </header>
        <div className="sheet-list">
          {locations.map((location) => {
            const active = selected?.id === location.id;
            return (
              <button className={`sheet-option ${active ? 'is-active' : ''}`} type="button" key={location.id} onClick={() => onSelect(location)}>
                <span className="workspace-icon"><MapPin size={20} /></span>
                <span><strong>{location.displayName}</strong><small>{location.kind || 'KCP location'}</small></span>
                {active && <Check size={20} />}
              </button>
            );
          })}
          {!locations.length && <div className="empty-inline">No accessible locations are assigned to this account.</div>}
        </div>
      </section>
    </div>
  );
}
