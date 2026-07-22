import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OperationalLocationPicker } from './OperationalLocationPicker';

const locations = [
  { id: 'loc-1', name: 'Main Kitchen', kind: 'selling', isDefault: true },
  { id: 'loc-2', name: 'Prep Kitchen', kind: 'production' }
];

describe('OperationalLocationPicker', () => {
  it('shows permitted options, selection state and excludes blocked locations', () => {
    const onSelect = vi.fn();
    render(<OperationalLocationPicker open title="Choose destination" locations={locations} selectedId="loc-2" excludedIds={['loc-1']} onSelect={onSelect} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Select Main Kitchen' })).not.toBeInTheDocument();
    const prep = screen.getByRole('button', { name: 'Select Prep Kitchen' });
    expect(prep).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(prep);
    expect(onSelect).toHaveBeenCalledWith(locations[1]);
  });

  it('closes on Escape and returns focus to the opening control', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<><button type="button">Open picker</button><OperationalLocationPicker open={false} title="Choose source" locations={locations} onSelect={vi.fn()} onClose={onClose} /></>);
    const opener = screen.getByRole('button', { name: 'Open picker' });
    opener.focus();
    rerender(<><button type="button">Open picker</button><OperationalLocationPicker open title="Choose source" locations={locations} onSelect={vi.fn()} onClose={onClose} /></>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Select Main Kitchen' })).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<><button type="button">Open picker</button><OperationalLocationPicker open={false} title="Choose source" locations={locations} onSelect={vi.fn()} onClose={onClose} /></>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open picker' })).toHaveFocus());
  });

  it('adds search for long location lists and filters by name or type', async () => {
    const many = [...locations, ...Array.from({ length: 5 }, (_, index) => ({ id: `store-${index}`, name: `Store ${index}`, kind: 'storage' }))];
    render(<OperationalLocationPicker open title="Choose source" locations={many} onSelect={vi.fn()} onClose={vi.fn()} />);
    const search = screen.getByRole('textbox', { name: 'Search locations' });
    await waitFor(() => expect(search).toHaveFocus());
    fireEvent.change(search, { target: { value: 'production' } });
    expect(screen.getByRole('button', { name: 'Select Prep Kitchen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Main Kitchen' })).not.toBeInTheDocument();
  });

  it('contains keyboard focus and dismisses from the backdrop', async () => {
    const onClose = vi.fn();
    const { container } = render(<OperationalLocationPicker open title="Choose destination" locations={locations} onSelect={vi.fn()} onClose={onClose} />);
    const close = screen.getByRole('button', { name: 'Close location selection' });
    const last = screen.getByRole('button', { name: 'Select Prep Kitchen' });
    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.mouseDown(container.querySelector('.sheet-backdrop')!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
