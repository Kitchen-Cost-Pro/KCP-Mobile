import { describe, expect, it } from 'vitest';
import { parseQuickAccess, reconcileQuickAccess, toggleQuickAccess, type QuickAccessRoute } from './quickAccess';

const available: QuickAccessRoute[] = ['tasks', 'approvals', 'stock-takes', 'transfers'];

describe('quick access navigation', () => {
  it('keeps saved choices in order and fills missing slots from accessible routes', () => {
    expect(reconcileQuickAccess(['transfers', 'not-a-route'], available)).toEqual(['transfers', 'tasks', 'approvals']);
  });

  it('drops choices that are no longer permitted', () => {
    expect(reconcileQuickAccess(['wastage', 'tasks', 'approvals'], ['tasks', 'stock-takes'])).toEqual(['tasks', 'stock-takes']);
  });

  it('replaces the oldest shortcut when a fourth choice is selected', () => {
    expect(toggleQuickAccess(['tasks', 'approvals', 'stock-takes'], 'transfers')).toEqual(['approvals', 'stock-takes', 'transfers']);
  });

  it('keeps an already-selected shortcut in place', () => {
    expect(toggleQuickAccess(['tasks', 'approvals', 'stock-takes'], 'approvals')).toEqual(['tasks', 'approvals', 'stock-takes']);
  });

  it('safely parses persisted settings', () => {
    expect(parseQuickAccess('["tasks","approvals"]')).toEqual(['tasks', 'approvals']);
    expect(parseQuickAccess('{broken')).toEqual([]);
  });
});
