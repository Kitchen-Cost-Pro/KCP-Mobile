import { Check } from 'lucide-react';
import type { QuickAccessRoute } from '../../core/navigation/quickAccess';

export type QuickAccessOption = {
  route: QuickAccessRoute;
  label: string;
};

type Props = {
  options: QuickAccessOption[];
  selected: QuickAccessRoute[];
  onToggle: (route: QuickAccessRoute) => void;
};

export function QuickAccessSettings({ options, selected, onToggle }: Props) {
  return (
    <section className="quick-access-settings" aria-labelledby="quick-access-heading">
      <header>
        <div><p className="settings-label">Navigation</p><h2 id="quick-access-heading">Bottom-bar shortcuts</h2></div>
        <span>{selected.length}/3</span>
      </header>
      <p>Choose your three fastest routes. Home and More always stay visible.</p>
      <div className="quick-access-grid">
        {options.map((option) => {
          const position = selected.indexOf(option.route);
          const active = position >= 0;
          return (
            <button
              className={active ? 'is-selected' : ''}
              type="button"
              key={option.route}
              aria-pressed={active}
              onClick={() => onToggle(option.route)}
            >
              <span>{active ? position + 1 : '+'}</span>
              <strong>{option.label}</strong>
              {active && <Check size={15} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
