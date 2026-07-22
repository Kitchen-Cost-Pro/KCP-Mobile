import { describe, expect, it } from 'vitest';
import { resolveWorkspaceOptions } from './workspaces';

describe('resolveWorkspaceOptions', () => {
  it('normalizes and sorts the existing KCP profile workspace map', () => {
    expect(resolveWorkspaceOptions({
      workspaces: {
        'ws-two': { role: 'prep', siteName: 'Zulu Kitchen' },
        'ws-one': { role: 'stocktaker', siteName: 'Alpha Store' }
      }
    })).toEqual([
      { id: 'ws-one', role: 'stocktaker', siteName: 'Alpha Store' },
      { id: 'ws-two', role: 'prep', siteName: 'Zulu Kitchen' }
    ]);
  });

  it('supports the legacy single workspace profile shape', () => {
    expect(resolveWorkspaceOptions({ workspaceId: 'ws-one', role: 'manager', siteName: 'Main Site' }))
      .toEqual([{ id: 'ws-one', role: 'manager', siteName: 'Main Site' }]);
  });
});
